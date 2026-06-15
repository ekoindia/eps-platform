import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
	buildNavTree,
	docsHref,
	type NavEndpoint,
} from "@/lib/data/docs-registry";
import { HttpMethodTag } from "./HttpMethodTag";

/**
 * Left-rail navigation. Hierarchy: CATEGORY (uppercase, divider) › Product
 * (subheading, only when it owns >1 endpoint) › endpoint links. Single-endpoint
 * products are flattened — the endpoint sits directly under the category to cut
 * the redundant "Passport Verification › Passport Verification" noise. Titles
 * wrap to at most two lines; each endpoint carries its HTTP-method tag.
 */
export const DocsNavTree = ({ onNavigate }: { onNavigate?: () => void }) => {
	const { pathname } = useLocation();
	const nav = buildNavTree();

	const isActive = (slug: string) => pathname === docsHref(slug);

	const itemClass = (active: boolean) =>
		cn(
			"flex items-start justify-between gap-2 rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors",
			active
				? "bg-eko-gold-light font-medium text-eko-navy dark:bg-eko-gold/15 dark:text-foreground"
				: "text-muted-foreground hover:bg-muted hover:text-foreground",
		);

	const EndpointLink = ({ ep }: { ep: NavEndpoint }) => (
		<Link
			to={docsHref(ep.slug)}
			onClick={onNavigate}
			className={itemClass(isActive(ep.slug))}
		>
			<span className="line-clamp-2">{ep.title}</span>
			<HttpMethodTag method={ep.method} short className="mt-0.5 shrink-0" />
		</Link>
	);

	return (
		<nav className="text-sm">
			<Link
				to={docsHref()}
				onClick={onNavigate}
				className={itemClass(pathname === docsHref())}
			>
				Overview
			</Link>

			{nav.guides.length > 0 && (
				<div className="mt-6 border-t border-border/50 pt-4">
					<p className="mb-1 px-3 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
						Guides
					</p>
					<div className="space-y-0.5">
						{nav.guides.map((g) => (
							<Link
								key={g.slug}
								to={docsHref(g.slug)}
								onClick={onNavigate}
								className={itemClass(isActive(g.slug))}
							>
								<span className="line-clamp-2">{g.title}</span>
							</Link>
						))}
					</div>
				</div>
			)}

			{nav.categories.map((category) => (
				<div
					key={category.category}
					className="mt-6 border-t border-border/50 pt-4"
				>
					<p className="mb-1 px-3 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
						{category.title}
					</p>
					{category.products.map((product) =>
						product.endpoints.length === 1 ? (
							// Single-endpoint product — flatten: no redundant subheading.
							<div key={product.productId} className="space-y-0.5">
								<EndpointLink ep={product.endpoints[0]} />
							</div>
						) : (
							<div key={product.productId} className="mt-3 first:mt-1">
								<p className="px-3 py-1 text-[0.8125rem] font-semibold text-foreground/90">
									{product.name}
								</p>
								<div className="space-y-0.5">
									{product.endpoints.map((ep) => (
										<EndpointLink key={ep.slug} ep={ep} />
									))}
								</div>
							</div>
						),
					)}
				</div>
			))}
		</nav>
	);
};
