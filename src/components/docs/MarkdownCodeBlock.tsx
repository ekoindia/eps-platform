import "@/lib/docs/prism-setup";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import {
	type ComponentProps,
	type ReactElement,
	isValidElement,
	useState,
} from "react";
import "./markdown-code.css";

/**
 * Renderer for fenced code blocks (the ```` ```java ```` block in the screenshot)
 * inside endpoint descriptions. Plugged into `react-markdown` as the `pre`
 * component, so inline `` `code` `` (the `code` element) is untouched.
 *
 * Self-themed via `--mdc-*` (see `markdown-code.css`) so it sits naturally in
 * the middle pane in both light and dark, independent of the right-pane palette.
 * Highlighting uses prism-react-renderer over the globally-registered grammars
 * (`prism-setup`); an unknown language falls back to plain, never throwing.
 */

/** Token → `--mdc-*` colour map. Broad token names so nothing renders unstyled. */
const mdCodeTheme: PrismTheme = {
	plain: { color: "var(--mdc-fg)", backgroundColor: "transparent" },
	styles: [
		{
			types: [
				"keyword",
				"builtin",
				"operator",
				"boolean",
				"constant",
				"symbol",
			],
			style: { color: "var(--mdc-kw)" },
		},
		{
			types: ["string", "char", "attr-value", "regex", "inserted"],
			style: { color: "var(--mdc-str)" },
		},
		{
			types: ["function", "class-name", "tag", "selector"],
			style: { color: "var(--mdc-fn)" },
		},
		{ types: ["number", "url"], style: { color: "var(--mdc-num)" } },
		{
			types: ["comment", "punctuation", "prolog", "cdata", "doctype"],
			style: { color: "var(--mdc-cm)" },
		},
	],
};

/** Fence info-string → Prism grammar name (defaults to the given id). */
const LANG_ALIAS: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	sh: "bash",
	shell: "bash",
	console: "bash",
	curl: "bash",
	py: "python",
	jsonc: "json",
};

const prismLang = (lang?: string): string =>
	lang ? (LANG_ALIAS[lang] ?? lang) : "text";

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
			aria-label="Copy code to clipboard"
			className="cursor-pointer rounded p-1 text-[var(--mdc-muted)] transition-colors hover:text-[var(--mdc-fg)]"
		>
			{copied ? (
				<Check className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
		</button>
	);
};

/** react-markdown renders fenced code as `<pre><code class="language-x">…`. */
export const MarkdownCodeBlock = ({ children }: ComponentProps<"pre">) => {
	const codeEl =
		isValidElement(children) &&
		(children as ReactElement<{ className?: string; children?: unknown }>);
	if (!codeEl) {
		return <pre>{children}</pre>;
	}

	const className = codeEl.props.className ?? "";
	const lang = /language-(\w+)/.exec(className)?.[1];
	const code = String(codeEl.props.children ?? "").replace(/\n$/, "");

	return (
		<div className="docs-md-code my-5 overflow-hidden rounded-lg border border-[var(--mdc-border)] bg-[var(--mdc-bg)]">
			<div className="flex items-center justify-between border-b border-[var(--mdc-border)] bg-[var(--mdc-hdr)] px-3 py-1.5">
				<span className="font-mono text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--mdc-muted)]">
					{lang ?? "code"}
				</span>
				<CopyButton text={code} />
			</div>
			<div className="docs-scroll overflow-x-auto px-4 py-3 font-mono text-[0.8125rem] leading-relaxed">
				<Highlight theme={mdCodeTheme} code={code} language={prismLang(lang)}>
					{({ tokens, getLineProps, getTokenProps }) => (
						<pre className={cn("whitespace-pre")}>
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
	);
};
