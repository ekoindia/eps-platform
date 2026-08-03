import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	buildEngine,
	parseQuery,
	search,
	type Scope,
} from "@/lib/search-engine";
import {
	SEARCH_INDEX,
	type SearchCategory,
	type SearchItem,
} from "@/lib/search-index";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** Fixed display order + headings of the suggested (empty-query) groups */
const GROUPS: { category: SearchCategory; heading: string }[] = [
	{ category: "api", heading: "APIs" },
	{ category: "guide", heading: "Guides" },
	{ category: "industry", heading: "Industries" },
	{ category: "solution", heading: "Solutions" },
	{ category: "page", heading: "Pages" },
];

/** Coloured type badge shown per row in the flat (searching) view. Endpoints use
 * the method pill instead, so their badge className is empty. */
const CATEGORY_BADGE: Record<
	SearchCategory,
	{ label: string; className: string }
> = {
	api: { label: "Product", className: "bg-primary/10 text-primary" },
	endpoint: { label: "Endpoint", className: "" },
	guide: {
		label: "Guide",
		className:
			"bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
	},
	solution: {
		label: "Solution",
		className:
			"bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
	},
	industry: {
		label: "Industry",
		className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
	},
	page: { label: "Page", className: "bg-muted text-muted-foreground" },
	faq: { label: "FAQ", className: "bg-muted text-muted-foreground" },
};

/** Subtle per-type tint on the icon box, so type reads before the badge. */
const ICON_TINT: Record<SearchCategory, string> = {
	api: "bg-primary/10 text-primary",
	endpoint:
		"bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
	guide: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
	solution:
		"bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
	industry: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
	page: "bg-muted text-muted-foreground",
	faq: "bg-muted text-muted-foreground",
};

/** Scope tabs — narrow the result set by asset type. `Scope` lives in search-engine. */
const SCOPES: { id: Scope; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "api", label: "Products" },
	{ id: "endpoint", label: "Endpoints" },
	{ id: "guide", label: "Guides" },
	{ id: "solution", label: "Solutions" },
	{ id: "industry", label: "Industries" },
	{ id: "page", label: "Pages" },
	{ id: "faq", label: "FAQs" },
];

/** Curated items for the empty-query view */
const SUGGESTED_ITEMS = SEARCH_INDEX.filter((item) => item.suggested);

const escapeRegExp = (s: string): string =>
	s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bolds every matched term. `terms` comes from MiniSearch's match metadata, so
 * multi-token queries highlight each hit — the previous version took the raw
 * query and could only bold one contiguous run.
 *
 * These are the *indexed* terms, which is what we want: type "aadhar" and the
 * word actually bolded is "Aadhaar". Terms that matched only the body or
 * keywords simply find nothing in `text` and are left alone.
 */
const highlight = (text: string, terms: string[]): React.ReactNode => {
	if (!terms.length) return text;
	// Longest-first so "aadhaar" wins over "aadhar" inside the alternation.
	const ordered = [...terms].sort((a, b) => b.length - a.length);
	const parts = text.split(
		new RegExp(`(${ordered.map(escapeRegExp).join("|")})`, "ig"),
	);
	const hit = new Set(terms.map((t) => t.toLowerCase()));
	return parts.map((part, i) =>
		hit.has(part.toLowerCase()) ? (
			<mark
				key={i}
				className="bg-transparent font-semibold text-foreground group-data-[selected=true]:text-accent-foreground"
			>
				{part}
			</mark>
		) : (
			part
		),
	);
};

/** Shared result row used by both the grouped (suggested) and flat (searching) views */
const ResultRow = ({
	item,
	showCategory,
	terms,
	onSelect,
}: {
	item: SearchItem;
	showCategory?: boolean;
	/** Matched terms to bold; omitted in the empty-query suggested view. */
	terms?: string[];
	onSelect: (item: SearchItem) => void;
}) => {
	const isEndpoint = item.category === "endpoint";
	// Endpoints show the request path as the secondary line; others show sublabel.
	const secondary = isEndpoint ? item.path : item.sublabel;
	return (
		<CommandItem
			// The id is unique (guarded by search-index.test.ts) and cmdk no longer
			// filters on this value, so it needs no searchable text baked in.
			value={item.id}
			onSelect={() => onSelect(item)}
			className="group gap-3 px-3 py-2"
		>
			<div
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-md",
					ICON_TINT[item.category],
				)}
			>
				<item.icon className="h-4 w-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">
					{terms ? highlight(item.label, terms) : item.label}
				</div>
				{secondary && (
					<div
						className={cn(
							"truncate text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/75",
							isEndpoint && "font-mono",
						)}
					>
						{isEndpoint && terms ? highlight(secondary, terms) : secondary}
					</div>
				)}
			</div>
			{showCategory &&
				(isEndpoint && item.method ? (
					<HttpMethodTag method={item.method} variant="soft" />
				) : (
					<span
						className={cn(
							"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
							CATEGORY_BADGE[item.category].className,
						)}
					>
						{CATEGORY_BADGE[item.category].label}
					</span>
				))}
		</CommandItem>
	);
};

