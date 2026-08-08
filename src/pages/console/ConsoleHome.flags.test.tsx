import type { MeView } from "@/lib/auth/client";
import ConsoleHome from "@/pages/console/ConsoleHome";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	dashboardClient: { load: vi.fn() },
}));

// The production default, pinned explicitly rather than left to whatever the
// test environment happens to have in `VITE_SHOW_BUSINESS_DASHBOARD` — a stray
// `.env.local` would otherwise turn this file green while proving nothing.
// Separate file from ConsoleHome.test.tsx because the flag is a module constant
// read at import, so its value cannot vary per test.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_BUSINESS_DASHBOARD: false,
}));

const { dashboardClient } = await import("@/lib/auth/client");
const load = vi.mocked(dashboardClient.load);

const ACTIVE: MeView = {
	state: "active",
	mobile: "999",
	profile: { name: "Asha" } as never,
	zohoId: null,
};

describe("ConsoleHome with the dashboard flag off", () => {
	it("shows Home and the next steps, and never asks for a dashboard", () => {
		render(
			<MemoryRouter initialEntries={["/console"]}>
				<Routes>
					<Route path="/console" element={<Outlet context={ACTIVE} />}>
						<Route index element={<ConsoleHome />} />
					</Route>
				</Routes>
			</MemoryRouter>,
		);
		expect(
			screen.getByRole("heading", { level: 2, name: "Home" }),
		).toBeInTheDocument();
		expect(screen.getByText("Next Steps")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
		expect(screen.queryByTestId("dashboard-loading")).not.toBeInTheDocument();
		// The point of the flag: a hidden dashboard costs no upstream call.
		expect(load).not.toHaveBeenCalled();
	});
});
