/** The palette's action intents — the same four tools a model router would get. */
export type ActionIntent =
	| "find_api"
	| "how_to_build"
	| "estimate_earnings"
	| "get_started";

/** What a rule extracted from a query, before anything is resolved. */
export interface DetectedIntent {
	intent: ActionIntent;
	/** The query with intent phrasing stripped: what the visitor is asking about. */
	subject: string;
	/** Typed values read from the query (amounts, counts, product ids). */
	slots: Record<string, string | number>;
}

/** One clickable target on a card. */
export interface CardLink {
	label: string;
	href: string;
}

/** A resolved action card, ready to render above the palette results. */
export interface ActionCard {
	intent: ActionIntent;
	/** Stable id for telemetry, e.g. `action:find_api:bank-account-verification`. */
	id: string;
	title: string;
	/** Secondary line: endpoint path, recipe summary, earnings estimate. */
	detail?: string;
	/** Short badge, e.g. the HTTP method. */
	badge?: string;
	/** The main action — what Enter does. */
	primary: CardLink;
	/** Further actions on the same target. */
	secondary: CardLink[];
	/** Close runners-up when the match is not clear-cut. */
	alternatives: CardLink[];
}
