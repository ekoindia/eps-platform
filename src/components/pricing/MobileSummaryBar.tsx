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
import type { ReactNode } from "react";

interface MobileEstimateBarProps {
  /** Left-hand status text, e.g. "3 APIs selected" */
  label: string;
  /** Headline figure (already formatted), e.g. "₹12,000" */
  headline: string;
  /** Suffix after the headline, e.g. "/mo"; pass "" to omit */
  headlineSuffix?: string;
  /** Accessible title for the drawer */
  drawerTitle: string;
  /** Drawer content — typically the full summary panel */
  children: ReactNode;
}

/**
 * Generic mobile-only sticky bottom bar showing a live headline figure;
 * tapping it opens a drawer with the full summary breakdown. Shared by the
 * verification (cost), payments (earnings) and banking (cost) calculators.
 */
export const MobileEstimateBar = ({
  label,
  headline,
  headlineSuffix = "/mo",
  drawerTitle,
  children,
}: MobileEstimateBarProps) => (
  <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
    <Drawer>
      <DrawerTrigger asChild>
        {/* pr-20 keeps the headline clear of the SalesIQ chat bubble (bottom-right) */}
        <button
          type="button"
          className="w-full bg-eko-navy text-white pl-5 pr-20 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
        >
          <span className="text-sm text-white/70">{label}</span>
          <span className="flex items-center gap-2 font-bold tabular-nums">
            {headline}
            {headlineSuffix && (
              <span className="text-xs font-normal text-white/60">
                {headlineSuffix}
              </span>
            )}
            <ChevronUp className="w-4 h-4 text-eko-gold" />
          </span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerTitle className="sr-only">{drawerTitle}</DrawerTitle>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  </div>
);

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
    <MobileEstimateBar
      label={
        quote.lines.length === 0
          ? "No APIs selected"
          : `${quote.lines.length} API${quote.lines.length > 1 ? "s" : ""} selected`
      }
      headline={formatINR(headlineTotal, 0)}
      drawerTitle="Your monthly estimate"
    >
      <QuoteSummary
        quote={quote}
        includeGst={includeGst}
        onIncludeGstChange={onIncludeGstChange}
        onQuickAdd={onQuickAdd}
      />
    </MobileEstimateBar>
  );
};
