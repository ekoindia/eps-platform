import { FadeIn } from "@/components/FadeIn";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

/** Optional "Also See" cross-link rendered beneath an FAQ answer. */
export interface FaqLink {
	label: string;
	href: string;
}

/**
 * A single FAQ entry. Both field-name conventions are accepted: the product
 * data uses `{ q, a }` while industry/solution data uses `{ question, answer }`.
 * `q`/`a` take precedence when present.
 */
export interface FaqItem {
	q?: string;
	a?: string;
	question?: string;
	answer?: string;
	links?: FaqLink[];
}

interface FaqSectionProps {
	faqs: FaqItem[];
	/** Section heading. Pass `null` to hide it (e.g. when the page hero already shows it). */
	title?: string | null;
	variant?: "default" | "navy" | "muted";
	className?: string;
}

/**
 * Shared FAQ accordion section. Renders a list of `<details>` disclosures with
 * the standard HelpCircle marker and rotating "+" toggle. Used by the product,
 * industry and solution page layouts.
 */
export const FaqSection = ({
	faqs,
	title = "Frequently Asked Questions",
	variant = "muted",
	className,
}: FaqSectionProps) => {
	const items = faqs
		.map((faq) => ({
			question: faq.q ?? faq.question,
			answer: faq.a ?? faq.answer,
			links: faq.links,
		}))
		.filter((faq) => faq.question || faq.answer);

	if (items.length === 0) return null;

	return (
		<SectionContainer variant={variant} className={className}>
			{title && <SectionHeader title={title} />}
			<div className="max-w-3xl mx-auto flex flex-col gap-4">
				{items.map((faq, i) => (
					<FadeIn key={i} delay={i * 50}>
						<details className="group p-6 bg-card border border-border/90 rounded-2xl">
							<summary className="flex items-center justify-between font-semibold text-foreground list-none cursor-pointer">
								<span className="flex items-center gap-3">
									<HelpCircle className="w-5 h-5 text-eko-gold shrink-0" />
									{faq.question}
								</span>
								<span className="ml-4 text-eko-gold transition-transform group-open:rotate-45 text-2xl">
									+
								</span>
							</summary>
							<p className="mt-4 text-muted-foreground leading-relaxed pl-8">
								{faq.answer}
							</p>
							{faq.links && faq.links.length > 0 && (
								<div className="mt-4 pl-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
									<span className="font-medium text-foreground">Also see:</span>
									{faq.links.map((link) =>
										link.href.startsWith("/") ? (
											<Link
												key={link.href}
												to={link.href}
												className="text-eko-gold hover:underline"
											>
												{link.label}
											</Link>
										) : (
											<a
												key={link.href}
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												className="text-eko-gold hover:underline"
											>
												{link.label}
											</a>
										),
									)}
								</div>
							)}
						</details>
					</FadeIn>
				))}
			</div>
		</SectionContainer>
	);
};
