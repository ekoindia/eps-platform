import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeroProps {
  children: ReactNode;
  /** Extra classes merged onto the hero `<section>`. */
  className?: string;
}

/**
 * Shared navy hero shell used by the product, industry and solution page
 * layouts. Renders the dark `bg-eko-navy` section with its two gradient
 * overlays and the centered content container. All per-page hero content
 * (breadcrumbs, headings, CTAs, hero image, chip rows) is supplied via
 * `children`.
 */
export const PageHero = ({ children, className }: PageHeroProps) => {
  return (
    <section
      className={cn(
        "relative pt-32 pb-20 bg-eko-navy overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-linear-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-eko-gold/5 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {children}
      </div>
    </section>
  );
};
