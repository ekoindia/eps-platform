import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked at the module boundary, per repo convention — never `fetch`.
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectEsign: { pending: vi.fn() } },
}));
vi.mock("@/lib/connect/interactions", async (orig) => ({
	...(await orig<typeof import("@/lib/connect/interactions")>()),
	resetRoleTransactionCache: vi.fn(),
}));

const { authClient } = await import("@/lib/auth/client");
const { resetRoleTransactionCache } =
	await import("@/lib/connect/interactions");
const { ESIGN_PENDING_TTL_MS, resetEsignPendingCache, useEsignPending } =
	await import("@/lib/connect/esign-pending");
const pending = vi.mocked(authClient.connectEsign.pending);

beforeEach(() => {
	resetEsignPendingCache();
	pending.mockReset().mockResolvedValue({ pendingCount: 1 });
	vi.mocked(resetRoleTransactionCache).mockReset();
});

describe("useEsignPending", () => {
	it("trusts the 223 entitlement without asking", () => {
		const { result } = renderHook(() => useEsignPending({ "223": {} }));
		expect(result.current).toBe(true);
		expect(pending).not.toHaveBeenCalled();
	});

	it("asks only when told to probe", () => {
		renderHook(() => useEsignPending({}));
		expect(pending).not.toHaveBeenCalled();
	});

	it("reports a pending agreement to every reader, and drops the stale list", async () => {
		const reader = renderHook(() => useEsignPending({}));
		renderHook(() => useEsignPending({}, true));

		await waitFor(() => expect(reader.result.current).toBe(true));
		expect(resetRoleTransactionCache).toHaveBeenCalledOnce();
	});

	it("stays false when nothing is pending", async () => {
		pending.mockResolvedValue({ pendingCount: 0 });
		const { result } = renderHook(() => useEsignPending({}, true));

		await waitFor(() => expect(pending).toHaveBeenCalledOnce());
		expect(result.current).toBe(false);
		expect(resetRoleTransactionCache).not.toHaveBeenCalled();
	});

	it("holds an answer for the TTL, then asks again", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			const first = renderHook(() => useEsignPending({}, true));
			await waitFor(() => expect(first.result.current).toBe(true));
			first.unmount();

			// Home → a page → Home inside the window: no second call.
			renderHook(() => useEsignPending({}, true)).unmount();
			expect(pending).toHaveBeenCalledOnce();

			vi.setSystemTime(Date.now() + ESIGN_PENDING_TTL_MS + 1);
			renderHook(() => useEsignPending({}, true));
			await waitFor(() => expect(pending).toHaveBeenCalledTimes(2));
		} finally {
			vi.useRealTimers();
		}
	});

	it("drops an answer that lands after sign-out", async () => {
		let resolve: (v: { pendingCount: number }) => void = () => {};
		pending.mockReturnValue(new Promise((r) => (resolve = r)));
		const { result } = renderHook(() => useEsignPending({}, true));

		act(() => resetEsignPendingCache());
		await act(async () => resolve({ pendingCount: 1 }));

		expect(result.current).toBe(false);
	});
});
