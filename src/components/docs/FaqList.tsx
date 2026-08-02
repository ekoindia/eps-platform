import { FaqAccordion } from "@/components/sections/FaqSection";
import { faqsByTag, GLOBAL_FAQS, parseFaqTags } from "@/lib/data/common-faqs";

/**
 * Renders the global FAQs in one or more categories, for embedding in an MDX
 * guide (`<FaqList tags="auth,testing" />`). The `.md` twin gets the same
 * questions via `expandFaqList` in `render-doc.ts` — keep the two in step.
 *
 * `not-prose` keeps the docs `prose` styles off the accordion markup; the
 * answer body carries its own link/code/list styling.
 *
 * @param tags - Comma-separated {@link FaqTag} names; throws on an unknown tag.
 */
export const FaqList = ({ tags }: { tags: string }) => (
	<FaqAccordion
		className="not-prose my-6"
		faqs={faqsByTag(GLOBAL_FAQS, parseFaqTags(tags))}
	/>
);
