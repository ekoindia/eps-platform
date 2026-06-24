import { describe, expect, it } from "vitest";
import type { OpenAPIV3_1 } from "openapi-types";

import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import {
	buildOpenApiDocument,
	operationIdFor,
} from "@/lib/openapi/build-openapi";
import type { ApiSpec } from "@/lib/data/api-specs-common";

const specs = getDocumentedSpecs();
const doc = buildOpenApiDocument(specs);

const allOperations = (
	source: OpenAPIV3_1.Document = doc,
): Array<{
	spec: undefined;
	op: OpenAPIV3_1.OperationObject;
}> => {
	const ops: Array<{ spec: undefined; op: OpenAPIV3_1.OperationObject }> = [];
	for (const path of Object.values(source.paths ?? {})) {
		for (const method of ["get", "post", "put", "delete"] as const) {
			const op = (path as Record<string, unknown>)[method] as
				| OpenAPIV3_1.OperationObject
				| undefined;
			if (op) ops.push({ spec: undefined, op });
		}
	}
	return ops;
};

describe("buildOpenApiDocument", () => {
	it("emits a valid 3.1 envelope with servers", () => {
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.info.title).toContain("REST API");
		expect(doc.servers?.map((s) => s.url)).toEqual([
			API_ENVIRONMENTS.sandbox.baseUrl,
			API_ENVIRONMENTS.production.baseUrl,
		]);
	});

	it("emits one operation per unique path+method and covers every spec", () => {
		const uniqueKeys = new Set(specs.map((s) => `${s.method} ${s.path}`));
		expect(allOperations().length).toBe(uniqueKeys.size);
		// Every spec's path+method is represented (body-discriminated variants
		// collapse onto the primary operation).
		for (const s of specs) {
			const item = doc.paths?.[s.path] as Record<string, unknown> | undefined;
			expect(item?.[s.method.toLowerCase()]).toBeTruthy();
		}
	});

	it("models common params as query (not a body) on GET operations", () => {
		// A GET with no API-specific body params — its only body-eligible params
		// would be the common ones, which must now resolve to the query string.
		const getSpec = specs.find(
			(s) =>
				s.method === "GET" &&
				!s.extraRequestParams.some((p) => p.in === "body"),
		);
		expect(getSpec).toBeDefined();
		const op = (doc.paths?.[getSpec!.path] as Record<string, unknown>)
			.get as OpenAPIV3_1.OperationObject;
		const queryNames = (op.parameters ?? [])
			.filter(
				(p): p is OpenAPIV3_1.ParameterObject => "in" in p && p.in === "query",
			)
			.map((p) => p.name);
		expect(queryNames).toContain("initiator_id");
		// A GET carries no JSON request body.
		expect(op.requestBody).toBeUndefined();
	});

	it("keeps the generic endpoint as primary over a shared-path -status poller", () => {
		// bbps-transaction-status shares GET /tools/reference/transaction/... with
		// the canonical transaction-inquiry. The grouping must keep the non-status
		// spec as the operation primary and list the status one as a variant.
		const txPath = "/tools/reference/transaction/{transaction-reference}";
		const op = (doc.paths?.[txPath] as Record<string, unknown>).get as Record<
			string,
			unknown
		>;
		expect(op).toBeTruthy();
		expect(op["x-docs-slug"]).toBe("transaction-inquiry");
		const variantSlugs = (
			(op["x-eko-variants"] as { slug: string }[] | undefined) ?? []
		).map((v) => v.slug);
		expect(variantSlugs).toContain("bbps-transaction-status");
		expect(variantSlugs).toContain("transaction-inquiry");
	});

	it("records body-discriminated variants under x-eko-variants", () => {
		// OpenAPI permits one operation per path+method, so specs sharing a
		// path+method collapse onto a primary operation with the rest listed
		// under x-eko-variants. Production specs now use distinct master
		// nomenclature paths (one endpoint per operation), so we construct a
		// deliberate collision here to exercise the grouping branch.
		const base = specs[0];
		const variantPath = "/internal/variant-collision-test";
		const a: ApiSpec = {
			...base,
			id: "variant-a",
			slug: "variant-a",
			path: variantPath,
		};
		const b: ApiSpec = {
			...base,
			id: "variant-b",
			slug: "variant-b",
			name: "Variant B",
			path: variantPath,
		};
		const variantDoc = buildOpenApiDocument([a, b]);
		const op = (variantDoc.paths?.[variantPath] as Record<string, unknown>)[
			base.method.toLowerCase()
		] as Record<string, unknown>;
		const variants = op["x-eko-variants"] as unknown[] | undefined;
		expect(variants).toBeDefined();
		expect(variants).toHaveLength(2);

		// No production operation should carry a malformed single-entry list.
		for (const { op } of allOperations()) {
			const prod = (op as Record<string, unknown>)["x-eko-variants"] as
				| unknown[]
				| undefined;
			if (prod) expect(prod.length).toBeGreaterThan(1);
		}
	});

	it("operationId is tooling-friendly (alphanumeric) and carries x-docs-slug", () => {
		for (const { op } of allOperations()) {
			expect(op.operationId).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
			expect((op as Record<string, unknown>)["x-docs-slug"]).toBeTruthy();
		}
	});

	it("operationIds are unique and the builder rejects collisions", () => {
		const ids = allOperations().map((o) => o.op.operationId);
		expect(new Set(ids).size).toBe(ids.length);

		const dup: ApiSpec = { ...specs[0], id: specs[0].id, slug: "dup-a" };
		const dup2: ApiSpec = { ...specs[0], slug: "dup-b" };
		expect(() => buildOpenApiDocument([dup, dup2])).toThrow(/collision/i);
	});

	it("x-tagGroups reference only declared tags", () => {
		const declared = new Set((doc.tags ?? []).map((t) => t.name));
		const groups = (doc as Record<string, unknown>)["x-tagGroups"] as
			| Array<{ name: string; tags: string[] }>
			| undefined;
		expect(groups?.length).toBeGreaterThan(0);
		for (const group of groups ?? []) {
			for (const tag of group.tags) expect(declared.has(tag)).toBe(true);
		}
	});

	it("models auth headers as required header params (developer_key, secret-key)", () => {
		const { op } = allOperations()[0];
		const headerNames = (op.parameters ?? [])
			.filter(
				(p): p is OpenAPIV3_1.ParameterObject => "in" in p && p.in === "header",
			)
			.map((p) => p.name);
		expect(headerNames).toContain("developer_key");
		expect(headerNames).toContain("secret-key");
		expect(headerNames).toContain("secret-key-timestamp");
	});

	it("operationIdFor camel-cases kebab ids", () => {
		expect(operationIdFor({ id: "pan-lite" } as ApiSpec)).toBe("panLite");
		expect(operationIdFor({ id: "dmt-get-sender" } as ApiSpec)).toBe(
			"dmtGetSender",
		);
	});

	it("the public (non-interactive) doc carries no interactive auth bits", () => {
		// Guards the pristine /openapi.json artifact: the Scalar-only security
		// schemes and per-operation security must never leak into the public doc.
		expect(
			(doc.components as Record<string, unknown> | undefined)?.securitySchemes,
		).toBeUndefined();
		for (const { op } of allOperations())
			expect((op as Record<string, unknown>).security).toBeUndefined();
	});
});

