import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { SolutionData } from "@/lib/data/solutions";
import { resolvePackApi } from "@/lib/data/solutions";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/FadeIn";

interface SolutionCardProps {
  solution: Pick<SolutionData, "slug" | "name" | "tagline" | "icon" | "packApis">;
  featured?: boolean;
  className?: string;
  delay?: number;
}

export const SolutionCard = ({ solution, featured, className, delay }: SolutionCardProps) => {
  const Icon = solution.icon;
  return (
    <FadeIn className="h-full" delay={delay}>
      <Link
        to={`/solutions/${solution.slug}`}
        className={cn(
          "group p-6 rounded-xl bg-card border transition-all duration-300 block h-full",
          featured
            ? "border-eko-gold/30 shadow-md hover:shadow-xl hover:border-eko-gold/50"
            : "border-border/50 hover:shadow-lg hover:border-eko-gold/30",
          className
        )}
      >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-eko-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-eko-gold/20 transition-colors">
          <Icon className="w-5 h-5 text-eko-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-foreground group-hover:text-eko-gold transition-colors truncate">{solution.name}</h3>
            {featured && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-eko-gold/10 text-eko-gold px-2 py-0.5 rounded-full flex-shrink-0">
                Popular
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{solution.tagline}</p>
        </div>
      </div>

      {(() => {
        const chips = solution.packApis.map(resolvePackApi).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {chips.slice(0, 4).map((api) => (
              <span key={api.apiId} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {api.name}
              </span>
            ))}
            {chips.length > 4 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                +{chips.length - 4} more
              </span>
            )}
          </div>
        );
      })()}

      <span className="inline-flex items-center gap-1 text-sm font-medium text-eko-gold group-hover:gap-2 transition-all">
        Explore pack <ArrowRight className="w-3.5 h-3.5" />
      </span>
      </Link>
    </FadeIn>
  );
};
