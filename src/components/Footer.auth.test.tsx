// src/components/Footer.auth.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = { value: { status: "anon" as string } };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: state.value, refresh: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/lib/config/features", () => ({ SHOW_USER_LOGIN: true }));

import { Footer } from "@/components/Footer";

afterEach(() => {
	state.value = { status: "anon" };
});

function renderFooter() {
	return render(
		<MemoryRouter>
			<Footer />
		</MemoryRouter>,
	);
}

describe("Footer auth entry", () => {
	it("shows Log in when anon and flag on", () => {
		state.value = { status: "anon" };
		renderFooter();
		expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
			"href",
			"/console",
		);
	});

	it("shows Console when authed", () => {
		state.value = { status: "authed" };
		renderFooter();
		expect(screen.getByRole("link", { name: "Console" })).toHaveAttribute(
			"href",
			"/console",
		);
	});
});
