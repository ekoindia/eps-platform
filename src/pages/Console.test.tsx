import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";
import Console from "@/pages/Console";
import type { AuthState } from "@/lib/auth/AuthProvider";

let mockState: AuthState = { status: "loading" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/components/auth/LoginForm", () => ({
	LoginForm: () => <div>login-form</div>,
}));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
	...(await orig<typeof import("react-router-dom")>()),
	useNavigate: () => mockNavigate,
}));

function renderConsole(state: AuthState) {
	mockState = state;
	return render(
		<HelmetProvider>
			<MemoryRouter>
				<Console />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

describe("Console", () => {
	it("renders the login form when anon", () => {
		renderConsole({ status: "anon" });
		expect(screen.getByText("login-form")).toBeInTheDocument();
	});

	it("shows a skeleton while loading", () => {
		renderConsole({ status: "loading" });
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});

	it("shows the lead onboarding CTA for a lead developer", () => {
		renderConsole({
			status: "authed",
			role: "developer",
			me: { state: "lead", mobile: "999", profile: null, zohoId: null },
		});
		expect(screen.getByText(/start onboarding/i)).toBeInTheDocument();
	});

	it("shows the active integration overview for an active developer", () => {
		renderConsole({
			status: "authed",
			role: "developer",
			me: {
				state: "active",
				mobile: "999",
				profile: { name: "Asha" } as never,
				zohoId: null,
			},
		});
		expect(screen.getByText(/integration overview/i)).toBeInTheDocument();
	});

	it("greets an admin session", () => {
		renderConsole({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octo", sub: "gh:octo" },
		});
		expect(screen.getByText(/octo/i)).toBeInTheDocument();
	});

	it("redirects a signup session back to /signup instead of rendering an empty console", () => {
		renderConsole({
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		});
		expect(mockNavigate).toHaveBeenCalledWith("/signup", { replace: true });
		// Not blank: shows the same loading skeleton the `loading` state shows,
		// rather than an empty body while the redirect is in flight.
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});
});
