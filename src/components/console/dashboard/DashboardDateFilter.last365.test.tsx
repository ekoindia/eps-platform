import DashboardDateFilter from "@/components/console/dashboard/DashboardDateFilter";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The local-testing flag on. Its own file because the flag is a module constant
// read at import; the capped default lives in DashboardDateFilter.test.tsx.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_DASHBOARD_LAST_365: true,
}));

describe("DashboardDateFilter with the year window enabled", () => {
	it("offers Last 365 Days and selects it", () => {
		const onChange = vi.fn();
		render(<DashboardDateFilter preset="last7" onChange={onChange} />);
		expect(screen.getAllByRole("tab")).toHaveLength(5);
		// Radix Tabs selects on mousedown, not on a synthetic click.
		fireEvent.mouseDown(screen.getByRole("tab", { name: "Last 365 Days" }));
		expect(onChange).toHaveBeenCalledWith("last365");
	});
});
