import { useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	SAMPLE_LANGS,
	sampleFor,
	type SampleLang,
} from "@/lib/docs/code-samples";
import { HttpMethodTag } from "./HttpMethodTag";

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
			className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
};

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
 * Right-rail request/response panel in the Scalar style:
 *   • a request card with a `METHOD /path` header, language tabs, line-numbered
 *     code and a "Test Request" action;
 *   • an example-response card with a status header.
 * Code samples come from the pure generators; auth values are placeholders. The
 * "Test Request" action hands off to the Scalar "Try it" modal (`onTest`), which
 * signs and sends live sandbox requests. The cURL/JS/Python samples double as the
 * copy-and-run fallback when the modal/proxy is unavailable.
 */
export const CodeSamples = ({
	spec,
	onTest,
}: {
	spec: ApiSpec;
	onTest?: (path: string, method: string) => void;
}) => {
	const [lang, setLang] = useState<SampleLang>(SAMPLE_LANGS[0].id);
	const code = sampleFor(spec, lang);

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

			{/* Request card */}
			<div className="code-block overflow-hidden">
				<div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
					<div className="flex min-w-0 items-center gap-2">
						<HttpMethodTag method={spec.method} variant="onDark" />
						<code className="truncate font-mono text-xs text-white/70">
							{spec.path}
						</code>
					</div>
					<CopyButton text={code} />
				</div>

				<div className="flex gap-1 border-b border-white/10 px-3 py-2">
					{SAMPLE_LANGS.map((l) => (
						<button
							key={l.id}
							type="button"
							onClick={() => setLang(l.id)}
							className={cn(
								"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
								lang === l.id
									? "bg-white/10 text-white"
									: "text-white/50 hover:text-white",
							)}
						>
							{l.label}
						</button>
					))}
				</div>

				<NumberedCode code={code} />

				<div className="flex justify-end border-t border-white/10 px-3 py-2.5">
					<button
						type="button"
						onClick={() => onTest?.(spec.path, spec.method)}
						disabled={!onTest}
						className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-eko-navy transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<Play className="h-3.5 w-3.5 fill-current" />
						Test Request
					</button>
				</div>
			</div>

			{/* Response card */}
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
		</div>
	);
};
