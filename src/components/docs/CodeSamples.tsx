import { EPS_MCP_CMD } from "@/lib/config/site";
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	SAMPLE_LANGS,
	SDK_INSTALL,
	SDK_LANGS,
	sampleFor,
	sdkSampleFor,
	toAiPrompt,
	toSdkLang,
} from "@/lib/docs/code-samples";
import { prismLangFor, rpPrismTheme } from "@/lib/docs/prism-rp-theme";
import { type DocsMode, useDocsMode } from "@/lib/docs/use-docs-mode";
import { usePreferredLang } from "@/lib/docs/use-preferred-lang";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Copy, Play } from "lucide-react";
import { Highlight } from "prism-react-renderer";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./code-samples.css";
import { HttpMethodTag } from "./HttpMethodTag";

const MODES: { id: DocsMode; label: string }[] = [
	{ id: "api", label: "API" },
	{ id: "sdk", label: "SDK" },
	{ id: "ai", label: "AI Coding" },
];

const CopyButton = ({ text }: { text: string }) => {
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
				"cursor-pointer rounded-md border border-[var(--rp-btnline)] bg-[var(--rp-btn)] p-1.5 transition-colors",
				copied
					? "text-[var(--rp-ok)]"
					: "text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]",
			)}
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
};

/** A small pill button used for the language sub-tabs (cURL / JS / …). */
const TabButton = ({
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
		className={cn(
			"cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
			active
				? "bg-[var(--rp-tabact)] text-[var(--rp-fg)]"
				: "text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]",
		)}
	>
		{children}
	</button>
);

/**
 * Code area with a line-number gutter and horizontal scroll. When `lang` is
 * given, the body is syntax-highlighted via prism-react-renderer using the
 * {@link rpPrismTheme} (whose colours are `--rp-*` CSS variables, so it tracks
 * the light/dark palette); otherwise it renders as plain prose.
 */
const NumberedCode = ({ code, lang }: { code: string; lang?: string }) => {
	const src = code.replace(/\n$/, "");
	const lines = src.split("\n");
	return (
		<div className="flex bg-[var(--rp-code)] font-mono text-xs leading-relaxed">
			<div
				aria-hidden
				className="select-none py-3 pl-4 pr-3 text-right text-[var(--rp-ln)]"
			>
				{lines.map((_, i) => (
					<div key={i}>{i + 1}</div>
				))}
			</div>
			<div className="docs-scroll min-w-0 flex-1 overflow-x-auto py-3 pr-4">
				{lang ? (
					<Highlight theme={rpPrismTheme} code={src} language={lang}>
						{({ tokens, getLineProps, getTokenProps }) => (
							<pre className="whitespace-pre">
								{tokens.map((line, i) => (
									<div key={i} {...getLineProps({ line })}>
										{line.map((token, key) => (
											<span key={key} {...getTokenProps({ token })} />
										))}
									</div>
								))}
							</pre>
						)}
					</Highlight>
				) : (
					<pre className="whitespace-pre text-[var(--rp-txt)]">
						<code>{src}</code>
					</pre>
				)}
			</div>
		</div>
	);
};

/**
 * Right-rail panel. A mode tab bar (API · SDK · AI Coding) — persisted site-wide
 * via {@link useDocsMode} — switches what the request card shows:
 *   • API — raw HTTP samples (cURL/JS/Python/PHP) + a live "Test Request";
 *   • SDK — `@ekoindia/eps-sdk` usage for the chosen language + install hint;
 *   • AI Coding — a ready-to-paste agent prompt + the eps-context-mcp command.
 * Code samples come from the pure generators; auth values are placeholders /
 * env vars. "Test Request" (API only) hands off to the Scalar "Try it" modal.
 *
 * Colours come entirely from the `--rp-*` tokens (see `code-samples.css`), so
 * the pane is warm Parchment in light mode and navy in dark mode.
 */
export const CodeSamples = ({
	spec,
	onTest,
}: {
	spec: ApiSpec;
	onTest?: (path: string, method: string) => void;
}) => {
	const [mode, setMode] = useDocsMode();
	const [lang, setLang] = usePreferredLang();
	const sdkLang = toSdkLang(lang);
	const install = SDK_INSTALL[sdkLang];

	const code =
		mode === "sdk"
			? sdkSampleFor(spec, sdkLang)
			: mode === "ai"
				? toAiPrompt(spec)
				: sampleFor(spec, lang);

	return (
		<div className="space-y-6">
			{/* UAT base URL — the environment every sample/try-it call targets */}
			<div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--rp-line)] bg-[var(--rp-card)] px-4 py-2.5 font-mono text-xs text-[var(--rp-fg2)]">
				<span className="rounded border border-[var(--rp-accline)] bg-[var(--rp-accbg)] px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--rp-acc)]">
					UAT
				</span>
				<span className="text-[var(--rp-fg3)]">Base URL</span>
				<span className="break-all text-[var(--rp-fg)]">
					{DEFAULT_BASE_URL}
				</span>
				<div className="ml-auto">
					<CopyButton text={DEFAULT_BASE_URL} />
				</div>
			</div>

			{/* Mode selector — full-width segmented control, flat active tab */}
			<div className="flex gap-1 rounded-xl border border-[var(--rp-line)] bg-[var(--rp-card)] p-1.5">
				{MODES.map((m) => {
					const active = mode === m.id;
					return (
						<button
							key={m.id}
							type="button"
							onClick={() => setMode(m.id)}
							className={cn(
								"flex-1 cursor-pointer rounded-lg px-3 py-2 text-center text-sm transition-colors",
								active
									? "border border-[var(--rp-line)] bg-[var(--rp-tabact)] font-semibold text-[var(--rp-fg)]"
									: "border border-transparent font-medium text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]",
							)}
						>
							{m.label}
						</button>
					);
				})}
			</div>

			{/* Request card */}
			<div className="overflow-hidden rounded-xl border border-[var(--rp-line)] bg-[var(--rp-card)]">
				{/* Header: METHOD /path + copy */}
				<div className="flex items-center justify-between gap-2 border-b border-[var(--rp-line)] bg-[var(--rp-codehdr)] px-4 py-2.5">
					<div className="flex min-w-0 items-center gap-2">
						<HttpMethodTag method={spec.method} variant="soft" />
						<code className="truncate font-mono text-xs text-[var(--rp-fg2)]">
							{spec.path}
						</code>
					</div>
					<CopyButton text={code} />
				</div>

				{/* API mode — raw HTTP language tabs */}
				{mode === "api" && (
					<>
						<div className="flex gap-1 border-b border-[var(--rp-line)] px-3 py-2">
							{SAMPLE_LANGS.map((l) => (
								<TabButton
									key={l.id}
									active={lang === l.id}
									onClick={() => setLang(l.id)}
								>
									{l.label}
								</TabButton>
							))}
						</div>
						<NumberedCode code={code} lang={prismLangFor(lang)} />
						<div className="flex justify-end border-t border-[var(--rp-line)] px-3 py-2.5">
							<button
								type="button"
								onClick={() => onTest?.(spec.path, spec.method)}
								disabled={!onTest}
								className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--rp-fg)] px-3 py-1.5 text-xs font-semibold text-[var(--rp-bg)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Play className="h-3.5 w-3.5 fill-current" />
								Test Request
							</button>
						</div>
					</>
				)}

				{/* SDK mode — SDK language tabs + install hint */}
				{mode === "sdk" && (
					<>
						<div className="flex gap-1 border-b border-[var(--rp-line)] px-3 py-2">
							{SDK_LANGS.map((l) => (
								<TabButton
									key={l.id}
									active={sdkLang === l.id}
									onClick={() => setLang(l.id)}
								>
									{l.label}
								</TabButton>
							))}
						</div>
						{install && (
							<div className="flex items-center gap-2 border-b border-[var(--rp-line)] px-4 py-2 font-mono text-xs text-[var(--rp-fg2)]">
								<span aria-hidden className="select-none text-[var(--rp-ok)]">
									$
								</span>
								<span className="min-w-0 flex-1 break-all">
									{install.command}
								</span>
								<CopyButton text={install.command} />
							</div>
						)}
						<NumberedCode code={code} lang={prismLangFor(sdkLang)} />
					</>
				)}

				{/* AI Coding mode — agent prompt + MCP command */}
				{mode === "ai" && (
					<>
						<NumberedCode code={code} />
						<div className="space-y-2 border-t border-[var(--rp-line)] px-4 py-3">
							<div className="flex items-center gap-2 font-mono text-xs text-[var(--rp-fg2)]">
								<span aria-hidden className="select-none text-[var(--rp-ok)]">
									$
								</span>
								<span className="min-w-0 flex-1 break-all">{EPS_MCP_CMD}</span>
								<CopyButton text={EPS_MCP_CMD} />
							</div>
							<Link
								to="/ai"
								className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rp-acc)] hover:underline"
							>
								Build with AI agents
								<ArrowRight className="h-3.5 w-3.5" />
							</Link>
						</div>
					</>
				)}
			</div>

			{/* Response card — relevant to API & SDK (both return this shape) */}
			{mode !== "ai" && (
				<div className="overflow-hidden rounded-xl border border-[var(--rp-line)] bg-[var(--rp-card)]">
					<div className="flex items-center gap-2 border-b border-[var(--rp-line)] bg-[var(--rp-codehdr)] px-4 py-2.5">
						<span className="font-mono text-xs font-semibold text-[var(--rp-ok)]">
							200
						</span>
						<span className="text-xs text-[var(--rp-fg3)]">
							Example response
						</span>
					</div>
					<NumberedCode
						code={JSON.stringify(spec.sampleSuccessResponse, null, 2)}
						lang="json"
					/>
				</div>
			)}
		</div>
	);
};
