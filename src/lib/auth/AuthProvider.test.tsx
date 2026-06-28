import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";

vi.mock("@/lib/auth/client", () => ({
	authClient: { me: vi.fn(), logout: vi.fn() },
}));
import { authClient } from "@/lib/auth/client";

function Probe() {
	const { state } = useAuth();
	return (
		<div data-testid="s">
			{state.status === "authed" ? `authed:${state.role}` : state.status}
		</div>
	);
}

afterEach(() => vi.clearAllMocks());

describe("AuthProvider", () => {
	it("resolves to authed developer when /me returns a MeView", async () => {
		(authClient.me as ReturnType<typeof vi.fn>).mockResolvedValue({
			state: "active",
			mobile: "999",
			profile: null,
			zohoId: null,
		});
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("s").textContent).toBe("authed:developer"),
		);
	});

	it("resolves to authed admin when /me returns role:admin", async () => {
		(authClient.me as ReturnType<typeof vi.fn>).mockResolvedValue({
			role: "admin",
			login: "octo",
			sub: "gh:octo",
		});
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("s").textContent).toBe("authed:admin"),
		);
	});

	it("resolves to anon when /me rejects", async () => {
		(authClient.me as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("401"),
		);
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("s").textContent).toBe("anon"),
		);
	});
});
