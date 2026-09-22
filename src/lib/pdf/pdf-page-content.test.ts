import { describe, expect, it } from "vitest";
import {
	findNonImageOp,
	isGainEnough,
	isPageImageOnly,
} from "./pdf-page-content";

// Stand-ins for pdf.js's numeric OPS codes — the point of keeping the policy
// in its own module is that it never has to load pdf.js to be tested.
const PAINT_IMAGE = 85;
const TRANSFORM = 12;
const SAVE = 10;
const RESTORE = 11;
const CLIP = 28;
const SHOW_TEXT = 44;
const FILL = 22;

const NON_IMAGE_OPS = new Set([SHOW_TEXT, FILL]);

describe("isPageImageOnly", () => {
	it("accepts a plain scanned page", () => {
		const page = [SAVE, TRANSFORM, PAINT_IMAGE, RESTORE];

		expect(isPageImageOnly(page, NON_IMAGE_OPS)).toBe(true);
	});

	it("accepts clipping and transforms around the image", () => {
		// Real scanner output is not just one paint op. Rejecting these was the
		// bug an allow-list version of this rule would have had.
		const page = [SAVE, TRANSFORM, CLIP, PAINT_IMAGE, RESTORE, RESTORE];

		expect(isPageImageOnly(page, NON_IMAGE_OPS)).toBe(true);
	});

	it("rejects a page that draws text", () => {
		const page = [SAVE, PAINT_IMAGE, SHOW_TEXT, RESTORE];

		expect(isPageImageOnly(page, NON_IMAGE_OPS)).toBe(false);
	});

	it("rejects a page that fills a path", () => {
		const page = [SAVE, TRANSFORM, FILL, RESTORE];

		expect(isPageImageOnly(page, NON_IMAGE_OPS)).toBe(false);
	});

	it("handles the typed array pdf.js actually returns", () => {
		const page = new Uint8Array([SAVE, PAINT_IMAGE, SHOW_TEXT]);

		expect(isPageImageOnly(page, NON_IMAGE_OPS)).toBe(false);
	});

	it("treats an empty page as image-only", () => {
		expect(isPageImageOnly([], NON_IMAGE_OPS)).toBe(true);
	});
});

describe("findNonImageOp", () => {
	it("reports where the offending operator is", () => {
		expect(
			findNonImageOp([SAVE, PAINT_IMAGE, SHOW_TEXT, FILL], NON_IMAGE_OPS),
		).toBe(2);
	});

	it("returns -1 when there is none", () => {
		expect(findNonImageOp([SAVE, PAINT_IMAGE], NON_IMAGE_OPS)).toBe(-1);
	});
});

describe("isGainEnough", () => {
	it("takes any saving by default and refuses none", () => {
		expect(isGainEnough(1000, 999)).toBe(true);
		expect(isGainEnough(1000, 1000)).toBe(false);
		expect(isGainEnough(1000, 1001)).toBe(false);
	});

	it("demands strictly more than the asked-for saving", () => {
		// 25 % off 1000 is 750: landing exactly there is not "more than".
		expect(isGainEnough(1000, 750, 25)).toBe(false);
		expect(isGainEnough(1000, 749, 25)).toBe(true);
		expect(isGainEnough(1000, 900, 25)).toBe(false);
	});

	it("never accepts a larger output, whatever the knob says", () => {
		// A negative or garbage percentage would otherwise flip the comparison.
		expect(isGainEnough(1000, 1100, -50)).toBe(false);
		expect(isGainEnough(1000, 999, Number.NaN)).toBe(true);
		expect(isGainEnough(1000, 1000, Number.NaN)).toBe(false);
		expect(isGainEnough(1000, 1, 500)).toBe(false);
		expect(isGainEnough(1000, 0, 500)).toBe(false);
	});
});
