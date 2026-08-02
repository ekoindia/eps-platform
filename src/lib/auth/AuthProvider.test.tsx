import {
	act,
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
	setSessionExpiredHandler: vi.fn(),
}));
vi.mock("@/lib/zoho-chat", () => ({ setChatIdentity: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from "sonner";
import {
	authClient,
	setSessionExpiredHandler,
	type MeView,
} from "@/lib/auth/client";
import { setChatIdentity } from "@/lib/zoho-chat";

/**
 * The expiry handler the provider registered on mount.
 * @returns The registered callback.
 */
function registeredHandler(): () => void {
	const registered = vi
		.mocked(setSessionExpiredHandler)
		.mock.calls.map(([handler]) => handler)
		.filter((handler) => typeof handler === "function");
	const latest = registered[registered.length - 1];
	if (!latest) throw new Error("no session-expired handler registered");
	return latest as () => void;
}

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

	describe("session expiry", () => {
		const DEVELOPER: MeView = {
			state: "active",
			mobile: "9990000001",
			profile: null,
			zohoId: null,
		};

		/** Renders the provider with a signed-in developer and waits for it. */
		async function renderAuthed() {
			vi.mocked(authClient.me).mockResolvedValue(DEVELOPER);
			vi.mocked(authClient.logout).mockResolvedValue({ ok: true });
			const view = renderHook(() => useAuth(), { wrapper: AuthProvider });
			await waitFor(() =>
				expect(view.result.current.state.status).toBe("authed"),
			);
			return view;
		}

		it("drops to anon and says why", async () => {
			const { result } = await renderAuthed();

			await act(async () => registeredHandler()());

			expect(result.current.state.status).toBe("anon");
			expect(toast.error).toHaveBeenCalledWith(
				"Your session has expired. Please sign in again.",
			);
			expect(authClient.logout).toHaveBeenCalledTimes(1);
		});

		// A console page fires several requests at once; they all 401 together.
		it("says it once however many requests fail together", async () => {
			await renderAuthed();
			const expire = registeredHandler();

			await act(async () => {
				expire();
				expire();
				expire();
			});

			expect(toast.error).toHaveBeenCalledTimes(1);
			expect(authClient.logout).toHaveBeenCalledTimes(1);
		});

		// The boot /me of a signed-out visitor on /console 401s exactly like an
		// expired session does — they must not be told a session ended.
		it("stays silent for a visitor who was never signed in", async () => {
			vi.mocked(authClient.me).mockRejectedValue(new Error("401"));
			const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
			await waitFor(() => expect(result.current.state.status).toBe("anon"));

			await act(async () => registeredHandler()());

			expect(toast.error).not.toHaveBeenCalled();
			expect(authClient.logout).not.toHaveBeenCalled();
		});

		// Signing back in has to re-arm the guard, or the next genuine expiry —
		// hours later, after another idle stretch — passes in silence.
		it("re-arms after the user signs back in", async () => {
			const { result } = await renderAuthed();
			await act(async () => registeredHandler()());
			expect(toast.error).toHaveBeenCalledTimes(1);

			await act(async () => {
				result.current.adopt(DEVELOPER);
			});
			expect(result.current.state.status).toBe("authed");

			await act(async () => registeredHandler()());

			expect(result.current.state.status).toBe("anon");
			expect(toast.error).toHaveBeenCalledTimes(2);
			expect(authClient.logout).toHaveBeenCalledTimes(2);
		});

		// Best-effort courtesy, not a gate: a hung logout must not leave a console
		// the user can no longer use on screen.
		it("does not wait for the logout call to settle", async () => {
			const { result } = await renderAuthed();
			vi.mocked(authClient.logout).mockReturnValue(new Promise(() => {}));

			await act(async () => registeredHandler()());

			expect(result.current.state.status).toBe("anon");
		});
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

describe("AuthProvider session cache", () => {
	const KEY = "eps.session.me";
	const CACHED: MeView = {
		state: "active",
		mobile: "9990000079",
		profile: null,
		zohoId: null,
	};

	/** Parks a view in the cache the way a previous page load would have. */
	function seed(me: unknown, version = 1) {
		sessionStorage.setItem(KEY, JSON.stringify({ v: version, me }));
	}

	afterEach(() => sessionStorage.clear());

	it("paints the cached session before /me answers", async () => {
		seed(CACHED);
		// A /me that never resolves: anything authed on screen came from the cache.
		vi.mocked(authClient.me).mockReturnValue(new Promise(() => {}));

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		await waitFor(() =>
			expect(result.current.state.status).toBe("authed"),
		);
		expect(result.current.state).toEqual({
			status: "authed",
			role: "developer",
			me: CACHED,
		});
	});

	it("still revalidates against /me, and the fresh view wins", async () => {
		seed(CACHED);
		const fresh: MeView = { ...CACHED, state: "inactive" };
		vi.mocked(authClient.me).mockResolvedValue(fresh);

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		await waitFor(() => {
			expect(result.current.state).toEqual({
				status: "authed",
				role: "developer",
				me: fresh,
			});
		});
		expect(authClient.me).toHaveBeenCalled();
	});

	// The cache is display data only — it must never keep a dead session alive.
	it("drops to anon when the cached session no longer authenticates", async () => {
		seed(CACHED);
		vi.mocked(authClient.me).mockRejectedValue(new Error("401"));

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		await waitFor(() => expect(result.current.state.status).toBe("anon"));
		expect(sessionStorage.getItem(KEY)).toBeNull();
	});

	it("caches the session /me resolved", async () => {
		vi.mocked(authClient.me).mockResolvedValue(CACHED);

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		await waitFor(() => expect(result.current.state.status).toBe("authed"));
		expect(JSON.parse(sessionStorage.getItem(KEY) ?? "null")).toEqual({
			v: 1,
			me: CACHED,
		});
	});

	it("forgets the session on logout", async () => {
		vi.mocked(authClient.me).mockResolvedValue(CACHED);
		vi.mocked(authClient.logout).mockResolvedValue(undefined);

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
		await waitFor(() => expect(result.current.state.status).toBe("authed"));
		await act(async () => {
			await result.current.logout();
		});

		expect(result.current.state.status).toBe("anon");
		expect(sessionStorage.getItem(KEY)).toBeNull();
	});

	it("ignores a cached blob it cannot trust and waits for /me", async () => {
		// A primitive would throw inside classify()'s `"role" in me`.
		seed(5);
		vi.mocked(authClient.me).mockResolvedValue(CACHED);

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		await waitFor(() => expect(result.current.state.status).toBe("authed"));
		expect(result.current.state).toEqual({
			status: "authed",
			role: "developer",
			me: CACHED,
		});
	});

	it("ignores a blob from an older build", async () => {
		seed(CACHED, 0);
		vi.mocked(authClient.me).mockReturnValue(new Promise(() => {}));

		const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

		// Nothing to hydrate from: it stays on the boot state.
		await waitFor(() => expect(result.current.state.status).toBe("loading"));
	});
});
