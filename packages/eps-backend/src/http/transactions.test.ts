import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { Config } from "../config";
import type { TransactionRow } from "../types";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";
import { mountTransactions } from "./transactions";

const foundProfile = {
	name: "Jane",
	email: "jane@example.com",
	mobile: "9990000001",
	code: 1,
	userType: "23",
	ekoUserId: "eko-1",
	roleList: [],
	orgId: 42,
	onboarding: 0,
	zohoId: "zoho-1",
	onboardingSteps: [],
};

/** One fixture row; the route only ever passes these through. */
function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
	return {
		tid: "1",
		tx_typeid: 1,
		tx_name: "Digi Khata Load Wallet",
		amount_dr: 100,
		amount_cr: 0,
		fee: 0,
		commission_earned: 0,
		bonus: 0,
		tds: 0,
		gst: 0,
		insurance_amount: 0,
		eko_service_charge: 0,
		eko_gst: 0,
		r_bal: 500,
		status: "Success",
		response_status_id: 0,
		datetime: "2026-04-16 11:49:00",
		...overrides,
	};
}

/** Config double; mock mode on unless a test says otherwise. */
function cfgStub(transactionsMock = true): Config {
	return { eko: { defaultOrgId: 1, transactionsMock } } as unknown as Config;
}

/** Builds an app with a session double that returns `role` for any cookie. */
function harness(
	role: string | null,
	overrides: {
		eko?: Partial<EkoClient>;
		cfg?: Config;
	} = {},
) {
	const app = new Hono<AppEnv>();
	// Mirrors app.ts's onError so status/code assertions match production.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as never);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});
	const sessions = {
		verifyAccess: vi
			.fn()
			.mockResolvedValue(role ? { sub: "9990000001", role, orgId: 1 } : null),
	} as unknown as Sessions;
	const eko = {
		getProfile: vi.fn().mockResolvedValue({
			kind: "found",
			responseTypeId: 1,
			profile: foundProfile,
		}),
		getTransactionHistory: vi.fn().mockResolvedValue({ rows: [row()] }),
		...overrides.eko,
	} as unknown as EkoClient;
	mountTransactions(app, { sessions, eko, cfg: overrides.cfg ?? cfgStub() });
	return { app, eko };
}

const withCookie = { headers: { Cookie: "eps_at=token" } };

/** POSTs a search body with the session cookie attached. */
async function search(app: Hono<AppEnv>, body: unknown): Promise<Response> {
	return app.request("/transactions/search", {
		method: "POST",
		headers: { ...withCookie.headers, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

/** The parsed error envelope of a failed response. */
async function errorOf(res: Response): Promise<{ code: string }> {
	const body = (await res.json()) as { error: { code: string } };
	return body.error;
}

/** The parsed success body of a search response. */
async function viewOf(res: Response): Promise<{
	rows: TransactionRow[];
	startIndex: number;
	limit: number;
	hasNext: boolean;
}> {
	return (await res.json()) as {
		rows: TransactionRow[];
		startIndex: number;
		limit: number;
		hasNext: boolean;
	};
}

describe("transactions route gate", () => {
	it("401s without a session cookie", async () => {
		const { app } = harness(null);
		const res = await app.request("/transactions/search", { method: "POST" });
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});

	it("403s a signup session — onboarding isn't finished", async () => {
		const { app } = harness("signup");
		const res = await search(app, {});
		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("403s an admin session", async () => {
		const { app } = harness("admin");
		expect((await search(app, {})).status).toBe(403);
	});

	it("403s when the profile is not a found EPS business account", async () => {
		const { app } = harness("developer", {
			eko: {
				getProfile: vi.fn().mockResolvedValue({
					kind: "onboarding",
					responseTypeId: 1,
					profile: foundProfile,
				}),
			},
		});
		const res = await search(app, {});
		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NO_PROFILE");
	});
});

describe("transactions search", () => {
	it("returns rows with the paging window for a developer", async () => {
		const { app } = harness("developer");
		const res = await search(app, {});
		expect(res.status).toBe(200);
		const body = await viewOf(res);
		expect(body.rows).toHaveLength(1);
		expect(body.startIndex).toBe(0);
		expect(body.limit).toBe(25);
	});

	it("forwards the caller's own identity from their profile", async () => {
		const { app, eko } = harness("developer");
		await search(app, {});
		// initiator_id is the caller's MOBILE, not their ekoUserId ("eko-1") —
		// mirrors connect-api, where the 151 claim's user_id IS detail.mobile and
		// every interaction sends initiator_id = tokenDetails.user_id. Sending the
		// internal id earns a 403 "Invalid Sender/Initiator" from upstream.
		expect(eko.getTransactionHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				identity: { initiatorId: "9990000001", userCode: "1", orgId: 42 },
			}),
		);
	});

	it("offers a next page only when the page came back full", async () => {
		const full = Array.from({ length: 25 }, () => row());
		const { app } = harness("developer", {
			eko: { getTransactionHistory: vi.fn().mockResolvedValue({ rows: full }) },
		});
		expect((await viewOf(await search(app, {}))).hasNext).toBe(true);

		const { app: partial } = harness("developer");
		expect((await viewOf(await search(partial, {}))).hasNext).toBe(false);
	});

	it("passes allow-listed filters through", async () => {
		const { app, eko } = harness("developer");
		await search(app, {
			filters: { tid: "2886973933", customer_mobile: "9876543210" },
		});
		expect(eko.getTransactionHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				filters: { tid: "2886973933", customer_mobile: "9876543210" },
			}),
		);
	});

	it("never forwards an unknown filter key upstream", async () => {
		const { app, eko } = harness("developer");
		await search(app, {
			filters: { tid: "123", org_id: "666", interaction_type_id: "515" },
		});
		const { filters } = vi.mocked(eko.getTransactionHistory).mock.calls[0][0];
		expect(filters).toEqual({ tid: "123" });
		expect(filters).not.toHaveProperty("org_id");
		expect(filters).not.toHaveProperty("interaction_type_id");
	});

	it("400s a malformed filter rather than passing it upstream", async () => {
		const { app, eko } = harness("developer");
		const res = await search(app, { filters: { customer_mobile: "12" } });
		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
		expect(eko.getTransactionHistory).not.toHaveBeenCalled();
	});

	it("drops empty filter values instead of sending blanks", async () => {
		const { app, eko } = harness("developer");
		await search(app, { filters: { tid: "", account: "   " } });
		expect(
			vi.mocked(eko.getTransactionHistory).mock.calls[0][0].filters,
		).toEqual({});
	});

	it("clamps an oversized limit and a negative start index", async () => {
		const { app, eko } = harness("developer");
		await search(app, { limit: 9999, start_index: -5 });
		expect(eko.getTransactionHistory).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 25, startIndex: 0 }),
		);
	});

	it("honours a smaller page window", async () => {
		const { app, eko } = harness("developer");
		await search(app, { limit: 10, start_index: 50 });
		expect(eko.getTransactionHistory).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 10, startIndex: 50 }),
		);
	});

	it("501s instead of calling upstream when mock is off and account_id is unresolved", async () => {
		// Guards the known gap: account_id has no source yet, so a live call could
		// only fail as a confusing 502. See docs §Unverified.
		const { app, eko } = harness("developer", { cfg: cfgStub(false) });
		const res = await search(app, {});
		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("NOT_WIRED");
		expect(eko.getTransactionHistory).not.toHaveBeenCalled();
	});
});
