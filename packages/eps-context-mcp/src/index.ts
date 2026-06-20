#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadBundle } from "./load-bundle.js";
import { createEpsServer } from "./server.js";

async function main() {
	const { bundle, source } = await loadBundle();
	const server = createEpsServer(bundle, source);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(
		`eps-context-mcp running (bundle ${bundle.meta.bundleVersion}, ${source})`,
	);
}

main().catch((err) => {
	console.error("eps-context-mcp fatal:", err);
	process.exit(1);
});
