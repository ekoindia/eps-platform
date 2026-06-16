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
		<div className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-semibold prose-a:text-eko-navy prose-a:no-underline prose-a:hover:underline dark:prose-a:text-eko-gold [&_:where(h1,h2,h3,h4,h5,h6)_a]:!no-underline [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.875em] [&_:not(pre)>code]:font-normal [&_:not(pre)>code]:before:content-[''] [&_:not(pre)>code]:after:content-['']">
			<Guide />
		</div>
	);
};
