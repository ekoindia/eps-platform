import { clearConnectTokens, ensureConnectTokens } from "@/lib/connect/token";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectToken = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectToken: () => connectToken() },
}));

const LITE = "access_token_lite";
const CRM = "access_token_crm";

beforeEach(() => {
	connectToken.mockReset();
	// Module-scope cache deliberately outlives a mount; without this a case
	// inherits the previous one's token and never fetches.
	clearConnectTokens();
	sessionStorage.clear();
});

describe("ensureConnectTokens", () => {
	it("writes the tokens where the widget reads them", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: "crm-1",
			expiresAt: Date.now() + 3_600_000,
		});

		await ensureConnectTokens();

		expect(sessionStorage.getItem(LITE)).toBe("lite-1");
		expect(sessionStorage.getItem(CRM)).toBe("crm-1");
	});

	it("never writes the full-scope access_token key", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: "crm-1",
			expiresAt: Date.now() + 3_600_000,
		});

		await ensureConnectTokens();

		// The widget only falls back to `access_token` when lite is absent, and we
		// deliberately never publish it.
		expect(sessionStorage.getItem("access_token")).toBeNull();
	});

	it("removes the crm key rather than storing a null string", async () => {
		sessionStorage.setItem(CRM, "stale");
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		});

		await ensureConnectTokens();

		// The widget's guard is `"undefined" !== v && v`, so the string "null" would
		// pass it and be sent as `Bearer null`.
		expect(sessionStorage.getItem(CRM)).toBeNull();
	});

	it("shares one request between concurrent callers", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		});

		await Promise.all([ensureConnectTokens(), ensureConnectTokens()]);

		expect(connectToken).toHaveBeenCalledTimes(1);
	});

	it("reuses a live token instead of refetching", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		});

		await ensureConnectTokens();
		await ensureConnectTokens();

		expect(connectToken).toHaveBeenCalledTimes(1);
	});

	it("refetches a token already inside the expiry skew", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			// Live by the clock, but too close to expiry to survive a round trip.
			expiresAt: Date.now() + 1_000,
		});

		await ensureConnectTokens();
		await ensureConnectTokens();

		expect(connectToken).toHaveBeenCalledTimes(2);
	});

	it("restores storage a stray clear emptied, without refetching", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		});
		await ensureConnectTokens();
		sessionStorage.removeItem(LITE);

		await ensureConnectTokens();

		expect(sessionStorage.getItem(LITE)).toBe("lite-1");
		expect(connectToken).toHaveBeenCalledTimes(1);
	});
});

describe("clearConnectTokens", () => {
	it("removes both keys", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: "crm-1",
			expiresAt: Date.now() + 3_600_000,
		});
		await ensureConnectTokens();

		clearConnectTokens();

		expect(sessionStorage.getItem(LITE)).toBeNull();
		expect(sessionStorage.getItem(CRM)).toBeNull();
	});

	it("forces the next call to refetch", async () => {
		connectToken.mockResolvedValue({
			accessTokenLite: "lite-1",
			accessTokenCrm: null,
			expiresAt: Date.now() + 3_600_000,
		});
		await ensureConnectTokens();

		clearConnectTokens();
		await ensureConnectTokens();

		expect(connectToken).toHaveBeenCalledTimes(2);
	});
});
