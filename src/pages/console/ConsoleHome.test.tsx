import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ConsoleHome from "@/pages/console/ConsoleHome";
import type { MeView } from "@/lib/auth/client";

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

	it("shows the active integration overview for an active developer", () => {
		renderHome({
			state: "active",
			mobile: "999",
			profile: { name: "Asha" } as never,
			zohoId: null,
		});
		expect(screen.getByText(/integration overview/i)).toBeInTheDocument();
		expect(screen.getByText(/signed in as asha/i)).toBeInTheDocument();
	});

	it("falls back to the mobile number when there is no profile", () => {
		renderHome({ state: "active", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText(/signed in as 999/i)).toBeInTheDocument();
	});
});
