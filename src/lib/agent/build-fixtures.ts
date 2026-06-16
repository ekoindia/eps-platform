/**
 * Pure builder for offline golden fixtures: one request/response pair per
 * endpoint (plus documented error examples). Consumed by the mock server,
 * agent evals, and SDK tests. No I/O, no Date.
 */
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

export interface EndpointFixture {
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

export const buildFixtures = (bundle: AgentBundle): EndpointFixture[] =>
	bundle.apis.map((a) => ({
		slug: a.slug,
		method: a.method,
		path: a.path,
		request: a.sampleRequest,
		successResponse: a.sampleSuccessResponse,
		errors: a.errorScenarios.map((e) => ({
			scenario: e.scenario,
			responseStatusId:
				typeof (e.example as { response_status_id?: number })
					.response_status_id === "number"
					? (e.example as { response_status_id: number }).response_status_id
					: undefined,
			statusCode: e.statusCode,
			example: e.example,
		})),
	}));
