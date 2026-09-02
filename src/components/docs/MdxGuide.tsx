import { GUIDE_COMPONENTS } from "@/content/docs/docs-guide-components";
import { Callout } from "@/components/docs/Callout";
import { CodeSnippets } from "@/components/docs/CodeSnippets";
import { FaqList } from "@/components/docs/FaqList";
import { MdxProse } from "@/components/docs/MdxProse";
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
 * Renders a compiled MDX guide inside the shared `prose` container. Returns null
 * for an unknown slug so the caller can fall back to NotFound.
 */
export const MdxGuide = ({ slug }: { slug: string }) => {
	const Guide = GUIDE_COMPONENTS[slug];
	if (!Guide) return null;
	return (
		<MdxProse>
			<Guide components={MDX_COMPONENTS} />
		</MdxProse>
	);
};
