import { useEkostoreUrl } from "@/lib/connect/use-ekostore";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectEkostoreToken = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectEkostoreToken: () => connectEkostoreToken() },
}));

const PAGE = "https://ekostore.app/products/kyc-verification";

beforeEach(() => {
	connectEkostoreToken.mockReset();
	connectEkostoreToken.mockResolvedValue({
		accessToken: "ca_full",
		expiresAt: Date.now() + 3_600_000,
	});
});

describe("useEkostoreUrl", () => {
	it("puts the token on the ekostore URL", async () => {
		const { result } = renderHook(() => useEkostoreUrl(true));

		await waitFor(() => expect(result.current).not.toBeNull());
		const url = new URL(result.current!);
		expect(`${url.origin}${url.pathname}`).toBe(PAGE);
		expect(url.searchParams.get("access_token")).toBe("ca_full");
	});

	it("fetches nothing for a user with no entitlement", async () => {
		const { result } = renderHook(() => useEkostoreUrl(false));

		await waitFor(() => expect(connectEkostoreToken).not.toHaveBeenCalled());
		expect(result.current).toBeNull();
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

		expect(result.current).toBeNull();
	});

	it("stays null when the handoff is refused", async () => {
		// A 403 from the entitlement gate, or any upstream failure: no link beats a
		// link that drops the user on a sign-in form.
		connectEkostoreToken.mockRejectedValue(new Error("EKOSTORE_NOT_ENTITLED"));
		const { result } = renderHook(() => useEkostoreUrl(true));

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

		const { unmount } = renderHook(() => useEkostoreUrl(true));
		unmount();
		settle({ accessToken: "ca_full", expiresAt: Date.now() + 1000 });
		await Promise.resolve();

		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
