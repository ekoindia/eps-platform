import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { withTimeout } from "./fetchTimeout.js";
import { loadBundle } from "./load-bundle.js";
import { createTransactServer } from "./server.js";
import { buildToolDefs } from "./tools.js";

/**
 * Live UAT smoke — the ONLY test that talks to Eko. Skipped unless real UAT
 * credentials are provided via env. It settles two things no mock can:
 * whether the bundle's sandbox base URL is reachable as written, and that HMAC
 * signing + JSON encoding pass end-to-end. CONFIRMED green 2026-07-08: the
 * portless `staging.eko.in/ekoapi/v3` is reachable and signing round-trips
 * (an earlier research repo had used a `:25004` port; the portless form is
 * correct — this test is the standing guard against a regression).
 *
 * Run: put the EPS_UAT_* vars in this package's .env (see .env.example;
 *      vitest.config.ts loads it, inline shell vars win), or pass inline:
 *      EPS_UAT_DEVELOPER_KEY=… EPS_UAT_ACCESS_KEY=… EPS_UAT_INITIATOR_ID=… \
 *      npm test -w @ekoindia/eps-transact-mcp -- uat-smoke
 */
const developerKey = process.env.EPS_UAT_DEVELOPER_KEY;
const accessKey = process.env.EPS_UAT_ACCESS_KEY;
const initiatorId = process.env.EPS_UAT_INITIATOR_ID;
const enabled = Boolean(developerKey && accessKey && initiatorId);

/**
 * Error codes worth another attempt. These are transport-class: a third-party
 * host is allowed the occasional blip, and one blip must not red-fail the whole
 * package suite.
 *
 * Retrying does NOT weaken what this test guards. A wrong base URL, a wrong
 * port, a TLS failure or broken signing fails EVERY attempt, deterministically
 * — that is what separates a regression from a hiccup, and it is the only
 * reason a retry is safe here. Anything not in this set (VALIDATION,
 * MISSING_CREDENTIALS, TOOL_NOT_ALLOWED) is deterministic too, and fails fast
 * on the first attempt rather than burning the backoff.
 */
const RETRYABLE = new Set(["UPSTREAM_ERROR", "UPSTREAM_TIMEOUT"]);
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;

describe.skipIf(!enabled)("UAT smoke (live)", () => {
	it("eps_pan_lite reaches Eko UAT and returns an EPS envelope", async () => {
		const { bundle } = await loadBundle();
		const baseUrl = bundle.meta.environments.find(
			(e) => e.id === "sandbox",
		)?.baseUrl;

		// `sanitizeError` deliberately collapses every transport failure into one
		// generic message, because raw upstream text can echo request data. That
		// is right for callers and useless for this test: "network or non-JSON"
		// cannot tell a 300ms blip from a base-URL regression, which is the whole
		// question here. So capture the transport facts on the way past — status,
		// content type, and the thrown error's name — and NEVER the body, which
		// is exactly the thing the sanitizer exists to keep out of logs.
		let transport = "no request reached fetch";
		const timedFetch = withTimeout(fetch, 15_000);
		const probeFetch: typeof fetch = async (input, init) => {
			try {
				const res = await timedFetch(input, init);
				transport = `HTTP ${res.status} (${res.headers.get("content-type") ?? "no content-type"})`;
				return res;
			} catch (err) {
				const e = err as Error;
				transport = `${e.name}: ${e.message}${
					e.cause instanceof Error ? ` (cause: ${e.cause.message})` : ""
				}`;
				throw err;
			}
		};

		const server = createTransactServer(
			buildToolDefs(bundle),
			{
				developerKey: developerKey as string,
				accessKey: accessKey as string,
				environment: "sandbox",
				allowed: "all",
				initiatorId,
				userCode: process.env.EPS_UAT_USER_CODE,
				fetch: probeFetch,
			},
			bundle.meta.bundleVersion,
		);
		const client = new Client({ name: "uat-smoke", version: "0" });
		const [a, b] = InMemoryTransport.createLinkedPair();
		await Promise.all([server.connect(a), client.connect(b)]);

		const failures: string[] = [];
		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			const res = await client.callTool({
				name: "eps_pan_lite",
				arguments: {
					pan_number: "ABCDE1234F",
					name: "Test Name",
					dob: "1990-01-01",
				},
			});
			const payload = JSON.parse(
				(res.content as { text: string }[])[0].text,
			) as Record<string, unknown>;

			// Any parsed EPS envelope (even a business failure) proves base URL,
			// auth, and encoding — which is all this test claims to prove.
			if (!res.isError) {
				expect(payload).toHaveProperty("response_status_id");
				return;
			}

			failures.push(
				`attempt ${attempt}: ${JSON.stringify(payload)} [transport: ${transport}]`,
			);
			if (!RETRYABLE.has(payload.code as string)) break;
			if (attempt < ATTEMPTS)
				await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
		}

		throw new Error(
			`UAT smoke failed against ${baseUrl} after ${failures.length} attempt(s).\n` +
				`${failures.join("\n")}\n` +
				"A transport failure on EVERY attempt points at the base URL, the " +
				"port, TLS or signing — not at a blip.",
		);
		// Three attempts at 15s each, plus backoff, has to fit inside the timeout.
	}, 60_000);
});
