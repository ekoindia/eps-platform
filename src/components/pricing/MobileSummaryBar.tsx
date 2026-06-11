import { QuoteSummary } from "@/components/pricing/QuoteSummary";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { type Quote } from "@/lib/data/api-pricing";
import { formatINR } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

interface MobileSummaryBarProps {
  quote: Quote;
  includeGst: boolean;
  onIncludeGstChange: (include: boolean) => void;
  onQuickAdd: (apiId: string) => void;
}

/**
 * Mobile-only sticky bottom bar showing the live monthly total; tapping it
 * opens a drawer with the full QuoteSummary breakdown and CTAs.
 */
export const MobileSummaryBar = ({
  quote,
  includeGst,
  onIncludeGstChange,
  onQuickAdd,
}: MobileSummaryBarProps) => {
  const headlineTotal = includeGst ? quote.total : quote.subtotal;

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
      <Drawer>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="w-full bg-eko-navy text-white px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
          >
            <span className="text-sm text-white/70">
              {quote.lines.length === 0
                ? "No APIs selected"
                : `${quote.lines.length} API${quote.lines.length > 1 ? "s" : ""} selected`}
            </span>
            <span className="flex items-center gap-2 font-bold tabular-nums">
              {formatINR(headlineTotal, 0)}
              <span className="text-xs font-normal text-white/60">/mo</span>
              <ChevronUp className="w-4 h-4 text-eko-gold" />
            </span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerTitle className="sr-only">Your monthly estimate</DrawerTitle>
          <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <QuoteSummary
              quote={quote}
              includeGst={includeGst}
              onIncludeGstChange={onIncludeGstChange}
              onQuickAdd={onQuickAdd}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
