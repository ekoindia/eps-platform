import { describe, it, expect, vi } from "vitest";
import { createConnectAuthProvider } from "./connectProvider";
import type { ConnectClient } from "../clients/connect";
import type { EkoClient } from "../clients/eko";
import { loadConfig, type Config } from "../config";
import { createInMemoryKV, type KV } from "../store/kv";
import { passThroughSecretBox } from "../store/secretbox";

const cfg: Config = loadConfig({
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "h",
	SIMPLIBANK_API_PORT: "1",
	SIMPLIBANK_API_PATH: "/p",
	EKO_DEVELOPER_KEY: "k",
	GITHUB_CLIENT_ID: "g",
	GITHUB_CLIENT_SECRET: "s",
	GITHUB_CALLBACK_URL: "https://x/cb",
	GITHUB_REPO: "o/r",
	CONNECT_API_BASE_URL: "https://api.beta.ekoconnect.in",
});

/**
 * The 151 re-read `verify` makes for a `found` login. Defaults to a failure, so
 * every test that does not care about it exercises the fall-back-to-envelope
 * path rather than silently depending on a stub profile.
 */
function setup(
	over: Partial<ConnectClient> = {},
	kv: KV = createInMemoryKV(),
	getProfile: EkoClient["getProfile"] = vi.fn(async () => ({
		kind: "error" as const,
		responseTypeId: 0,
	})),
) {
	const eko = { getProfile } as unknown as EkoClient;
	const connect: ConnectClient = {
		sendOtp: vi.fn(async () => ({ ok: true })),
		login: vi.fn(async () => ({})),
		refreshTokens: vi.fn(async () => null),
		revoke: vi.fn(async () => {}),
		interactions: vi.fn(async () => []),
		interact: vi.fn(async () => ({})),
		interactJson: vi.fn(async () => ({})),
		uploadInteraction: vi.fn(async () => ({})),
		createSupportTicket: vi.fn(async () => ({})),
		...over,
	};
	const provider = createConnectAuthProvider(connect, {
		kv,
		secretbox: passThroughSecretBox,
		cfg,
		eko,
	});
	return { provider, connect, kv, getProfile };
}

const LOGIN_OK = {
	access_token: "ca_access",
	refresh_token: "ca_refresh",
	token_expiration: 18000,
	long_session: true,
	details: {
		name: "Dev",
		mobile: "9990000001",
		code: 20810282,
		user_type: "23",
		org_id: 1,
		onboarding: 0,
	},
};

