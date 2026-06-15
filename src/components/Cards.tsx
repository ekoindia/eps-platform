import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
	icon: LucideIcon;
	title: string;
	description: string;
	className?: string;
}

export const FeatureCard = ({
	icon: Icon,
	title,
	description,
	className,
}: FeatureCardProps) => {
	return (
		<div
			className={cn(
				"group p-6 rounded-2xl bg-card border border-border/50 card-hover",
				className,
			)}
		>
			<div className="icon-container mb-4 group-hover:scale-110 transition-transform duration-300">
				<Icon className="w-6 h-6 text-eko-gold" />
			</div>
			<h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
			<p className="text-muted-foreground text-sm leading-relaxed">
				{description}
			</p>
		</div>
	);
};

interface ProductCardProps {
	title: string;
	description: string;
	features: string[];
	icon?: LucideIcon;
	className?: string;
}

export const ProductCard = ({
	title,
	description,
	features,
	icon: Icon,
	className,
}: ProductCardProps) => {
	return (
		<div
			className={cn(
				"group p-6 lg:p-8 rounded-2xl bg-card border border-border/50 card-hover h-full flex flex-col",
				className,
			)}
		>
			{Icon && (
				<div className="icon-container mb-5 group-hover:scale-110 transition-transform duration-300">
					<Icon className="w-6 h-6 text-eko-gold" />
				</div>
			)}
			<h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
			<p className="text-muted-foreground mb-5 leading-relaxed">
				{description}
			</p>
			<ul className="flex flex-col gap-2.5 mt-auto">
				{features.map((feature, index) => (
					<li key={index} className="flex items-start gap-2.5 text-sm">
						<span className="w-1.5 h-1.5 rounded-full bg-eko-gold mt-2 shrink-0" />
						<span className="text-foreground/80">{feature}</span>
					</li>
				))}
			</ul>
		</div>
	);
};

interface StatCardProps {
	value: string;
	label: string;
	icon?: LucideIcon;
	className?: string;
}

export const StatCard = ({
	value,
	label,
	icon: Icon,
	className,
}: StatCardProps) => {
	return (
		<div className={cn("text-center p-6", className)}>
			{Icon && (
				<div className="flex justify-center mb-3">
					<Icon className="w-8 h-8 text-eko-gold" />
				</div>
			)}
			<div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
				{value}
			</div>
			<div className="text-muted-foreground text-sm">{label}</div>
		</div>
	);
};

interface UseCaseCardProps {
	title: string;
	description: string;
	icon: LucideIcon;
	className?: string;
}

export const UseCaseCard = ({
	title,
	description,
	icon: Icon,
	className,
}: UseCaseCardProps) => {
	return (
		<div
			className={cn(
				"group p-6 rounded-xl bg-card border border-border/50 card-hover cursor-pointer",
				className,
			)}
		>
			<div className="flex items-start gap-4">
				<div className="icon-container shrink-0 group-hover:scale-110 transition-transform duration-300">
					<Icon className="w-5 h-5 text-eko-gold" />
				</div>
				<div>
					<h3 className="font-semibold text-foreground mb-1 group-hover:text-eko-gold transition-colors">
						{title}
					</h3>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				</div>
			</div>
		</div>
	);
};
