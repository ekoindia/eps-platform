import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Banknote, Landmark, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/** Tab ids — URL-stable (used in the ?tab= query param) */
export type PricingTabId = "verification" | "payments" | "banking";

/** The calculator tabs' own URL key (absent = "verification") */
const TAB_PARAM = "tab";

const TAB_DEFS: { id: PricingTabId; label: string; icon: typeof ShieldCheck }[] =
  [
    { id: "verification", label: "Verification APIs", icon: ShieldCheck },
    { id: "payments", label: "Payments & BC APIs", icon: Banknote },
    { id: "banking", label: "Connected Banking", icon: Landmark },
  ];

const isTabId = (value: string | null): value is PricingTabId =>
  TAB_DEFS.some((tab) => tab.id === value);

interface PricingTabsProps {
  /** Tab 1 — Verification APIs (cost calculator + rate card) */
  verification: ReactNode;
  /** Tab 2 — Payments & BC APIs (DMT/AePS/BBPS earnings calculator) */
  payments: ReactNode;
  /** Tab 3 — Connected Banking (cost calculator) */
  banking: ReactNode;
}

/**
 * Client-side tab shell for the /pricing page.
 *
 * All three panels stay mounted (`forceMount`) and are hidden via CSS so the
 * prerendered HTML carries every product's tables (SEO) and calculator state
 * survives tab switches. `display:none` also hides each inactive panel's
 * position:fixed mobile summary bar.
 *
 * The active tab is mirrored to `?tab=` ("verification" is the canonical
 * default and never written). Only the `tab` key is touched — `sel`, `gst`,
 * `pay`, `cb` and UTM/tracking params are preserved.
 */
export const PricingTabs = ({
  verification,
  payments,
  banking,
}: PricingTabsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PricingTabId>(() => {
    const fromUrl = searchParams.get(TAB_PARAM);
    return isTabId(fromUrl) ? fromUrl : "verification";
  });

  const onTabChange = (value: string) => {
    if (!isTabId(value)) return;
    setActiveTab(value);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "verification") params.delete(TAB_PARAM);
        else params.set(TAB_PARAM, value);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const panels: { id: PricingTabId; content: ReactNode }[] = [
    { id: "verification", content: verification },
    { id: "payments", content: payments },
    { id: "banking", content: banking },
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      {/* Sticky below the auto-hiding fixed header (z-50): when the header
          hides on scroll-down the tab bar sits flush at the top.
          Material-style tabs: flat labels with an active underline indicator
          (visually distinct from the hero's pill chips). */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xs border-b border-border/60 -mt-px shadow-xs">
        <div className="container mx-auto px-4">
          {/* -mb-px lets the active underline sit on the wrapper's border */}
          <TabsList className="h-auto w-full sm:w-auto justify-start gap-1 bg-transparent p-0 -mb-px overflow-x-auto rounded-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TAB_DEFS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="cursor-pointer gap-2 rounded-none px-4 sm:px-5 py-3.5 text-sm font-medium text-muted-foreground border-b-[3px] border-transparent transition-colors hover:text-foreground hover:bg-muted/40 data-[state=active]:border-eko-gold data-[state=active]:text-eko-navy data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {panels.map((panel) => (
        <TabsContent
          key={panel.id}
          value={panel.id}
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};
