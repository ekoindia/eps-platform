import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider } from "../auth/provider";
import type { Sessions } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import { createInMemoryKV, type KV } from "../store/kv";
import {
	SAMPLE_DASHBOARD_OBJECT,
	SAMPLE_SERVICE_LIST,
} from "./dashboard.sample";
import { mountDashboard } from "./dashboard";
import { DATASETS, type DashboardView } from "./dashboardView";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";

const upstream = {
	accessToken: "full-token",
	accessTokenLite: "lite",
	accessExpiresAt: Date.now() + 60_000,
};

/** A successful interaction-682 envelope wrapping the synthetic sample. */
function envelope(dashboardObject: unknown = SAMPLE_DASHBOARD_OBJECT) {
	return {
		status: 0,
		message: "ok",
		data: { dashboard_object: dashboardObject },
	};
}

/**
 * Builds an app with session, auth and connect doubles.
 * @param opts.role - Session role, or null for "no session".
 * @param opts.connect - Connect client overrides; `null` drops the client
 *   entirely, which is how the `eko` provider looks to this route.
 */
function harness(
	opts: {
		role?: string | null;
		sid?: string | null;
		connect?: Partial<ConnectClient> | null;
		upstreamSession?: unknown;
		kv?: KV;
	} = {},
) {
	const role = opts.role === undefined ? "developer" : opts.role;
	const sid = opts.sid === undefined ? "sid-1" : opts.sid;
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
			.mockResolvedValue(
				role
					? { sub: "9990000001", role, orgId: 1, sid: sid ?? undefined }
					: null,
			),
	} as unknown as Sessions;

	const auth = {
		name: "connect",
		getUpstream: vi
			.fn()
			.mockResolvedValue(
				opts.upstreamSession === undefined ? upstream : opts.upstreamSession,
			),
	} as unknown as AuthProvider;

	// Parameters are declared so `mock.calls[n][1]` stays typed as the body.
	const interactJson = vi.fn(
		async (_token: string, _body: Record<string, unknown>) => envelope(),
	);
	const interact = vi.fn(
		async (_token: string, _body: Record<string, unknown>) =>
			SAMPLE_SERVICE_LIST,
	);
	const connect =
		opts.connect === null
			? undefined
			: ({
					interact,
					interactJson,
					...opts.connect,
				} as unknown as ConnectClient);

	mountDashboard(app, {
		sessions,
		auth,
		connect,
		kv: opts.kv ?? createInMemoryKV(),
		connectBaseUrl: "https://api.beta.ekoconnect.in",
	});
	return { app, interactJson, interact, connect };
}

