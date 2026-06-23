import { remarkCallout } from "@/lib/docs/remark-callout";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Callout } from "./Callout";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

/**
 * Rich markdown renderer for API endpoint descriptions (the single source of
 * truth in `api-specs.ts` / `content/docs/endpoints/*.md`). Supports GFM
 * (tables, lists, inline code), section headings (h2–h4), syntax-highlighted
 * fenced code blocks, and GitHub-alert callouts (`> [!WARNING]`).
 *
 * `h1` is disallowed (the endpoint title owns the page h1). Inline `` `code` ``
 * is left to the `.docs-inline-code-prose` styles; only fenced blocks (`pre`) are
 * taken over by {@link MarkdownCodeBlock}.
 */

const heading =
	(tag: "h2" | "h3" | "h4", size: string) =>
	({ children }: { children?: ReactNode }) => {
		const Tag = tag;
		return (
			<Tag
				className={cn(
					"scroll-mt-28 font-semibold tracking-tight text-foreground",
					size,
				)}
			>
				{children}
			</Tag>
		);
	};

const components = {
	// `callout` is a custom element produced by remarkCallout (data.hName).
	callout: Callout,
	pre: MarkdownCodeBlock,
	h2: heading("h2", "mt-8 mb-3 text-lg"),
	h3: heading("h3", "mt-6 mb-2 text-base"),
	h4: heading("h4", "mt-4 mb-2 text-sm"),
} as unknown as Components;

export const MarkdownProse = ({
	content,
	className,
}: {
	content: string;
	className?: string;
}) => (
	<div
		className={cn(
			"docs-inline-code-prose text-[0.9375rem] leading-relaxed text-foreground/80",
			"[&_a]:font-medium [&_a]:text-eko-navy [&_a]:underline dark:[&_a]:text-eko-gold",
			"[&_strong]:font-semibold [&_strong]:text-foreground",
			"[&_p]:my-0 [&_p+p]:mt-3",
			"[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
			"[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
			"[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
			"[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5",
			"[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-foreground/70",
			className,
		)}
	>
		<ReactMarkdown
			remarkPlugins={[remarkGfm, remarkCallout]}
			components={components}
			disallowedElements={["h1"]}
			unwrapDisallowed
		>
			{content}
		</ReactMarkdown>
	</div>
);
