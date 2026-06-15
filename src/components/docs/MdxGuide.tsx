import { GUIDE_COMPONENTS } from "@/content/docs/docs-guide-components";

/**
 * Renders a compiled MDX guide inside a typographic `prose` container that
 * tracks the site theme (and inverts under docs-local dark mode). Returns null
 * for an unknown slug so the caller can fall back to NotFound.
 */
export const MdxGuide = ({ slug }: { slug: string }) => {
	const Guide = GUIDE_COMPONENTS[slug];
	if (!Guide) return null;
	return (
		<div className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-semibold prose-a:text-eko-navy prose-a:no-underline hover:prose-a:underline dark:prose-a:text-eko-gold prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-['']">
			<Guide />
		</div>
	);
};
