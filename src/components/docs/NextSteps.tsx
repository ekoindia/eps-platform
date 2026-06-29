import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import type { ApiSpec, RelatedLink } from "@/lib/data/api-specs-common";
import {
	docHrefForSlug,
	docsHref,
	nextEndpointInGroup,
} from "@/lib/data/docs-registry";
import { cn } from "@/lib/utils";
import { HttpMethodTag } from "./HttpMethodTag";

/** A resolved link ready to render: `external` true ⇒ open in a new tab. */
interface ResolvedLink {
	label: string;
	href: string;
	description?: string;
	external: boolean;
}

/** Resolve one curated {@link RelatedLink} to a renderable link, or `null` when
 * it points nowhere valid (internal `slug` with no docs page, or no target). */
const resolveRelatedLink = (link: RelatedLink): ResolvedLink | null => {
	const internalHref = link.slug ? docHrefForSlug(link.slug) : undefined;
	if (internalHref) {
		return {
			label: link.label,
			href: internalHref,
			description: link.description,
			external: false,
		};
	}
	if (link.url) {
		// A site-relative `/path` stays in-app; anything else is external.
		const isInternal = link.url.startsWith("/");
		return {
			label: link.label,
			href: link.url,
			description: link.description,
			external: !isInternal,
		};
	}
	return null;
};

/** The fixed auto-links (product / AI / SDK) plus any curated `relatedLinks`. */
const buildRelatedLinks = (spec: ApiSpec): ResolvedLink[] => {
	const links: ResolvedLink[] = [];

	// Product details & pricing — only for an active (non-disabled) product.
	const product = ACTIVE_PRODUCTS_MAP[spec.productId];
	if (product) {
		links.push({
			label: `${product.name} — details & pricing`,
			href: productHref(product.slug),
			description: "Features, plans and pricing for this product.",
			external: false,
		});
	}

	links.push({
		label: "Integrate using AI",
		href: "/ai",
		description: "Build agent-native integrations with MCP, SDKs and packs.",
		external: false,
	});
	links.push({
		label: "Integrate using an SDK",
		href: docsHref(),
		description: "Browse guides and the full developer documentation.",
		external: false,
	});

	for (const link of spec.relatedLinks ?? []) {
		const resolved = resolveRelatedLink(link);
		if (resolved) links.push(resolved);
	}

	return links;
};

const RelatedLinkRow = ({ link }: { link: ResolvedLink }) => {
	const Icon = link.external ? ArrowUpRight : ArrowRight;
	const content = (
		<>
			<span className="min-w-0">
				<span className="font-medium text-foreground group-hover:text-primary">
					{link.label}
				</span>
				{link.description && (
					<span className="mt-0.5 block text-sm text-muted-foreground">
						{link.description}
					</span>
				)}
			</span>
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
		</>
	);
	const className =
		"group flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:border-border hover:bg-muted/60";

	return link.external ? (
		<a href={link.href} target="_blank" rel="noreferrer" className={className}>
			{content}
		</a>
	) : (
		<Link to={link.href} className={className}>
			{content}
		</Link>
	);
};

/**
 * "Next steps" block rendered at the bottom of an endpoint page. Shows a
 * prominent pager to the next API in the same nav group (when there is one),
 * then a list of related links: product/pricing, AI, SDK docs, and any curated
 * `spec.relatedLinks`. Pure / SSR-safe so it prerenders with the page.
 */
export const NextSteps = ({ spec }: { spec: ApiSpec }) => {
	const next = nextEndpointInGroup(spec);
	const related = buildRelatedLinks(spec);

	return (
		<section className="mt-12 border-t border-border/60 pt-8">
			<h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
				Next steps
			</h2>

			{next && (
				<Link
					to={docsHref(next.slug)}
					className={cn(
						"group mb-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4",
						"transition-colors hover:border-primary/50 hover:bg-muted/40",
					)}
				>
					<span className="min-w-0">
						<span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							Next
						</span>
						<span className="mt-1 flex items-center gap-2.5">
							<HttpMethodTag method={next.method} />
							<span className="truncate text-base font-semibold text-foreground group-hover:text-primary">
								{next.name}
							</span>
						</span>
						<span className="mt-1 block truncate text-sm text-muted-foreground">
							{next.summary}
						</span>
					</span>
					<ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
				</Link>
			)}

			<h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
				Related
			</h3>
			<ul className="grid gap-2.5 sm:grid-cols-2">
				{related.map((link) => (
					<li key={`${link.href}:${link.label}`}>
						<RelatedLinkRow link={link} />
					</li>
				))}
			</ul>
		</section>
	);
};
