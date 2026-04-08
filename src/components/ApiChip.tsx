import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ApiProductRelevance } from "@/lib/data/api-products";

interface ApiChipProps {
  name: string;
  href?: string;
  relevance?: ApiProductRelevance;
  className?: string;
}

const relevanceColors: Record<ApiProductRelevance, string> = {
  H: "bg-eko-success/20 text-eko-success",
  M: "bg-amber-100 text-amber-700",
  L: "bg-gray-100 text-gray-500",
};

export const ApiChip = ({ name, href, relevance, className }: ApiChipProps) => {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-card transition-colors",
        href && "hover:border-eko-gold/40 hover:bg-eko-gold/5 cursor-pointer",
        className
      )}
    >
      {name}
      {relevance && (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", relevanceColors[relevance])}>
          {relevance === "H" ? "HIGH" : relevance === "M" ? "MED" : "LOW"}
        </span>
      )}
    </span>
  );

  if (href && href !== "#") {
    return <Link to={href}>{content}</Link>;
  }
  return content;
};
