import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  PRICING_GROUPS,
  displayName,
  type PricedApi,
} from "@/lib/data/api-pricing";
import { cn, formatINRRate } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

interface ApiPickerProps {
  /** Ids of currently selected priced APIs */
  selectedIds: string[];
  /** Toggles an API in/out of the selection */
  onToggle: (apiId: string) => void;
}

/**
 * Searchable, grouped multi-select list of all priced verification APIs.
 * Rows are full-width labels (44px+ tap targets) with the per-transaction
 * rate inline, so users can compare prices while picking.
 */
export const ApiPicker = ({ selectedIds, onToggle }: ApiPickerProps) => {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PRICING_GROUPS;
    return PRICING_GROUPS.map((group) => ({
      ...group,
      apis: group.apis.filter(
        (api) =>
          api.name.toLowerCase().includes(needle) ||
          api.group.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.apis.length > 0);
  }, [query]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
      <div className="p-3 border-b border-border/60 bg-muted/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search APIs — PAN, bank, GST, RC…"
            aria-label="Search verification APIs"
            className="pl-9 bg-background"
          />
        </div>
      </div>
      {/* Internal scroll only on desktop — on mobile the list runs full
          height so the page is the single vertical scroller */}
      <div className="lg:max-h-[26rem] lg:overflow-y-auto overscroll-contain">
        {filteredGroups.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">
            No APIs match "{query}"
          </p>
        )}
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <div className="lg:sticky lg:top-0 z-10 px-4 py-1.5 bg-muted/90 backdrop-blur-xs text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.apis.map((api) => (
              <PickerRow
                key={api.id}
                api={api}
                checked={selectedIds.includes(api.id)}
                onToggle={() => onToggle(api.id)}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="px-4 py-2 border-t border-border/60 bg-muted/40 text-[11px] text-muted-foreground/80">
        * Bulk APIs are billed per individual verification in the bulk request
        — e.g. one bulk call with 100 PANs at ₹1.20 each costs ₹120.
      </p>
    </div>
  );
};

const PickerRow = ({
  api,
  checked,
  onToggle,
}: {
  api: PricedApi;
  checked: boolean;
  onToggle: () => void;
}) => (
  <label
    className={cn(
      "flex items-center gap-3 px-4 py-2.5 min-h-11 cursor-pointer border-b border-border/40 last:border-b-0 transition-colors",
      checked ? "bg-eko-gold-light/60" : "hover:bg-muted/50",
    )}
  >
    <Checkbox
      checked={checked}
      onCheckedChange={onToggle}
      aria-label={api.name}
      className="data-[state=checked]:bg-eko-gold data-[state=checked]:border-eko-gold data-[state=checked]:text-eko-navy border-muted-foreground/40"
    />
    <span className="flex-1 text-sm font-medium text-foreground">
      {displayName(api)}
      {api.popular && (
        <Badge className="ml-2 bg-eko-gold/15 text-amber-700 hover:bg-eko-gold/15 border-0 text-[10px] px-1.5 align-middle">
          Popular
        </Badge>
      )}
    </span>
    <span className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
      {formatINRRate(api.tiers[0].rate)}
      <span className="text-xs text-muted-foreground/70">/txn</span>
    </span>
  </label>
);
