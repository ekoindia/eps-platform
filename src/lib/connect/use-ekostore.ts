import { authClient } from "@/lib/auth/client";
import { EKOSTORE_URL } from "@/lib/config/features";
import { useEffect, useState } from "react";

/**
 * The interaction that entitles an account to the ekostore KYC sandbox. Lives
 * here rather than in the rail: the rail decides whether to draw the link, the
 * page decides whether to embed anything, and both must agree.
 */
export const EKOSTORE_KYC_ID = 9995;

/**
 * ekostore's gateway rendering of the KYC & verification sandbox — the same UI
 * with ekostore's own branding, header, footer and rail stripped, so it can be
 * framed inside the console.
 *
 * The path and the credential param are a contract with someone else's site, so
 * they live as named constants: if ekostore renames one, this is the one line to
 * change.
 */
const EKOSTORE_GATEWAY_PATH = "/gateway/products/kyc-verification";
const EKOSTORE_TOKEN_PARAM = "access_token";

/** What the console page needs to decide between a frame and a message. */
export interface EkostoreGateway {
	/** The gateway URL to frame, or null while unresolved, refused or disabled. */
	url: string | null;
	/** True once the token fetch has been refused — a URL that will never come. */
	failed: boolean;
}

/**
 * The ekostore gateway URL for this user, carrying their connect-api access
 * token so they are not asked to sign in again on a site backed by the same
 * connect-api.
 *
 * `url` stays null while the token is in flight, when the fetch failed, and
 * whenever `enabled` is false. Fail-closed throughout: a frame without a working
 * credential is worse than no frame, since it lands the user on a sign-in form
 * they were promised they would skip. `failed` separates "refused" from "still
 * loading" so the page can say so instead of spinning forever.
 *
 * `enabled` is not authorization. The backend re-checks entitlement to
 * interaction 9995 and answers 403 otherwise; this flag only avoids fetching a
 * credential for a user who has nowhere to spend it.
 * @param enabled - Whether this user is entitled to the ekostore sandbox.
 * @returns The gateway URL and whether the handoff was refused.
 */
export function useEkostoreUrl(enabled: boolean): EkostoreGateway {
	const [token, setToken] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		void authClient
			.connectEkostoreToken()
			.then(({ accessToken }) => {
				if (alive) setToken(accessToken);
			})
			.catch(() => {
				if (alive) setFailed(true);
			});
		// Drops the token when the entitlement goes away, not just on unmount.
		// Without this a true → false → true flip would render the previous
		// token-bearing URL before the refetch that would have refused it.
		return () => {
			alive = false;
			setToken(null);
			setFailed(false);
		};
	}, [enabled]);

	// Derived rather than stored, so `enabled` and the framed URL cannot disagree
	// even for one render.
	if (!enabled || !token) return { url: null, failed };
	// Concatenated rather than `new URL(path, base)`: that form drops any path on
	// the configured origin, so an ekostore served under a sub-path would lose it.
	const url = new URL(EKOSTORE_URL.replace(/\/+$/, "") + EKOSTORE_GATEWAY_PATH);
	url.searchParams.set(EKOSTORE_TOKEN_PARAM, token);
	return { url: url.toString(), failed: false };
}
