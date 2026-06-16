import LegalPageLayout from "@/components/LegalPageLayout";
import { RECIPES } from "@/lib/data/api-recipes";

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

			<h2>Machine bundle</h2>
			<ul>
				{BUNDLE_LINKS.map((b) => (
					<li key={b.href}>
						<a href={b.href}>{b.label}</a>
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
