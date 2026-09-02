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

// Module constant read at import, so it has to be mocked rather than stubbed
// through import.meta.env. On here, so this file stays about ConsoleHome's
// routing; the flag-off default has its own file, ConsoleHome.flags.test.tsx.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_BUSINESS_DASHBOARD: true,
	// Proves ConsoleHome actually renders the support strip when a channel is
	// configured — SupportContact's own tests pass through props and so would
	// stay green even if the import here were dropped.
	SUPPORT_EMAIL: "eps.support@eko.co.in",
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
	it("renders the support strip when a channel is configured", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(
			screen.getByRole("link", { name: "Email support at eps.support@eko.co.in" }),
		).toHaveAttribute("href", "mailto:eps.support@eko.co.in");
	});


	it("shows the lifecycle state on the profile card for a lead developer", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText("Lead")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View Profile" }),
		).toBeInTheDocument();
	});

	it("still shows the next steps for a lead, beside the profile card", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText("Next Steps")).toBeInTheDocument();
		expect(screen.getByText(/finish your kyc/i)).toBeInTheDocument();
	});

	it("does not load a dashboard for an account that cannot have one", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(load).not.toHaveBeenCalled();
		expect(screen.queryByTestId("dashboard-loading")).not.toBeInTheDocument();
	});

	it("shows the dashboard, with the state on the profile card, for an active developer", () => {
		renderHome({
			state: "active",
			mobile: "999",
			profile: { name: "Asha" } as never,
			zohoId: null,
		});
		expect(screen.getByText("Asha")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
		expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
		expect(load).toHaveBeenCalledWith({ preset: "last7", typeId: undefined });
	});

	it("falls back to the mobile number when there is no profile", () => {
		renderHome({
			state: "active",
			mobile: "9990000079",
			profile: null,
			zohoId: null,
		});
		expect(screen.getByText("9990000079")).toBeInTheDocument();
		expect(screen.getByText("+91 999 000 0079")).toBeInTheDocument();
	});

	// A KYC-pending account can have transacted, so it keeps the dashboard it had
	// before this state existed — the state itself only ever reads as a badge.
	it("keeps the dashboard while KYC is pending", () => {
		renderHome({
			state: "kyc-pending",
			mobile: "999",
			profile: null,
			zohoId: null,
		});
		expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
		expect(load).toHaveBeenCalled();
		expect(screen.getByText("KYC Pending")).toBeInTheDocument();
	});

	// Same reason as the kyc-pending case above: a refused document does not
	// unwind the transactions this partner has already run.
	it("keeps the dashboard when the KYC pack was rejected", () => {
		renderHome({
			state: "kyc-rejected",
			mobile: "999",
			profile: null,
			zohoId: null,
		});
		expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
		expect(load).toHaveBeenCalled();
		expect(screen.getByText("KYC Rejected")).toBeInTheDocument();
	});

	it("shows the state, and no dashboard, for an inactive account", () => {
		renderHome({
			state: "inactive",
			mobile: "999",
			profile: null,
			zohoId: null,
		});
		expect(screen.getByText("Inactive")).toBeInTheDocument();
		expect(load).not.toHaveBeenCalled();
	});
});
