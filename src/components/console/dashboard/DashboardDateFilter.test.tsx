import DashboardDateFilter from "@/components/console/dashboard/DashboardDateFilter";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The production cap, pinned explicitly rather than left to whatever the test
// environment has in `VITE_SHOW_DASHBOARD_LAST_365`. The flag-on case needs its
// own file — the flag is a module constant read at import.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_DASHBOARD_LAST_365: false,
}));

describe("DashboardDateFilter with the year window capped", () => {
	it("offers the four short windows and not the year", () => {
		render(<DashboardDateFilter preset="last7" onChange={() => {}} />);
		expect(screen.getAllByRole("tab")).toHaveLength(4);
		expect(
			screen.getByRole("tab", { name: "Last 30 Days" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("tab", { name: "Last 365 Days" }),
		).not.toBeInTheDocument();
	});
});
