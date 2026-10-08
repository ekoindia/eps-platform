export interface Fixture {
	slug: string;
	method: string;
	path: string;
	request: Record<string, unknown>;
	successResponse: Record<string, unknown>;
	errors: {
		scenario: string;
		/** Envelope `status` of the example; one of the two `eps_scenario` keys. */
		status?: number;
		/** Envelope `response_type_id` of the example — the id recipes branch on. */
		responseTypeId?: number;
		statusCode?: number;
		example: Record<string, unknown>;
	}[];
}

/** Turn "/a/{id}/b" into a RegExp that matches "/a/123/b". */
const pathToRegExp = (path: string): RegExp =>
	new RegExp(`^${path.replace(/\{[^/]+\}/g, "[^/]+")}/?$`);

export interface MockResult {
	statusCode: number;
	body: Record<string, unknown> & { status?: number };
}

/**
 * Resolve a mock response. `query.eps_scenario=<code>` forces the documented
 * example whose envelope `status` or `response_type_id` equals `code` —
 * recipe-aware testing, e.g. `308` on the DMT sender lookup returns the
 * "sender not enrolled" example the recipe routes to Onboard Sender on.
 */
export const matchResponse = (
	fixtures: Fixture[],
	method: string,
	pathname: string,
	query: Record<string, string>,
): MockResult | null => {
	const fixture = fixtures.find(
		(f) => f.method === method && pathToRegExp(f.path).test(pathname),
	);
	if (!fixture) return null;

	const forced = query.eps_scenario;
	if (forced) {
		const err = fixture.errors.find(
			(e) =>
				String(e.status) === forced || String(e.responseTypeId) === forced,
		);
		if (err) return { statusCode: err.statusCode ?? 200, body: err.example };
	}
	return { statusCode: 200, body: fixture.successResponse };
};
