import { EKOSTORE_URL } from "@/lib/config/features";
import { useEkostoreUrl } from "@/lib/connect/use-ekostore";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectEkostoreToken = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectEkostoreToken: () => connectEkostoreToken() },
}));

// Derived from the configured origin, not hardcoded: `VITE_EKOSTORE_URL` points
// at a different ekostore per environment, and a literal here fails on any
// `.env` that sets it.
const ROOT = new URL(EKOSTORE_URL).origin + new URL(EKOSTORE_URL).pathname;
const KYC_PATH = "/products/kyc-verification";
const MOBILE = "9876543210";

beforeEach(() => {
	connectEkostoreToken.mockReset();
	connectEkostoreToken.mockResolvedValue({
		accessToken: "ca_full",
		expiresAt: Date.now() + 3_600_000,
	});
});

describe("useEkostoreUrl", () => {
	it("hands the token, the mobile and the page over at ekostore's root", async () => {
		const { result } = renderHook(() => useEkostoreUrl(true, MOBILE));

		await waitFor(() => expect(result.current).not.toBeNull());
		const url = new URL(result.current!);
		// The root, with the sandbox page in `next` — ekostore seats the session
		// before forwarding, so linking the page directly would skip the handover.
		expect(`${url.origin}${url.pathname}`).toBe(ROOT);
		expect(url.searchParams.get("next")).toBe(KYC_PATH);
		expect(url.searchParams.get("mobile")).toBe(MOBILE);
		expect(url.searchParams.get("access_token")).toBe("ca_full");
	});

	it("leaves the mobile off when the session has none", async () => {
		// An admin session carries no mobile. The token is what authenticates, so a
		// missing mobile drops the param, not the link.
		const { result } = renderHook(() => useEkostoreUrl(true, ""));

		await waitFor(() => expect(result.current).not.toBeNull());
		const url = new URL(result.current!);
		expect(url.searchParams.has("mobile")).toBe(false);
		expect(url.searchParams.get("access_token")).toBe("ca_full");
	});

	it("fetches nothing for a user with no entitlement", async () => {
		const { result } = renderHook(() => useEkostoreUrl(false, MOBILE));

		await waitFor(() => expect(connectEkostoreToken).not.toHaveBeenCalled());
		expect(result.current).toBeNull();
	});

	it("drops the link when the entitlement goes away", async () => {
		// The URL carries a credential, so losing the entitlement has to take the
		// link with it — not leave the last one it resolved on screen.
		const { result, rerender } = renderHook(
			({ enabled }) => useEkostoreUrl(enabled, MOBILE),
			{ initialProps: { enabled: true } },
		);
		await waitFor(() => expect(result.current).not.toBeNull());

		rerender({ enabled: false });

		expect(result.current).toBeNull();
	});

	it("stays null when the handoff is refused", async () => {
		// A 403 from the entitlement gate, or any upstream failure: no link beats a
		// link that drops the user on a sign-in form.
		connectEkostoreToken.mockRejectedValue(new Error("EKOSTORE_NOT_ENTITLED"));
		const { result } = renderHook(() => useEkostoreUrl(true, MOBILE));

		await waitFor(() => expect(connectEkostoreToken).toHaveBeenCalled());
		expect(result.current).toBeNull();
	});

	it("does not set state after unmount", async () => {
		// Resolution can land after the rail closes; without the `alive` guard React
		// warns and the update is wasted.
		let settle: (view: {
			accessToken: string;
			expiresAt: number;
		}) => void = () => undefined;
		connectEkostoreToken.mockReturnValue(
			new Promise((resolve) => {
				settle = resolve;
			}),
		);
		const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const { unmount } = renderHook(() => useEkostoreUrl(true, MOBILE));
		unmount();
		settle({ accessToken: "ca_full", expiresAt: Date.now() + 1000 });
		await Promise.resolve();

		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
