import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConsoleLayout, {
	useConsoleMe,
} from "@/components/console/ConsoleLayout";
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

const DEVELOPER: AuthState = {
	status: "authed",
	role: "developer",
	me: { state: "active", mobile: "999", profile: null, zohoId: null },
};

function renderLayout(state: AuthState, path = "/console") {
	mockState = state;
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/console" element={<ConsoleLayout />}>
						<Route index element={<div>home-page</div>} />
						<Route path="credentials" element={<div>creds-page</div>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</HelmetProvider>,
	);
}

function ContextProbe() {
	const me = useConsoleMe();
	return <div>state:{me.state}</div>;
}

describe("ConsoleLayout", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		mockNavigate.mockClear();
	});

	it("never leaks credentials to an anonymous visitor", () => {
		// The anon branch renders no Outlet, so no sub-page — and therefore no
		// keypair — can mount. This asserts that guarantee in the terms that
		// make it load-bearing.
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");
		renderLayout({ status: "anon" }, "/console/credentials");
		expect(screen.queryByText("dev-key-123")).not.toBeInTheDocument();
		expect(screen.getByText("login-form")).toBeInTheDocument();
	});

	it("renders the login form and no rail when anon", () => {
		renderLayout({ status: "anon" });
		expect(screen.getByText("login-form")).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Console" })).toBeNull();
		expect(screen.queryByText("home-page")).toBeNull();
	});

	it("shows a skeleton while loading", () => {
		renderLayout({ status: "loading" });
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});

	it("greets an admin session without a rail", () => {
		renderLayout({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octo", sub: "gh:octo" },
		});
		expect(screen.getByText(/octo/i)).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Console" })).toBeNull();
	});

	it("redirects a signup session back to /signup instead of rendering an empty console", () => {
		renderLayout({
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		});
		expect(mockNavigate).toHaveBeenCalledWith("/signup", { replace: true });
		// Not blank: shows the same loading skeleton the `loading` state shows,
		// rather than an empty body while the redirect is in flight.
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});

	it("renders the rail and the child route for a developer", () => {
		renderLayout(DEVELOPER);
		expect(screen.getByText("home-page")).toBeInTheDocument();
		const links = screen.getAllByRole("link", { name: /credentials/i });
		expect(links[0]).toHaveAttribute("href", "/console/credentials");
	});

	it("renders the credentials child route at /console/credentials", () => {
		renderLayout(DEVELOPER, "/console/credentials");
		expect(screen.getByText("creds-page")).toBeInTheDocument();
	});

	it("passes the session to the child route via outlet context", () => {
		mockState = DEVELOPER;
		render(
			<HelmetProvider>
				<MemoryRouter initialEntries={["/console"]}>
					<Routes>
						<Route path="/console" element={<ConsoleLayout />}>
							<Route index element={<ContextProbe />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</HelmetProvider>,
		);
		expect(screen.getByText("state:active")).toBeInTheDocument();
	});
});
