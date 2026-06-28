import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";
import type { AuthState } from "@/lib/auth/AuthProvider";

let mockState: AuthState = { status: "anon" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));

function renderAdmin(state: AuthState) {
	mockState = state;
	return render(
		<HelmetProvider>
			<MemoryRouter>
				<Admin />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

describe("Admin", () => {
	it("shows the GitHub sign-in link to the backend OAuth start when anon", () => {
		renderAdmin({ status: "anon" });
		expect(
			screen.getByRole("link", { name: /sign in with github/i }),
		).toHaveAttribute("href", "/api/auth/admin/github");
	});

	it("shows a console link (not the sign-in button) when signed in as admin", () => {
		renderAdmin({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octo", sub: "gh:octo" },
		});
		expect(
			screen.queryByRole("link", { name: /sign in with github/i }),
		).toBeNull();
		expect(
			screen.getByRole("link", { name: /go to console/i }),
		).toHaveAttribute("href", "/console");
		expect(screen.getByText(/octo/i)).toBeInTheDocument();
	});
});