describe("connect auth provider — verify", () => {
	it("returns ok:false for a wrong OTP answered with HTTP 200", async () => {
		// The single most dangerous shape in this integration: reading the status
		// code alone would mint a session for any six digits.
		const { provider } = setup({
			login: vi.fn(async () => ({ otpFailed: true })),
		});
		expect(await provider.verify({ mobile: "9", otp: "000000" })).toEqual({
			ok: false,
		});
	});

	it("returns the classified profile plus upstream tokens on success", async () => {
		const { provider } = setup({ login: vi.fn(async () => LOGIN_OK) });
		const r = await provider.verify({ mobile: "9990000001", otp: "123456" });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.profile.kind).toBe("found");
		expect(r.upstream?.accessToken).toBe("ca_access");
		expect(r.upstream?.refreshToken).toBe("ca_refresh");
		// 30-day long session, well beyond the 5-hour access token.
		expect(r.upstream!.sessionExpiresAt).toBeGreaterThan(
			r.upstream!.accessExpiresAt,
		);
	});

	it("carries the lite and crm tokens the Connect widget needs", async () => {
		const { provider } = setup({
			login: vi.fn(async () => ({
				...LOGIN_OK,
				access_token_lite: "ca_lite",
				access_token_crm: "ca_crm",
			})),
		});
		const r = await provider.verify({ mobile: "9990000001", otp: "123456" });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.upstream?.accessTokenLite).toBe("ca_lite");
		expect(r.upstream?.accessTokenCrm).toBe("ca_crm");
	});

	// The bug this re-read exists for: connect-api's `auth_details` names its
	// fields one by one and `account_state_id` is not among them, so a login view
	// built from it reported `accountStateId: null` — and therefore `active` — for
	// an account whose KYC was outstanding. `GET /me` reads 151 and disagreed, so
	// the state silently corrected itself on the next page load.
	it("takes the profile from interaction 151, not from the login envelope", async () => {
		const fresh = {
			kind: "found" as const,
			responseTypeId: 369,
			profile: { accountStateId: 48, name: "From 151" },
		};
		const { provider, getProfile } = setup(
			{ login: vi.fn(async () => LOGIN_OK) },
			createInMemoryKV(),
			vi.fn(async () => fresh) as never,
		);
		const r = await provider.verify({
			mobile: "9990000001",
			otp: "123456",
			xRealIp: "1.2.3.4",
		});
		expect(r.ok).toBe(true);
		if (!r.ok || r.profile.kind !== "found") throw new Error("expected found");
		expect(r.profile.profile.accountStateId).toBe(48);
		expect(getProfile).toHaveBeenCalledWith({
			mobile: "9990000001",
			orgId: 1,
			xRealIp: "1.2.3.4",
		});
	});

	// The re-read may only ADD fields. `mapConnectLogin` is what decides whether a
	// session is minted, and a 151 blip must not turn a good login into a refusal.
	it("keeps the envelope's profile when the 151 re-read fails", async () => {
		const { provider } = setup(
			{ login: vi.fn(async () => LOGIN_OK) },
			createInMemoryKV(),
			vi.fn(async () => {
				throw new Error("151 down");
			}) as never,
		);
		const r = await provider.verify({ mobile: "9990000001", otp: "123456" });
		expect(r.ok).toBe(true);
		if (!r.ok || r.profile.kind !== "found") throw new Error("expected found");
		expect(r.profile.profile.name).toBe("Dev");
	});

	it("does not re-read 151 for a login that minted no developer session", async () => {
		const { provider, getProfile } = setup({
			login: vi.fn(async () => ({ accountInactive: true })),
		});
		await provider.verify({ mobile: "9", otp: "1" });
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("classifies without upstream tokens when connect-api minted no session", async () => {
		const { provider } = setup({
			login: vi.fn(async () => ({
				accountInactive: true,
				response_type_id: 2123,
			})),
		});
		const r = await provider.verify({ mobile: "9", otp: "1" });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.profile.kind).toBe("inactive");
		expect(r.upstream).toBeUndefined();
	});
});

describe("connect auth provider — persist", () => {
	it("caps the KV TTL to the upstream session, never our own default", async () => {
		// A 30-day EPS TTL over an 8-hour connect-api session would leave a healthy
		// looking cookie holding dead credentials.
		const kv = createInMemoryKV();
		const set = vi.spyOn(kv, "set");
		const { provider } = setup({}, kv);
		const eightHoursSec = 8 * 60 * 60;
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessExpiresAt: Date.now() + 60_000,
			sessionExpiresAt: Date.now() + eightHoursSec * 1000,
		});
		const ttl = set.mock.calls[0][2] as number;
		expect(ttl).toBeLessThanOrEqual(eightHoursSec);
		expect(ttl).toBeLessThan(cfg.refreshTtlSec);
	});

	it("refuses to store an already-expired upstream session", async () => {
		const { provider } = setup();
		await expect(
			provider.persist!("sid1", {
				accessToken: "a",
				refreshToken: "r",
				accessExpiresAt: Date.now() - 1000,
				sessionExpiresAt: Date.now() - 1000,
			}),
		).rejects.toThrow(/already expired/);
	});
});

