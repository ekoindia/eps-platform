import BusinessDashboard from "@/components/console/dashboard/BusinessDashboard";
import { ApiError } from "@/lib/auth/client";
import type { DashboardView } from "@/lib/console/dashboard";
import { resetDashboardCache } from "@/lib/console/dashboard";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	dashboardClient: { load: vi.fn() },
}));

const { dashboardClient } = await import("@/lib/auth/client");
const load = vi.mocked(dashboardClient.load);

/** A view with everything at zero, and the given overrides applied. */
function view(overrides: Partial<DashboardView> = {}): DashboardView {
	const zero = { value: 0, lastPeriod: 0 };
	return {
		range: {
			preset: "last7",
			from: "2026-07-22 00:00:00",
			to: "2026-07-28 23:59:59",
		},
		overview: {
			transactions: { value: 939, lastPeriod: 720 },
			successCases: { value: 222, lastPeriod: 200 },
			failedCases: zero,
			pending: zero,
			gtv: zero,
			revenue: zero,
			averageRevenue: zero,
			breakdown: [],
			...overrides.overview,
		},
		successRates: [],
		mostUsedServices: [
			{
				typeId: "81",
				name: "Accept Payment",
				totalCount: 223,
				totalRevenue: 0,
			},
		],
		usage: [
			{
				startDate: "2026-07-28T00:00:00",
				endDate: "2026-07-28T23:59:59",
				totalCount: 63,
			},
		],
		services: [],
		...overrides,
	};
}

function renderDashboard() {
	return render(
		<MemoryRouter>
			<BusinessDashboard />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	resetDashboardCache();
	load.mockReset();
});

describe("BusinessDashboard", () => {
	it("shows a skeleton, then leads with the transaction count", async () => {
		load.mockResolvedValue(view());
		renderDashboard();
		expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
		expect(await screen.findByText("939")).toBeInTheDocument();
		expect(screen.getByText("Total Transactions")).toBeInTheDocument();
		expect(
			screen.getByText(/showing stats from 22 jul 2026 to 28 jul 2026/i),
		).toBeInTheDocument();
	});

	it("defaults to the last-7-day window", async () => {
		load.mockResolvedValue(view());
		renderDashboard();
		await screen.findByText("939");
		expect(load).toHaveBeenCalledWith({ preset: "last7", typeId: undefined });
	});

	it("refetches when another window is picked", async () => {
		load.mockResolvedValue(view());
		renderDashboard();
		await screen.findByText("939");
		// Radix Tabs selects on mousedown, not on a synthetic click.
		fireEvent.mouseDown(screen.getByRole("tab", { name: "Last 30 Days" }));
		await waitFor(() =>
			expect(load).toHaveBeenCalledWith({
				preset: "last30",
				typeId: undefined,
			}),
		);
	});

	it("renders the chart widgets' text summaries once they load", async () => {
		load.mockResolvedValue(view());
		renderDashboard();
		// The charts are SVG — assert on the summary lines, which are also what a
		// screen reader gets.
		expect(await screen.findByText(/top: accept payment/i)).toBeInTheDocument();
		expect(await screen.findByText("Total Volume")).toBeInTheDocument();
	});

	it("treats a deployment without analytics as a note, not a failure", async () => {
		load.mockRejectedValue(
			new ApiError("DASHBOARD_UNAVAILABLE", "not here", 501),
		);
		renderDashboard();
		expect(
			await screen.findByText(/aren't available on this deployment/i),
		).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("shows the error box and no widgets on a real failure", async () => {
		load.mockRejectedValue(
			new ApiError("DASHBOARD_FAILED", "upstream said no", 502),
		);
		renderDashboard();
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"upstream said no",
		);
		expect(screen.queryByText("Total Transactions")).not.toBeInTheDocument();
	});

	it("renders real zeros alongside a pointer to the transaction history", async () => {
		load.mockResolvedValue(
			view({
				overview: {
					...view().overview,
					transactions: { value: 0, lastPeriod: 0 },
					successCases: { value: 0, lastPeriod: 0 },
				},
				mostUsedServices: [],
				usage: [],
			}),
		);
		renderDashboard();
		expect(
			await screen.findByText(/no activity for your account/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /check your transaction history/i }),
		).toBeInTheDocument();
		// The zero is SHOWN, not hidden — that is what makes it distinguishable
		// from "we could not see your account".
		expect(screen.getByText("Total Transactions")).toBeInTheDocument();
	});
});
