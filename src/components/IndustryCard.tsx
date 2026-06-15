import { Link } from "react-router-dom";
import type { IndustryData } from "@/lib/data/industries";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/FadeIn";

interface IndustryCardProps {
	industry: Pick<IndustryData, "slug" | "name" | "navDescription" | "icon">;
	className?: string;
	delay?: number;
}

export const IndustryCard = ({
	industry,
	className,
	delay,
}: IndustryCardProps) => {
	const Icon = industry.icon;
	return (
		<FadeIn className="h-full" delay={delay}>
			<Link
				to={`/industries/${industry.slug}`}
				className={cn(
					"group p-6 rounded-xl bg-card border border-border/50 hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300 block h-full",
					className,
				)}
			>
				<div className="flex items-start gap-4">
					<div className="w-10 h-10 rounded-lg bg-eko-gold/10 flex items-center justify-center shrink-0 group-hover:bg-eko-gold/20 transition-colors">
						<Icon className="w-5 h-5 text-eko-gold" />
					</div>
					<div>
						<h3 className="font-semibold text-foreground mb-1 group-hover:text-eko-gold transition-colors">
							{industry.name}
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{industry.navDescription}
						</p>
					</div>
				</div>
			</Link>
		</FadeIn>
	);
};
