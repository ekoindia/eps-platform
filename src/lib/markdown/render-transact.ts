/**
 * Renders `/agents.md` — the markdown twin of the `/agents` page. Describes the
 * EPS *transactional* MCP server: verification APIs exposed as agent tools that
 * execute with the partner's own pass-through credentials.
 *
 * Note: this twin is emitted on every build, but the `/agents` page is only
 * nav-linked, prerendered, and listed in llms.txt when `SHOW_TRANSACT_MCP` is
 * on — so an unreferenced twin leaks nothing to crawlers while the flag is off.
 */
import {
	EPS_TRANSACT_MCP_CMD,
	EPS_TRANSACT_MCP_URL,
	PLUGINS_ADD_CMD,
	SITE_URL,
} from "@/lib/config/site";

export function renderTransactAgentsMarkdown(): string {
	const lines: string[] = [];
	lines.push("# EPS for AI agents");
	lines.push("");
	lines.push(
		"The EPS Transactional MCP server turns every Eko verification API into a " +
			"typed tool your AI agents call directly — PAN, Aadhaar, bank account, " +
			"GSTIN, and more. It executes the real API with your own credentials, " +
			"which pass through per request and are never stored.",
	);
	lines.push("");

	lines.push("## What it is");
	lines.push(
		"- Verification APIs exposed as MCP tools an agent can call at runtime\n" +
			"- Pass-through credentials: keys sign the request, then vanish with it — nothing on disk or cache\n" +
			"- Request bodies/headers (PAN, Aadhaar, bank data) are never logged\n" +
			"- Per-client allowlist scopes which tools an agent can see and call\n" +
			"- UAT is the default environment; production must be selected explicitly\n" +
			"- Tool list is generated from the EPS API source of truth, so it tracks the platform automatically",
	);
	lines.push("");

	lines.push("## Connect — coding-agent plugin (recommended)");
	lines.push("");
	lines.push(
		"If your agent is Claude Code, Codex, Cursor, or OpenCode, install the " +
			"`eps-transact` plugin — one command wires this MCP plus an `eps-verify` " +
			"skill. Export your `EKO_*` credentials in your shell first:",
	);
	lines.push("");
	lines.push("```bash");
	lines.push(PLUGINS_ADD_CMD);
	lines.push("```");
	lines.push("");
	lines.push("Pick **eps-transact** when prompted.");
	lines.push("");

	lines.push("## Connect — hosted remote");
	lines.push("");
	lines.push(
		"Point any MCP client that supports remote (streamable HTTP) servers with " +
			"header auth — such as Claude Code — at the hosted endpoint:",
	);
	lines.push("");
	lines.push("```");
	lines.push(EPS_TRANSACT_MCP_URL);
	lines.push("```");
	lines.push("");

	lines.push("## Connect — local stdio");
	lines.push("");
	lines.push(
		"Run the server as a local process and pass credentials via environment " +
			"variables (exact variable names are in the package README):",
	);
	lines.push("");
	lines.push("```bash");
	lines.push(EPS_TRANSACT_MCP_CMD);
	lines.push("```");
	lines.push("");

	lines.push("## Related");
	lines.push(
		`- [Build with AI](${SITE_URL}/ai): AI coding toolkit — context MCP, SDKs, and recipes for integrating EPS by hand or with a coding agent\n` +
			`- [API documentation](${SITE_URL}/docs): Every EPS verification endpoint`,
	);
	lines.push("");

	return lines.join("\n");
}
