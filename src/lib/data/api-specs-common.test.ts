import { describe, expect, it } from "vitest";
import type { ApiParam, ApiSpec } from "./api-specs-common";
import {
	assertResponseTypeSlugs,
	buildSampleRequest,
	COMMON_REQUEST_PARAMS,
	isMultipart,
	resolveContentType,
	resolveHeaders,
	resolveRequestParams,
	responseTypeFor,
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

	it("places common params in the query for GET (client_ref_id included)", () => {
		const params = resolveRequestParams(spec({ method: "GET" }));
		expect(byName(params, "initiator_id")?.in).toBe("query");
		// client_ref_id rides along on GET too, so every call is traceable.
		expect(byName(params, "client_ref_id")?.in).toBe("query");
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

	it("derives in:path for a hyphenated {token} (e.g. transaction-reference)", () => {
		const ref: ApiParam = {
			name: "transaction-reference",
			type: "string",
			required: true,
		};
		const params = resolveRequestParams(
			spec({
				method: "GET",
				path: "/tools/reference/transaction/{transaction-reference}",
				extraRequestParams: [ref],
			}),
		);
		// Hyphenated token still resolves to path (not query) despite the GET method.
		expect(byName(params, "transaction-reference")?.in).toBe("path");
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

describe("resolveHeaders / content-type derivation", () => {
	const fileParam: ApiParam = {
		name: "pan_card",
		type: "file",
		required: true,
		example: "<binary file>",
	};

	it("defaults content-type to application/json (no spec / no file params)", () => {
		for (const headers of [
			resolveHeaders(),
			resolveHeaders(spec({ method: "POST" })),
		]) {
			expect(byName(headers, "content-type")?.example).toBe("application/json");
		}
	});

	it("derives multipart/form-data when a body param is type:file", () => {
		const s = spec({ method: "PUT", extraRequestParams: [fileParam] });
		expect(isMultipart(s)).toBe(true);
		expect(resolveContentType(s)).toBe("multipart/form-data");
		const contentType = byName(resolveHeaders(s), "content-type");
		expect(contentType?.example).toBe("multipart/form-data");
		// The description must warn that the client sets the boundary.
		expect(contentType?.description).toContain("boundary");
	});

	it("merges per-spec header overrides by name and appends new ones", () => {
		const s = spec({
			method: "POST",
			headers: [
				{
					name: "developer_key",
					in: "header",
					type: "string",
					required: false,
					description: "overridden",
				},
				{
					name: "x-extra",
					in: "header",
					type: "string",
					required: true,
				},
			],
		});
		const headers = resolveHeaders(s);
		expect(byName(headers, "developer_key")?.description).toBe("overridden");
		expect(byName(headers, "x-extra")).toBeDefined();
		// Untouched shared headers survive the merge.
		expect(byName(headers, "secret-key")).toBeDefined();
	});
});

describe("responseTypeFor", () => {
	const documented = spec({
		responseTypes: [
			{ id: 309, meaning: "Sender found", next: "dmt-get-recipients" },
			{ id: 308, meaning: "Sender not found" },
		],
	});

	it("matches a payload's response_type_id to its documented meaning", () => {
		expect(
			responseTypeFor(documented, { response_type_id: 309 })?.meaning,
		).toBe("Sender found");
	});

	it("returns undefined for an id the spec does not document", () => {
		expect(
			responseTypeFor(documented, { response_type_id: 1388 }),
		).toBeUndefined();
	});

	it("returns undefined when the payload carries no response_type_id", () => {
		// Financial responses routinely omit it — must not throw or half-match.
		expect(responseTypeFor(documented, { status: 0 })).toBeUndefined();
	});

	it("ignores a non-numeric response_type_id rather than coercing it", () => {
		expect(
			responseTypeFor(documented, { response_type_id: "309" }),
		).toBeUndefined();
	});

	it("returns undefined for a spec that documents no response types", () => {
		expect(
			responseTypeFor(spec({}), { response_type_id: 309 }),
		).toBeUndefined();
	});
});

describe("assertResponseTypeSlugs", () => {
	const known = new Set(["dmt-get-recipients"]);

	it("passes a spec whose next targets a documented slug", () => {
		expect(() =>
			assertResponseTypeSlugs(
				[
					spec({
						responseTypes: [
							{ id: 1, meaning: "m", next: "dmt-get-recipients" },
						],
					}),
				],
				known,
			),
		).not.toThrow();
	});

	it("passes a spec with no responseTypes at all", () => {
		expect(() => assertResponseTypeSlugs([spec({})], known)).not.toThrow();
	});

	it("throws when next names a slug with no docs page", () => {
		expect(() =>
			assertResponseTypeSlugs(
				[
					spec({
						id: "x",
						responseTypes: [{ id: 1, meaning: "m", next: "not-a-real-page" }],
					}),
				],
				known,
			),
		).toThrow(/not-a-real-page/);
	});

	it("throws when a spec documents the same id twice", () => {
		expect(() =>
			assertResponseTypeSlugs(
				[
					spec({
						id: "x",
						responseTypes: [
							{ id: 7, meaning: "first" },
							{ id: 7, meaning: "second" },
						],
					}),
				],
				known,
			),
		).toThrow(/7 twice/);
	});
});
