import { isSampled, reportPaletteSearch } from "@/lib/palette-telemetry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null)));

beforeEach(() => {
	window.dataLayer = [];
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	delete window.dataLayer;
	vi.unstubAllGlobals();
	fetchMock.mockClear();
});

const report = {
	query: "verify pan abcde1234f",
	scope: "all",
	resultCount: 3,
	outcome: "click" as const,
	clickedCategory: "endpoint",
	clickedRank: 1,
};

describe("reportPaletteSearch", () => {
	// A typed name survives redaction, so Google must only ever see the shape.
	it("pushes counts to GTM and never the query text", () => {
		reportPaletteSearch(report, false);

		expect(window.dataLayer).toEqual([
			{
				event: "palette_search",
				scope: "all",
				resultCount: 3,
				outcome: "click",
				clickedCategory: "endpoint",
				clickedRank: 1,
				queryLength: 21,
			},
		]);
		expect(JSON.stringify(window.dataLayer)).not.toContain("verify");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sends redacted text, cookie-free, only when sampled", () => {
		reportPaletteSearch(report, true);

		expect(fetchMock).toHaveBeenCalledOnce();
		const [, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(init.credentials).toBe("omit");
		expect(JSON.parse(init.body as string)).toMatchObject({
			query: "verify pan …",
			outcome: "click",
		});
	});

	it("ignores an empty query", () => {
		reportPaletteSearch({ ...report, query: "  " }, true);

		expect(window.dataLayer).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("isSampled", () => {
	it("never samples at rate 0, always below the rate", () => {
		expect(isSampled(0, () => 0)).toBe(false);
		expect(isSampled(0.1, () => 0.05)).toBe(true);
		expect(isSampled(0.1, () => 0.5)).toBe(false);
	});
});
