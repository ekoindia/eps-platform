export interface Fixture {
	slug: string;
	method: string;
	path: string;
	request: Record<string, unknown>;
	successResponse: Record<string, unknown>;
	errors: {
		scenario: string;
		responseStatusId?: number;
		statusCode?: number;
		example: Record<string, unknown>;
	}[];
}

/** Turn "/a/{id}/b" into a RegExp that matches "/a/123/b". */
const pathToRegExp = (path: string): RegExp =>
	new RegExp(`^${path.replace(/\{[^/]+\}/g, "[^/]+")}/?$`);

export interface MockResult {
	statusCode: number;
	body: Record<string, unknown> & { response_status_id?: number };
}

/**
 * Resolve a mock response. `query.eps_scenario=<response_status_id>` forces a
 * documented error example (recipe-aware testing, e.g. 463 → onboard branch).
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
			(e) => String(e.responseStatusId) === forced,
		);
		if (err) return { statusCode: err.statusCode ?? 200, body: err.example };
	}
	return { statusCode: 200, body: fixture.successResponse };
};
