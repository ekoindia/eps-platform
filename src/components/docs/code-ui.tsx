/**
 * Shared presentational primitives for docs code panes — extracted from
 * `CodeSamples.tsx` so both the endpoint request pane and the guide
 * `<CodeSnippets>` component render identical copy buttons, language tabs, and
 * highlighted code (warm Parchment / navy via the `--rp-*` tokens).
 */
import { rpPrismTheme } from "@/lib/docs/prism-rp-theme";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { Highlight } from "prism-react-renderer";
import { useState } from "react";

/** Copy-to-clipboard button. Copies exactly `text` at click time. */
export const CopyButton = ({ text }: { text: string }) => {
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
export const TabButton = ({
	active,
	onClick,
	children,
	...aria
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
} & React.AriaAttributes) => (
	<button
		type="button"
		role="tab"
		aria-selected={active}
		onClick={onClick}
		className={cn(
			"inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
			active
				? "bg-[var(--rp-tabact)] text-[var(--rp-fg)]"
				: "text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]",
		)}
		{...aria}
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
export const NumberedCode = ({
	code,
	lang,
}: {
	code: string;
	lang?: string;
}) => {
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