describe("connect auth provider — refresh", () => {
	it("throws when no upstream session exists for the sid", async () => {
		// Fail closed: the route turns this into a 401 + cleared cookies.
		const { provider } = setup();
		await expect(provider.refresh!("missing")).rejects.toThrow(
			/no connect-api/,
		);
	});

	it("throws when the stored value cannot be opened", async () => {
		const kv = createInMemoryKV();
		await kv.set("ca:sid1", "not-json", 600);
		const { provider } = setup({}, kv);
		await expect(provider.refresh!("sid1")).rejects.toThrow(/no connect-api/);
	});

	it("is a no-op while the upstream access token is comfortably valid", async () => {
		const { provider, connect, kv } = setup();
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessExpiresAt: Date.now() + 60 * 60_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await provider.refresh!("sid1");
		expect(connect.refreshTokens).not.toHaveBeenCalled();
		expect(await kv.get("ca:sid1")).toBeTruthy();
	});

	it("rotates and re-seals once inside the skew window", async () => {
		const { provider, connect, kv } = setup({
			refreshTokens: vi.fn(async () => ({
				accessToken: "a2",
				refreshToken: "r2",
				accessTtlSec: 18000,
				sessionTtlSec: 28800,
			})),
		});
		await provider.persist!("sid1", {
			accessToken: "a1",
			refreshToken: "r1",
			accessExpiresAt: Date.now() + 5_000, // inside REFRESH_SKEW_MS
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await provider.refresh!("sid1");
		expect(connect.refreshTokens).toHaveBeenCalledWith("r1");
		const stored = JSON.parse((await kv.get("ca:sid1"))!);
		expect(stored.accessToken).toBe("a2");
		expect(stored.refreshToken).toBe("r2");
	});

	it("keeps the previous lite/crm tokens when a rotation omits them", async () => {
		// `/authentication/token` is not guaranteed to re-mint every tier. Blanking
		// them would break a widget session that was working; a stale one merely
		// fails and triggers `login-again`.
		const { provider, kv } = setup({
			refreshTokens: vi.fn(async () => ({
				accessToken: "a2",
				refreshToken: "r2",
				accessTtlSec: 18000,
				sessionTtlSec: 28800,
			})),
		});
		await provider.persist!("sid1", {
			accessToken: "a1",
			refreshToken: "r1",
			accessTokenLite: "lite1",
			accessTokenCrm: "crm1",
			accessExpiresAt: Date.now() + 5_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await provider.refresh!("sid1");

		const stored = JSON.parse((await kv.get("ca:sid1"))!);
		expect(stored.accessTokenLite).toBe("lite1");
		expect(stored.accessTokenCrm).toBe("crm1");
	});

	it("takes the rotated lite/crm tokens when connect-api does re-mint them", async () => {
		const { provider, kv } = setup({
			refreshTokens: vi.fn(async () => ({
				accessToken: "a2",
				refreshToken: "r2",
				accessTokenLite: "lite2",
				accessTokenCrm: "crm2",
				accessTtlSec: 18000,
				sessionTtlSec: 28800,
			})),
		});
		await provider.persist!("sid1", {
			accessToken: "a1",
			refreshToken: "r1",
			accessTokenLite: "lite1",
			accessTokenCrm: "crm1",
			accessExpiresAt: Date.now() + 5_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await provider.refresh!("sid1");

		const stored = JSON.parse((await kv.get("ca:sid1"))!);
		expect(stored.accessTokenLite).toBe("lite2");
		expect(stored.accessTokenCrm).toBe("crm2");
	});

	it("throws when connect-api refuses to rotate", async () => {
		const { provider } = setup({ refreshTokens: vi.fn(async () => null) });
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessExpiresAt: Date.now() + 1_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await expect(provider.refresh!("sid1")).rejects.toThrow(
			/refused to rotate/,
		);
	});
});

describe("connect auth provider — getUpstream", () => {
	it("round-trips the sealed session including lite/crm", async () => {
		const { provider } = setup();
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessTokenLite: "lite",
			accessTokenCrm: "crm",
			accessExpiresAt: Date.now() + 60_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});

		const read = await provider.getUpstream!("sid1");
		expect(read).toMatchObject({
			accessToken: "a",
			accessTokenLite: "lite",
			accessTokenCrm: "crm",
		});
	});

	it("returns null for an unknown sid", async () => {
		const { provider } = setup();
		expect(await provider.getUpstream!("nope")).toBeNull();
	});
});

describe("connect auth provider — revoke", () => {
	it("revokes upstream and deletes the sealed entry", async () => {
		const { provider, connect, kv } = setup();
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessExpiresAt: Date.now() + 60_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await provider.revoke!("sid1");
		expect(connect.revoke).toHaveBeenCalledWith("r");
		expect(await kv.get("ca:sid1")).toBeNull();
	});

	it("never throws when the upstream logout fails", async () => {
		// Logout must always succeed client-side; an orphan expires by its TTL.
		const { provider } = setup({
			revoke: vi.fn(async () => {
				throw new Error("connect-api down");
			}),
		});
		await provider.persist!("sid1", {
			accessToken: "a",
			refreshToken: "r",
			accessExpiresAt: Date.now() + 60_000,
			sessionExpiresAt: Date.now() + 8 * 60 * 60_000,
		});
		await expect(provider.revoke!("sid1")).resolves.toBeUndefined();
	});
});
