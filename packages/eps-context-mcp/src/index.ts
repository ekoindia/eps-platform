#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadBundle } from "./load-bundle.js";
import { createEpsServer } from "./server.js";
import { checkForUpdate, type VersionState } from "./update-check.js";

/** Own npm version from the packaged package.json (adjacent to dist/). */
function readPackageVersion(): string {
	try {
		const here = path.dirname(fileURLToPath(import.meta.url));
		const pkg = JSON.parse(
			readFileSync(path.resolve(here, "../package.json"), "utf8"),
		) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

async function main() {
	const { bundle, source } = await loadBundle();
	const versionState: VersionState = { current: readPackageVersion() };
	// Fire-and-forget before connect so the check runs while the client handshakes.
	void checkForUpdate(versionState);
	const server = createEpsServer(bundle, source, versionState);
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
