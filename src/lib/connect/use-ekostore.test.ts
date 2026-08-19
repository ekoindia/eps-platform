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
const GATEWAY =
	EKOSTORE_URL.replace(/\/+$/, "") + "/gateway/products/kyc-verification";

beforeEach(() => {
	connectEkostoreToken.mockReset();
	connectEkostoreToken.mockResolvedValue({
		accessToken: "ca_full",
		expiresAt: Date.now() + 3_600_000,
	});
});

describe("useEkostoreUrl", () => {
	it("frames the gateway page with the token on it", async () => {
		const { result } = renderHook(() => useEkostoreUrl(true));

		await waitFor(() => expect(result.current.url).not.toBeNull());
		const url = new URL(result.current.url!);
		// The gateway rendering, not the branded page: it is the one ekostore
		// serves without its own header, footer and rail so it can be embedded.
		expect(`${url.origin}${url.pathname}`).toBe(GATEWAY);
		expect(url.searchParams.get("access_token")).toBe("ca_full");
		expect(result.current.failed).toBe(false);
	});

	it("fetches nothing for a user with no entitlement", async () => {
		const { result } = renderHook(() => useEkostoreUrl(false));

		await waitFor(() => expect(connectEkostoreToken).not.toHaveBeenCalled());
		expect(result.current.url).toBeNull();
	});

	it("drops the link when the entitlement goes away", async () => {
		// The URL carries a credential, so losing the entitlement has to take the
		// link with it — not leave the last one it resolved on screen.
		const { result, rerender } = renderHook(
			({ enabled }) => useEkostoreUrl(enabled),
			{ initialProps: { enabled: true } },
		);
		await waitFor(() => expect(result.current).not.toBeNull());

		rerender({ enabled: false });

		expect(result.current.url).toBeNull();
	});

	it("stays null when the handoff is refused", async () => {
		// A 403 from the entitlement gate, or any upstream failure: no link beats a
		// link that drops the user on a sign-in form.
		connectEkostoreToken.mockRejectedValue(new Error("EKOSTORE_NOT_ENTITLED"));
		const { result } = renderHook(() => useEkostoreUrl(true));

		await waitFor(() => expect(result.current.failed).toBe(true));
		// `failed`, not just a null URL: the page has to tell a refused handoff
		// from one still in flight, or an entitled user spins forever.
		expect(result.current.url).toBeNull();
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

		const { unmount } = renderHook(() => useEkostoreUrl(true));
		unmount();
		settle({ accessToken: "ca_full", expiresAt: Date.now() + 1000 });
		await Promise.resolve();

		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
