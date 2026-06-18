import { AiHint } from "@/components/AiHint";
import { InlineCode } from "@/components/docs/InlineCode";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { HarnessIcon } from "@/components/icons/HarnessIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildInstallMatrix } from "@/lib/agent/build-install-matrix";
import { SITE_URL } from "@/lib/config/site";
import { RECIPES } from "@/lib/data/api-recipes";
import {
	ArrowRight,
	Boxes,
	Download,
	FileJson,
	FileTerminal,
	GitBranch,
	KeyRound,
	Layers,
	Package,
	PlugZap,
	ServerCog,
	ShieldCheck,
	Terminal,
	type LucideIcon,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CommandBlock, ConfigBlock, CopyButton } from "./ai/CommandBlock";

const MCP_CMD = "npx -y @ekoindia/eps-context-mcp";
const INSTALL_MATRIX = buildInstallMatrix();

/* ----------------------------- Differentiators ---------------------------- */

interface Differentiator {
	icon: LucideIcon;
	title: string;
	body: string;
}

const DIFFERENTIATORS: Differentiator[] = [
	{
		icon: KeyRound,
		title: "Correct auth, first try",
		body: "EPS requests are HMAC-signed with your secret-key — the exact step generic OpenAPI tooling gets wrong. Our context teaches your agent the signing scheme, so it works on the first call instead of the fifth.",
	},
	{
		icon: Layers,
		title: "Token-efficient context",
		body: "A lazy, tiered MCP: your agent lists endpoints, then drills into just the one it needs. It never dumps the whole spec into the context window, so you keep tokens for the actual task.",
	},
	{
		icon: ShieldCheck,
		title: "Works in every harness",
		body: "Built on open standards — Model Context Protocol and AGENTS.md-style context packs — so the same capability lights up in Claude Code, Cursor, Codex, Copilot, and a dozen more.",
	},
];

/* -------------------------------- Artifacts ------------------------------- */

interface ArtifactLink {
	label: string;
	href: string;
	external?: boolean;
}

interface Artifact {
	icon: LucideIcon;
	title: string;
	body: string;
	/** A copyable command shown inline. */
	command?: string;
	/** Download / external links (first is rendered as the primary link). */
	links?: ArtifactLink[];
}

const ARTIFACTS: Artifact[] = [
	{
		icon: FileTerminal,
		title: "Context packs",
		body: "Drop-in instructions for any agent — auth, endpoints, and recipes in one file.",
		links: [
			{ label: "AGENTS.md", href: "/agent/AGENTS.md" },
			{ label: "CLAUDE.md", href: "/agent/CLAUDE.md" },
			{ label: ".cursorrules", href: "/agent/.cursorrules" },
			{
				label: "copilot-instructions.md",
				href: "/agent/copilot-instructions.md",
			},
		],
	},
	{
		icon: PlugZap,
		title: "Local MCP server",
		body: "Zero hosting, zero secrets. The tiered context server your agent talks to.",
		command: MCP_CMD,
	},
	{
		icon: Package,
		title: "Signed SDKs",
		body: "Backend-only SDKs with HMAC signing baked in. Keep your access_key server-side.",
		command: "npm i @ekoindia/eps-sdk",
		links: [
			{
				label: "composer require ekoindia/eps-sdk",
				href: "https://packagist.org/packages/ekoindia/eps-sdk",
				external: true,
			},
		],
	},
	{
		icon: ServerCog,
		title: "Offline mock server",
		body: "Replays golden sample responses with recipe-aware error branching — never touches the live API.",
		command: "npx -y @ekoindia/eps-mock-server",
	},
	{
		icon: Boxes,
		title: "Postman collection",
		body: "Every EPS endpoint, ready to import and run against the sandbox.",
		links: [
			{
				label: "eps.postman_collection.json",
				href: "/agent/eps.postman_collection.json",
			},
		],
	},
	{
		icon: FileJson,
		title: "Machine bundle + OpenAPI",
		body: "Canonical JSON of every endpoint, topic, and recipe — plus the compact index and an OpenAPI 3.1 document.",
		links: [
			{ label: "eps.json", href: "/agent/eps.json" },
			{ label: "index.json", href: "/agent/index.json" },
			{ label: "openapi.json", href: "/openapi.json" },
		],
	},
];

