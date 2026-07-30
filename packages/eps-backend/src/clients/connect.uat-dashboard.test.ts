import { describe, expect, it } from "vitest";
import { createConnectClient } from "./connect";

/**
 * A LIVE probe against a UAT connect-api, skipped unless it is pointed at one.
 *
 *   CONNECT_UAT_BASE_URL=https://api.beta.ekoconnect.in \
 *   CONNECT_UAT_MOBILE=99xxxxxxxx \
 *   npm run backend:test -- uat-dashboard
 *
 * It exists to settle the one thing no amount of local reading can: whether
 * interaction 682's server-side scope — which is derived from the bearer token
 * and implemented in SimpliBank, not in any repo here — returns anything at all
 * for an EPS API partner. Eloka uses 682 for its ADMIN dashboard, where every
 * caller has a downline; an EPS partner has none, and a scope predicate of
 * "descendants of the caller" would answer zeros for a perfectly healthy
 * account.
 *
 * It prints both raw bodies and asserts almost nothing, deliberately: the point
 * is to read the shape, then encode it in `dashboard.sample.ts`. Nothing from a
 * live account is committed — that sample is hand-written.
 *
 * Kept in the repo, skipped, as the standing check to re-run whenever upstream
 * moves. Same contract as `redis.test.ts` and its `REDIS_TEST_URL`.
 */
const baseUrl = process.env.CONNECT_UAT_BASE_URL;
const mobile = process.env.CONNECT_UAT_MOBILE;
const enabled = Boolean(baseUrl && mobile);

describe.skipIf(!enabled)("interaction 682 (live UAT probe)", () => {
	it("reports what the dashboard interaction returns for this account", async () => {
		const connect = createConnectClient({
			baseUrl: baseUrl!,
			timeoutMs: 30_000,
			orgId: Number(process.env.CONNECT_UAT_ORG_ID ?? 1),
		} as never);

		// UAT connect-api returns the OTP in the response, so no SMS is needed.
		const started = await connect.sendOtp({ mobile: mobile! });
		expect(started.otp, "UAT should return the OTP inline").toBeTruthy();
		const envelope = await connect.login({
			mobile: mobile!,
			otp: started.otp!,
		});
		const accessToken = (envelope as { data?: { access_token?: string } })?.data
			?.access_token;
		expect(accessToken, "login should mint a full access token").toBeTruthy();

		const range = {
			datefrom: "2026-07-01 00:00:00",
			dateto: "2026-07-28 23:59:59",
		};
		// Both payload shapes, side by side. A multi-key payload came back missing
		// `mostUsedServices` and `verificationTrends` on a live account, which is why
		// the route now sends one key per call — the shape Eloka uses. Keep both
		// here: the diff is the evidence, and it is the thing to re-check whenever
		// upstream moves.
		const multiKey = await connect.interactJson(accessToken!, {
			source: "EPS",
			client_ref_id: `${Date.now()}0000000`.slice(0, 20),
			interaction_type_id: 682,
			requestPayload: {
				products_overview: range,
				success_rate: range,
				most_used_services: range,
				verification_trends: range,
			},
		});

		const requestKeys = [
			"products_overview",
			"success_rate",
			"most_used_services",
			"verification_trends",
		];
		const perKey: Record<string, unknown> = {};
		for (const [i, key] of requestKeys.entries()) {
			perKey[key] = await connect.interactJson(accessToken!, {
				source: "EPS",
				client_ref_id: `${Date.now()}000000${i}`.slice(0, 20),
				interaction_type_id: 682,
				requestPayload: { [key]: range },
			});
		}
		const dashboard = { multiKey, perKey };

		const services = await connect.interact(accessToken!, {
			interaction_type_id: 1044,
			source: "EPS",
			client_ref_id: `${Date.now()}0000001`.slice(0, 20),
		});

		console.dir({ dashboard, services }, { depth: null });
		expect(dashboard).toBeTruthy();
	}, 60_000);
});
