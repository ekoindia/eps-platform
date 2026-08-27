// Guards the tab-visibility contract: a panel prop left undefined drops both
// the panel and its trigger, and a `?tab=` naming a hidden or unknown tab
// falls back to "verification" with the stale key stripped from the URL.
// This is what switches Connected Banking off (CONNECTED_BANKING_ENABLED).
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	PricingTabs,
	type PricingTabsProps,
} from "@/components/pricing/PricingTabs";

let container: HTMLDivElement;
let root: Root;
let search = "";

/** Mirrors the live router search string out for assertions. */
const SearchProbe = () => {
	const location = useLocation();
	useEffect(() => {
		search = location.search;
	}, [location.search]);
	return null;
};

const renderTabs = (
	initialUrl: string,
	props: Partial<PricingTabsProps> = {},
) => {
	act(() => {
		root = createRoot(container);
		root.render(
			<MemoryRouter initialEntries={[initialUrl]}>
				<SearchProbe />
				<PricingTabs
					verification={<div>VERIFICATION PANEL</div>}
					dmt={<div>DMT PANEL</div>}
					payments={<div>PAYMENTS PANEL</div>}
					{...props}
				/>
			</MemoryRouter>,
		);
	});
};

const triggerLabels = () =>
	[...container.querySelectorAll('[role="tab"]')].map((el) => el.textContent);

const activeTrigger = () =>
	container.querySelector('[role="tab"][data-state="active"]')?.textContent;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	search = "";
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe("PricingTabs", () => {
	it("omits the tab whose panel prop is undefined", () => {
		renderTabs("/pricing");

		expect(triggerLabels()).toEqual([
			"Verification APIs",
			"Money Transfer (DMT)",
			"AePS & BBPS",
		]);
		expect(container.textContent).not.toContain("Connected Banking");
		expect(container.textContent).not.toContain("BANKING PANEL");
	});

	it("renders the tab once its panel prop is supplied", () => {
		renderTabs("/pricing", { banking: <div>BANKING PANEL</div> });

		expect(triggerLabels()).toContain("Connected Banking");
		expect(container.textContent).toContain("BANKING PANEL");
	});

	it("falls back to verification and strips a ?tab= naming a hidden tab", () => {
		renderTabs("/pricing?tab=banking&cb=2:5000:10000");

		expect(activeTrigger()).toBe("Verification APIs");
		expect(search).not.toContain("tab=");
		// Unrelated calculator params must survive the rewrite.
		expect(search).toContain("cb=2%3A5000%3A10000");
	});

	it("honours a ?tab= naming a visible tab", () => {
		renderTabs("/pricing?tab=dmt");

		expect(activeTrigger()).toBe("Money Transfer (DMT)");
		expect(search).toContain("tab=dmt");
	});
});
