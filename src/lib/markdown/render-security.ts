import { SITE_URL } from "@/lib/config/site";
import {
	SECURITY_PAGE_DESCRIPTION,
	SECURITY_PAGE_TITLE,
	SECURITY_PATH,
	SECURITY_SECTIONS,
} from "@/lib/data/security";

import {
	bulletList,
	canonicalNotice,
	frontMatter,
	gettingStartedNotice,
	h1,
	h2,
	indexPageNotice,
	joinBlocks,
} from "./shared";

/** Site-relative markdown links → absolute, since the twin is read off-site. */
const absoluteLinks = (markdown: string): string =>
	markdown.replace(/\]\(\//g, `](${SITE_URL}/`);

/**
 * Render `/security.md` — the machine-readable twin of `/security`, from the
 * same `SECURITY_SECTIONS` the page renders. Pure function.
 */
export function renderSecurityMarkdown(): string {
	const canonical = `${SITE_URL}${SECURITY_PATH}`;

	return joinBlocks([
		frontMatter({
			type: "security",
			title: SECURITY_PAGE_TITLE,
			description: SECURITY_PAGE_DESCRIPTION,
			canonical,
		}),
		canonicalNotice(canonical),
		h1("Security & Data Protection"),
		"How Eko keeps partner data and transactions safe — from where data lives to how every transaction is authenticated.",
		...SECURITY_SECTIONS.flatMap((section) => [
			h2(section.title),
			section.summary,
			absoluteLinks(bulletList(section.points)),
		]),
		gettingStartedNotice(),
		indexPageNotice(),
	]);
}
