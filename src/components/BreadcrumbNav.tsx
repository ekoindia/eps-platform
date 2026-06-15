import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface BreadcrumbNavProps {
	crumbs: BreadcrumbItem[];
}

export const BreadcrumbNav = ({ crumbs }: BreadcrumbNavProps) => {
	return (
		<nav
			aria-label="Breadcrumb"
			className="flex items-center gap-1.5 text-xs text-white/60 mb-6"
		>
			{crumbs.map((crumb, i) => (
				<span key={i} className="flex items-center gap-1.5">
					{i > 0 && <ChevronRight className="w-3 h-3" />}
					{crumb.href ? (
						<Link
							to={crumb.href}
							className="hover:text-eko-gold transition-colors"
						>
							{crumb.label}
						</Link>
					) : (
						<span className="text-white/90">{crumb.label}</span>
					)}
				</span>
			))}
		</nav>
	);
};
