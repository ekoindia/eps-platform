import { formatLocation, joinWatermark } from "@/hooks/use-watermark";
import { describe, expect, it } from "vitest";

const FIX = {
	latitude: 28.6139,
	longitude: 77.209,
	accuracy: 12.4,
	error: null,
};

describe("formatLocation", () => {
	it("pairs the fix with the IP", () => {
		// Coordinates are fixed to 5 decimals — ~1 m, past what any GPS knows.
		expect(formatLocation(FIX, "203.0.113.7")).toBe(
			"28.61390, 77.20900 (12m) – 203.0.113.7",
		);
	});

	it("keeps whichever half it has", () => {
		// Location denied: the IP still says roughly where the capture came from.
		expect(
			formatLocation(
				{ latitude: null, longitude: null, accuracy: null, error: "denied" },
				"203.0.113.7",
			),
		).toBe("203.0.113.7");
		// Backend unreachable: the fix alone is better than nothing.
		expect(formatLocation(FIX, "")).toBe("28.61390, 77.20900 (12m)");
	});

	it("is empty when neither is known", () => {
		expect(
			formatLocation(
				{ latitude: null, longitude: null, accuracy: null, error: null },
				"",
			),
		).toBe("");
	});
});

describe("joinWatermark", () => {
	it("drops empty fields rather than stamping blank lines", () => {
		expect(
			joinWatermark({
				name: "Asha (R123)",
				org: "Eko (1)",
				location: "",
				timestamp: "27/7/2026 @ eko.in",
			}),
		).toBe("Asha (R123)\nEko (1)\n27/7/2026 @ eko.in");
	});
});
