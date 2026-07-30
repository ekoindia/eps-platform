import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { DATE_PRESETS, istRange, parsePreset } from "./dashboardRange";

/**
 * 2026-07-29 02:30:00 UTC = 2026-07-29 08:00:00 IST.
 *
 * Chosen so the UTC and IST calendar days AGREE, which is the easy case, and
 * paired below with an instant where they disagree — that is where a host-local
 * implementation breaks.
 */
const MORNING = new Date("2026-07-29T02:30:00Z");

/**
 * 2026-07-28 19:00:00 UTC = 2026-07-29 00:30:00 IST.
 *
 * The half hour after IST midnight: UTC still says the 28th, IST says the 29th.
 * A UTC-based "today" would report the whole of the 28th here.
 */
const JUST_AFTER_IST_MIDNIGHT = new Date("2026-07-28T19:00:00Z");

describe("istRange", () => {
	it("runs today from IST midnight to now", () => {
		expect(istRange("today", MORNING)).toEqual({
			datefrom: "2026-07-29 00:00:00",
			dateto: "2026-07-29 08:00:00",
		});
	});

	it("uses the IST day, not the host's, just after IST midnight", () => {
		// The bug this pins: on a UTC host, `new Date().setHours(0,0,0,0)` would
		// answer 2026-07-28 00:00 and the partner would see a full extra day.
		expect(istRange("today", JUST_AFTER_IST_MIDNIGHT)).toEqual({
			datefrom: "2026-07-29 00:00:00",
			dateto: "2026-07-29 00:30:00",
		});
	});

	it("ends every non-today preset at the close of yesterday", () => {
		for (const preset of DATE_PRESETS) {
			if (preset === "today") continue;
			expect(istRange(preset, MORNING).dateto).toBe("2026-07-28 23:59:59");
		}
	});

	it("opens each window N whole days back", () => {
		expect(istRange("yesterday", MORNING).datefrom).toBe("2026-07-28 00:00:00");
		expect(istRange("last7", MORNING).datefrom).toBe("2026-07-22 00:00:00");
		expect(istRange("last30", MORNING).datefrom).toBe("2026-06-29 00:00:00");
		// Trailing 365 days, NOT the calendar year to date — hence the name.
		expect(istRange("last365", MORNING).datefrom).toBe("2025-07-29 00:00:00");
	});

	it("does not mutate the instant it is given", () => {
		const now = new Date(MORNING);
		istRange("last30", now);
		expect(now.getTime()).toBe(MORNING.getTime());
	});
});

describe("parsePreset", () => {
	it("accepts every published preset", () => {
		for (const preset of DATE_PRESETS) expect(parsePreset(preset)).toBe(preset);
	});

	it.each([["lastYear"], [""], [null], [undefined], [{}], [7]])(
		"rejects %o with 400 INVALID_INPUT",
		(raw) => {
			try {
				parsePreset(raw);
				expect.unreachable("should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(AppError);
				expect((e as AppError).status).toBe(400);
				expect((e as AppError).code).toBe("INVALID_INPUT");
			}
		},
	);
});
