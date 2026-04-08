import { Link } from "react-router-dom";
import type { IndustryData } from "@/lib/data/industries";
import { cn } from "@/lib/utils";

interface IndustryCardProps {
  industry: Pick<IndustryData, "slug" | "name" | "navDescription" | "icon">;
  className?: string;
}

export const IndustryCard = ({ industry, className }: IndustryCardProps) => {
  const Icon = industry.icon;
  return (
    <Link
      to={`/industries/${industry.slug}`}
      className={cn(
        "group p-6 rounded-xl bg-card border border-border/50 hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300 block",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-eko-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-eko-gold/20 transition-colors">
          <Icon className="w-5 h-5 text-eko-gold" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1 group-hover:text-eko-gold transition-colors">{industry.name}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{industry.navDescription}</p>
        </div>
      </div>
    </Link>
  );
};
