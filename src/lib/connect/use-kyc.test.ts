import type { AuthState } from "@/lib/auth/AuthProvider";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The whole gate, and the only place it is tested for real: the rail, the
// documents page and the Home CTA all mock this hook away.
let authValue: { state: AuthState } | null = null;
vi.mock("@/lib/auth/AuthProvider", () => ({
	useOptionalAuth: () => authValue,
}));

// The flag this hook used to consult. Mocked OFF on purpose: it gates the Eko
// Connect iframe (Load E-value, Manage My Account), not this app's own document
// page, and a pending partner must still be offered the upload with it unset.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_CONNECT_WIDGET: false,
}));

const me = (state: Lifecycle): MeView => ({
	state,
	mobile: "9999999999",
	profile: null,
	zohoId: null,
});

const developer = (state: Lifecycle): AuthState => ({
	status: "authed",
	role: "developer",
	me: me(state),
});

beforeEach(() => {
	authValue = null;
});

describe("useKycEnabled", () => {
	it("offers the flow to the two states that owe a document pack", () => {
		for (const state of ["kyc-pending", "kyc-rejected"] as const) {
			authValue = { state: developer(state) };
			expect(renderHook(() => useKycEnabled()).result.current).toBe(true);
		}
	});

	it("withholds it from every other developer lifecycle", () => {
		for (const state of [
			"lead",
			"onboarded",
			"active",
			"inactive",
			"unknown",
		] as const) {
			authValue = { state: developer(state) };
			expect(renderHook(() => useKycEnabled()).result.current).toBe(false);
		}
	});

	// Null, not false: `Documents` renders "isn't available on this account" on
	// false, and every user would see it flash for the length of the /me call.
	it("answers null while the session is still loading", () => {
		authValue = { state: { status: "loading" } };
		expect(renderHook(() => useKycEnabled()).result.current).toBeNull();
	});

	it("withholds it from sessions with no lifecycle at all", () => {
		const states: AuthState[] = [
			{ status: "anon" },
			{
				status: "authed",
				role: "admin",
				me: { role: "admin", login: null, sub: "gh" },
			},
			{ status: "authed", role: "signup", me: { role: "signup", mobile: "9" } },
		];
		for (const state of states) {
			authValue = { state };
			expect(renderHook(() => useKycEnabled()).result.current).toBe(false);
		}
	});

	// The hook is called from trees with no provider — tests, and anything
	// rendered outside `AuthProvider`.
	it("withholds it when there is no provider", () => {
		authValue = null;
		expect(renderHook(() => useKycEnabled()).result.current).toBe(false);
	});

	// The reason this reads context directly instead of fetching: the
	// signup→developer upgrade changes the session WITHOUT a remount, and the
	// previous implementation needed an effect keyed on the role to notice.
	it("follows a lifecycle change without remounting", () => {
		authValue = { state: developer("active") };
		const { result, rerender } = renderHook(() => useKycEnabled());
		expect(result.current).toBe(false);

		authValue = { state: developer("kyc-pending") };
		rerender();
		expect(result.current).toBe(true);
	});
});
