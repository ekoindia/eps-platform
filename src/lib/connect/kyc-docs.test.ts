import {
	configOf,
	KYC_DOC_CONFIG,
	KYC_MAX_FILE_BYTES,
	KYC_MAX_PAGES,
	withDocConfig,
} from "@/lib/connect/kyc-docs";
import type { KycDocument } from "@/lib/connect/kyc";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The repo root: vitest runs from it, and `import.meta.url` is not a file URL
// under the jsdom environment.
const PUBLIC_DIR = join(process.cwd(), "public");

/** A parsed row as upstream described it, before any local overlay. */
function doc(overrides: Partial<KycDocument> = {}): KycDocument {
	return {
		docType: "999",
		name: "Upstream name",
		info: "Upstream note",
		pages: 1,
		status: 1,
		statusDesc: "",
		error: "",
		...overrides,
	};
}

describe("configOf", () => {
	it("has nothing to say about a document type it does not know", () => {
		// Upstream can add a document tomorrow; an unknown code is not an error.
		expect(configOf("no-such-type")).toEqual({});
	});

	it("cannot have its empty fallback mutated into every other document", () => {
		expect(Object.isFrozen(configOf("no-such-type"))).toBe(true);
	});
});

describe("withDocConfig", () => {
	it("leaves an unconfigured document exactly as upstream described it", () => {
		const row = doc();

		expect(withDocConfig(row)).toEqual(row);
	});

	it("overrides upstream even where upstream sent a real value", () => {
		const merged = withDocConfig(doc(), {
			name: "Local name",
			info: "Local note",
			pages: 2,
		});

		expect(merged).toMatchObject({
			name: "Local name",
			info: "Local note",
			pages: 2,
		});
	});

	it("blanks a note the config deliberately empties", () => {
		// `??`, not `||`: `info: ""` is an instruction, not an omission.
		expect(withDocConfig(doc(), { info: "" }).info).toBe("");
	});

	it("keeps every field the config does not name", () => {
		const row = doc({ statusDesc: "Under review", error: "Torn" });

		expect(withDocConfig(row, { pages: 2 })).toMatchObject({
			docType: "999",
			name: "Upstream name",
			info: "Upstream note",
			status: 1,
			statusDesc: "Under review",
			error: "Torn",
		});
	});
});

describe("KYC_DOC_CONFIG entries", () => {
	const entries = Object.entries(KYC_DOC_CONFIG);

	it.each(entries)(
		"%s stays inside the backend's limits",
		(_docType, config) => {
			// A page count above the backend's ceiling is a 400 for every user on that
			// document, before a byte reaches upstream.
			if (config.pages !== undefined) {
				expect(Number.isInteger(config.pages)).toBe(true);
				expect(config.pages).toBeGreaterThanOrEqual(1);
				expect(config.pages).toBeLessThanOrEqual(KYC_MAX_PAGES);
			}
			// Raising the local limit past the server's does not accept a larger file;
			// it spends the upload before the same rejection.
			if (config.maxBytes !== undefined) {
				expect(config.maxBytes).toBeGreaterThan(0);
				expect(config.maxBytes).toBeLessThanOrEqual(KYC_MAX_FILE_BYTES);
			}
		},
	);

	it.each(entries)("%s offers a sample that exists", (_docType, config) => {
		// A renamed or forgotten file is a 404 the partner meets mid-upload, with
		// no way to produce the document they are being asked for. Cheaper to fail
		// here than to hear about it from support.
		if (config.sampleUrl === undefined) return;
		expect(config.sampleUrl).toMatch(/^\/kyc-samples\/[\w.-]+$/);
		expect(existsSync(join(PUBLIC_DIR, config.sampleUrl))).toBe(true);
	});

	it.each(entries)(
		"%s labels no more pages than it has",
		(_docType, config) => {
			// Labels beyond the page count are never rendered — a silent typo.
			const pages = config.pages ?? KYC_MAX_PAGES;
			expect(config.pageLabels?.length ?? 0).toBeLessThanOrEqual(pages);
		},
	);
});
