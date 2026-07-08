#!/usr/bin/env node
/**
 * Local stdio entrypoint — the zero-custody mode: credentials stay in the
 * partner's own environment, calls go straight from their machine to Eko.
 * Same generated tool core and ctx rules as the remote server.
 */
import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadBundle } from "./load-bundle.js";
import { buildToolDefs } from "./tools.js";
import { createTransactServer } from "./server.js";
import { parseAllowed, parseEnvironment, type TransactCtx } from "./ctx.js";
import { withTimeout } from "./fetchTimeout.js";
import { notifyIfOutdated } from "./update-check.js";

// Own version, read at runtime from the published layout (dist/stdio.js → ../package.json).
const { version: OWN_VERSION } = createRequire(import.meta.url)(
	"../package.json",
) as { version: string };

const main = async () => {
	// Start even without credentials so the MCP handshake still completes and the
	// tools list — otherwise the host just shows "failed to connect" and the
	// eps-verify skill has no server to guide setup against. Calls are guarded in
	// the server: a tool invoked without credentials returns MISSING_CREDENTIALS,
	// never a signed/network request.
	const developerKey = process.env.EKO_DEVELOPER_KEY ?? "";
	const accessKey = process.env.EKO_ACCESS_KEY ?? "";
	if (!developerKey || !accessKey) {
		console.error(
			"[eps-transact-mcp] EKO_DEVELOPER_KEY / EKO_ACCESS_KEY not set — starting anyway; verification calls return MISSING_CREDENTIALS until you set them.",
		);
	}
	// An invalid EKO_ENV is a typo, not a reason to drop the connection: warn
	// (naming the bad value + accepted set) and fall back to uat.
	let environment = parseEnvironment(process.env.EKO_ENV);
	if (!environment) {
		console.error(
			`[eps-transact-mcp] Invalid EKO_ENV "${process.env.EKO_ENV ?? ""}". Use "uat" (default) or "production". Falling back to uat.`,
		);
		environment = "sandbox";
	}
	// Local mode defaults to all verification tools: the user configuring env
	// vars on their own machine owns the keys already.
	const allowed = parseAllowed(process.env.EKO_ALLOWED_APIS) ?? "all";

	const { bundle } = await loadBundle();
	const ctx: TransactCtx = {
		developerKey,
		accessKey,
		environment,
		allowed,
		initiatorId: process.env.EKO_INITIATOR_ID,
		userCode: process.env.EKO_USER_CODE,
		fetch: withTimeout(fetch),
	};
	const server = createTransactServer(
		buildToolDefs(bundle),
		ctx,
		bundle.meta.bundleVersion,
	);
	await server.connect(new StdioServerTransport());
	console.error(
		`[eps-transact-mcp] stdio ready (${environment}, bundle ${bundle.meta.bundleVersion})`,
	);
	// Fire-and-forget: bounded by its own timeout, swallows failures, prints a
	// one-line stderr nudge if a newer version is published. Never blocks startup.
	void notifyIfOutdated(OWN_VERSION);
};

main().catch((err: unknown) => {
	console.error(
		`[eps-transact-mcp] fatal: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
