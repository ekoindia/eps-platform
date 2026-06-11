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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  SEARCH_INDEX,
  type SearchCategory,
  type SearchItem,
} from "@/lib/search-index";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fixed display order + headings of the suggested (empty-query) groups */
const GROUPS: { category: SearchCategory; heading: string }[] = [
  { category: "api", heading: "APIs" },
  { category: "industry", heading: "Industries" },
  { category: "solution", heading: "Solutions" },
  { category: "page", heading: "Pages" },
];

/** Category chip labels shown per row in the flat (searching) view */
const CATEGORY_LABELS: Record<SearchCategory, string> = {
  api: "API",
  industry: "Industry",
  solution: "Solution",
  page: "Page",
};

/** Curated items for the empty-query view */
const SUGGESTED_ITEMS = SEARCH_INDEX.filter((item) => item.suggested);

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

/** Shared result row used by both the grouped (suggested) and flat (searching) views */
const ResultRow = ({
  item,
  showCategory,
  onSelect,
}: {
  item: SearchItem;
  showCategory?: boolean;
  onSelect: (item: SearchItem) => void;
}) => (
  <CommandItem
    value={`${item.label} ${item.id}`}
    keywords={item.keywords}
    onSelect={() => onSelect(item)}
    className="group gap-3 px-3 py-2"
  >
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
      <item.icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{item.label}</div>
      {item.sublabel && (
        <div className="truncate text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/75">
          {item.sublabel}
        </div>
      )}
    </div>
    {showCategory && (
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 group-data-[selected=true]:text-accent-foreground/60">
        {CATEGORY_LABELS[item.category]}
      </span>
    )}
  </CommandItem>
);

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
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  // Fresh query every time the palette opens
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Safety net: close if the route changes while the palette is open
  useEffect(() => {
    if (location.pathname !== previousPathRef.current) {
      previousPathRef.current = location.pathname;
      if (open) onOpenChange(false);
    }
  }, [location.pathname, open, onOpenChange]);

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
        className="top-[12%] translate-y-0 data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%] sm:top-[18%] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden rounded-xl border-border/60 p-0 shadow-2xl motion-reduce:animate-none [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command loop filter={substringGatedFilter}>
          <CommandInput
            placeholder="Search APIs, industries, solutions…"
            value={query}
            onValueChange={setQuery}
          />
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
                  Try &ldquo;UPI&rdquo;, &ldquo;KYC&rdquo; or &ldquo;lending&rdquo;
                </p>
              </div>
            </CommandEmpty>
            {query
              ? // Searching → flat list so cmdk ranks all matches globally by
                // score (cross-group reordering is broken in cmdk v1.1.1)
                SEARCH_INDEX.map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    showCategory
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
