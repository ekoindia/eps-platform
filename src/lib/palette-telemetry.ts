import { pushDataLayer, redactIdentifiers } from "@/lib/analytics";

/** How a ⌘K session with a query ended. */
export type PaletteOutcome = "click" | "ask_ai" | "abandon";

/** The last query of one palette session and what the visitor did with it. */
export interface PaletteSearchReport {
	query: string;
	scope: string;
	resultCount: number;
	outcome: PaletteOutcome;
	/** Search category of the clicked result; only on `click`. */
	clickedCategory?: string;
	/** 1-based position of the clicked result; only on `click`. */
	clickedRank?: number;
}

/** Longest query text sent to the backend; the backend enforces the same cap. */
export const MAX_SAMPLED_QUERY_CHARS = 200;

const TELEMETRY_URL = `${import.meta.env.VITE_EPS_BACKEND_URL ?? "/api"}/telemetry/palette`;

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
 * Records how a palette session ended.
 *
 * GTM always gets the shape of the search — length, result count, outcome —
 * and never its text: a name or an address typed into the box would survive
 * redaction and land on Google's servers. When the session is `sampled`, the
 * redacted text also goes to our own backend, where it becomes the eval set for
 * the on-device query router. Best-effort on every path: telemetry never
 * throws into the palette.
 * @param report - The session's last query and its outcome.
 * @param sampled - Whether this session was picked by {@link isSampled}.
 */
export function reportPaletteSearch(
	report: PaletteSearchReport,
	sampled: boolean,
): void {
	const query = report.query.trim();
	if (!query) return;

	const counts = {
		scope: report.scope,
		resultCount: report.resultCount,
		outcome: report.outcome,
		clickedCategory: report.clickedCategory,
		clickedRank: report.clickedRank,
	};
	pushDataLayer("palette_search", { ...counts, queryLength: query.length });

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
			}),
			headers: { "content-type": "text/plain" },
			credentials: "omit",
			keepalive: true,
		}).catch(() => {});
	} catch {
		// fetch unavailable — the sample is simply lost
	}
}
