import { describe, expect, it } from "vitest";
import {
	blurScore,
	DEFAULT_BLUR_THRESHOLD,
	getBlurScore,
	lowestBlurScore,
	setBlurScore,
	toGrayscale,
	withBlurScoreInName,
} from "./blur";

const SIZE = 128;

/** A hard-edged 8px checkerboard — the sharpest thing a scan can be. */
function checkerboard(size = SIZE, block = 8): Float32Array {
	const gray = new Float32Array(size * size);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const on = (Math.floor(x / block) + Math.floor(y / block)) % 2 === 0;
			gray[y * size + x] = on ? 255 : 0;
		}
	}
	return gray;
}

/** One horizontal box-blur pass; several passes approximate a Gaussian. */
function boxBlur(
	gray: Float32Array,
	size: number,
	radius: number,
): Float32Array {
	const horizontal = new Float32Array(gray.length);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			let sum = 0;
			let count = 0;
			for (let dx = -radius; dx <= radius; dx += 1) {
				const sx = x + dx;
				if (sx < 0 || sx >= size) continue;
				sum += gray[y * size + sx];
				count += 1;
			}
			horizontal[y * size + x] = sum / count;
		}
	}
	const blurred = new Float32Array(gray.length);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			let sum = 0;
			let count = 0;
			for (let dy = -radius; dy <= radius; dy += 1) {
				const sy = y + dy;
				if (sy < 0 || sy >= size) continue;
				sum += horizontal[sy * size + x];
				count += 1;
			}
			blurred[y * size + x] = sum / count;
		}
	}
	return blurred;
}

function blurredCheckerboard(passes: number, radius: number): Float32Array {
	let gray = checkerboard();
	for (let pass = 0; pass < passes; pass += 1) {
		gray = boxBlur(gray, SIZE, radius);
	}
	return gray;
}

describe("blurScore", () => {
	it("scores a sharp pattern high", () => {
		const score = blurScore(checkerboard(), SIZE, SIZE);
		expect(score).not.toBeNull();
		expect(score!).toBeGreaterThan(50);
	});

	it("scores a heavily blurred pattern below the default threshold", () => {
		const score = blurScore(blurredCheckerboard(3, 6), SIZE, SIZE);
		expect(score).not.toBeNull();
		expect(score!).toBeLessThan(DEFAULT_BLUR_THRESHOLD);
	});

	it("orders sharp > mild blur > heavy blur", () => {
		const sharp = blurScore(checkerboard(), SIZE, SIZE)!;
		const mild = blurScore(blurredCheckerboard(1, 2), SIZE, SIZE)!;
		const heavy = blurScore(blurredCheckerboard(3, 6), SIZE, SIZE)!;
		expect(sharp).toBeGreaterThan(mild);
		expect(mild).toBeGreaterThan(heavy);
	});

	it("refuses to judge a blank image", () => {
		const blank = new Float32Array(SIZE * SIZE).fill(180);
		expect(blurScore(blank, SIZE, SIZE)).toBeNull();
	});

	it("refuses to judge a tiny image", () => {
		expect(blurScore(new Float32Array(4), 2, 2)).toBeNull();
	});

	it("scores a mostly blank page by its sharp region", () => {
		// Blank except a sharp checkerboard patch covering ~a quarter of the
		// page — enough tiles to judge, and the percentile must let the sharp
		// region carry the verdict rather than averaging it away.
		const gray = new Float32Array(SIZE * SIZE).fill(255);
		const patch = checkerboard(64, 8);
		for (let y = 0; y < 64; y += 1) {
			for (let x = 0; x < 64; x += 1) {
				gray[y * SIZE + x] = patch[y * 64 + x];
			}
		}
		const partial = blurScore(gray, SIZE, SIZE);
		const full = blurScore(checkerboard(), SIZE, SIZE);
		expect(partial).not.toBeNull();
		expect(Math.abs(partial! - full!)).toBeLessThanOrEqual(10);
	});
});

describe("toGrayscale", () => {
	it("applies Rec.601 weights", () => {
		// One red, one green, one blue, one white pixel.
		const rgba = new Uint8ClampedArray([
			255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
		]);
		const gray = toGrayscale(rgba, 2, 2);
		expect(gray[0]).toBeCloseTo(76.245, 1);
		expect(gray[1]).toBeCloseTo(149.685, 1);
		expect(gray[2]).toBeCloseTo(29.07, 1);
		expect(gray[3]).toBeCloseTo(255, 1);
	});
});

describe("lowestBlurScore", () => {
	it("takes the worst page, not the average", () => {
		// The whole point: a pack averaging 50 but hiding an unreadable page is
		// still a pack review will bounce.
		expect(lowestBlurScore([80, 12, 76])).toBe(12);
	});

	it("ignores pages that could not be judged", () => {
		expect(lowestBlurScore([null, 40, undefined, 55])).toBe(40);
	});

	it("cannot judge when nothing could be judged", () => {
		expect(lowestBlurScore([])).toBeNull();
		expect(lowestBlurScore([null, undefined])).toBeNull();
	});
});

describe("withBlurScoreInName", () => {
	it("inserts the score before the extension", () => {
		expect(withBlurScoreInName("aadhaar-front.pdf", 18)).toBe(
			"aadhaar-front_blur_score18.pdf",
		);
	});

	it("keeps only the last dot as the extension", () => {
		expect(withBlurScoreInName("scan.v2.jpg", 61)).toBe(
			"scan.v2_blur_score61.jpg",
		);
	});

	it("appends when there is no extension to sit before", () => {
		expect(withBlurScoreInName("scan", 5)).toBe("scan_blur_score5");
		// A leading dot is a stem, not a suffix — do not split on it.
		expect(withBlurScoreInName(".hidden", 5)).toBe(".hidden_blur_score5");
	});
});

describe("blur score registry", () => {
	it("round-trips a score keyed on file identity", () => {
		const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
		const other = new File(["x"], "a.jpg", { type: "image/jpeg" });
		setBlurScore(file, 42);
		expect(getBlurScore(file)).toBe(42);
		expect(getBlurScore(other)).toBeUndefined();
	});
});
