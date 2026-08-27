import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Landmark, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/** Tab ids — URL-stable (used in the ?tab= query param) */
export type PricingTabId = "verification" | "dmt" | "payments" | "banking";

/** The calculator tabs' own URL key (absent = "verification") */
const TAB_PARAM = "tab";

const TAB_DEFS: {
	id: PricingTabId;
	label: string;
	icon: typeof ShieldCheck;
}[] = [
	{ id: "verification", label: "Verification APIs", icon: ShieldCheck },
	{ id: "dmt", label: "Money Transfer (DMT)", icon: Send },
	{ id: "payments", label: "AePS & BBPS", icon: Banknote },
	{ id: "banking", label: "Connected Banking", icon: Landmark },
];

/** True when `value` names a tab that is currently visible (see `TAB_DEFS`). */
const isVisibleTabId = (
	value: string | null,
	visible: readonly { id: PricingTabId }[],
): value is PricingTabId => visible.some((tab) => tab.id === value);

export interface PricingTabsProps {
	/** Tab 1 — Verification APIs (cost calculator + rate card) */
	verification: ReactNode;
	/** Tab 2 — DMT (per-transaction ledger + RCM explainer + rate card) */
	dmt: ReactNode;
	/** Tab 3 — AePS & BBPS (earnings calculator + rate card) */
	payments: ReactNode;
	/** Tab 4 — Connected Banking (cost calculator). Omit to hide the tab. */
	banking?: ReactNode;
}

/**
 * Client-side tab shell for the /pricing page.
 *
 * Every supplied panel stays mounted (`forceMount`) and is hidden via CSS so the
 * prerendered HTML carries every product's tables (SEO) and calculator state
 * survives tab switches. `display:none` also hides each inactive panel's
 * position:fixed mobile summary bar.
 *
 * A panel prop left undefined drops both its content and its tab trigger — that
 * is how a product is switched off (see `CONNECTED_BANKING_ENABLED`). A `?tab=`
 * pointing at a hidden or unknown tab falls back to "verification" and the stale
 * key is stripped from the URL.
 *
 * The active tab is mirrored to `?tab=` ("verification" is the canonical
 * default and never written). Only the `tab` key is touched — `sel`, `gst`,
 * `dmt`, `pay`, `cb` and UTM/tracking params are preserved.
 */
export const PricingTabs = ({
	verification,
	dmt,
	payments,
	banking,
}: PricingTabsProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	// A panel prop left undefined removes both the panel and its tab trigger.
	const panels = (
		[
			{ id: "verification", content: verification },
			{ id: "dmt", content: dmt },
			{ id: "payments", content: payments },
			{ id: "banking", content: banking },
		] as const
	).filter((panel) => panel.content != null);
	const tabs = TAB_DEFS.filter((tab) =>
		panels.some((panel) => panel.id === tab.id),
	);

	const [activeTab, setActiveTab] = useState<PricingTabId>(() => {
		const fromUrl = searchParams.get(TAB_PARAM);
		return isVisibleTabId(fromUrl, tabs) ? fromUrl : "verification";
	});

	// Strip a `?tab=` that names a hidden or unknown tab so the URL stops
	// advertising it on reload/share. The predicate is computed during render so
	// the effect depends on a boolean, not on the freshly-built `tabs` array —
	// and it flips false after the write, so this runs exactly once.
	const urlTab = searchParams.get(TAB_PARAM);
	const hasStaleTabParam = urlTab !== null && !isVisibleTabId(urlTab, tabs);
	useEffect(() => {
		if (!hasStaleTabParam) return;
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				params.delete(TAB_PARAM);
				return params;
			},
			{ replace: true, preventScrollReset: true },
		);
	}, [hasStaleTabParam, setSearchParams]);

	const onTabChange = (value: string) => {
		if (!isVisibleTabId(value, tabs)) return;
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
						{tabs.map((tab) => (
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
