import LegalPageLayout from "@/components/LegalPageLayout";
import { buildInstallMatrix } from "@/lib/agent/build-install-matrix";
import { RECIPES } from "@/lib/data/api-recipes";

const INSTALL_MATRIX = buildInstallMatrix();

const PACKS = [
	{ label: "Any agent — AGENTS.md", href: "/agent/AGENTS.md" },
	{ label: "Claude Code — CLAUDE.md", href: "/agent/CLAUDE.md" },
	{ label: "Cursor — .cursorrules", href: "/agent/.cursorrules" },
	{ label: "GitHub Copilot", href: "/agent/copilot-instructions.md" },
];

const BUNDLE_LINKS = [
	{ label: "Canonical bundle (eps.json)", href: "/agent/eps.json" },
	{ label: "Endpoint index (index.json)", href: "/agent/index.json" },
	{ label: "OpenAPI 3.1 (openapi.json)", href: "/openapi.json" },
];

const SDK_LINKS = [
	{
		label: "@ekoindia/eps-sdk (npm — Node.js)",
		href: "https://www.npmjs.com/package/@ekoindia/eps-sdk",
	},
	{
		label: "ekoindia/eps-sdk (Composer — PHP)",
		href: "https://packagist.org/packages/ekoindia/eps-sdk",
	},
	{
		label: "Postman collection (eps.postman_collection.json)",
		href: "/agent/eps.postman_collection.json",
	},
];

const AgentsPage = () => {
	return (
		<LegalPageLayout
			title="EPS for AI agents"
			description="Drop-in context packs, a local MCP server, and a machine-readable API bundle — everything an AI coding agent needs to integrate Eko Platform Services."
		>
			<h2>Context packs</h2>
			<p>
				Drop one of these into your repo so your agent gets EPS auth, endpoints,
				and recipes right:
			</p>
			<ul>
				{PACKS.map((p) => (
					<li key={p.href}>
						<a href={p.href}>{p.label}</a>
					</li>
				))}
			</ul>

			<h2>Local MCP server</h2>
			<p>Install the local context server (zero hosting, zero secrets):</p>
			<pre>
				<code>npx -y @ekoindia/eps-context-mcp</code>
			</pre>

			<h2>Offline mock server</h2>
			<p>
				Develop and test EPS integrations offline — the mock server replays
				golden sample responses (with recipe-aware error branching) so agents
				never touch the live API:
			</p>
			<pre>
				<code>npx -y @ekoindia/eps-mock-server</code>
			</pre>

			<h2>Claude Code plugin</h2>
			<p>
				One install wires the <code>eps</code> MCP, the{" "}
				<code>integrate-eps</code> and <code>sign-request</code> skills, and the{" "}
				<code>/eps</code> slash command into Claude Code:
			</p>
			<pre>
				<code>/plugin install eps</code>
			</pre>

			<h2>Install matrix</h2>
			<p>
				EPS rides on open standards — Model Context Protocol (MCP) and{" "}
				<code>AGENTS.md</code>-style context packs — so it works in any modern
				coding agent. Here is how to wire it into each harness:
			</p>
			<table>
				<thead>
					<tr>
						<th>Harness</th>
						<th>MCP command</th>
						<th>Pack file</th>
						<th>Placement</th>
					</tr>
				</thead>
				<tbody>
					{INSTALL_MATRIX.map((h) => (
						<tr key={h.id}>
							<td>{h.name}</td>
							<td>{h.mcp ? <code>{h.mcp}</code> : "—"}</td>
							<td>
								{h.packFile ? (
									<a href={`/agent/${h.packFile}`}>{h.packFile}</a>
								) : (
									"—"
								)}
							</td>
							<td>{h.packPlacement ? <code>{h.packPlacement}</code> : "—"}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h2>Machine bundle</h2>
			<ul>
				{BUNDLE_LINKS.map((b) => (
					<li key={b.href}>
						<a href={b.href}>{b.label}</a>
					</li>
				))}
			</ul>

			<h2>SDKs &amp; tools</h2>
			<p>
				Backend-only signed SDKs (HMAC baked in) and a ready-to-run Postman
				collection. Keep your <code>access_key</code> server-side only.
			</p>
			<ul>
				{SDK_LINKS.map((s) => (
					<li key={s.href}>
						<a href={s.href}>{s.label}</a>
					</li>
				))}
			</ul>

			<h2>Recipes</h2>
			<ul>
				{RECIPES.map((r) => (
					<li key={r.id}>
						<strong>{r.name}</strong> — {r.summary}
					</li>
				))}
			</ul>
		</LegalPageLayout>
	);
};

export default AgentsPage;
