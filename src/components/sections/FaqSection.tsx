import { FadeIn } from "@/components/FadeIn";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";

/** Optional "Also See" cross-link rendered beneath an FAQ answer. */
export interface FaqLink {
	label: string;
	href: string;
}

/**
 * A single FAQ entry. Both field-name conventions are accepted: the product
 * data uses `{ q, a }` while industry/solution data uses `{ question, answer }`.
 * `q`/`a` take precedence when present. Answers are markdown.
 */
export interface FaqItem {
	q?: string;
	a?: string;
	question?: string;
	answer?: string;
	links?: FaqLink[];
}

/**
 * True for hrefs that should stay inside the SPA: absolute paths (but not
 * protocol-relative `//host` URLs, which are external), same-page fragments and
 * bare query strings. Everything else opens in a new tab.
 */
const isInternalHref = (href: string): boolean =>
	(href.startsWith("/") && !href.startsWith("//")) || /^[#?]/.test(href);

/**
 * Renders one cross-link, routing internal hrefs through react-router so they
 * client-navigate instead of triggering a full page load. Shared by the markdown
 * answer body and the "Also see" row.
 */
const FaqCrossLink = ({
	href,
	className,
	children,
}: {
	href?: string;
	className?: string;
	children?: ReactNode;
}) => {
	if (!href) return <span className={className}>{children}</span>;
	return isInternalHref(href) ? (
		<Link to={href} className={className}>
			{children}
		</Link>
	) : (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={className}
		>
			{children}
		</a>
	);
};

const answerComponents = {
	a: FaqCrossLink,
};

/**
 * Renders an FAQ answer as markdown — bold, inline code, links and lists. GFM
 * (tables, autolinks) is deliberately not enabled: FAQ answers do not need it
 * and `remark-gfm` would land in every marketing-page chunk.
 *
 * Rendered in a `div`, never a `p` — react-markdown emits its own `<p>`, and
 * nesting those is invalid HTML that breaks hydration on prerendered pages.
 */
const FaqAnswer = ({
	content,
	className,
}: {
	content: string;
	className?: string;
}) => (
	<div
		className={cn(
			"leading-relaxed text-muted-foreground",
			"[&_a]:font-medium [&_a]:text-eko-gold [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:no-underline",
			"[&_strong]:font-semibold [&_strong]:text-foreground",
			"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground",
			"[&_p]:my-0 [&_p+p]:mt-3",
			"[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
			className,
		)}
	>
		<ReactMarkdown components={answerComponents}>{content}</ReactMarkdown>
	</div>
);

interface FaqAccordionProps {
	faqs: FaqItem[];
	className?: string;
}

/** Collapse both field-name conventions and drop entries with nothing to show. */
const normalizeFaqs = (faqs: FaqItem[]) =>
	faqs
		.map((faq) => ({
			question: faq.q ?? faq.question,
			answer: faq.a ?? faq.answer,
			links: faq.links,
		}))
		.filter((faq) => faq.question || faq.answer);

/**
 * The bare FAQ accordion: a list of `<details>` disclosures with the standard
 * HelpCircle marker and rotating "+" toggle. Layout-agnostic, so it can be used
 * inside the docs column as well as inside a marketing {@link FaqSection}.
 */
export const FaqAccordion = ({ faqs, className }: FaqAccordionProps) => {
	const items = normalizeFaqs(faqs);

	if (items.length === 0) return null;

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{items.map((faq, i) => (
				<FadeIn key={faq.question ?? i} delay={i * 50}>
					<details className="group bg-card border border-border/90 rounded-2xl">
						<summary className="flex items-center justify-between font-semibold text-foreground list-none cursor-pointer p-6">
							<span className="flex items-center gap-3">
								<HelpCircle className="w-5 h-5 text-eko-gold shrink-0" />
								{faq.question}
							</span>
							<span className="ml-4 text-eko-gold transition-transform group-open:rotate-45 text-2xl">
								+
							</span>
						</summary>
						{faq.answer && (
							<FaqAnswer content={faq.answer} className="pr-6 pl-14 pb-6" />
						)}
						{faq.links && faq.links.length > 0 && (
							<div className="pr-6 pl-14 pb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
								<span className="font-medium text-foreground">Also see:</span>
								{faq.links.map((link) => (
									<FaqCrossLink
										key={link.href}
										href={link.href}
										className="text-eko-gold hover:underline"
									>
										{link.label}
									</FaqCrossLink>
								))}
							</div>
						)}
					</details>
				</FadeIn>
			))}
		</div>
	);
};

interface FaqSectionProps extends FaqAccordionProps {
	/** Section heading. Pass `null` to hide it (e.g. when the page hero already shows it). */
	title?: string | null;
	variant?: "default" | "navy" | "muted";
}

/**
 * Shared FAQ accordion section for marketing pages — {@link FaqAccordion}
 * wrapped in the standard section container and heading. Used by the product,
 * industry and solution page layouts.
 */
export const FaqSection = ({
	faqs,
	title = "Frequently Asked Questions",
	variant = "muted",
	className,
}: FaqSectionProps) => {
	if (normalizeFaqs(faqs).length === 0) return null;

	return (
		<SectionContainer variant={variant} className={className}>
			{title && <SectionHeader title={title} />}
			<FaqAccordion faqs={faqs} className="max-w-3xl mx-auto" />
		</SectionContainer>
	);
};