describe("buildOpenApiDocument({ interactive: true })", () => {
	const idoc = buildOpenApiDocument(specs, { interactive: true });
	const headerNames = (op: OpenAPIV3_1.OperationObject): string[] =>
		(op.parameters ?? [])
			.filter(
				(p): p is OpenAPIV3_1.ParameterObject => "in" in p && p.in === "header",
			)
			.map((p) => p.name);

	it("declares developer_key + access_key as apiKey header schemes", () => {
		const schemes = (idoc.components as Record<string, unknown> | undefined)
			?.securitySchemes as Record<string, Record<string, unknown>> | undefined;
		expect(schemes?.developerKey).toMatchObject({
			type: "apiKey",
			in: "header",
			name: "developer_key",
		});
		expect(schemes?.accessKey).toMatchObject({
			type: "apiKey",
			in: "header",
			name: "access_key",
		});
	});

	it("requires both keys on every operation", () => {
		const ops = allOperations(idoc);
		expect(ops.length).toBeGreaterThan(0);
		for (const { op } of ops)
			expect((op as Record<string, unknown>).security).toEqual([
				{ developerKey: [], accessKey: [] },
			]);
	});

	it("drops signing headers from params (schemes + plugin supply them)", () => {
		for (const { op } of allOperations(idoc)) {
			const names = headerNames(op);
			expect(names).not.toContain("developer_key");
			expect(names).not.toContain("secret-key");
			expect(names).not.toContain("secret-key-timestamp");
		}
	});

	it("drops content-type only on operations that carry a JSON body", () => {
		for (const { op } of allOperations(idoc)) {
			const hasBody = Boolean((op as Record<string, unknown>).requestBody);
			if (hasBody) expect(headerNames(op)).not.toContain("content-type");
		}
	});
});
