import { describe, expect, it } from "vitest";
import type { ApiParam, ApiSpec } from "./api-specs-common";
import {
	buildSampleRequest,
	COMMON_REQUEST_PARAMS,
	resolveRequestParams,
} from "./api-specs-common";

/** Minimal spec covering only the fields the resolvers read. */
const spec = (over: Partial<ApiSpec>): ApiSpec =>
	({
		method: "POST",
		extraRequestParams: [],
		...over,
	}) as ApiSpec;

const names = (params: ApiParam[]): string[] => params.map((p) => p.name);
const byName = (params: ApiParam[], name: string): ApiParam | undefined =>
	params.find((p) => p.name === name);

describe("resolveRequestParams", () => {
	it("places common params in the body for non-GET methods", () => {
		const params = resolveRequestParams(spec({ method: "POST" }));
		expect(byName(params, "initiator_id")?.in).toBe("body");
		expect(byName(params, "user_code")?.in).toBe("body");
		// client_ref_id applies to write methods.
		expect(byName(params, "client_ref_id")?.in).toBe("body");
	});

	it("places common params in the query and drops client_ref_id for GET", () => {
		const params = resolveRequestParams(spec({ method: "GET" }));
		expect(byName(params, "initiator_id")?.in).toBe("query");
		expect(byName(params, "user_code")?.in).toBe("query");
		expect(byName(params, "client_ref_id")).toBeUndefined();
	});

	it("omitCommonParams still drops a matching common param", () => {
		const params = resolveRequestParams(
			spec({ method: "POST", omitCommonParams: ["user_code"] }),
		);
		expect(byName(params, "user_code")).toBeUndefined();
		expect(byName(params, "initiator_id")).toBeDefined();
	});

	it("a same-named extraRequestParam overrides the common param", () => {
		const override: ApiParam = {
			name: "user_code",
			in: "body",
			type: "string",
			required: false,
			description: "API-specific override.",
			example: "OVERRIDDEN",
		};
		const params = resolveRequestParams(
			spec({ method: "POST", extraRequestParams: [override] }),
		);
		// Only one user_code, and it is the override (not the common default).
		expect(names(params).filter((n) => n === "user_code")).toHaveLength(1);
		const resolved = byName(params, "user_code");
		expect(resolved?.required).toBe(false);
		expect(resolved?.example).toBe("OVERRIDDEN");
	});

	it("appends extra params after the common ones", () => {
		const extra: ApiParam = {
			name: "pan_number",
			in: "body",
			type: "string",
			required: true,
			example: "ABCDE1234F",
		};
		const params = resolveRequestParams(
			spec({ method: "POST", extraRequestParams: [extra] }),
		);
		expect(names(params).at(-1)).toBe("pan_number");
	});
});

describe("buildSampleRequest", () => {
	it("returns the spec override verbatim when set", () => {
		const override = { custom: "shape", nested: { a: 1 } };
		expect(buildSampleRequest(spec({ sampleRequest: override }))).toBe(
			override,
		);
	});

	it("generates a body of in:body params from their examples", () => {
		const extra: ApiParam = {
			name: "pan_number",
			in: "body",
			type: "string",
			required: true,
			example: "ABCDE1234F",
		};
		const body = buildSampleRequest(
			spec({ method: "POST", extraRequestParams: [extra] }),
		);
		expect(body).toMatchObject({
			initiator_id: COMMON_REQUEST_PARAMS[0].example,
			user_code: COMMON_REQUEST_PARAMS[1].example,
			pan_number: "ABCDE1234F",
		});
	});

	it("yields an empty body for a GET (common params are query)", () => {
		expect(buildSampleRequest(spec({ method: "GET" }))).toEqual({});
	});

	it("skips a body param that has no example", () => {
		const noExample: ApiParam = {
			name: "maybe",
			in: "body",
			type: "string",
			required: false,
		};
		const body = buildSampleRequest(
			spec({ method: "POST", extraRequestParams: [noExample] }),
		);
		expect(body).not.toHaveProperty("maybe");
	});
});
