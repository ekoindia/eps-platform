import {
	buildNavTree,
	docsHref,
	type NavBranch,
	type NavLeaf,
	type NavNode,
} from "@/lib/data/docs-registry";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HttpMethodTag } from "./HttpMethodTag";

/**
 * Left-rail navigation. Hierarchy: CATEGORY (uppercase, divider) › collapsible
 * branches (product › optional provider › optional purpose-group) › endpoint
 * links. Branch rows render at normal weight with a right-edge chevron (the slot
 * leaves use for the HTTP-method tag); children indent under a left rail. Single
 * endpoint products are flattened to cut the redundant subheading. Only the
 * active endpoint's ancestor branches are expanded by default.
 */

/** Strip a trailing slash (except the root) so `/docs/x/` matches `/docs/x`. */
const normalizePath = (path: string): string =>
	path.length > 1 ? path.replace(/\/+$/, "") : path;

/** Collect the ids of every branch on the path to the active leaf. */
const collectActiveBranchIds = (
	nodes: NavNode[],
	isActiveSlug: (slug: string) => boolean,
	acc: Set<string>,
): boolean => {
	let onPath = false;
	for (const node of nodes) {
		if (node.type === "leaf") {
			if (isActiveSlug(node.slug)) onPath = true;
		} else if (collectActiveBranchIds(node.children, isActiveSlug, acc)) {
			acc.add(node.id);
			onPath = true;
		}
	}
	return onPath;
};

export const DocsNavTree = ({ onNavigate }: { onNavigate?: () => void }) => {
	const { pathname } = useLocation();
	const current = normalizePath(pathname);
	const nav = useMemo(() => buildNavTree(), []);

	const isActive = (slug: string) => current === docsHref(slug);

	const activeBranchIds = useMemo(() => {
		const acc = new Set<string>();
		const matches = (slug: string) => current === docsHref(slug);
		nav.categories.forEach((c) =>
			collectActiveBranchIds(c.nodes, matches, acc),
		);
		return acc;
	}, [nav, current]);

	const [open, setOpen] = useState<Set<string>>(() => new Set(activeBranchIds));
	// Re-open the active path on navigation, preserving branches the user opened.
	useEffect(() => {
		setOpen((prev) => new Set([...prev, ...activeBranchIds]));
	}, [activeBranchIds]);

	const toggle = (id: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const itemClass = (active: boolean) =>
		cn(
			"flex cursor-pointer items-start justify-between gap-2 rounded-md py-1.5 pl-3 pr-2 text-xs transition-colors",
			active
				? "bg-slate-300 font-medium text-eko-navy dark:bg-eko-gold/15 dark:text-foreground"
				: "text-muted-foreground hover:bg-muted hover:text-foreground",
		);

	const EndpointLink = ({ ep }: { ep: NavLeaf }) => (
		<Link
			to={docsHref(ep.slug)}
			onClick={onNavigate}
			className={itemClass(isActive(ep.slug))}
		>
			<span className="line-clamp-2">{ep.title}</span>
			<HttpMethodTag
				method={ep.method}
				short
				className="shrink-0 px-1.5 py-0.5 rounded-[3px] text-[0.5rem]"
				variant={isActive(ep.slug) ? "solid" : "soft"}
			/>
		</Link>
	);

	const renderNode = (node: NavNode) =>
		node.type === "branch" ? (
			<BranchRow key={node.id} branch={node} />
		) : (
			<EndpointLink key={node.slug} ep={node} />
		);

	const BranchRow = ({ branch }: { branch: NavBranch }) => {
		const isOpen = open.has(branch.id);
		return (
			<div>
				<button
					type="button"
					onClick={() => toggle(branch.id)}
					aria-expanded={isOpen}
					className={cn(itemClass(false), "w-full text-left")}
				>
					<span className="line-clamp-2">{branch.label}</span>
					<ChevronRight
						className={cn(
							"mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
							isOpen && "rotate-90",
						)}
					/>
				</button>
				{isOpen && (
					<div className="ml-3 space-y-0.5 border-l border-border/60 pl-2">
						{branch.children.map(renderNode)}
					</div>
				)}
			</div>
		);
	};

	return (
		<nav className="text-sm">
			<Link
				to={docsHref()}
				onClick={onNavigate}
				className={itemClass(current === docsHref())}
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
					<div className="space-y-0.5">{category.nodes.map(renderNode)}</div>
				</div>
			))}
		</nav>
	);
};
