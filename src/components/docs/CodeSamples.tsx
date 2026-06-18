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
import { type DocsMode, useDocsMode } from "@/lib/docs/use-docs-mode";
import { usePreferredLang } from "@/lib/docs/use-preferred-lang";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Copy, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
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
			className="cursor-pointer rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
};

/** A pill button used for the mode tab bar and language sub-tabs. */
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
			active ? "bg-white/10 text-white" : "text-white/50 hover:text-white",
		)}
	>
		{children}
	</button>
);

/** Dark code area with a line-number gutter and a horizontal scroll. */
const NumberedCode = ({ code }: { code: string }) => {
	const lines = code.split("\n");
	return (
		<div className="flex font-mono text-xs leading-relaxed">
			<div
				aria-hidden
				className="select-none py-3 pl-4 pr-3 text-right text-white/25"
			>
				{lines.map((_, i) => (
					<div key={i}>{i + 1}</div>
				))}
			</div>
			<div className="docs-scroll min-w-0 flex-1 overflow-x-auto py-3 pr-4">
				<pre className="text-slate-100">
					<code>{code}</code>
				</pre>
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
			<div className="code-block flex flex-wrap items-center gap-2 px-4 py-2.5 font-mono text-xs text-white/70">
				<span className="rounded bg-eko-gold/15 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-eko-gold">
					UAT
				</span>
				<span className="text-white/50">Base URL</span>
				<span className="break-all">{DEFAULT_BASE_URL}</span>
			</div>

			{/* Mode selector — its own box, separate from the request card */}
			<div className="code-block flex gap-1 px-3 py-2">
				{MODES.map((m) => (
					<TabButton
						key={m.id}
						active={mode === m.id}
						onClick={() => setMode(m.id)}
					>
						{m.label}
					</TabButton>
				))}
			</div>

			{/* Request card */}
			<div className="code-block overflow-hidden">
				{/* Header: METHOD /path + copy */}
				<div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
					<div className="flex min-w-0 items-center gap-2">
						<HttpMethodTag method={spec.method} variant="onDark" />
						<code className="truncate font-mono text-xs text-white/70">
							{spec.path}
						</code>
					</div>
					<CopyButton text={code} />
				</div>

				{/* API mode — raw HTTP language tabs */}
				{mode === "api" && (
					<>
						<div className="flex gap-1 border-b border-white/10 px-3 py-2">
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
						<NumberedCode code={code} />
						<div className="flex justify-end border-t border-white/10 px-3 py-2.5">
							<button
								type="button"
								onClick={() => onTest?.(spec.path, spec.method)}
								disabled={!onTest}
								className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-eko-navy transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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
						<div className="flex gap-1 border-b border-white/10 px-3 py-2">
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
							<div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 font-mono text-xs text-white/70">
								<span aria-hidden className="select-none text-white/40">
									$
								</span>
								<span className="min-w-0 flex-1 break-all">
									{install.command}
								</span>
								<CopyButton text={install.command} />
							</div>
						)}
						<NumberedCode code={code} />
					</>
				)}

				{/* AI Coding mode — agent prompt + MCP command */}
				{mode === "ai" && (
					<>
						<NumberedCode code={code} />
						<div className="space-y-2 border-t border-white/10 px-4 py-3">
							<div className="flex items-center gap-2 font-mono text-xs text-white/70">
								<span aria-hidden className="select-none text-white/40">
									$
								</span>
								<span className="min-w-0 flex-1 break-all">{EPS_MCP_CMD}</span>
								<CopyButton text={EPS_MCP_CMD} />
							</div>
							<Link
								to="/ai"
								className="inline-flex items-center gap-1 text-xs font-medium text-eko-gold hover:underline"
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
				<div className="code-block overflow-hidden">
					<div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
						<span className="font-mono text-xs font-semibold text-emerald-400">
							200
						</span>
						<span className="text-xs text-white/50">Example response</span>
					</div>
					<NumberedCode
						code={JSON.stringify(spec.sampleSuccessResponse, null, 2)}
					/>
				</div>
			)}
		</div>
	);
};