/** POSTs a dashboard body with the session cookie attached. */
async function load(app: Hono<AppEnv>, body: unknown = { preset: "last7" }) {
	return app.request("/dashboard", {
		method: "POST",
		headers: { Cookie: "eps_at=token", "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

/** The parsed error envelope of a failed response. */
async function errorOf(res: Response): Promise<{ code: string }> {
	return ((await res.json()) as { error: { code: string } }).error;
}

describe("dashboard route gate", () => {
	it("401s without a session cookie", async () => {
		const { app } = harness({ role: null });
		const res = await app.request("/dashboard", { method: "POST" });
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ role: "signup" });
		const res = await load(app);
		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("501s under the eko provider, which has no upstream client", async () => {
		const { app } = harness({ connect: null });
		const res = await load(app);
		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("DASHBOARD_UNAVAILABLE");
	});

	it("501s for a developer session minted without a sealed upstream session", async () => {
		const { app } = harness({ sid: null });
		const res = await load(app);
		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("DASHBOARD_UNAVAILABLE");
	});

	it("401s once the sealed upstream session has aged out", async () => {
		const { app } = harness({ upstreamSession: null });
		const res = await load(app);
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("CONNECT_SESSION_EXPIRED");
	});
});

describe("dashboard route input", () => {
	it("400s an unknown preset", async () => {
		const { app } = harness();
		const res = await load(app, { preset: "lastYear" });
		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
	});

	it("400s a typeId that is not a known service", async () => {
		const { app } = harness();
		const res = await load(app, { preset: "last7", typeId: "999" });
		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
	});

	it("400s a malformed typeId", async () => {
		const { app } = harness();
		const res = await load(app, { preset: "last7", typeId: "81; DROP" });
		expect(res.status).toBe(400);
	});

	it("asks for one dataset per call, never four keys in one payload", async () => {
		// Upstream answers only some keys when they share a payload, which is what
		// left Most Used Services and Usage Analytics blank. Eloka sends one per
		// call; so do we.
		const { app, interactJson } = harness();
		await load(app);
		expect(interactJson).toHaveBeenCalledTimes(DATASETS.length);
		const keys = interactJson.mock.calls.map((call) =>
			Object.keys(call[1].requestPayload as Record<string, unknown>),
		);
		expect(keys.every((k) => k.length === 1)).toBe(true);
		expect(keys.flat().sort()).toEqual(
			DATASETS.map((d) => d.request)
				.slice()
				.sort(),
		);
	});

	it("forwards a known typeId on the per-service datasets only", async () => {
		const { app, interactJson } = harness();
		await load(app, { preset: "last7", typeId: "81" });
		const typeIdFor = (request: string) => {
			const call = interactJson.mock.calls.find(
				(c) => request in (c[1].requestPayload as Record<string, unknown>),
			);
			const payload = (call?.[1].requestPayload as Record<string, unknown>)[
				request
			] as Record<string, string>;
			return payload.typeid;
		};
		expect(typeIdFor("products_overview")).toBe("81");
		expect(typeIdFor("most_used_services")).toBe("81");
		expect(typeIdFor("success_rate")).toBeUndefined();
		expect(typeIdFor("verification_trends")).toBeUndefined();
	});

	it("ignores a browser-supplied date window and sends its own", async () => {
		const { app, interactJson } = harness();
		await load(app, {
			preset: "yesterday",
			datefrom: "1999-01-01 00:00:00",
			dateto: "2030-01-01 00:00:00",
		});
		const payload = interactJson.mock.calls[0][1].requestPayload as Record<
			string,
			Record<string, string>
		>;
		expect(payload.products_overview.datefrom).not.toContain("1999");
		expect(payload.products_overview.dateto).toMatch(/ 23:59:59$/);
	});

	it("never lets the browser choose the client_ref_id", async () => {
		const { app, interactJson } = harness();
		await load(app, { preset: "today", client_ref_id: "replayed" });
		// The route forwards no ref at all — the connect client generates one per
		// call (clients/connect.test.ts covers that), so a browser-sent value has
		// nowhere to land and cannot be replayed.
		expect(interactJson.mock.calls[0][1]).not.toHaveProperty("client_ref_id");
	});
});

describe("dashboard route response", () => {
	it("returns the normalized view over interaction 682", async () => {
		const { app, interactJson } = harness();
		const res = await load(app);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		const view = (await res.json()) as DashboardView;
		expect(view.overview.transactions.value).toBe(939);
		expect(view.mostUsedServices[0].name).toBe("Accept Payment");
		expect(view.range.preset).toBe("last7");
		expect(interactJson.mock.calls[0][1].interaction_type_id).toBe(682);
	});

	it("502s when upstream reports a business failure", async () => {
		const { app } = harness({
			connect: {
				interactJson: vi.fn(async () => ({
					status: 1,
					message: "not allowed",
				})),
			},
		});
		const res = await load(app);
		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("DASHBOARD_FAILED");
	});

	it("still reads a dataset upstream returned under a renamed key", async () => {
		// Upstream's own naming is inconsistent (three keys convert snake→camel,
		// one does not), so a block arriving as `verification_trends` is a live
		// possibility — and it used to present as a silently blank widget.
		const { app } = harness({
			connect: {
				interactJson: vi.fn(
					async (_token: string, body: Record<string, unknown>) => {
						const key = Object.keys(
							body.requestPayload as Record<string, unknown>,
						)[0];
						if (key !== "verification_trends") {
							return {
								status: 0,
								data: { dashboard_object: SAMPLE_DASHBOARD_OBJECT },
							};
						}
						return {
							status: 0,
							data: {
								dashboard_object: {
									verification_trends: [
										{
											startDate: "2025-08-12",
											endDate: "2025-08-12",
											totalCount: 7,
										},
									],
								},
							},
						};
					},
				),
			},
		});
		const view = (await (await load(app)).json()) as DashboardView;
		expect(view.usage).toEqual([
			{ startDate: "2025-08-12", endDate: "2025-08-12", totalCount: 7 },
		]);
	});

	it("logs the raw shape and echo of whichever dataset came back dry", async () => {
		// The view is built from keys this service already recognizes, so the
		// merged shape alone can never show that upstream answered under a name
		// nobody asked for. This line is the only instrument that can.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { app } = harness({
			connect: {
				interactJson: vi.fn(
					async (_token: string, body: Record<string, unknown>) => {
						const key = Object.keys(
							body.requestPayload as Record<string, unknown>,
						)[0];
						return {
							status: 0,
							data: {
								user_code: "99027178",
								org_id: 3,
								source: "",
								dashboard_object:
									key === "verification_trends"
										? { somethingElse: { nested: 1 } }
										: SAMPLE_DASHBOARD_OBJECT,
							},
						};
					},
				),
			},
		});
		await load(app);
		const line =
			warn.mock.calls.map(String).find((c) => c.includes("raw=")) ?? "";
		expect(line).toContain("empty=[usage]");
		// The key upstream really sent, which the merged view cannot show.
		expect(line).toContain("verification_trends→{somethingElse:object{1}}");
		// Masked to its last four: enough to spot connect-api's mock account,
		// not a customer identifier in full.
		expect(line).toContain("user_code:…7178");
		expect(line).toContain("org_id:3");
		expect(line).not.toContain("99027178");
		// Only the dry dataset is reported, not the three that answered.
		expect(line).not.toContain("products_overview→");
		warn.mockRestore();
	});

	it("loses one widget, not the page, when a secondary dataset fails", async () => {
		// Splitting into four calls means four things that can fail independently.
		// Only the overview is worth a 502; the rest degrade to an empty widget.
		const { app } = harness({
			connect: {
				interactJson: vi.fn(
					async (_token: string, body: Record<string, unknown>) => {
						const key = Object.keys(
							body.requestPayload as Record<string, unknown>,
						)[0];
						if (key === "verification_trends") throw new Error("upstream blip");
						return {
							status: 0,
							data: { dashboard_object: SAMPLE_DASHBOARD_OBJECT },
						};
					},
				),
			},
		});
		const res = await load(app);
		expect(res.status).toBe(200);
		const view = (await res.json()) as DashboardView;
		expect(view.usage).toEqual([]);
		expect(view.overview.transactions.value).toBe(939);
	});

	it("502s when the overview dataset itself fails", async () => {
		const { app } = harness({
			connect: {
				interactJson: vi.fn(
					async (_token: string, body: Record<string, unknown>) => {
						const key = Object.keys(
							body.requestPayload as Record<string, unknown>,
						)[0];
						if (key === "products_overview") {
							return { status: 1, message: "not allowed" };
						}
						return {
							status: 0,
							data: { dashboard_object: SAMPLE_DASHBOARD_OBJECT },
						};
					},
				),
			},
		});
		const res = await load(app);
		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("DASHBOARD_FAILED");
	});

	it("still renders when the service-name list fails, with fallback names", async () => {
		const { app } = harness({
			connect: {
				interact: vi.fn(async () => Promise.reject(new Error("down"))),
			},
		});
		const res = await load(app);
		expect(res.status).toBe(200);
		const view = (await res.json()) as DashboardView;
		expect(view.services).toEqual([]);
		expect(view.mostUsedServices[0].name).toBe("Service 81");
	});

	it("accepts a typeId filter when the service list is unavailable", async () => {
		// The regex still bounds it; refusing here would turn a cosmetic outage
		// into a broken filter.
		const { app } = harness({
			connect: {
				interact: vi.fn(async () => Promise.reject(new Error("down"))),
			},
		});
		expect((await load(app, { preset: "last7", typeId: "81" })).status).toBe(
			200,
		);
	});

	it("runs the two upstream calls concurrently when there is no filter", async () => {
		// 1044 is held open; 682 must still have been sent. Sequential code would
		// be stuck waiting for the name list before starting the aggregate, and a
		// partner would wait for the sum of the two.
		let releaseServices = () => {};
		const held = new Promise<typeof SAMPLE_SERVICE_LIST>((resolve) => {
			releaseServices = () => resolve(SAMPLE_SERVICE_LIST);
		});
		const { app, interactJson } = harness({
			connect: { interact: vi.fn(async () => held) },
		});
		const pending = load(app);
		await vi.waitFor(() => expect(interactJson).toHaveBeenCalled());
		releaseServices();
		expect((await pending).status).toBe(200);
	});

	it("resolves the service list before forwarding a filter, not alongside it", async () => {
		// The mirror of the above: a typeId cannot go upstream until the list has
		// said it is real, so this path stays sequential on purpose.
		const { app, interactJson } = harness();
		const res = await load(app, { preset: "last7", typeId: "999" });
		expect(res.status).toBe(400);
		expect(interactJson).not.toHaveBeenCalled();
	});

	it("serves a repeat request from cache without calling upstream again", async () => {
		const { app, interactJson } = harness();
		await load(app);
		await load(app);
		// One window costs one round of dataset calls, however many that is.
		expect(interactJson).toHaveBeenCalledTimes(DATASETS.length);
	});

	it("does not share a cache entry across presets", async () => {
		const { app, interactJson } = harness();
		await load(app, { preset: "last7" });
		await load(app, { preset: "last30" });
		expect(interactJson).toHaveBeenCalledTimes(DATASETS.length * 2);
	});
});

describe("dashboard KV outage", () => {
	/** A KV whose cache reads/writes are dead but whose limiter still works. */
	function brokenCacheKv(): KV {
		const real = createInMemoryKV();
		return {
			...real,
			get: vi.fn().mockRejectedValue(new Error("store down")),
			set: vi.fn().mockRejectedValue(new Error("store down")),
		};
	}

	it("still renders when the dash cache store is down (cache fails open)", async () => {
		const { app, interactJson } = harness({ kv: brokenCacheKv() });
		const res = await load(app);
		expect(res.status).toBe(200);
		expect(interactJson).toHaveBeenCalledTimes(DATASETS.length);
	});

	it("503s when the rate-limit counter store is down (limiter fails closed)", async () => {
		const real = createInMemoryKV();
		const kv: KV = {
			...real,
			incr: vi.fn().mockRejectedValue(new Error("store down")),
		};
		const { app } = harness({ kv });
		const res = await load(app);
		expect(res.status).toBe(503);
		expect((await errorOf(res)).code).toBe("RATE_LIMIT_UNAVAILABLE");
	});
});
