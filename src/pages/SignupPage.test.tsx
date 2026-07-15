import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthState } from "@/lib/auth/AuthProvider";
import SignupPage from "./SignupPage";

let mockState: AuthState = { status: "loading" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/components/auth/LoginForm", () => ({
	LoginForm: () => <div data-testid="login-form" />,
}));
vi.mock("@/features/signup/SignupWizard", () => ({
	SignupWizard: () => <div data-testid="signup-wizard" />,
}));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
	...(await orig<typeof import("react-router-dom")>()),
	useNavigate: () => mockNavigate,
}));

function renderPage() {
	return render(
		<HelmetProvider>
			<MemoryRouter>
				<SignupPage />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

describe("SignupPage", () => {
	it("shows the login form when anonymous", () => {
		mockState = { status: "anon" };
		renderPage();
		expect(screen.getByTestId("login-form")).toBeInTheDocument();
	});

	it("shows the wizard for a signup session", () => {
		mockState = {
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		};
		renderPage();
		expect(screen.getByTestId("signup-wizard")).toBeInTheDocument();
	});

	it("redirects a fully onboarded user to the console", () => {
		mockState = {
			status: "authed",
			role: "developer",
			me: { state: "active", mobile: "9990000001", profile: null, zohoId: null },
		};
		renderPage();
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
	});

	it("shows a skeleton while loading", () => {
		mockState = { status: "loading" };
		renderPage();
		expect(screen.getByTestId("signup-loading")).toBeInTheDocument();
	});
});
