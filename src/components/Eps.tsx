import { SITE_ORG_NAME } from "@/lib/config/site";

/** Inline "EPS" acronym, expanded to its full name for a hover tooltip + a11y. */
export const Eps = () => (
	<abbr
		title={SITE_ORG_NAME}
		className="cursor-help underline decoration-dotted underline-offset-2"
	>
		EPS
	</abbr>
);
