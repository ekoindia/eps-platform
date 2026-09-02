/**
 * The dark slate code card used by docs guides: a header slot (language tabs,
 * or nothing) plus a line-numbered, syntax-highlighted body with a copy button.
 *
 * Self-contained DARK theme (fixed `codeBlockTheme`, not the `--rp-*` third-pane
 * tokens, which are undefined in the main prose column), so it looks right
 * anywhere and in both site light/dark modes.
 *
 * Shared by `<CodeSnippets>` (language-tabbed) and `<SdkFacts>` (single
 * language) so the two can never drift apart visually.
 */
import { codeBlockTheme } from "@/lib/code-block-theme";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { Highlight, Prism } from "prism-react-renderer";
import { type ReactNode, useState } from "react";

/** prism-react-renderer bundles a fixed grammar set (js/python/clike/cpp… but
 * NOT php/java/csharp). Fall back to `clike` for the unbundled ones so they still
 * get string/comment/keyword highlighting without pulling in a prismjs dep. */
export const prismLang = (language: string): string =>
	language in Prism.languages ? language : "clike";

/** Copy-to-clipboard button, dark-styled for the slate card. Copies `text` at
 * click time; no-ops (never throws) when the Clipboard API is unavailable. */
export const CopyButton = ({ text }: { text: string }) => {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return;
		navigator.clipboard.writeText(text).then(
			() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			},
			() => {}, // clipboard denied — fail silently, no console noise
		);
	};
	return (
		<button
			type="button"
			onClick={copy}
			aria-label="Copy code to clipboard"
			className={cn(
				"cursor-pointer rounded-md border border-slate-700 p-1.5 transition-colors",
				copied
					? "text-emerald-400"
					: "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
			)}
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
};

interface CodeCardProps {
	code: string;
	language: string;
	/** Left side of the header — language tabs, a filename, or nothing. */
	header?: ReactNode;
	/** Ties the body to a `role="tab"` header for assistive tech. */
	panelId?: string;
	panelRole?: "tabpanel";
}

export const CodeCard = ({
	code,
	language,
	header,
	panelId,
	panelRole,
}: CodeCardProps) => {
	const body = code.replace(/\n$/, "");
	const lineCount = body.split("\n").length;
	return (
		<div className="not-prose overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
			<div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-800/50 px-3 py-2">
				{header ?? <span />}
				<CopyButton text={code} />
			</div>
			<div
				id={panelId}
				role={panelRole}
				className="flex bg-slate-900 font-mono text-xs leading-relaxed"
			>
				<div
					aria-hidden
					className="select-none py-3 pl-4 pr-3 text-right text-slate-600"
				>
					{Array.from({ length: lineCount }, (_, i) => (
						<div key={i}>{i + 1}</div>
					))}
				</div>
				<div className="min-w-0 flex-1 overflow-x-auto py-3 pr-4">
					<Highlight
						theme={codeBlockTheme}
						code={body}
						language={prismLang(language)}
					>
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
				</div>
			</div>
		</div>
	);
};
