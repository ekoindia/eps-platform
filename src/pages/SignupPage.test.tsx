import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function renderPage(path = "/signup") {
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={[path]}>
				<SignupPage />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

const DEVELOPER: AuthState = {
	status: "authed",
	role: "developer",
	me: { state: "active", mobile: "9990000001", profile: null, zohoId: null },
};

describe("SignupPage", () => {
	beforeEach(() => mockNavigate.mockClear());

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
		mockState = DEVELOPER;
		renderPage();
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
	});

	// The `?next=` on the signup link survives the whole wizard — the URL never
	// changes while it runs — and is spent here, on the hop to the console.
	it("sends a newly onboarded developer to ?next= instead of the console", () => {
		mockState = DEVELOPER;
		renderPage("/signup?next=/console/credentials");
		expect(mockNavigate).toHaveBeenCalledWith("/console/credentials", {
			replace: true,
		});
	});

	it("falls back to the console for a ?next= that points off-site", () => {
		mockState = DEVELOPER;
		renderPage("/signup?next=https://evil.com");
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
	});

	it("ignores ?next= for an admin, who has no console pages to land on", () => {
		mockState = {
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octo", sub: "gh:octo" },
		};
		renderPage("/signup?next=/console/credentials");
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
	});

	it("shows a skeleton while loading", () => {
		mockState = { status: "loading" };
		renderPage();
		expect(screen.getByTestId("signup-loading")).toBeInTheDocument();
	});

	it("redirects an admin user to console and shows loading skeleton", () => {
		mockState = {
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "admin@example.com", sub: "sub123" },
		};
		renderPage();
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
		expect(screen.getByTestId("signup-loading")).toBeInTheDocument();
	});
});
