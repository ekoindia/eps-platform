import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsoleHome from "@/pages/console/ConsoleHome";
import type { MeView } from "@/lib/auth/client";
import { resetDashboardCache } from "@/lib/console/dashboard";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	dashboardClient: { load: vi.fn() },
}));

const { dashboardClient } = await import("@/lib/auth/client");
const load = vi.mocked(dashboardClient.load);

beforeEach(() => {
	resetDashboardCache();
	load.mockReset();
	// Never settles: the dashboard stays on its skeleton, which keeps these
	// tests about ConsoleHome's routing rather than about the widgets.
	load.mockReturnValue(new Promise(() => {}));
});

function renderHome(me: MeView) {
	return render(
		<MemoryRouter initialEntries={["/console"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route index element={<ConsoleHome />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

describe("ConsoleHome", () => {
	it("shows the lead onboarding CTA for a lead developer", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText(/start onboarding/i)).toBeInTheDocument();
	});

	it("does not load a dashboard for an account that cannot have one", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(load).not.toHaveBeenCalled();
		expect(screen.queryByTestId("dashboard-loading")).not.toBeInTheDocument();
	});

	it("shows the dashboard, with the state as a banner, for an active developer", () => {
		renderHome({
			state: "active",
			mobile: "999",
			profile: { name: "Asha" } as never,
			zohoId: null,
		});
		expect(screen.getByText(/signed in as asha/i)).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
		expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
		expect(load).toHaveBeenCalledWith({ preset: "last7", typeId: undefined });
	});

	it("falls back to the mobile number when there is no profile", () => {
		renderHome({ state: "active", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText(/signed in as 999/i)).toBeInTheDocument();
	});

	it("keeps the full state card for an inactive account", () => {
		renderHome({
			state: "inactive",
			mobile: "999",
			profile: null,
			zohoId: null,
		});
		expect(screen.getByText(/account inactive/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /contact support/i }),
		).toBeInTheDocument();
		expect(load).not.toHaveBeenCalled();
	});
});
