/**
 * Builds the agent context packs from the agent bundle: one canonical, lean
 * markdown body + thin per-target wrappers (AGENTS.md, CLAUDE.md, .cursorrules,
 * Copilot instructions). DRY — the body is authored once; wrappers only add a
 * format-appropriate shell.
 *
 * "Lean": inline only the get-it-wrong essentials (auth/HMAC signing +
 * backend-only warning, environments, error model) plus a COMPACT endpoint
 * index. Per-endpoint detail is linked (bundle/MCP/.md docs), not inlined.
 */
import { EPS_MCP_PKG, PLUGINS_ADD_CMD, SITE_URL } from "@/lib/config/site";
import { markdownTable } from "@/lib/markdown/shared";
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

const MCP_PACKAGE = EPS_MCP_PKG;
const MOCK_PACKAGE = "@ekoindia/eps-mock-server";

/** The canonical, format-neutral pack body (GitHub-flavored markdown). */
export const buildContextPackBody = (bundle: AgentBundle): string => {
	const { topics, apis, recipes, meta } = bundle;
	const lines: string[] = [];

	lines.push("# Integrating Eko Platform Services (EPS) APIs");
	lines.push("");
	lines.push(
		"EPS is an API platform for payments, banking-correspondent services " +
			"(AePS, DMT, BBPS) and identity verification (PAN, Aadhaar, bank, GST, " +
			"etc.) in India. This pack tells an AI coding agent how to call EPS APIs " +
			"correctly.",
	);
	lines.push("");
	lines.push(
		"This is a self-contained section — append it to your repo's existing " +
			"agent instructions (AGENTS.md or equivalent); it does not replace your " +
			"project instructions. Agents with plugin support get richer, on-demand " +
			"context instead of this static pack: `" +
			PLUGINS_ADD_CMD +
			"` (installs the EPS MCP + skills into Claude Code, Codex, Cursor, " +
			"OpenCode).",
	);
	lines.push("");

	// Getting started — how a user onboards to obtain credentials
	const gettingStarted = topics["getting-started"];
	lines.push("## Getting started");
	lines.push("");
	lines.push(gettingStarted.summary);
	lines.push("");
	for (let i = 0; i < gettingStarted.steps.length; i++) {
		const s = gettingStarted.steps[i];
		lines.push(
			`${i + 1}. **${s.title}** — ${s.detail}${s.url ? ` (${s.url})` : ""}`,
		);
	}
	lines.push("");

	// Environments
	lines.push("## Environments");
	lines.push("");
	lines.push(
		markdownTable(
			["Environment", "Base URL", "Notes"],
			meta.environments.map((e) => [e.label, e.baseUrl, e.note ?? ""]),
		),
	);
	lines.push("");

	// Auth & signing — inlined, backend-only
	lines.push("## Authentication & request signing");
	lines.push("");
	lines.push(`> **${topics.auth.warning}**`);
	lines.push("");
	lines.push("Every request sends these headers:");
	lines.push("");
	lines.push(
		markdownTable(
			["Header", "Description"],
			topics.auth.headers.map((h) => [h.name, h.description ?? ""]),
		),
	);
	lines.push("");
	lines.push("Compute `secret-key` (server-side) as:");
	lines.push("");
	for (let i = 0; i < topics.auth.secretKeyGeneration.length; i++)
		lines.push(`${i + 1}. ${topics.auth.secretKeyGeneration[i]}`);
	lines.push("");
	lines.push(`Full auth reference: ${topics.auth.docsUrl}`);
	lines.push("");

	// Error model
	lines.push("## Error model");
	lines.push("");
	lines.push(
		"Responses carry `status` (0 = success) and a granular " +
			"`response_status_id`. Common codes (e.g. `463` = user not found, " +
			"`347` = insufficient balance). Full table: " +
			topics.errors.docsUrl +
			".",
	);
	lines.push("");

	// Endpoint index — compact
	lines.push("## API endpoints");
	lines.push("");
	lines.push(
		markdownTable(
			["API", "Method", "Path", "Summary"],
			apis.map((a) => [a.name, a.method, `\`${a.path}\``, a.summary]),
		),
	);
	lines.push("");
	lines.push(
		`Full machine-readable specs: ${SITE_URL}/agent/eps.json ` +
			`(index: ${SITE_URL}/agent/index.json, per-API: ` +
			`${SITE_URL}/agent/api/<slug>.json). OpenAPI: ${SITE_URL}/openapi.json.`,
	);
	lines.push("");

	// Recipes
	lines.push("## Multi-step recipes");
	lines.push("");
	for (const r of recipes) {
		lines.push(`### ${r.name}`);
		lines.push("");
		lines.push(r.summary);
		lines.push("");
		for (let i = 0; i < r.steps.length; i++) {
			const step = r.steps[i];
			const branch = step.branches
				?.map(
					(b) => ` (if response_status_id ${b.onResponseStatusId} → ${b.goto})`,
				)
				.join("");
			lines.push(
				`${i + 1}. \`${step.specSlug}\` — ${step.purpose}${branch ?? ""}`,
			);
		}
		lines.push("");
	}

	// Offline mock server — local dev/testing without the live API
	lines.push("## Local development & testing (offline mock server)");
	lines.push("");
	lines.push(
		"Test EPS integrations without touching the live API. The mock server " +
			"replays golden sample responses over plain HTTP on " +
			"`http://localhost:4010`:\n\n" +
			"```bash\n" +
			`npx -y ${MOCK_PACKAGE}\n` +
			"```",
	);
	lines.push("");
	lines.push(
		"It mirrors the real EPS paths, so point your EPS base URL at " +
			"`http://localhost:4010` — no other code change needed. It does not " +
			"require valid EPS credentials, but keep the same request shape and " +
			"headers your integration sends. To exercise a documented error branch, " +
			"append `?eps_scenario=<response_status_id>` to the request for " +
			"endpoints whose fixture includes that code — e.g. calling the DMT " +
			"sender lookup (`dmt-get-sender`) with `?eps_scenario=463` returns its " +
			'"sender not found" branch from the DMT — Send Money recipe.',
	);
	lines.push("");

	// MCP pointer
	lines.push("## Live context via MCP");
	lines.push("");
	lines.push(
		`Install the local context server for richer, on-demand lookups:\n\n` +
			"```bash\n" +
			`npx -y ${MCP_PACKAGE}\n` +
			"```",
	);
	lines.push("");

	return lines.join("\n");
};

/** One emitted pack file. */
export interface ContextPackFile {
	/** Path relative to /agent in the build output. */
	file: string;
	build: (bundle: AgentBundle) => string;
}

const withHeading = (heading: string, bundle: AgentBundle): string =>
	`${heading}\n\n${buildContextPackBody(bundle)}`;

export const CONTEXT_PACK_FILES: ContextPackFile[] = [
	{
		file: "AGENTS.md",
		build: (b) =>
			withHeading(
				"<!-- Eko EPS — append this section to your existing AGENTS.md -->",
				b,
			),
	},
	{
		file: "CLAUDE.md",
		build: (b) =>
			withHeading(
				"<!-- Eko EPS — append this section to your existing CLAUDE.md -->",
				b,
			),
	},
	{
		file: ".cursorrules",
		build: (b) =>
			withHeading(
				"# Eko EPS integration rules — append to your existing .cursorrules",
				b,
			),
	},
	{
		file: "copilot-instructions.md",
		build: (b) =>
			withHeading(
				"<!-- Eko EPS — append to .github/copilot-instructions.md in your repo -->",
				b,
			),
	},
];
