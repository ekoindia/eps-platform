import { useCallback } from "react";

/**
 * Returns an `onTest(path, method)` callback that opens the Scalar "Try it" modal
 * for a single API operation.
 *
 * The Scalar client (Vue app + CSS) is dynamically imported on first use so it
 * never enters the SSR/prerender bundle — the callback is a no-op on the server.
 */
export const useTryIt = (): ((path: string, method: string) => void) =>
	useCallback((path: string, method: string) => {
		if (typeof window === "undefined") return;
		void import("@/lib/docs/tryit-client").then(({ openTryIt }) =>
			openTryIt(path, method),
		);
	}, []);
