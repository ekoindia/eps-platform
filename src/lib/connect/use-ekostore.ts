import { authClient } from "@/lib/auth/client";
import { EKOSTORE_URL } from "@/lib/config/features";
import { useEffect, useState } from "react";

/**
 * ekostore's KYC & verification sandbox — handed over as a path in `next` rather
 * than linked directly, so ekostore's root can seat the session before it lands.
 */
const EKOSTORE_KYC_PATH = "/products/kyc-verification";

/**
 * The query params ekostore reads the handover from: the credential, the page to
 * continue to, and the mobile the credential belongs to.
 *
 * A contract with someone else's site, so they live as named constants: if
 * ekostore renames one, this is the one line to change.
 */
const EKOSTORE_TOKEN_PARAM = "access_token";
const EKOSTORE_NEXT_PARAM = "next";
const EKOSTORE_MOBILE_PARAM = "mobile";

/**
 * The ekostore link for this user: ekostore's root, carrying their connect-api
 * access token so they are not asked to sign in again on a site backed by the
 * same connect-api, the mobile that token belongs to, and the sandbox page to
 * continue to in `next`.
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
 * @param mobile - The session mobile the token belongs to, or "" when there is
 *   none (an admin session). Left off the URL when blank rather than sent empty:
 *   the token is what authenticates, so a missing mobile must not drop the link.
 * @returns The URL to link to, or null.
 */
export function useEkostoreUrl(
	enabled: boolean,
	mobile: string,
): string | null {
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
	const url = new URL(EKOSTORE_URL);
	if (mobile) url.searchParams.set(EKOSTORE_MOBILE_PARAM, mobile);
	url.searchParams.set(EKOSTORE_NEXT_PARAM, EKOSTORE_KYC_PATH);
	url.searchParams.set(EKOSTORE_TOKEN_PARAM, token);
	return url.toString();
}