/* --------------------------------- Helpers -------------------------------- */

/** Maps a recipe step's spec slug to its public docs URL. */
const docHref = (slug: string) => `/docs/${slug}`;

/* ================================== Page ================================== */

const AiPage = () => {
	return (
		<div className="min-h-screen bg-background">
			<Helmet>
				<title>
					AI-native fintech APIs — integrate EPS from any coding agent | Eko
				</title>
				<meta
					name="description"
					content="EPS is AI-native: a local MCP server, drop-in context packs, signed SDKs and a machine-readable bundle so any AI coding agent can integrate Eko Platform Services — with correct HMAC auth, first try."
				/>
				<link rel="canonical" href={`${SITE_URL}/ai`} />
				<link rel="alternate" type="text/markdown" href={`${SITE_URL}/ai.md`} />
			</Helmet>

			<AiHint mdPath="/ai.md" />

			<main>
				{/* ============================== HERO ============================== */}
				<section className="relative overflow-hidden bg-eko-navy">
					{/* Atmosphere: gold gradient mesh + grid + glow (CSS only) */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0"
						style={{
							background:
								"radial-gradient(60% 50% at 75% 0%, hsl(42 96% 54% / 0.16), transparent 60%), radial-gradient(50% 40% at 10% 100%, hsl(42 96% 54% / 0.08), transparent 55%)",
						}}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 opacity-[0.07]"
						style={{
							backgroundImage:
								"linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
							backgroundSize: "56px 56px",
							maskImage:
								"radial-gradient(80% 80% at 50% 0%, black, transparent 75%)",
							WebkitMaskImage:
								"radial-gradient(80% 80% at 50% 0%, black, transparent 75%)",
						}}
					/>

					<div className="container relative mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
						<div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
							{/* Left: copy + CTAs */}
							<div>
								<span
									className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-eko-gold/30 bg-eko-gold/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-eko-gold"
									style={{ animationDelay: "0ms" }}
								>
									<span className="h-1.5 w-1.5 rounded-full bg-eko-gold" />
									AI-native platform
								</span>

								<h1
									className="mt-6 animate-fade-up text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
									style={{ animationDelay: "80ms" }}
								>
									Integrate EPS APIs from any{" "}
									<span className="text-gradient-gold">AI coding agent</span>
								</h1>

								<p
									className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-white/70"
									style={{ animationDelay: "160ms" }}
								>
									Point your agent at our MCP server and it learns Eko Platform
									Services from the inside — correct HMAC auth, the right
									endpoints, and the multi-step recipes that make a real
									integration work. No spec spelunking. No broken signing.
								</p>

								{/* Primary CTA: copy the MCP command */}
								<div
									className="mt-8 max-w-xl animate-fade-up"
									style={{ animationDelay: "240ms" }}
								>
									<CommandBlock text={MCP_CMD} tone="dark" caption="Run it" />
								</div>

								{/* Secondary CTA */}
								<div
									className="mt-5 flex animate-fade-up flex-wrap items-center gap-4"
									style={{ animationDelay: "320ms" }}
								>
									<Button variant="gold" size="lg" asChild>
										<a href="#install">
											Install by harness
											<ArrowRight className="h-4 w-4" />
										</a>
									</Button>
									<Button variant="hero-outline" size="lg" asChild>
										<a href="#artifacts">Browse context packs</a>
									</Button>
								</div>
							</div>

							{/* Right: stylized terminal / agent card (decorative) */}
							<FadeIn delay={200} className="relative animate-scale-in">
								<div className="absolute -inset-4 rounded-3xl bg-eko-gold/10 blur-3xl" />
								<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06222e] shadow-2xl">
									<div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
										<span className="h-3 w-3 rounded-full bg-red-400/80" />
										<span className="h-3 w-3 rounded-full bg-amber-400/80" />
										<span className="h-3 w-3 rounded-full bg-green-400/80" />
										<span className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/40">
											<Terminal className="h-3.5 w-3.5" />
											agent · eps-context-mcp
										</span>
									</div>
									<div className="space-y-2.5 p-5 font-mono text-[13px] leading-relaxed">
										<p className="text-white/40">
											<span className="text-eko-gold">→</span> connect{" "}
											<span className="text-white/80">eps-context-mcp</span>
										</p>
										<p className="text-emerald-300/80">
											<span className="text-white/40">←</span> 87 tools ·
											signing scheme loaded
										</p>
										<p className="pt-1 text-white/40">
											<span className="text-eko-gold">→</span> search(
											<span className="text-amber-200">"send money"</span>)
										</p>
										<p className="text-white/70">
											<span className="text-white/40">←</span> dmt-send-money,
											dmt-add-recipient, dmt-get-sender …
										</p>
										<p className="pt-1 text-white/40">
											<span className="text-eko-gold">→</span>{" "}
											get_signing_snippet(
											<span className="text-amber-200">"php"</span>)
										</p>
										<p className="text-white/70">
											<span className="text-white/40">←</span> hash_hmac(
											<span className="text-amber-200">'sha256'</span>, …,
											$secretKey)
										</p>
										<p className="pt-1 text-emerald-300/90">
											<span className="text-white/40">✓</span> integration ready
											<span className="ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse-soft bg-eko-gold" />
										</p>
									</div>
								</div>
							</FadeIn>
						</div>
					</div>
				</section>

				{/* ========================= DIFFERENTIATORS ======================= */}
				<section className="bg-background py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-14 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								Why agents get it right
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Built for machines that write code
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								Generic OpenAPI is a reference. This is an integration partner
								your agent can actually use.
							</p>
						</FadeIn>

						<div className="grid gap-6 md:grid-cols-3">
							{DIFFERENTIATORS.map((d, i) => {
								const Icon = d.icon;
								return (
									<FadeIn key={d.title} delay={i * 100}>
										<Card className="card-hover h-full p-7">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-eko-gold/10">
												<Icon className="h-6 w-6 text-eko-gold" />
											</div>
											<h3 className="text-xl font-semibold text-foreground">
												{d.title}
											</h3>
											<p className="mt-3 text-muted-foreground">{d.body}</p>
										</Card>
									</FadeIn>
								);
							})}
						</div>
					</div>
				</section>

				{/* ========================= INSTALL BY HARNESS ==================== */}
				<section id="install" className="scroll-mt-24 bg-muted py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-12 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								Install by harness
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Wire EPS into your AI agent
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								Pick your <strong>development tool</strong>. Get a ready-to-copy
								MCP install command and download the AI-context file.
							</p>
						</FadeIn>

						<FadeIn className="mx-auto max-w-4xl">
							<Tabs defaultValue={INSTALL_MATRIX[0]?.id} className="w-full">
								<TabsList className="flex h-auto flex-wrap justify-center gap-1 bg-transparent p-0">
									{INSTALL_MATRIX.map((h) => (
										<TabsTrigger
											key={h.id}
											value={h.id}
											className="gap-2 rounded-full border border-border bg-background px-4 py-2 data-[state=active]:border-eko-navy data-[state=active]:bg-eko-navy data-[state=active]:text-white"
										>
											<HarnessIcon id={h.id} className="h-4 w-4 shrink-0" />
											{h.name}
										</TabsTrigger>
									))}
								</TabsList>

								{INSTALL_MATRIX.map((h) => (
									<TabsContent key={h.id} value={h.id} className="mt-6">
										<Card className="space-y-5 p-6 lg:p-8">
											<div className="flex items-center justify-between gap-4">
												<h3 className="flex items-center gap-2.5 text-xl font-semibold text-foreground">
													<HarnessIcon id={h.id} className="h-5 w-5 shrink-0" />
													{h.name}
												</h3>
												<div className="flex gap-2">
													{h.mcp && <Badge variant="secondary">MCP</Badge>}
													{h.packFile && (
														<Badge variant="outline">Context pack</Badge>
													)}
												</div>
											</div>

											{h.mcp ? (
												<div className="flex flex-col gap-3">
													{h.mcp.command && (
														<CommandBlock
															text={h.mcp.command}
															caption="MCP install command"
														/>
													)}
													{h.mcp.configSnippet && (
														<ConfigBlock
															text={h.mcp.configSnippet}
															caption={
																h.mcp.configFile
																	? `MCP config · ${h.mcp.configFile}`
																	: "MCP config"
															}
														/>
													)}
													{h.mcp.note && (
														<p className="text-xs text-muted-foreground">
															{h.mcp.note}
														</p>
													)}
												</div>
											) : (
												<p className="text-sm text-muted-foreground">
													{h.name} has no native MCP client — use the context
													pack below instead.
												</p>
											)}

											{h.packFile && (
												<div className="flex flex-col gap-1.5">
													<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
														Context pack
													</span>
													<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
														<a
															href={`/agent/${h.packFile}`}
															className="font-mono text-sm font-medium text-eko-navy underline-offset-2 hover:underline"
														>
															{h.packFile}
														</a>
														{h.packPlacement && (
															<>
																<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
																<code className="font-mono text-sm text-muted-foreground">
																	{h.packPlacement}
																</code>
															</>
														)}
													</div>
												</div>
											)}
										</Card>
									</TabsContent>
								))}
							</Tabs>

							{/* Claude Code plugin highlight */}
							<Card className="mt-6 border-eko-gold/30 bg-eko-gold-light/60 p-6 lg:p-8">
								<div className="mb-8 flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-eko-navy">
										<PlugZap className="h-5 w-5 text-eko-gold" />
									</div>
									<div>
										<h3 className="text-lg font-semibold text-foreground">
											Install Claude Code Plugin
										</h3>
										<div className="text-xs pt-1 text-muted-foreground">
											One install wires the <strong>EPS MCP</strong>,{" "}
											<strong>skills</strong>, and the{" "}
											<InlineCode className="font-bold">/eps</InlineCode>{" "}
											command for Claude Code.
										</div>
									</div>
								</div>
								<p className="mb-3 text-sm text-muted-foreground">
									Enter both commands inside the Claude Code prompt, in this
									order:
								</p>
								<div className="flex flex-col gap-3">
									<CommandBlock
										caption="Step 1"
										text="/plugin marketplace add ekoindia/eps-platform"
										prompt=""
									/>
									<CommandBlock
										caption="Step 2"
										text="/plugin install eps@ekoindia"
										prompt=""
									/>
								</div>
							</Card>
						</FadeIn>
					</div>
				</section>

				{/* ============================ ARTIFACTS ========================== */}
				<section
					id="artifacts"
					className="scroll-mt-24 bg-background py-20 lg:py-28"
				>
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-12 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								The toolkit
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Everything your agent needs
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								Generated from one API source of truth, so every artifact stays
								in lock-step with the live platform.
							</p>
						</FadeIn>

						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{ARTIFACTS.map((a, i) => {
								const Icon = a.icon;
								return (
									<FadeIn key={a.title} delay={(i % 3) * 100}>
										<Card className="card-hover flex h-full flex-col p-7">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-eko-navy">
												<Icon className="h-6 w-6 text-eko-gold" />
											</div>
											<h3 className="text-lg font-semibold text-foreground">
												{a.title}
											</h3>
											<p className="mt-2 flex-1 text-sm text-muted-foreground">
												{a.body}
											</p>

											<div className="mt-5 flex flex-col gap-2">
												{a.command && (
													<div className="flex items-center gap-2 rounded-lg border border-border bg-eko-navy px-3 py-2 font-mono text-xs text-white">
														<code className="flex-1 overflow-x-auto whitespace-nowrap docs-scroll">
															{a.command}
														</code>
														<CopyButton text={a.command} />
													</div>
												)}
												{a.links?.map((l, li) => {
													const ext = l.external
														? {
																target: "_blank",
																rel: "noopener noreferrer",
															}
														: {};
													return li === 0 ? (
														<a
															key={l.href}
															href={l.href}
															{...ext}
															className="inline-flex items-center gap-1.5 text-sm font-medium text-eko-navy underline-offset-2 hover:text-eko-gold-hover hover:underline"
														>
															<Download className="h-3.5 w-3.5" />
															{l.label}
														</a>
													) : (
														<a
															key={l.href}
															href={l.href}
															{...ext}
															className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-eko-navy hover:underline"
														>
															{l.label}
														</a>
													);
												})}
											</div>
										</Card>
									</FadeIn>
								);
							})}
						</div>
					</div>
				</section>

				{/* ============================= RECIPES =========================== */}
				<section className="bg-muted py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-12 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								Multi-step recipes
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Real flows, not just endpoints
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								EPS encodes the conditional, multi-call runbooks an integration
								actually needs — including the error branches.
							</p>
						</FadeIn>

						<div className="mx-auto flex max-w-4xl flex-col gap-8">
							{RECIPES.map((recipe, ri) => (
								<FadeIn key={recipe.id} delay={ri * 100}>
									<Card className="p-6 lg:p-8">
										<h3 className="text-xl font-semibold text-foreground">
											{recipe.name}
										</h3>
										<p className="mt-2 text-sm text-muted-foreground">
											{recipe.summary}
										</p>

										<Separator className="my-6" />

										<ol className="flex flex-col gap-4">
											{recipe.steps.map((step, si) => {
												const branches = step.branches ?? [];
												return (
													<li
														key={`${recipe.id}-${step.specSlug}`}
														className="flex gap-4"
													>
														<div className="flex flex-col items-center">
															<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-eko-navy text-sm font-bold text-eko-gold">
																{si + 1}
															</span>
															{si < recipe.steps.length - 1 && (
																<span
																	aria-hidden="true"
																	className="mt-1 w-px flex-1 bg-border"
																/>
															)}
														</div>
														<div className="pb-1">
															<Link
																to={docHref(step.specSlug)}
																className="font-mono text-sm font-semibold text-eko-navy underline-offset-2 hover:text-eko-gold-hover hover:underline"
															>
																{step.specSlug}
															</Link>
															<p className="mt-1 text-sm text-muted-foreground">
																{step.purpose}
															</p>
															{branches.map((b) => (
																<span
																	key={`${step.specSlug}-${b.onResponseStatusId}-${b.goto}`}
																	className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-eko-gold/15 px-2.5 py-1 text-xs font-medium text-amber-800"
																>
																	<GitBranch className="h-3 w-3" />
																	{b.onResponseStatusId} →{" "}
																	{b.goto === "done" ? "complete" : b.goto}
																	{b.note ? ` · ${b.note}` : ""}
																</span>
															))}
														</div>
													</li>
												);
											})}
										</ol>
									</Card>
								</FadeIn>
							))}
						</div>
					</div>
				</section>

				{/* ============================ CTA BAND =========================== */}
				<section className="relative overflow-hidden bg-eko-navy py-20 lg:py-28">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0"
						style={{
							background:
								"radial-gradient(50% 60% at 50% 0%, hsl(42 96% 54% / 0.14), transparent 60%)",
						}}
					/>
					<div className="container relative mx-auto px-4 text-center sm:px-6 lg:px-8">
						<FadeIn className="mx-auto max-w-2xl">
							<h2 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
								Start building
							</h2>
							<p className="mt-4 text-lg text-white/70">
								Drop the MCP into your agent and ship your first signed EPS call
								today.
							</p>
							<div className="mx-auto mt-8 max-w-lg">
								<CommandBlock text={MCP_CMD} tone="dark" caption="Run it" />
							</div>
							<div className="mt-6 flex flex-wrap justify-center gap-4">
								<Button variant="gold" size="lg" asChild>
									<Link to="/docs">
										Read the docs
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
								<Button variant="hero-outline" size="lg" asChild>
									<a href="#install">Install by harness</a>
								</Button>
							</div>
						</FadeIn>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default AiPage;
