import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HeaderDropdownPanels } from "./HeaderDropdownPanels";

vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({
		state: { status: "anon" },
		refresh: vi.fn(),
		logout: vi.fn(),
	}),
}));

// Forced off rather than left to the ambient env: a developer's `.env.local`
// turns `SHOW_USER_LOGIN` on while CI has none, so an unmocked flag would make
// this suite pass or fail by machine. Flag off is today's production build, and
// the console card must stay out of that panel entirely — it would advertise a
// gated feature.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_USER_LOGIN: false,
}));

describe("desktop Developers dropdown with the console feature off", () => {
	it("renders no console card and no console link", () => {
		render(
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
		expect(screen.queryByText("Developer Console")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Open Console" }),
		).not.toBeInTheDocument();
		// The reference columns themselves are untouched.
		expect(
			screen.getByRole("link", { name: /API Documentation/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Ask Claude/ }),
		).toBeInTheDocument();
	});
});
