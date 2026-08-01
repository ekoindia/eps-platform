import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";
import type { AuthState } from "@/lib/auth/AuthProvider";

const logout = vi.fn();
let mockState: AuthState = { status: "anon" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout }),
}));

function renderMenu(state: AuthState) {
	mockState = state;
	return render(
		<MemoryRouter>
			<UserMenu />
		</MemoryRouter>,
	);
}

const developer: AuthState = {
	status: "authed",
	role: "developer",
	me: {
		state: "active",
		mobile: "9990000079",
		profile: null,
		zohoId: null,
	},
};

afterEach(() => vi.clearAllMocks());

describe("UserMenu", () => {
	it("renders nothing when anonymous", () => {
		const { container } = renderMenu({ status: "anon" });
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the avatar trigger with mobile-derived initials", () => {
		renderMenu(developer);
		expect(
			screen.getByRole("button", { name: /account menu/i }),
		).toHaveTextContent("#79");
	});

	it("opens the menu and logs out on click", async () => {
		renderMenu(developer);
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		expect(await screen.findByText("9990000079")).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: /console/i }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));
		await waitFor(() => expect(logout).toHaveBeenCalled());
	});

	it("links a developer to their profile page", async () => {
		renderMenu(developer);
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		// Radix puts role="menuitem" on the anchor, overriding its implicit "link".
		expect(
			await screen.findByRole("menuitem", { name: /my profile/i }),
		).toHaveAttribute("href", "/console/profile");
	});

	it("hides the profile entry from admins, who have no Eko profile", async () => {
		renderMenu({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octocat", sub: "gh:1" },
		});
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		await screen.findByRole("menuitem", { name: /admin console/i });
		expect(screen.queryByRole("menuitem", { name: /my profile/i })).toBeNull();
	});

	it("shows the admin console entry for admins", async () => {
		renderMenu({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octocat", sub: "gh:1" },
		});
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		expect(
			await screen.findByRole("menuitem", { name: /admin console/i }),
		).toBeInTheDocument();
	});
});
