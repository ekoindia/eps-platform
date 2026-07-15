import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

/**
 * `hero` — light text for the dark page-hero band (the original, default).
 * `surface` — theme-aware muted text for a normal light/dark page surface.
 */
type BreadcrumbVariant = "hero" | "surface";

const VARIANT_STYLES: Record<
	BreadcrumbVariant,
	{ base: string; link: string; current: string }
> = {
	hero: {
		base: "text-white/60",
		link: "hover:text-eko-gold transition-colors",
		current: "text-white/90",
	},
	surface: {
		base: "text-muted-foreground",
		link: "hover:text-foreground transition-colors",
		current: "text-foreground",
	},
};

interface BreadcrumbNavProps {
	crumbs: BreadcrumbItem[];
	variant?: BreadcrumbVariant;
	className?: string;
}

export const BreadcrumbNav = ({
	crumbs,
	variant = "hero",
	className,
}: BreadcrumbNavProps) => {
	const styles = VARIANT_STYLES[variant];
	return (
		<nav
			aria-label="Breadcrumb"
			className={cn(
				"mb-6 flex items-center gap-1.5 text-xs",
				styles.base,
				className,
			)}
		>
			{crumbs.map((crumb, i) => (
				<span key={i} className="flex items-center gap-1.5">
					{i > 0 && <ChevronRight className="h-3 w-3" />}
					{crumb.href ? (
						<Link to={crumb.href} className={styles.link}>
							{crumb.label}
						</Link>
					) : (
						<span className={styles.current}>{crumb.label}</span>
					)}
				</span>
			))}
		</nav>
	);
};
