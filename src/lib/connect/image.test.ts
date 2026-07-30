import { getFinalImageDimensions } from "@/lib/connect/image";
import { describe, expect, it } from "vitest";

describe("getFinalImageDimensions", () => {
	it("leaves an image alone when it already fits", () => {
		expect(
			getFinalImageDimensions({ width: 800, height: 600, maxLength: 1024 }),
		).toEqual({ finalWidth: 800, finalHeight: 600 });
	});

	it("clamps the longer side and keeps the aspect ratio", () => {
		expect(
			getFinalImageDimensions({ width: 4000, height: 2000, maxLength: 1000 }),
		).toEqual({ finalWidth: 1000, finalHeight: 500 });

		// Portrait: it is the height that gets clamped, not the width.
		expect(
			getFinalImageDimensions({ width: 2000, height: 4000, maxLength: 1000 }),
		).toEqual({ finalWidth: 500, finalHeight: 1000 });
	});

	it("does nothing without a cap", () => {
		expect(getFinalImageDimensions({ width: 4000, height: 2000 })).toEqual({
			finalWidth: 4000,
			finalHeight: 2000,
		});
	});
});
