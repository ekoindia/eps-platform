#!/usr/bin/env node
/**
 * Local stdio entrypoint — the zero-custody mode: credentials stay in the
 * partner's own environment, calls go straight from their machine to Eko.
 * Same generated tool core and ctx rules as the remote server.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadBundle } from "./load-bundle.js";
import { buildToolDefs } from "./tools.js";
import { createTransactServer } from "./server.js";
import { parseAllowed, parseEnvironment, type TransactCtx } from "./ctx.js";
import { withTimeout } from "./fetchTimeout.js";

const main = async () => {
	const developerKey = process.env.EKO_DEVELOPER_KEY;
	const accessKey = process.env.EKO_ACCESS_KEY;
	if (!developerKey || !accessKey) {
		console.error(
			"[eps-transact-mcp] EKO_DEVELOPER_KEY and EKO_ACCESS_KEY env vars are required.",
		);
		process.exit(1);
	}
	const environment = parseEnvironment(process.env.EKO_ENV);
	if (!environment) {
		console.error(
			'[eps-transact-mcp] Invalid EKO_ENV. Use "uat" (default) or "production".',
		);
		process.exit(1);
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
};

main().catch((err: unknown) => {
	console.error(
		`[eps-transact-mcp] fatal: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
