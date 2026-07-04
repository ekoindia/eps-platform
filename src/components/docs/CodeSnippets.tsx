/**
 * `<CodeSnippets id="…" />` — a language-tabbed code block for docs guides,
 * driven by the named sets in `@/lib/docs/code-snippet-sets`. Supplied to MDX
 * guides via the `components` prop in `MdxGuide`, so `.mdx` authors write just
 * `<CodeSnippets id="sign-request" />` (no import).
 *
 * Self-contained DARK slate editor theme (fixed `codeBlockTheme`, not the
 * `--rp-*` third-pane tokens which are undefined in the main prose column), so it
 * looks right anywhere and in both site light/dark modes.
 *
 * The `.md` twin of a guide renders ONLY the default (first) snippet — see the
 * substitution in `renderGuideMarkdown` (`src/lib/markdown/render-doc.ts`).
 */
import { type LangId, LangIcon } from "@/components/icons/LangIcon";
import { codeBlockTheme } from "@/lib/code-block-theme";
import { getSnippetSet } from "@/lib/docs/code-snippet-sets";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { Highlight, Prism } from "prism-react-renderer";
import { useState } from "react";

/** prism-react-renderer bundles a fixed grammar set (js/python/clike/cpp… but
 * NOT php/java/csharp). Fall back to `clike` for the unbundled ones so they still
 * get string/comment/keyword highlighting without pulling in a prismjs dep. */
const prismLang = (language: string): string =>
	language in Prism.languages ? language : "clike";

/** Copy-to-clipboard button, dark-styled for the slate card. Copies `text` at
 * click time; no-ops (never throws) when the Clipboard API is unavailable. */
const CopyButton = ({ text }: { text: string }) => {
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

export const CodeSnippets = ({ id }: { id: string }) => {
	const snippets = getSnippetSet(id);
	const [active, setActive] = useState(0);

	if (!snippets?.length) {
		// Unknown/empty set — never crash a docs page or the build over a typo'd id.
		if (import.meta.env?.DEV)
			console.warn(`<CodeSnippets id="${id}"> — no such snippet set`);
		return null;
	}

	const current = snippets[Math.min(active, snippets.length - 1)];
	const panelId = `code-snippet-${id}`;
	const lines = current.code.replace(/\n$/, "").split("\n");

	return (
		<div className="not-prose overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
			{/* Header: language tabs + copy */}
			<div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-800/50 px-3 py-2">
				<div
					role="tablist"
					aria-label="Language"
					className="flex flex-wrap gap-1"
				>
					{snippets.map((s, i) => (
						<button
							key={s.language}
							type="button"
							role="tab"
							aria-selected={i === active}
							aria-controls={panelId}
							onClick={() => setActive(i)}
							className={cn(
								"inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
								i === active
									? "bg-white/10 text-white"
									: "text-slate-400 hover:text-slate-200",
							)}
						>
							<LangIcon
								id={s.language as LangId}
								className="h-3.5 w-3.5 shrink-0"
							/>
							{s.label}
						</button>
					))}
				</div>
				<CopyButton text={current.code} />
			</div>

			{/* Code — highlighted over the dark slate body */}
			<div
				id={panelId}
				role="tabpanel"
				className="flex bg-slate-900 font-mono text-xs leading-relaxed"
			>
				<div
					aria-hidden
					className="select-none py-3 pl-4 pr-3 text-right text-slate-600"
				>
					{lines.map((_, i) => (
						<div key={i}>{i + 1}</div>
					))}
				</div>
				<div className="min-w-0 flex-1 overflow-x-auto py-3 pr-4">
					<Highlight
						theme={codeBlockTheme}
						code={current.code.replace(/\n$/, "")}
						language={prismLang(current.language)}
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
