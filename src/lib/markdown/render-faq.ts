import { SITE_URL } from "@/lib/config/site";

import {
	canonicalNotice,
	frontMatter,
	gettingStartedNotice,
	h1,
	h3,
	indexPageNotice,
	joinBlocks,
	link,
} from "./shared";

/** Minimal structural shape of a common/global FAQ entry. */
export interface FaqMarkdownItem {
	q?: string;
	a?: string;
	question?: string;
	answer?: string;
	links?: Array<{ label: string; href: string }>;
}

/**
 * Render `/faq.md` — the machine-readable twin of the global `/faq` page.
 * Mirrors the platform-agnostic common FAQs plus the global-only reference
 * FAQs. Pure function — no filesystem or network access — so it is unit-testable.
 */
export function renderFaqMarkdown(faqs: FaqMarkdownItem[]): string {
	const canonical = `${SITE_URL}/faq`;

	const blocks: (string | false | undefined)[] = [
		frontMatter({
			type: "faq",
			title: "Frequently Asked Questions | Eko Platform Services API",
			description:
				"Answers to common questions about integrating Eko's APIs — getting started, authentication, SDKs and AI tooling, sandbox testing, response times, billing, error handling, versioning, and data privacy & compliance.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("Frequently Asked Questions"),
		"Common questions about integrating Eko's APIs, across all products.",
	];

	for (const faq of faqs) {
		const question = faq.q ?? faq.question;
		const answer = faq.a ?? faq.answer;
		if (!question && !answer) continue;
		blocks.push(h3(question ?? ""));
		if (answer) blocks.push(answer);
		if (faq.links?.length) {
			const rendered = faq.links
				.map((l) =>
					link(
						l.label,
						l.href.startsWith("/") ? `${SITE_URL}${l.href}` : l.href,
						"md",
					),
				)
				.join(" · ");
			blocks.push(`Also see: ${rendered}`);
		}
	}

	blocks.push(gettingStartedNotice(), indexPageNotice());

	return joinBlocks(blocks);
}
