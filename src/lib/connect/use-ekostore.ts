import { authClient } from "@/lib/auth/client";
import { useEffect, useState } from "react";

/** ekostore's KYC & verification sandbox, the page the console rail links to. */
const EKOSTORE_KYC_URL = "https://ekostore.app/products/kyc-verification";

/**
 * The query param ekostore reads the handed-over credential from.
 *
 * A contract with someone else's site, so it lives as a named constant: if
 * ekostore renames it, this is the one line to change.
 */
const EKOSTORE_TOKEN_PARAM = "access_token";

/**
 * The ekostore link for this user, with their connect-api access token on it, so
 * they are not asked to sign in again on a site backed by the same connect-api.
 *
 * Returns null — and the rail then renders nothing — while the token is in
 * flight, when the fetch failed, and whenever `enabled` is false. Fail-closed
 * throughout: a link without a working credential is worse than no link, since
 * it lands the user on a sign-in form they were promised they would skip.
 *
 * `enabled` is not authorization. The backend re-checks entitlement to
 * interaction 9995 and answers 403 otherwise; this flag only avoids fetching a
 * credential for a user who has nowhere to spend it.
 * @param enabled - Whether this user is entitled to the ekostore sandbox.
 * @returns The URL to link to, or null.
 */
export function useEkostoreUrl(enabled: boolean): string | null {
	const [token, setToken] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		void authClient
			.connectEkostoreToken()
			.then(({ accessToken }) => {
				if (alive) setToken(accessToken);
			})
			.catch(() => {
				if (alive) setToken(null);
			});
		// Drops the token when the entitlement goes away, not just on unmount.
		// Without this a true → false → true flip would render the previous
		// token-bearing URL before the refetch that would have refused it.
		return () => {
			alive = false;
			setToken(null);
		};
	}, [enabled]);

	// Derived rather than stored, so `enabled` and the rendered URL cannot
	// disagree even for one render.
	if (!enabled || !token) return null;
	const url = new URL(EKOSTORE_KYC_URL);
	url.searchParams.set(EKOSTORE_TOKEN_PARAM, token);
	return url.toString();
}
