import {
	clampBoxToBounds,
	getFullFaceBound,
} from "@/lib/connect/face-detector";
import { describe, expect, it } from "vitest";

describe("getFullFaceBound", () => {
	it("grows a detection to the whole head and squares it", () => {
		const head = getFullFaceBound({
			originX: 100,
			originY: 100,
			width: 60,
			height: 80,
		});

		// 80 + 55% above + 10% below = 132, and the width is squared up to match.
		expect(head.height).toBeCloseTo(132);
		expect(head.width).toBeCloseTo(132);
		expect(head.y).toBeCloseTo(56);
	});

	it("never starts off the top-left of the image", () => {
		const head = getFullFaceBound({
			originX: 5,
			originY: 5,
			width: 40,
			height: 40,
		});

		expect(head.x).toBe(0);
		expect(head.y).toBe(0);
	});
});

describe("clampBoxToBounds", () => {
	const bounds = { width: 400, height: 300 };

	it("leaves a box that already fits", () => {
		const box = { x: 50, y: 50, width: 100, height: 100 };
		expect(clampBoxToBounds(box, bounds)).toEqual(box);
	});

	it("pulls an overhanging box back inside", () => {
		// The head box ran off the bottom — what the crop overlay was drawing
		// outside the picture.
		const fitted = clampBoxToBounds(
			{ x: 380, y: 250, width: 100, height: 100 },
			bounds,
		);

		expect(fitted).toEqual({ x: 300, y: 200, width: 100, height: 100 });
		expect(fitted.x + fitted.width).toBeLessThanOrEqual(bounds.width);
		expect(fitted.y + fitted.height).toBeLessThanOrEqual(bounds.height);
	});

	it("shrinks a too-large box without distorting it", () => {
		const fitted = clampBoxToBounds(
			{ x: 0, y: 0, width: 600, height: 600 },
			bounds,
		);

		// Square in, square out: circularCrop would otherwise draw an ellipse.
		expect(fitted.width).toBe(300);
		expect(fitted.height).toBe(300);
	});
});
