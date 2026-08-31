import type { AuthState } from "@/lib/auth/AuthProvider";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderDropdownPanels } from "./HeaderDropdownPanels";

let mockState: AuthState = { status: "anon" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));

// Same reason as the drawer suite: `SHOW_USER_LOGIN` is a module constant read
// at import, and the console card exists only when it is on. Spread keeps the
// other flags real.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_USER_LOGIN: true,
}));

function renderPanel(state: AuthState) {
	mockState = state;
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<HeaderDropdownPanels
				activeDesktopDropdown="developers"
				setActiveDesktopDropdown={vi.fn()}
				activeMobileAccordion={null}
				setActiveMobileAccordion={vi.fn()}
				mobileMenuOpen={false}
				isScrolled={false}
				talkToSalesOpen={false}
				setMobileMenuOpen={vi.fn()}
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
		profile: { name: "Richa Mishra", code: "48060001" } as never,
		zohoId: null,
	},
};

const admin: AuthState = {
	status: "authed",
	role: "admin",
	me: { role: "admin", login: "octocat", sub: "gh:1" },
};

const consoleCta = () => screen.getByRole("link", { name: "Open Console" });

afterEach(() => vi.clearAllMocks());

describe("desktop Developers dropdown console card", () => {
	it("offers the console to a signed-out visitor, with no signed-in badge", () => {
		renderPanel({ status: "anon" });
		expect(consoleCta()).toHaveAttribute("href", "/console");
		expect(screen.queryByText(/signed in/i)).not.toBeInTheDocument();
		// The card replaces the old link-list row, so it must not appear twice.
		expect(screen.getAllByText("Developer Console")).toHaveLength(1);
	});

	it("marks a signed-in developer and keeps them on /console", () => {
		renderPanel(developer);
		expect(screen.getByText(/signed in/i)).toBeInTheDocument();
		expect(consoleCta()).toHaveAttribute("href", "/console");
	});

	// An admin's console is the GitOps one; same split `consoleTarget` makes for
	// the drawer CTA.
	it("sends an admin to /admin", () => {
		renderPanel(admin);
		expect(consoleCta()).toHaveAttribute("href", "/admin");
	});
});
