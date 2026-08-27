import type { AuthState } from "@/lib/auth/AuthProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderDropdownPanels } from "./HeaderDropdownPanels";

const logout = vi.fn();
let mockState: AuthState = { status: "anon" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout }),
}));

// `SHOW_USER_LOGIN` is a module constant read at import, so it has to be mocked
// rather than set through import.meta.env — CI has no `.env.local`, and without
// it the drawer renders no identity and `GetStartedButton` is a chat button
// rather than a link. Spread keeps the other flags at their real values.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_USER_LOGIN: true,
}));

const setMobileMenuOpen = vi.fn();

function renderDrawer(state: AuthState) {
	mockState = state;
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<HeaderDropdownPanels
				activeDesktopDropdown={null}
				setActiveDesktopDropdown={vi.fn()}
				activeMobileAccordion={null}
				setActiveMobileAccordion={vi.fn()}
				mobileMenuOpen
				isScrolled={false}
				talkToSalesOpen={false}
				setMobileMenuOpen={setMobileMenuOpen}
				setTalkToSalesOpen={vi.fn()}
				panelHoverHandlers={{ onMouseEnter: vi.fn(), onMouseLeave: vi.fn() }}
			/>
		</MemoryRouter>,
	);
}

const developer: AuthState = {
	status: "authed",
	role: "developer",
	me: {
		state: "active",
		mobile: "8527155996",
		profile: {
			name: "Richa Mishra",
			code: "48060001",
		} as never,
		zohoId: null,
	},
};

const admin: AuthState = {
	status: "authed",
	role: "admin",
	me: { role: "admin", login: "octocat", sub: "gh:1" },
};

afterEach(() => vi.clearAllMocks());

describe("mobile drawer account section", () => {
	it("puts the identity in the header slot instead of the logo", () => {
		renderDrawer(developer);
		expect(screen.getByText("Richa Mishra")).toBeInTheDocument();
		expect(screen.getByText("EPS Admin")).toBeInTheDocument();
		expect(
			screen.getByText(/\+91 852 715 5996 · EkoCode 48060001/),
		).toBeInTheDocument();
		// The logo link owns the slot only while signed out.
		expect(
			screen.queryByRole("link", { name: /eko platform services/i }),
		).not.toBeInTheDocument();
	});

	it("gives a developer My Profile, not the admin console row", () => {
		renderDrawer(developer);
		expect(screen.getByRole("link", { name: "My Profile" })).toHaveAttribute(
			"href",
			"/console/profile",
		);
		expect(
			screen.queryByRole("link", { name: "Developer console" }),
		).not.toBeInTheDocument();
	});

	it("swaps My Profile for the developer console row on an admin", () => {
		renderDrawer(admin);
		expect(
			screen.getByRole("link", { name: "Developer console" }),
		).toHaveAttribute("href", "/console");
		expect(
			screen.queryByRole("link", { name: "My Profile" }),
		).not.toBeInTheDocument();
	});

	it("logs out and closes the drawer from its own row", () => {
		renderDrawer(developer);
		fireEvent.click(screen.getByRole("button", { name: "Log out" }));
		expect(logout).toHaveBeenCalledTimes(1);
		expect(setMobileMenuOpen).toHaveBeenCalledWith(false);
	});

	it("keeps the language list open when its row is tapped", () => {
		renderDrawer(developer);
		fireEvent.click(screen.getByRole("button", { name: /select language/i }));
		expect(setMobileMenuOpen).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "हिन्दी" })).toBeInTheDocument();
	});

	it("shows the logo and Get Started while signed out", () => {
		renderDrawer({ status: "anon" });
		expect(screen.queryByText("Log out")).not.toBeInTheDocument();
		expect(screen.queryByText("My Profile")).not.toBeInTheDocument();
		// `GetStartedButton` swaps in `consoleLabel` while `SHOW_USER_LOGIN` is on.
		expect(
			screen.getByRole("link", { name: /get started|log in \/ sign up/i }),
		).toBeInTheDocument();
	});
});
