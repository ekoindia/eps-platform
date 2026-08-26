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

function renderMenu(state: AuthState, path = "/") {
	mockState = state;
	return render(
		<MemoryRouter initialEntries={[path]}>
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

const admin: AuthState = {
	status: "authed",
	role: "admin",
	me: { role: "admin", login: "octocat", sub: "gh:1" },
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
		expect(await screen.findByText("+91 999 000 0079")).toBeInTheDocument();
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

	it("puts a labelled console jump beside the avatar", () => {
		renderMenu(developer);
		const jump = screen.getByRole("link", { name: /console home/i });
		expect(jump).toHaveAttribute("href", "/console");
		expect(jump).toHaveTextContent("Console");
		expect(jump).not.toHaveAttribute("aria-current");
	});

	it("points an admin's jump at the admin console", () => {
		renderMenu(admin);
		expect(screen.getByRole("link", { name: /admin home/i })).toHaveAttribute(
			"href",
			"/admin",
		);
	});

	it("marks the jump current inside the console, but not on a lookalike route", () => {
		renderMenu(developer, "/console/keys");
		expect(screen.getByRole("link", { name: /console home/i })).toHaveAttribute(
			"aria-current",
			"page",
		);
		renderMenu(developer, "/console-old");
		const [, sibling] = screen.getAllByRole("link", { name: /console home/i });
		expect(sibling).not.toHaveAttribute("aria-current");
	});

	it("pins the console as the first menu row", async () => {
		renderMenu(developer);
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		const first = (await screen.findAllByRole("menuitem"))[0];
		expect(first).toHaveTextContent("Developer Console");
		expect(first).toHaveAttribute("href", "/console");
	});

	it("pins the admin console first and keeps the developer one below", async () => {
		renderMenu(admin);
		fireEvent.keyDown(screen.getByRole("button", { name: /account menu/i }), {
			key: "Enter",
		});
		const items = await screen.findAllByRole("menuitem");
		expect(items[0]).toHaveTextContent("Admin Console");
		expect(items[0]).toHaveAttribute("href", "/admin");
		expect(
			screen.getByRole("menuitem", { name: /developer console/i }),
		).toHaveAttribute("href", "/console");
	});
});
