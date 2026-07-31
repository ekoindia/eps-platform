import {
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";

// Only `authClient` is stubbed — the rest of the module stays real so constants
// like LIFECYCLES (which classify() validates against) can't drift from a
// hand-written copy.
vi.mock("@/lib/auth/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/client")>()),
	authClient: { me: vi.fn(), logout: vi.fn() },
}));
vi.mock("@/lib/zoho-chat", () => ({ setChatIdentity: vi.fn() }));
import { authClient } from "@/lib/auth/client";
import { setChatIdentity } from "@/lib/zoho-chat";

function Probe() {
	const { state, logout } = useAuth();
	return (
		<div>
			<div data-testid="s">
				{state.status === "authed" ? `authed:${state.role}` : state.status}
			</div>
			<button type="button" onClick={() => void logout()}>
				log out
			</button>
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

	// Fail closed. A /me that parses but carries no recognizable session — `{}`
	// from a proxy, an error envelope, a role this build doesn't know — used to
	// fall through to "authed developer" and crash the console downstream on
	// fields that were all undefined.
	it.each([
		["an empty object", {}],
		["an error envelope", { error: { code: "PARSE_ERROR", message: "x" } }],
		["an unknown lifecycle", { state: "retired", mobile: "999" }],
		["an unknown role", { role: "auditor" }],
	])("stays anon when /me returns %s", async (_label, payload) => {
		(authClient.me as ReturnType<typeof vi.fn>).mockResolvedValue(payload);
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("s").textContent).toBe("anon"),
		);
	});

	it("hands the logged-in identity to the support chat", async () => {
		(authClient.me as ReturnType<typeof vi.fn>).mockResolvedValue({
			state: "active",
			mobile: "9990000079",
			profile: {
				name: "Rahul Sharma",
				email: "rahul@example.in",
				mobile: "9990000079",
			},
			zohoId: null,
		});
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(setChatIdentity).toHaveBeenCalledWith({
				name: "Rahul Sharma",
				email: "rahul@example.in",
				contactNumber: "9990000079",
			}),
		);
	});

	it("clears the chat identity on logout", async () => {
		(authClient.me as ReturnType<typeof vi.fn>).mockResolvedValue({
			state: "active",
			mobile: "9990000079",
			profile: { name: "Rahul Sharma", mobile: "9990000079" },
			zohoId: null,
		});
		(authClient.logout as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
		});
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("s").textContent).toBe("authed:developer"),
		);

		fireEvent.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => expect(setChatIdentity).toHaveBeenLastCalledWith(null));
	});

	it("classifies a signup session", async () => {
		vi.mocked(authClient.me).mockResolvedValue({
			role: "signup",
			mobile: "9990000001",
		});
		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
		await waitFor(() => expect(result.current.state.status).toBe("authed"));
		expect(result.current.state).toEqual({
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		});
	});
});
