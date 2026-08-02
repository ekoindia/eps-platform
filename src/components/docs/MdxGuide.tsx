import { GUIDE_COMPONENTS } from "@/content/docs/docs-guide-components";
import { Callout } from "@/components/docs/Callout";
import { CodeSnippets } from "@/components/docs/CodeSnippets";
import { FaqList } from "@/components/docs/FaqList";
import { RdServiceTester } from "@/components/docs/RdServiceTester";
import { SecretKeyTester } from "@/components/docs/SecretKeyTester";
import { Button } from "@/components/ui/button";

/** Custom components MDX guides may use by tag name (no import needed in `.mdx`). */
const MDX_COMPONENTS = {
	Button,
	Callout,
	CodeSnippets,
	FaqList,
	RdServiceTester,
	SecretKeyTester,
};

/**
 * Renders a compiled MDX guide inside a typographic `prose` container that
 * tracks the site theme (and inverts under docs-local dark mode). Returns null
 * for an unknown slug so the caller can fall back to NotFound.
 */
export const MdxGuide = ({ slug }: { slug: string }) => {
	const Guide = GUIDE_COMPONENTS[slug];
	if (!Guide) return null;
	return (
		<div className="docs-inline-code-prose prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-semibold prose-a:text-eko-gold-ink prose-a:underline dark:prose-a:text-eko-gold [&_:where(h1,h2,h3,h4,h5,h6)_a]:!no-underline [&_:where(h1,h2,h3,h4,h5,h6)_a]:!text-eko-navy dark:[&_:where(h1,h2,h3,h4,h5,h6)_a]:!text-eko-gold">
			<Guide components={MDX_COMPONENTS} />
		</div>
	);
};
