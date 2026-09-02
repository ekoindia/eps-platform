/**
 * `<CodeSnippets id="…" />` — a language-tabbed code block for docs guides,
 * driven by the named sets in `@/lib/docs/code-snippet-sets`. Supplied to MDX
 * guides via the `components` prop in `MdxGuide`, so `.mdx` authors write just
 * `<CodeSnippets id="sign-request" />` (no import).
 *
 * The card itself is `<CodeCard>`, shared with `<SdkFacts>`.
 *
 * The `.md` twin of a guide renders ONLY the default (first) snippet — see the
 * substitution in `renderGuideMarkdown` (`src/lib/markdown/render-doc.ts`).
 */
import { CodeCard } from "@/components/docs/CodeCard";
import { type LangId, LangIcon } from "@/components/icons/LangIcon";
import { getSnippetSet } from "@/lib/docs/code-snippet-sets";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

	return (
		<CodeCard
			code={current.code}
			language={current.language}
			panelId={panelId}
			panelRole="tabpanel"
			header={
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
			}
		/>
	);
};
