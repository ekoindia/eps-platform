import { AiHint } from "@/components/AiHint";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { InlineCode } from "@/components/docs/InlineCode";
import { LangIcon } from "@/components/icons/LangIcon";
import { McpIcon } from "@/components/icons/McpIcon";
import { Button } from "@/components/ui/button";
import { EPS_MCP_CMD, SITE_URL } from "@/lib/config/site";
import { API_ENVIRONMENTS, AUTH_HEADERS } from "@/lib/data/api-auth";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import { docsHref } from "@/lib/data/docs-registry";
import {
	type SampleLang,
	SDK_INSTALL,
	SDK_LANGS,
	sampleFor,
	sdkSampleFor,
	toSdkLang,
} from "@/lib/docs/code-samples";
import { useDocsMode } from "@/lib/docs/use-docs-mode";
import { usePreferredLang } from "@/lib/docs/use-preferred-lang";
import { cn } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-chat";
import {
	type LucideIcon,
	ArrowRight,
	Check,
	Copy,
	Download,
	FileJson,
	FileText,
	Package,
	Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";

const MD_PATH = "/docs.md";

/** A simple, well-known POST endpoint used for the "first request" showcase. */
const SHOWCASE_SPEC = API_SPECS_MAP["pan-lite"];

/** Raw-HTTP languages offered in API mode — SDK languages first, cURL last. */
const API_LANGS: { id: SampleLang; label: string }[] = [
	{ id: "javascript", label: "Node.js" },
	{ id: "php", label: "PHP" },
	{ id: "python", label: "Python" },
	{ id: "curl", label: "cURL" },
];

interface DownloadLink {
	icon: LucideIcon;
	title: string;
	description: string;
	href: string;
}

const DOWNLOADS: DownloadLink[] = [
	{
		icon: Download,
		title: "Postman Collection",
		description: "Every endpoint, pre-signed and ready to send.",
		href: "/agent/eps.postman_collection.json",
	},
	{
		icon: FileJson,
		title: "OpenAPI Specification",
		description: "OpenAPI 3.1 JSON for codegen and tooling.",
		href: "/openapi.json",
	},
	{
		icon: FileText,
		title: "Markdown for AI agents",
		description: "The whole reference in one file to feed an LLM.",
		href: MD_PATH,
	},
];

/** Copy-to-clipboard button; `dark` adapts it for use inside a code panel. */
const CopyButton = ({ text, dark }: { text: string; dark?: boolean }) => {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return;
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	};
	return (
		<button
			type="button"
			onClick={copy}
			aria-label="Copy to clipboard"
			className={cn(
				"shrink-0 cursor-pointer rounded-md p-1.5 transition-colors",
				dark
					? "text-white/50 hover:bg-white/10 hover:text-white"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
};

/** A light pill toggle (language selector). */
const Pill = ({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) => (
	<button
		type="button"
		onClick={onClick}
		aria-pressed={active}
		className={cn(
			"inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
			active
				? "bg-eko-gold/25 text-foreground font-semibold shadow-sm ring-1 ring-eko-gold/40"
				: "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
		)}
	>
		{children}
	</button>
);

/** One of the three "how do you want to build" entry points — sets the mode. */
const PathCard = ({
	icon: Icon,
	title,
	description,
	active,
	onClick,
}: {
	icon: LucideIcon | typeof McpIcon;
	title: string;
	description: string;
	active: boolean;
	onClick: () => void;
}) => (
	<button
		type="button"
		onClick={onClick}
		aria-pressed={active}
		role="radio"
		aria-checked={active}
		className={cn(
			"group relative flex w-full cursor-pointer flex-col rounded-2xl border p-5 text-left transition-colors",
			active
				? "border-eko-gold bg-eko-gold/5"
				: "border-border/60 hover:border-eko-gold hover:bg-muted/40",
		)}
	>
		{/* Radio indicator — empty circle when unselected, filled gold disc with a
		    thick tick when selected. */}
		<span
			aria-hidden="true"
			className={cn(
				"absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
				active
					? "border-eko-gold bg-eko-gold text-white"
					: "border-muted-foreground/40 group-hover:border-eko-gold",
			)}
		>
			{active && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
		</span>
		<Icon className="h-6 w-6 text-eko-gold" />
		<h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
		<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		<span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-eko-gold">
			{active ? "Selected" : "Choose"}
			<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
		</span>
	</button>
);

/**
 * A numbered step in the quickstart flow. Presentational only — a semantic
 * `<section>` with an `<h2>` (PathCard already uses `<h3>`), a gold number badge,
 * an optional subtitle, then its content. The wrapper is intentionally NOT
 * card-styled so any cards inside it don't nest card-in-card.
 */
const Step = ({
	n,
	title,
	subtitle,
	children,
}: {
	n: number;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}) => (
	<section className="mt-20 scroll-mt-28">
		<div className="flex items-center gap-3">
			<span className="inline-flex shrink-0 items-center justify-center rounded-full bg-eko-navy px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
				Step {n}
			</span>
			<h2 className="text-xl font-semibold tracking-tight text-foreground">
				{title}
			</h2>
		</div>
		{subtitle && (
			<p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
		)}
		<div className="mt-4">{children}</div>
	</section>
);

/**
 * `/docs` — the documentation landing page. Instead of re-listing every endpoint
 * (already in the left nav), it answers "how do I start building on EPS?": pick a
 * mode (API / SDK / AI Coding), see a real example for the demo endpoint in your
 * language, and grab the downloadable artifacts. The mode + language are persisted
 * and shared with every endpoint's code pane. Fully prerenderable; client-only
 * state just reconciles the saved preferences after mount.
 */
const DocsIndexPage = () => {
	const [mode, setMode] = useDocsMode();
	const [lang, setLang] = usePreferredLang();
	const { hash } = useLocation();
	const canonical = `${SITE_URL}/docs`;

	// Deep-link from the header "Developers → SDKs & Libraries" entry: /docs#sdk
	// preselects the "Use an SDK" integration mode. Runs after the localStorage
	// reconcile in useDocsMode, so the hash wins for this visit.
	useEffect(() => {
		if (hash === "#sdk") setMode("sdk");
	}, [hash, setMode]);

	const isAi = mode === "ai";
	const sdkLang = toSdkLang(lang);
	const install = SDK_INSTALL[sdkLang];
	// API/SDK only — the AI path delegates everything to the agent, so no sample.
	const code =
		mode === "sdk"
			? sdkSampleFor(SHOWCASE_SPEC, sdkLang)
			: sampleFor(SHOWCASE_SPEC, lang);

	const firstCallTitle =
		mode === "sdk"
			? "Install the SDK & make your first call"
			: "Your first request";
	const firstCallSubtext =
		mode === "sdk"
			? "Install, construct the client, and call any endpoint by slug. We'll remember your language across the docs."
			: "Copy a ready-to-run request. We'll remember your language across the docs.";

	/**
	 * AI cross-sell banner — rendered inline as the AI path's "step 2 result",
	 * and again near the page foot (hidden there in AI mode to avoid a duplicate).
	 * Always present in the default (sdk) prerender so the static HTML keeps an
	 * internal link to /ai.
	 */
	const aiBanner = (
		<div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-eko-navy p-6 text-white sm:flex-row sm:items-center sm:p-8">
			<div className="flex items-start gap-4">
				<McpIcon className="mt-0.5 h-8 w-8 shrink-0 text-eko-gold" />
				<div>
					<h3 className="text-lg font-semibold">
						Skip the integration work — build with AI agents
					</h3>
					<p className="mt-1 text-sm text-white/70">
						Point Claude, Cursor or Copilot at our MCP server and context packs.
						Correct signing on the first try, no SDK wiring.
					</p>
				</div>
			</div>
			<Button variant="gold" asChild className="shrink-0">
				<Link to="/ai">
					Explore AI agents
					<ArrowRight className="ml-1 h-4 w-4" />
				</Link>
			</Button>
		</div>
	);

	return (
		<>
			<Helmet>
				<title>Developer Documentation{SITE_TITLE_SUFFIX}</title>
				<meta
					name="description"
					content="Start building on Eko's EPS platform — SDKs for Node.js and PHP, REST APIs, Postman & OpenAPI downloads, or fully automated integration with AI agents."
				/>
				<link rel="canonical" href={canonical} />
				<meta property="og:title" content="Developer Documentation" />
				<meta
					property="og:description"
					content="SDKs, REST APIs and AI-agent tooling to integrate Eko's KYC, verification, payment and banking platform."
				/>
				<meta property="og:type" content="website" />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={MD_PATH}
				/>
			</Helmet>
			<AiHint mdPath={MD_PATH} />

			<DocsLayout>
				<div className="mx-auto max-w-3xl">
					{/* Hero */}
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Start building on EPS
					</h1>
					<p className="mt-3 text-lg text-muted-foreground">
						Integrate Eko's KYC, verification, payment and banking platform your
						way — drop in a signed SDK, call the REST API directly, or let an AI
						agent build the integration for you. Follow the steps below to go
						from zero to your first verified call.
					</p>

					{/* Step 1 — credentials */}
					<Step
						n={1}
						title="Get your credentials"
						subtitle="Eko's UAT / sandbox is self-serve — sign up with your mobile number, verify with your PAN and bank account."
					>
						<div className="flex flex-wrap items-center gap-4">
							<Button variant="gold" onClick={() => openZohoChat()}>
								Get your API keys
							</Button>
							<div className="flex-1 self-center text-xs text-muted-foreground">
								{API_ENVIRONMENTS.production.note}
							</div>
						</div>
					</Step>

					{/* Step 2 — choose how to build (sets the persisted integration mode) */}
					<Step
						n={2}
						title="Choose how you'll build"
						subtitle="Pick a path — we'll remember it across the docs."
					>
						<div
							role="radiogroup"
							aria-label="Choose how you'll build"
							className="grid gap-4 sm:grid-cols-3"
						>
							<PathCard
								icon={Terminal}
								title="Call the API directly"
								description="Plain REST with cURL, plus Postman & OpenAPI."
								active={mode === "api"}
								onClick={() => {
									setMode("api");
									setLang("curl");
								}}
							/>
							<PathCard
								icon={Package}
								title="Use an SDK"
								description="Signed SDKs for Node.js & PHP — HMAC auth & input validations baked in."
								active={mode === "sdk"}
								onClick={() => setMode("sdk")}
							/>
							<PathCard
								icon={McpIcon}
								title="Build with AI"
								description="MCP server & context packs for Claude, Cursor, Copilot."
								active={mode === "ai"}
								onClick={() => setMode("ai")}
							/>
						</div>

						{/* AI path resolves here — banner to the AI hub, no further steps. */}
						{isAi && (
							<div className="mt-6">
								<div className="mb-3 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 font-mono text-sm">
									<span
										aria-hidden
										className="select-none text-muted-foreground"
									>
										$
									</span>
									<code className="min-w-0 flex-1 break-all text-foreground">
										{EPS_MCP_CMD}
									</code>
									<CopyButton text={EPS_MCP_CMD} />
								</div>
								{aiBanner}
							</div>
						)}
					</Step>

					{/* Steps 3–5 — API & SDK paths only */}
					{!isAi && (
						<>
							{/* Step 3 — language */}
							<Step
								n={3}
								title="Pick your language"
								subtitle="Your first request and SDK snippets will use this language."
							>
								<div className="inline-flex flex-wrap gap-1 rounded-lg border border-border/60 p-1">
									{(mode === "sdk" ? SDK_LANGS : API_LANGS).map((l) => (
										<Pill
											key={l.id}
											active={(mode === "sdk" ? sdkLang : lang) === l.id}
											onClick={() => setLang(l.id)}
										>
											<LangIcon id={l.id} className="h-4 w-4 shrink-0" />
											{l.label}
										</Pill>
									))}
								</div>
							</Step>

							{/* Step 4 — first request (SDK adds the install line) */}
							<Step n={4} title={firstCallTitle} subtitle={firstCallSubtext}>
								{mode === "sdk" && install && (
									<div className="mb-4 space-y-2">
										<div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 font-mono text-sm">
											<span
												aria-hidden
												className="select-none text-muted-foreground"
											>
												$
											</span>
											<code className="min-w-0 flex-1 break-all text-foreground">
												{install.command}
											</code>
											<CopyButton text={install.command} />
										</div>
										<a
											href={install.registryUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-sm font-medium text-eko-gold hover:underline"
										>
											View on {install.registry}
											<ArrowRight className="h-3.5 w-3.5" />
										</a>
									</div>
								)}

								<div className="code-block code-block--solid overflow-hidden rounded-xl">
									<div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
										<span className="truncate font-mono text-xs text-white/60">
											{`${SHOWCASE_SPEC.name} · ${SHOWCASE_SPEC.method} ${SHOWCASE_SPEC.path}`}
										</span>
										<CopyButton text={code} dark />
									</div>
									<pre className="docs-scroll overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
										<code>{code}</code>
									</pre>
								</div>

								<p className="mt-3 text-sm text-muted-foreground">
									Browse every endpoint in the left sidebar, or open the{" "}
									<Link
										to={docsHref(SHOWCASE_SPEC.slug)}
										className="font-medium text-eko-gold hover:underline"
									>
										{SHOWCASE_SPEC.name}
									</Link>{" "}
									reference for parameters, responses and a live console.
								</p>
							</Step>

							{/* Step 5 — response envelope */}
							<Step
								n={5}
								title="Handle the response"
								subtitle="EPS APIs share a common response envelope."
							>
								<div className="rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground">
									<ul className="space-y-1.5">
										<li>
											<code className="font-mono text-foreground">status</code>{" "}
											— <code className="font-mono">0</code> means success.
										</li>
										<li>
											<code className="font-mono text-foreground">
												response_status_id
											</code>{" "}
											— transaction status id (see status &amp; error codes).
										</li>
										<li>
											<code className="font-mono text-foreground">message</code>{" "}
											— a human-readable description.
										</li>
										<li>
											<code className="font-mono text-foreground">data</code> —
											the API-specific payload.
										</li>
									</ul>
									<p className="mt-3">
										<Link
											to={docsHref("error-codes")}
											className="font-medium text-eko-gold hover:underline"
										>
											See status &amp; error codes
										</Link>{" "}
										for the full list.
									</p>
								</div>
							</Step>
						</>
					)}

					{/* AI cross-sell banner — hidden in AI mode (the inline banner shows there) */}
					{!isAi && <div className="mt-16">{aiBanner}</div>}

					{/* Base URL + auth callout */}
					<section className="mt-16">
						<h2 className="text-xl font-semibold tracking-tight text-foreground">
							Environments &amp; auth
						</h2>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							{(["sandbox", "production"] as const).map((key) => {
								const env = API_ENVIRONMENTS[key];
								return (
									<div
										key={key}
										className="rounded-xl border border-border/60 px-4 py-3"
									>
										<div className="text-sm font-semibold text-foreground">
											{env.label}
										</div>
										<code className="mt-1 block break-all font-mono text-xs text-muted-foreground">
											{env.baseUrl}
										</code>
										{env.note && (
											<p className="mt-2 text-xs text-muted-foreground">
												{env.note}
											</p>
										)}
									</div>
								);
							})}
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							The full endpoint URL is always{" "}
							<code className="font-mono text-foreground">baseUrl + path</code>{" "}
							— e.g. <code className="font-mono">{SHOWCASE_SPEC.path}</code> on
							the sandbox base URL above.
						</p>

						{/* Required request headers — sent on every call */}
						<div className="mt-4 rounded-xl border border-border/60 px-4 py-3">
							<div className="text-sm font-semibold text-foreground">
								Required request headers
							</div>
							<ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
								{AUTH_HEADERS.map((h) => (
									<li key={h.name}>
										<code className="font-mono text-foreground">{h.name}</code>
										{h.description ? ` — ${h.description}` : ""}
									</li>
								))}
							</ul>
							<p className="mt-2 text-xs text-muted-foreground">
								Requests accept both <InlineCode>application/json</InlineCode>{" "}
								and <InlineCode>application/x-www-form-urlencoded</InlineCode>{" "}
								bodies. Use <InlineCode>multipart/form-data</InlineCode> for
								file uploads.
							</p>
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							The <code className="font-mono">secret-key</code> is an HMAC
							signature computed per request.{" "}
							<Link
								to={docsHref("how-auth-works")}
								className="font-medium text-eko-gold hover:underline"
							>
								See how auth works
							</Link>
							.
						</p>
					</section>

					{/* Downloads */}
					<section className="mt-16">
						<h2 className="text-xl font-semibold tracking-tight text-foreground">
							Specs & downloads
						</h2>
						<div className="mt-4 grid gap-3 sm:grid-cols-3">
							{DOWNLOADS.map((d) => (
								<a
									key={d.href}
									href={d.href}
									target="_blank"
									rel="noopener noreferrer"
									className="group flex flex-col rounded-xl border border-border/60 p-4 transition-colors hover:border-eko-gold hover:bg-muted/40"
								>
									<d.icon className="h-5 w-5 text-eko-gold" />
									<span className="mt-2 text-sm font-medium text-foreground">
										{d.title}
									</span>
									<span className="mt-1 text-xs text-muted-foreground">
										{d.description}
									</span>
								</a>
							))}
						</div>
					</section>
				</div>
			</DocsLayout>
		</>
	);
};

export default DocsIndexPage;
