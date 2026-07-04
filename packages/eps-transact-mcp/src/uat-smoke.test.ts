import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { loadBundle } from "./load-bundle.js";
import { buildToolDefs } from "./tools.js";
import { createTransactServer } from "./server.js";
import { withTimeout } from "./fetchTimeout.js";

/**
 * Live UAT smoke — the ONLY test that talks to Eko. Skipped unless real UAT
 * credentials are provided via env. It settles two things no mock can:
 * whether the bundle's sandbox base URL is reachable as written (the eko-eps
 * research repo verified staging WITH port :25004; our bundle is portless),
 * and that HMAC signing + JSON encoding pass end-to-end.
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

describe.skipIf(!enabled)("UAT smoke (live)", () => {
	it("eps_pan_lite reaches Eko UAT and returns an EPS envelope", async () => {
		const { bundle } = await loadBundle();
		const server = createTransactServer(
			buildToolDefs(bundle),
			{
				developerKey: developerKey as string,
				accessKey: accessKey as string,
				environment: "sandbox",
				allowed: "all",
				initiatorId,
				userCode: process.env.EPS_UAT_USER_CODE,
				fetch: withTimeout(fetch, 15_000),
			},
			bundle.meta.bundleVersion,
		);
		const client = new Client({ name: "uat-smoke", version: "0" });
		const [a, b] = InMemoryTransport.createLinkedPair();
		await Promise.all([server.connect(a), client.connect(b)]);
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: {
				pan_number: "ABCDE1234F",
				name: "Test Name",
				dob: "1990-01-01",
			},
		});
		// Any parsed EPS envelope (even a business failure) proves base URL,
		// auth, and encoding. A sanitized UPSTREAM_ERROR means the base URL or
		// TLS/port is wrong — that's exactly what this smoke exists to catch.
		const payload = JSON.parse(
			(res.content as { text: string }[])[0].text,
		) as Record<string, unknown>;
		if (res.isError)
			throw new Error(`UAT smoke failed: ${JSON.stringify(payload)}`);
		expect(payload).toHaveProperty("response_status_id");
	}, 30_000);
});
