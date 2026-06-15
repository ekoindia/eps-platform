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

const allOperations = (): Array<{
	spec: undefined;
	op: OpenAPIV3_1.OperationObject;
}> => {
	const ops: Array<{ spec: undefined; op: OpenAPIV3_1.OperationObject }> = [];
	for (const path of Object.values(doc.paths ?? {})) {
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

	it("records body-discriminated variants under x-eko-variants", () => {
		const grouped = new Map<string, number>();
		for (const s of specs)
			grouped.set(
				`${s.method} ${s.path}`,
				(grouped.get(`${s.method} ${s.path}`) ?? 0) + 1,
			);
		const collided = [...grouped.entries()].filter(([, n]) => n > 1);
		expect(collided.length).toBeGreaterThan(0); // fixture guard
		for (const { op } of allOperations()) {
			const variants = (op as Record<string, unknown>)["x-eko-variants"] as
				| unknown[]
				| undefined;
			if (variants) expect(variants.length).toBeGreaterThan(1);
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

	it("financial specs additionally require request_hash", () => {
		const financial = specs.find((s) => s.financial);
		if (!financial) return; // no financial spec in the documented set
		const path = doc.paths?.[financial.path] as Record<
			string,
			OpenAPIV3_1.OperationObject
		>;
		const op = path[financial.method.toLowerCase()];
		const headers = (op.parameters ?? [])
			.filter(
				(p): p is OpenAPIV3_1.ParameterObject => "in" in p && p.in === "header",
			)
			.map((p) => p.name);
		expect(headers).toContain("request_hash");
	});

	it("operationIdFor camel-cases kebab ids", () => {
		expect(operationIdFor({ id: "pan-lite" } as ApiSpec)).toBe("panLite");
		expect(operationIdFor({ id: "dmt-get-sender" } as ApiSpec)).toBe(
			"dmtGetSender",
		);
	});
});
