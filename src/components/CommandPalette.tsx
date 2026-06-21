import { defaultFilter } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	MAX_TYPE_WEIGHT,
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
};

/** Scope tabs — narrow the result set by asset type. */
type Scope = SearchCategory | "all";
const SCOPES: { id: Scope; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "api", label: "Products" },
	{ id: "endpoint", label: "Endpoints" },
	{ id: "guide", label: "Guides" },
	{ id: "solution", label: "Solutions" },
	{ id: "industry", label: "Industries" },
	{ id: "page", label: "Pages" },
];

/** Leading prefix tokens that jump straight to a scope (e.g. `e: upi`). Tokens
 * are consumed from the input the moment they're typed; the active tab reflects
 * the chosen scope. Avoids the ambiguous `p:`. */
const TOKEN_SCOPE: Record<string, Scope> = {
	"all:": "all",
	"api:": "api",
	"prod:": "api",
	"product:": "api",
	"e:": "endpoint",
	"ep:": "endpoint",
	"endpoint:": "endpoint",
	"g:": "guide",
	"guide:": "guide",
	"sol:": "solution",
	"solution:": "solution",
	"ind:": "industry",
	"industry:": "industry",
	"page:": "page",
};

/** Curated items for the empty-query view */
const SUGGESTED_ITEMS = SEARCH_INDEX.filter((item) => item.suggested);

/** cmdk's CommandItem `value`, also the join key back to the SearchItem. Single
 * source of truth — used by both ResultRow and ITEM_BY_VALUE so they never drift. */
const itemValue = (item: SearchItem): string => `${item.label} ${item.id}`;

const ITEM_BY_VALUE = new Map(
	SEARCH_INDEX.map((item) => [itemValue(item).toLowerCase(), item]),
);

/**
 * cmdk's fuzzy score, gated on the query appearing as a contiguous substring
 * of the item's value + keywords. The default fuzzy filter matches scattered
 * letter subsequences, so e.g. "pricing" matched half the index via long SEO
 * keyword strings.
 */
const substringGatedFilter = (
	value: string,
	search: string,
	keywords?: string[],
): number => {
	const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase();
	if (!haystack.includes(search.trim().toLowerCase())) return 0;
	return defaultFilter(value, search, keywords);
};

// Ranking weights — tuned empirically; kept named for easy adjustment.
const TYPE_ALPHA = 0.5; // asset-type multiplier ∈ [1.0 .. 1.5]
const FIELD_BETA = 0.5; // match-field multiplier ∈ [0.75 .. 1.5]
const FIELD_WEIGHT = {
	slug: 1.0,
	label: 0.8,
	keyword: 0.55,
	description: 0.35,
	none: 0.25,
};

/** Where the query hit, in priority order: slug/id > label > keyword > description. */
const matchFieldWeight = (item: SearchItem, search: string): number => {
	const s = search.trim().toLowerCase();
	if (!s) return FIELD_WEIGHT.none;
	if (item.slug?.toLowerCase().includes(s) || item.id.toLowerCase().includes(s))
		return FIELD_WEIGHT.slug;
	if (item.label.toLowerCase().includes(s)) return FIELD_WEIGHT.label;
	if (item.keywords.some((k) => k.toLowerCase().includes(s)))
		return FIELD_WEIGHT.keyword;
	if (item.sublabel?.toLowerCase().includes(s)) return FIELD_WEIGHT.description;
	return FIELD_WEIGHT.none;
};

/** Two-factor ranked filter: cmdk fuzzy score × asset-type weight × match-field weight. */
const rankedFilter = (
	value: string,
	search: string,
	keywords?: string[],
): number => {
	const base = substringGatedFilter(value, search, keywords);
	if (base === 0) return 0;
	const item = ITEM_BY_VALUE.get(value.toLowerCase());
	if (!item) return base;
	const typeMul = 1 + TYPE_ALPHA * (item.typeWeight / MAX_TYPE_WEIGHT);
	const fieldMul = FIELD_BETA + matchFieldWeight(item, search);
	return base * typeMul * fieldMul;
};

/** Splits leading prefix token off the raw input → { scope, query }. */
const parseQuery = (raw: string): { scope: Scope | null; query: string } => {
	const lower = raw.toLowerCase();
	for (const [token, scope] of Object.entries(TOKEN_SCOPE)) {
		if (lower.startsWith(token)) {
			return { scope, query: raw.slice(token.length).replace(/^\s+/, "") };
		}
	}
	return { scope: null, query: raw };
};

const escapeRegExp = (s: string): string =>
	s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bolds the matched substring of `text`; safe for regex-special queries. */
const highlight = (text: string, query: string): React.ReactNode => {
	const q = query.trim();
	if (!q) return text;
	const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
	return parts.map((part, i) =>
		part.toLowerCase() === q.toLowerCase() ? (
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
	query,
	onSelect,
}: {
	item: SearchItem;
	showCategory?: boolean;
	query?: string;
	onSelect: (item: SearchItem) => void;
}) => {
	const isEndpoint = item.category === "endpoint";
	// Endpoints show the request path as the secondary line; others show sublabel.
	const secondary = isEndpoint ? item.path : item.sublabel;
	return (
		<CommandItem
			value={itemValue(item)}
			keywords={item.keywords}
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
					{query ? highlight(item.label, query) : item.label}
				</div>
				{secondary && (
					<div
						className={cn(
							"truncate text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/75",
							isEndpoint && "font-mono",
						)}
					>
						{isEndpoint && query ? highlight(secondary, query) : secondary}
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
	const navigate = useNavigate();
	const location = useLocation();
	const previousPathRef = useRef(location.pathname);

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

	const visible =
		scope === "all"
			? SEARCH_INDEX
			: SEARCH_INDEX.filter((item) => item.category === scope);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="top-[12%] translate-y-0 data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%] sm:top-[18%] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden rounded-xl border-border/60 p-0 shadow-2xl motion-reduce:animate-none [&>button]:hidden"
			>
				<DialogTitle className="sr-only">Search</DialogTitle>
				<Command loop filter={rankedFilter}>
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
						<CommandEmpty>
							<div className="flex flex-col items-center gap-2 py-2">
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
						</CommandEmpty>
						{query
							? // Searching → flat list so cmdk ranks all matches globally by
								// score (cross-group reordering is broken in cmdk v1.1.1)
								visible.map((item) => (
									<ResultRow
										key={item.id}
										item={item}
										showCategory
										query={query}
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
