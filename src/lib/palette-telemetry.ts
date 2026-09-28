import { pushDataLayer, redactIdentifiers } from "@/lib/analytics";
import type { AuthState } from "@/lib/auth/AuthProvider";

/** How a ⌘K session with a query ended. */
export type PaletteOutcome = "click" | "ask_ai" | "abandon";

/** How the palette was opened. */
export type PaletteTrigger = "keyboard" | "header_button" | "mobile_button";

/** Who was searching, coarsely. `unknown` = `/me` still loading. */
export type PaletteAuth = "anon" | "developer" | "signup" | "admin" | "unknown";

/** Where and by whom the palette was used — fixed for one palette session. */
export interface PaletteContext {
	/** Normalised path, see {@link normalizePagePath}. */
	page: string;
	auth: PaletteAuth;
	/** Developer lifecycle (`active`, `kyc-pending`…); absent for everyone else. */
	stage?: string;
	trigger: PaletteTrigger;
	device: "mobile" | "desktop";
}

/** The last query of one palette session and what the visitor did with it. */
export interface PaletteSearchReport extends PaletteContext {
	query: string;
	scope: string;
	resultCount: number;
	outcome: PaletteOutcome;
	/** Search category of the clicked result; only on `click`. */
	clickedCategory?: string;
	/** 1-based position of the clicked result; only on `click`. */
	clickedRank?: number;
	/** Search item id (`endpoint:bank-account-verification`); only on `click`. */
	clickedId?: string;
	/** The result's title as the visitor saw it; only on `click`. */
	clickedLabel?: string;
	/** Settled queries before the last one — how much the visitor had to rephrase. */
	refinements: number;
	/** Milliseconds from palette open to the outcome. */
	durationMs: number;
	/** Whether long-form page text was indexed yet; false = label/keyword index only. */
	bodyIndexLoaded: boolean;
}

/** Longest query text sent to the backend; the backend enforces the same cap. */
export const MAX_SAMPLED_QUERY_CHARS = 200;

const TELEMETRY_URL = `${import.meta.env.VITE_EPS_BACKEND_URL ?? "/api"}/telemetry/palette`;

/** Viewport width below which the palette renders its mobile layout (Tailwind `md`). */
const MOBILE_MAX_WIDTH = 767;

/**
 * Decides, once per palette open, whether this session's query text is sampled.
 * @param rate - Share of sessions to sample, 0–1.
 * @param random - Source of randomness; injectable for tests.
 * @returns True when the session's query should reach the backend.
 */
export function isSampled(
	rate: number,
	random: () => number = Math.random,
): boolean {
	return rate > 0 && random() < rate;
}

/**
 * Reduces a pathname to its page, never to a record. Query string and hash are
 * never passed in (callers use `location.pathname`), a segment carrying four or
 * more digits or a UUID becomes `:id` (`/console/transaction/:id`), and anything
 * identifier-like left over is redacted.
 * @param pathname - `location.pathname`.
 * @returns The normalised path.
 */
export function normalizePagePath(pathname: string): string {
	const path = pathname
		.split("/")
		.map((segment) =>
			/\d{4}/.test(segment) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)
				? ":id"
				: segment,
		)
		.join("/");
	return redactIdentifiers(path).slice(0, 200) || "/";
}

/**
 * Maps the auth state to the coarse who-was-searching fields. Only the
 * lifecycle ever leaves — no mobile, name, org or profile field.
 * @param state - `useAuth().state`.
 */
export function authContext(
	state: AuthState,
): Pick<PaletteContext, "auth" | "stage"> {
	if (state.status === "loading") return { auth: "unknown" };
	if (state.status === "anon") return { auth: "anon" };
	if (state.role === "developer")
		return { auth: "developer", stage: state.me.state };
	return { auth: state.role };
}

/** Mobile vs desktop by viewport, matching the palette's own breakpoint. */
export function deviceClass(
	width: number = window.innerWidth,
): "mobile" | "desktop" {
	return width <= MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

/**
 * Records how a palette session ended.
 *
 * GTM gets the shape of the search plus `auth`, `trigger` and `device` — never
 * text, page, stage or the clicked label: GA4 joins events to its own client
 * ids, and with a small user base stage + page there would identify a partner.
 * When the session is `sampled`, the full report (query redacted) goes to our
 * own backend, which stores it with the timestamp rounded to the hour. Best-
 * effort on every path: telemetry never throws into the palette.
 * @param report - The session's last query, its outcome and context.
 * @param sampled - Whether this session was picked by {@link isSampled}.
 */
export function reportPaletteSearch(
	report: PaletteSearchReport,
	sampled: boolean,
): void {
	const query = report.query.trim();
	if (!query) return;

	// The click keys stay present even when undefined: GTM's data model keeps
	// values across pushes, and only an explicit undefined stops an abandoned
	// search from inheriting the previous click's category and rank.
	const counts = {
		scope: report.scope,
		resultCount: report.resultCount,
		outcome: report.outcome,
		clickedCategory: report.clickedCategory,
		clickedRank: report.clickedRank,
	};
	pushDataLayer("palette_search", {
		...counts,
		queryLength: query.length,
		auth: report.auth,
		trigger: report.trigger,
		device: report.device,
	});

	if (!sampled) return;
	try {
		// text/plain keeps this a simple CORS request (no preflight), keepalive
		// lets it finish if the click navigates away, and no cookie rides along:
		// the log must not be joinable to a session.
		void fetch(TELEMETRY_URL, {
			method: "POST",
			body: JSON.stringify({
				...counts,
				query: redactIdentifiers(query).slice(0, MAX_SAMPLED_QUERY_CHARS),
				page: report.page,
				auth: report.auth,
				stage: report.stage,
				trigger: report.trigger,
				device: report.device,
				clickedId: report.clickedId,
				clickedLabel: report.clickedLabel,
				refinements: report.refinements,
				durationMs: report.durationMs,
				bodyIndexLoaded: report.bodyIndexLoaded,
			}),
			headers: { "content-type": "text/plain" },
			credentials: "omit",
			keepalive: true,
		}).catch(() => {});
	} catch {
		// fetch unavailable — the sample is simply lost
	}
}