/** Small keyboard-key chip used in the footer hints */
const Kbd = ({ children }: { children: React.ReactNode }) => (
	<kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
		{children}
	</kbd>
);

/**
 * Global ⌘K / Ctrl+K command palette. Lazy-loaded — never part of the
 * initial bundle or the pre-rendered HTML (see Header.tsx).
 */
export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
	const [query, setQuery] = useState("");
	const [scope, setScope] = useState<Scope>("all");
	// State, not a ref: Phase B swaps in a body-aware engine once
	// search-body.json loads, and that swap has to re-run the memo below.
	// Built lazily on first render — the palette only mounts once opened.
	const [engine] = useState(() => buildEngine());
	const navigate = useNavigate();
	const location = useLocation();
	const previousPathRef = useRef(location.pathname);

	// Lexical search is sub-millisecond over ~195 docs, so no debounce.
	const results = useMemo(
		() => (query.trim() ? search(engine, query, scope) : []),
		[engine, query, scope],
	);

	// Fresh query + scope every time the palette opens
	useEffect(() => {
		if (open) {
			setQuery("");
			setScope("all");
		}
	}, [open]);

	// Safety net: close if the route changes while the palette is open
	useEffect(() => {
		if (location.pathname !== previousPathRef.current) {
			previousPathRef.current = location.pathname;
			if (open) onOpenChange(false);
		}
	}, [location.pathname, open, onOpenChange]);

	// Consume a leading prefix token into the active scope, strip it from the
	// text handed to cmdk (so it searches clean terms, not `e: upi`).
	const handleQueryChange = (raw: string): void => {
		const { scope: tokenScope, query: stripped } = parseQuery(raw);
		if (tokenScope) setScope(tokenScope);
		setQuery(tokenScope ? stripped : raw);
	};

	const handleSelect = (item: SearchItem): void => {
		onOpenChange(false);
		if (item.action === "talk-to-sales") {
			window.dispatchEvent(new Event("open-talk-to-sales"));
		} else if (item.external) {
			window.open(item.href, "_blank", "noopener");
		} else {
			navigate(item.href);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="top-[12%] translate-y-0 sm:top-[18%] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden rounded-xl border-border/60 p-0 shadow-2xl motion-reduce:animate-none [&>button]:hidden [--tw-enter-translate-x:0]! [--tw-enter-translate-y:0]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!"
			>
				<DialogTitle className="sr-only">Search</DialogTitle>
				{/* shouldFilter={false}: search-engine.ts ranks and filters; cmdk is
				    left to do rendering and keyboard navigation only. */}
				<Command loop shouldFilter={false}>
					<CommandInput
						placeholder="Search APIs, endpoints, guides, solutions…"
						value={query}
						onValueChange={handleQueryChange}
					/>
					<div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{SCOPES.map(({ id, label }) => (
							<button
								key={id}
								type="button"
								onClick={() => setScope(id)}
								aria-pressed={scope === id}
								className={cn(
									"shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
									scope === id
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{label}
							</button>
						))}
					</div>
					<CommandList className="max-h-[min(60vh,420px)] overscroll-contain">
						{/* Rendered directly rather than via <CommandEmpty>, whose
						    internal count is derived from cmdk's own filtering — which
						    is switched off here. */}
						{query && results.length === 0 && (
							<div className="flex flex-col items-center gap-2 py-6">
								<Search className="h-5 w-5 text-muted-foreground/60" />
								<p className="text-sm text-muted-foreground">
									No results for{" "}
									<span className="font-medium text-foreground">
										&ldquo;{query}&rdquo;
									</span>
								</p>
								<p className="text-xs text-muted-foreground/70">
									Try &ldquo;UPI&rdquo;, &ldquo;KYC&rdquo; or
									&ldquo;lending&rdquo;
								</p>
							</div>
						)}
						{query
							? // Searching → flat list, already ranked globally by relevance
								results.map(({ item, terms }) => (
									<ResultRow
										key={item.id}
										item={item}
										showCategory
										terms={terms}
										onSelect={handleSelect}
									/>
								))
							: // Empty query → curated "suggested" items, grouped
								GROUPS.map(({ category, heading }) => {
									const groupItems = SUGGESTED_ITEMS.filter(
										(item) => item.category === category,
									);
									if (groupItems.length === 0) return null;
									return (
										<CommandGroup key={category} heading={heading}>
											{groupItems.map((item) => (
												<ResultRow
													key={item.id}
													item={item}
													onSelect={handleSelect}
												/>
											))}
										</CommandGroup>
									);
								})}
					</CommandList>
					<div className="flex items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<Kbd>↑</Kbd>
							<Kbd>↓</Kbd>
							Navigate
						</span>
						<span className="flex items-center gap-1.5">
							<Kbd>↵</Kbd>
							Open
						</span>
						<span className="ml-auto flex items-center gap-1.5">
							<Kbd>esc</Kbd>
							Close
						</span>
					</div>
				</Command>
			</DialogContent>
		</Dialog>
	);
};
