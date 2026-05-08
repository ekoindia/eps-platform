import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ApiProductRelevance } from "@/lib/data/api-products";

interface ApiChipProps {
  name: string;
  href?: string;
  relevance?: ApiProductRelevance;
  className?: string;
  onClick?: () => void;
}

const relevanceColors: Record<ApiProductRelevance, string> = {
  H: "bg-eko-success/20 text-eko-success",
  M: "bg-amber-100 text-amber-700",
  L: "bg-gray-100 text-gray-500",
};

/**
 * ApiChip Component: A reusable UI component to display API names as chips, with optional relevance indicators and links.
 * @param {string} name - The name of the API to display on the chip.
 * @param {string} [href] - Optional URL to link the chip to. If provided, the chip becomes clickable and navigates to this URL.
 * @param {ApiProductRelevance} [relevance] - Optional relevance level of the API (H, M, L) which determines the color coding of the relevance badge.
 * @param {string} [className] - Optional additional class names for custom styling of the chip.
 * @param {function} [onClick] - Optional click handler function that gets called when the chip is clicked. This is used in conjunction with `href` for navigation or can be used independently for other click actions.
 * @returns {JSX.Element} The rendered ApiChip component.
 */
export const ApiChip = ({ name, href, relevance, className, onClick }: ApiChipProps) => {
  const chipClassName = cn(
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-card transition-colors select-none",
    (href || onClick) ? "hover:border-eko-gold/40 hover:bg-eko-gold/5 cursor-pointer" : "cursor-default",
    className
  );

  const chipContent = (
    <>
      {name}
      {relevance && (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", relevanceColors[relevance])}>
          {relevance === "H" ? "HIGH" : relevance === "M" ? "MED" : "LOW"}
        </span>
      )}
    </>
  );

  if (href && href !== "#") {
    return <Link to={href} className={chipClassName}>{chipContent}</Link>;
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={chipClassName}>
        {chipContent}
      </button>
    );
  }

  return <span className={chipClassName}>{chipContent}</span>;
};
