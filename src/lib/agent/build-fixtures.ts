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
		/** Envelope `status` of the example; one of the two `eps_scenario` keys. */
		status?: number;
		/** Envelope `response_type_id` of the example — the id recipes branch on. */
		responseTypeId?: number;
		statusCode?: number;
		example: Record<string, unknown>;
	}[];
}

/** Read a numeric envelope field from an example, else undefined. */
const numberField = (
	example: Record<string, unknown>,
	key: string,
): number | undefined =>
	typeof example[key] === "number" ? (example[key] as number) : undefined;

export const buildFixtures = (bundle: AgentBundle): EndpointFixture[] =>
	bundle.apis.map((a) => ({
		slug: a.slug,
		method: a.method,
		path: a.path,
		request: a.sampleRequest,
		successResponse: a.sampleSuccessResponse,
		errors: a.errorScenarios.map((e) => ({
			scenario: e.scenario,
			// Scenario keys are the business `status` and the `response_type_id`
			// (what recipes branch on) — never `response_status_id`, a UI display
			// hint that is `1` for every error example and so cannot tell them apart.
			status: numberField(e.example, "status"),
			responseTypeId: numberField(e.example, "response_type_id"),
			statusCode: e.statusCode,
			example: e.example,
		})),
	}));
