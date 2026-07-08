import { AiHint } from "@/components/AiHint";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { McpIcon } from "@/components/icons/McpIcon";
import type { IconComponent } from "@/components/icons/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	EPS_TRANSACT_MCP_CMD,
	EPS_TRANSACT_MCP_URL,
	SITE_URL,
} from "@/lib/config/site";
import {
	ArrowRight,
	BadgeCheck,
	Bot,
	FileWarning,
	KeyRound,
	Loader,
	Radar,
	ScrollText,
	ShieldCheck,
	SlidersHorizontal,
	Workflow,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
// ponytail: CommandBlock/ConfigBlock are page-local to /ai; importing across
// the page boundary instead of lifting them to src/components/. Lift if a third
// page needs them.
import { CommandBlock, ConfigBlock } from "./ai/CommandBlock";

/* ------------------------------- What it is ------------------------------- */

interface Feature {
	icon: IconComponent;
	title: string;
	body: string;
}

/** Why an agent-runtime verification server, not just a coding helper. */
const PAINS: Feature[] = [
	{
		icon: Workflow,
		title: "Verification is a workflow step, not a coding task",
		body: "Onboarding, lending, and payout flows need to verify a PAN, a bank account, or a GSTIN mid-process — while the agent is running, not while a developer is coding.",
	},
	{
		icon: FileWarning,
		title: "Wiring each API by hand is slow",
		body: "Signing, environment routing, and per-endpoint request shapes are the same boilerplate every time — repeated for every verification your agent needs to run.",
	},
	{
		icon: KeyRound,
		title: "Credentials shouldn't leak into prompts",
		body: "Handing an agent raw API keys as text is a liability. Verification calls need signing that never exposes your secret to the model.",
	},
];

/** How the transactional MCP addresses the above. */
const HOW: Feature[] = [
	{
		icon: BadgeCheck,
		title: "Tools that actually run verifications",
		body: "Every EPS verification API is exposed as a typed MCP tool — PAN, Aadhaar, bank account, GSTIN, and more. Your agent calls the tool; the server signs and executes the real API and returns the result.",
	},
	{
		icon: ShieldCheck,
		title: "Your keys pass through, never stored",
		body: "Credentials arrive per request, sign the call, and vanish with it — nothing is written to disk or cache. Request bodies and headers (PAN, Aadhaar, bank data) are never logged.",
	},
	{
		icon: SlidersHorizontal,
		title: "Scope which tools an agent can reach",
		body: "An allowlist you set in client config limits which verification tools appear and can be called. UAT is the default environment; production must be selected explicitly.",
	},
];

/* --------------------------------- Page ----------------------------------- */

const REMOTE_CONFIG = `{
  "mcpServers": {
    "eps-transact": {
      "type": "http",
      "url": "${EPS_TRANSACT_MCP_URL}",
      "headers": {
        "// See the package README for the exact": "credential + environment + allowlist header names"
      }
    }
  }
}`;

const AgentsPage = () => {
	return (
		<div className="min-h-screen bg-background">
			<Helmet>
				<title>
					EPS for AI Agents | Run Indian Fintech Verifications via MCP
				</title>
				<meta
					name="description"
					content="Give your AI agents a verification runtime. The EPS Transactional MCP server exposes PAN, Aadhaar, bank account, GST and more as typed tools your agents call directly — with pass-through credentials that are never stored."
				/>
				<link rel="canonical" href={`${SITE_URL}/agents`} />
				<link
					rel="alternate"
					type="text/markdown"
					href={`${SITE_URL}/agents.md`}
				/>
			</Helmet>

			<AiHint mdPath="/agents.md" />

			<main>
				{/* ============================== HERO ============================== */}
				<section className="relative overflow-hidden bg-eko-navy">
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
						<div className="mx-auto max-w-3xl text-center">
							<span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-eko-gold/30 bg-eko-gold/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-eko-gold">
								<Bot className="h-3.5 w-3.5" />
								Agentic verification runtime
							</span>

							<h1
								className="mt-6 animate-fade-up text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
								style={{ animationDelay: "80ms" }}
							>
								Let your AI agents run{" "}
								<span className="text-gradient-gold">
									Indian fintech verifications
								</span>
							</h1>

							<p
								className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-white/70"
								style={{ animationDelay: "160ms" }}
							>
								The EPS Transactional MCP server turns every Eko verification
								API into a typed tool your agents call directly — PAN, Aadhaar,
								bank account, GSTIN, and more. Drop it into any MCP-capable
								agent and automate verification inside your own workflows. Your
								credentials pass through per request and are never stored.
							</p>

							<div
								className="mt-8 flex animate-fade-up flex-wrap justify-center gap-4"
								style={{ animationDelay: "320ms" }}
							>
								<Button variant="gold" size="lg" asChild>
									<a href="#connect">
										Connect the MCP
										<ArrowRight className="h-4 w-4" />
									</a>
								</Button>
								<Button variant="hero-outline" size="lg" asChild>
									<a href="#how">How it works</a>
								</Button>
							</div>
						</div>
					</div>
				</section>

				{/* ============================ PROBLEM ============================ */}
				<section className="bg-muted/30 py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-14 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-destructive/10 px-4 py-1.5 text-sm font-medium text-destructive">
								The problem
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Your agents can reason. They still can&rsquo;t verify.
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								A model can decide a PAN needs checking. It can&rsquo;t sign the
								request, hit the right environment, and read the result — unless
								something gives it real verification tools.
							</p>
						</FadeIn>

						<div className="grid gap-6 md:grid-cols-3">
							{PAINS.map((p, i) => {
								const Icon = p.icon;
								return (
									<FadeIn key={p.title} delay={i * 100}>
										<Card className="card-hover h-full p-7">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
												<Icon className="h-6 w-6 text-destructive" />
											</div>
											<h3 className="text-xl font-semibold text-foreground">
												{p.title}
											</h3>
											<p className="mt-3 text-muted-foreground">{p.body}</p>
										</Card>
									</FadeIn>
								);
							})}
						</div>
					</div>
				</section>

				{/* ============================== HOW ============================== */}
				<section id="how" className="scroll-mt-24 bg-background py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-14 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								How it works
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								A verification API platform, exposed as agent tools
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								The tool list is generated from the EPS API source of truth, so
								it tracks the platform automatically — new verification APIs
								show up as new tools, no client changes.
							</p>
						</FadeIn>

						<div className="grid gap-6 md:grid-cols-3">
							{HOW.map((h, i) => {
								const Icon = h.icon;
								return (
									<FadeIn key={h.title} delay={i * 100}>
										<Card className="card-hover h-full p-7">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-eko-gold/10">
												<Icon className="h-6 w-6 text-eko-gold" />
											</div>
											<h3 className="text-xl font-semibold text-foreground">
												{h.title}
											</h3>
											<p className="mt-3 text-muted-foreground">{h.body}</p>
										</Card>
									</FadeIn>
								);
							})}
						</div>
					</div>
				</section>

				{/* ============================ CONNECT ============================ */}
				<section id="connect" className="scroll-mt-24 bg-muted py-20 lg:py-28">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto mb-12 max-w-2xl text-center">
							<span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-amber-700">
								Connect it
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
								Two ways to plug in
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								Coding agents: one command. Otherwise use the hosted remote
								endpoint, or run it locally over stdio. Either way, your EPS
								credentials stay in your own config — never in a prompt.
							</p>
						</FadeIn>

						<div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
							{/* Remote */}
							<FadeIn>
								<Card className="flex h-full flex-col gap-5 p-6 lg:p-8">
									<div className="flex items-center gap-2.5">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-eko-navy">
											<Radar className="h-5 w-5 text-eko-gold" />
										</div>
										<h3 className="text-xl font-semibold text-foreground">
											Hosted remote
										</h3>
									</div>
									<p className="text-sm text-muted-foreground">
										Point any MCP client that supports remote (streamable HTTP)
										servers with header auth — such as Claude Code — at the
										hosted endpoint. Nothing to install; always the current
										production tools.
									</p>
									<ConfigBlock
										text={REMOTE_CONFIG}
										caption="MCP client config"
									/>
								</Card>
							</FadeIn>

							{/* Local */}
							<FadeIn delay={100}>
								<Card className="flex h-full flex-col gap-5 p-6 lg:p-8">
									<div className="flex items-center gap-2.5">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-eko-navy">
											<McpIcon className="h-5 w-5 text-eko-gold" />
										</div>
										<h3 className="text-xl font-semibold text-foreground">
											Local stdio
										</h3>
									</div>
									<p className="text-sm text-muted-foreground">
										Run the server as a local process and pass credentials via
										environment variables. Good for self-hosted agents and CI.
									</p>
									<CommandBlock
										text={EPS_TRANSACT_MCP_CMD}
										caption="Run locally"
									/>
									<p className="text-xs text-muted-foreground">
										Exact credential, environment, and API-allowlist variable
										names are documented in the package README.
									</p>
								</Card>
							</FadeIn>
						</div>

						<FadeIn className="mx-auto mt-8 max-w-4xl">
							<div className="flex items-start gap-3 rounded-xl border border-eko-gold/30 bg-eko-gold-light/50 px-5 py-4">
								<Loader className="mt-0.5 h-5 w-5 shrink-0 text-eko-navy" />
								<p className="text-sm text-eko-slate">
									Start in <strong>UAT</strong> (the default) and confirm your
									flows against sandbox responses before selecting the
									production environment explicitly.
								</p>
							</div>
						</FadeIn>
					</div>
				</section>

				{/* ===================== CROSS-LINK TO /ai ======================== */}
				<section className="bg-background py-16">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<FadeIn className="mx-auto max-w-3xl">
							<Card className="flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-start gap-4">
									<ScrollText className="mt-1 h-6 w-6 shrink-0 text-eko-navy" />
									<div>
										<h3 className="text-lg font-semibold text-foreground">
											Integrating EPS by hand, or with a coding agent?
										</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											If you&rsquo;re writing the integration yourself, the AI
											coding toolkit — MCP context server, SDKs, and recipes —
											is over on Build with AI.
										</p>
									</div>
								</div>
								<Button variant="outline" asChild className="shrink-0">
									<Link to="/ai">
										Build with AI
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
							</Card>
						</FadeIn>
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
								Give your agents verification superpowers
							</h2>
							<p className="mt-4 text-lg text-white/70">
								Connect the MCP and let your agents verify PANs, bank accounts,
								and more — signed, scoped, and sandbox-first.
							</p>
							<div className="mt-8 flex flex-wrap justify-center gap-4">
								<Button variant="gold" size="lg" asChild>
									<a href="#connect">
										Connect the MCP
										<ArrowRight className="h-4 w-4" />
									</a>
								</Button>
								<Button variant="hero-outline" size="lg" asChild>
									<Link to="/docs">Browse verification APIs</Link>
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

export default AgentsPage;
