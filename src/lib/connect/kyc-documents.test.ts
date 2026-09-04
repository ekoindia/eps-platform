import {
	resetKycDocumentCache,
	useKycDocuments,
} from "@/lib/connect/kyc-documents";
import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocked at the module boundary, per repo convention — never `fetch`.
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: {
		connectKyc: { documents: vi.fn(), upload: vi.fn() },
	},
}));

const { authClient } = await import("@/lib/auth/client");
const fetchDocuments = vi.mocked(authClient.connectKyc.documents);

const PACK = { documents: [...KYC_DOCUMENTS_SAMPLE.data.document_list] };

beforeEach(() => {
	resetKycDocumentCache();
	fetchDocuments.mockReset().mockResolvedValue(PACK);
	vi.useRealTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useKycDocuments", () => {
	it("fires nothing while disabled", () => {
		const { result } = renderHook(() => useKycDocuments(false));

		expect(fetchDocuments).not.toHaveBeenCalled();
		expect(result.current).toBeNull();
	});

	it("resolves the parsed pack once enabled", async () => {
		const { result } = renderHook(() => useKycDocuments(true));

		await waitFor(() => expect(result.current).not.toBeNull());
		expect(result.current).toHaveLength(PACK.documents.length);
		// Parsed, not raw: `doc_type` has become `docType`.
		expect(result.current?.[0].docType).toBeTruthy();
	});

	// The whole point of the cache: Home → a page → Home must not re-ask upstream.
	it("shares one request between mounts inside the TTL", async () => {
		const first = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(first.result.current).not.toBeNull());
		first.unmount();

		const second = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(second.result.current).not.toBeNull());

		expect(fetchDocuments).toHaveBeenCalledTimes(1);
	});

	it("asks again once the TTL has passed", async () => {
		const first = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(first.result.current).not.toBeNull());
		first.unmount();

		// A minute and a bit later, by the clock the cache reads.
		vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
		const second = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(second.result.current).not.toBeNull());
		expect(fetchDocuments).toHaveBeenCalledTimes(2);
	});

	it("does not cache a failure", async () => {
		fetchDocuments.mockRejectedValueOnce(new Error("502"));
		const first = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(fetchDocuments).toHaveBeenCalledTimes(1));
		expect(first.result.current).toBeNull();
		first.unmount();

		const second = renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(second.result.current).not.toBeNull());
		expect(fetchDocuments).toHaveBeenCalledTimes(2);
	});

	// The hazard the generation counter exists for: one partner's pack must not
	// land in the cache after their session ended.
	it("drops a request that was in flight when the session was reset", async () => {
		let release: (value: { documents: unknown[] }) => void = () => {};
		fetchDocuments.mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		const { result } = renderHook(() => useKycDocuments(true));
		resetKycDocumentCache();
		release(PACK);
		await waitFor(() => expect(result.current).toBeNull());

		// And the cache is empty, so the next caller really asks again.
		renderHook(() => useKycDocuments(true));
		await waitFor(() => expect(fetchDocuments).toHaveBeenCalledTimes(2));
	});

	it("clears the pack when it is disabled again", async () => {
		const { result, rerender } = renderHook(
			({ enabled }) => useKycDocuments(enabled),
			{ initialProps: { enabled: true } },
		);
		await waitFor(() => expect(result.current).not.toBeNull());

		rerender({ enabled: false });
		expect(result.current).toBeNull();
	});
});
