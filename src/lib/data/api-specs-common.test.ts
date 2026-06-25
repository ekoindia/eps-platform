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
		path: "/some/endpoint",
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
		// client_ref_id applies to write methods.
		expect(byName(params, "client_ref_id")?.in).toBe("body");
	});

	it("places common params in the query and drops client_ref_id for GET", () => {
		const params = resolveRequestParams(spec({ method: "GET" }));
		expect(byName(params, "initiator_id")?.in).toBe("query");
		expect(byName(params, "client_ref_id")).toBeUndefined();
	});

	it("derives in:path for an extra param matching a {token} in the path", () => {
		const userCode: ApiParam = {
			name: "user_code",
			type: "string",
			required: true,
			example: "20810200",
		};
		const params = resolveRequestParams(
			spec({
				method: "PUT",
				path: "/admin/network/agent/{user_code}/service/{service_code}/activate",
				extraRequestParams: [userCode],
			}),
		);
		// No explicit `in`, but the name matches a path token → path.
		expect(byName(params, "user_code")?.in).toBe("path");
	});

	it("derives in by method for a non-path extra param (body on POST, query on GET)", () => {
		const flag: ApiParam = { name: "flag", type: "string", required: true };
		expect(
			byName(
				resolveRequestParams(
					spec({ method: "POST", extraRequestParams: [flag] }),
				),
				"flag",
			)?.in,
		).toBe("body");
		expect(
			byName(
				resolveRequestParams(
					spec({ method: "GET", extraRequestParams: [flag] }),
				),
				"flag",
			)?.in,
		).toBe("query");
	});

	it("an explicit in on an extra param overrides derivation", () => {
		const header: ApiParam = {
			name: "x-trace",
			in: "header",
			type: "string",
			required: false,
		};
		const params = resolveRequestParams(
			spec({ method: "POST", extraRequestParams: [header] }),
		);
		expect(byName(params, "x-trace")?.in).toBe("header");
	});

	it("omitCommonParams still drops a matching common param", () => {
		const params = resolveRequestParams(
			spec({ method: "POST", omitCommonParams: ["client_ref_id"] }),
		);
		expect(byName(params, "client_ref_id")).toBeUndefined();
		expect(byName(params, "initiator_id")).toBeDefined();
	});

	it("a same-named extraRequestParam overrides the common param", () => {
		const override: ApiParam = {
			name: "client_ref_id",
			in: "body",
			type: "string",
			required: false,
			description: "API-specific override.",
			example: "OVERRIDDEN",
		};
		const params = resolveRequestParams(
			spec({ method: "POST", extraRequestParams: [override] }),
		);
		// Only one client_ref_id, and it is the override (not the common default).
		expect(names(params).filter((n) => n === "client_ref_id")).toHaveLength(1);
		const resolved = byName(params, "client_ref_id");
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
			client_ref_id: COMMON_REQUEST_PARAMS[1].example,
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
