import { FadeIn } from "@/components/FadeIn";
import {
  SectionContainer,
  SectionHeader,
} from "@/components/SectionContainer";
import { HelpCircle } from "lucide-react";

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
}

interface FaqSectionProps {
  faqs: FaqItem[];
  title?: string;
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
    }))
    .filter((faq) => faq.question || faq.answer);

  if (items.length === 0) return null;

  return (
    <SectionContainer variant={variant} className={className}>
      <SectionHeader title={title} />
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {items.map((faq, i) => (
          <FadeIn key={i} delay={i * 50}>
            <details className="group p-6 bg-card border border-border/50 rounded-2xl cursor-pointer">
              <summary className="flex items-center justify-between font-semibold text-foreground list-none">
                <span className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-eko-gold shrink-0" />
                  {faq.question}
                </span>
                <span className="ml-4 text-eko-gold transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-muted-foreground leading-relaxed pl-8">
                {faq.answer}
              </p>
            </details>
          </FadeIn>
        ))}
      </div>
    </SectionContainer>
  );
};
