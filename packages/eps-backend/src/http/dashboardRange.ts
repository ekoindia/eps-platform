import { AppError } from "./errors";

/**
 * The windows the dashboard offers.
 *
 * A closed enum, not a free date pair: it is the entire untrusted surface of the
 * dashboard route, it bounds how far back an upstream aggregate can be asked to
 * scan, and it validates in one `Set.has`. Every one of these maps to a range
 * the browser never gets to influence.
 *
 * `last365` is Eloka's `yearTillYesterday` renamed. That name is a lie there —
 * the range is a trailing 365 days ending yesterday, not the calendar year to
 * date — and the label follows the maths rather than the other way round.
 */
export const DATE_PRESETS = [
	"today",
	"yesterday",
	"last7",
	"last30",
	"last365",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

const PRESETS = new Set<string>(DATE_PRESETS);

/**
 * How many days back a preset's window opens. Absent for `today`, which is the
 * one range that ends now rather than at the close of yesterday.
 */
const DAYS_BACK: Record<Exclude<DatePreset, "today">, number> = {
	yesterday: 1,
	last7: 7,
	last30: 30,
	last365: 365,
};

const MS_PER_DAY = 86_400_000;

/**
 * India Standard Time, as a fixed offset.
 *
 * Fixed, not a timezone lookup, because India has never observed DST — and this
 * is the whole reason the module exists. The backend runs UTC on Vercel, the
 * data upstream is Eko's and is stamped in IST, and Eloka computes its ranges in
 * the *browser's* local time. Computing "today" in UTC would open a Delhi
 * partner's window 5h30m late and close it 5h30m early, so they would see an
 * empty dashboard every morning and a truncated one every night.
 */
export const IST_OFFSET_MS = 5.5 * 3_600_000;

/**
 * Formats an instant as `yyyy-MM-dd HH:mm:ss` in IST.
 *
 * No timezone suffix, matching the strings Eloka sends and upstream accepts.
 * Reads the shifted instant with the UTC getters so the host's own zone never
 * enters into it.
 * @param ms - Epoch milliseconds.
 * @returns The IST wall-clock time, upstream's format.
 */
function formatIst(ms: number): string {
	const d = new Date(ms + IST_OFFSET_MS);
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
		` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
	);
}

/**
 * Midnight IST at the start of the day `ms` falls in, as epoch milliseconds.
 * @param ms - Epoch milliseconds.
 * @returns Epoch milliseconds of that IST day's 00:00:00.
 */
function startOfIstDay(ms: number): number {
	const shifted = ms + IST_OFFSET_MS;
	return Math.floor(shifted / MS_PER_DAY) * MS_PER_DAY - IST_OFFSET_MS;
}

/**
 * Validates an untrusted preset from the request body.
 * @param raw - Anything the browser sent.
 * @returns The preset, narrowed.
 * @throws {AppError} 400 INVALID_INPUT for anything not in `DATE_PRESETS`.
 */
export function parsePreset(raw: unknown): DatePreset {
	if (typeof raw === "string" && PRESETS.has(raw)) return raw as DatePreset;
	throw new AppError(400, "INVALID_INPUT", "preset is invalid");
}

/**
 * The upstream date window for a preset.
 *
 * Semantics ported from Eloka's `getDateRange`
 * (`page-components/Admin/Dashboard/DashboardDateFilter.jsx`), with two
 * deliberate differences: the arithmetic is IST rather than host-local (see
 * `IST_OFFSET_MS`), and nothing mutates its input — Eloka's `calculateDateBefore`
 * mutates the `Date` it is handed.
 *
 * Every preset except `today` ends at the close of YESTERDAY, so a window never
 * includes a partial day alongside whole ones. `today` alone runs to this
 * instant.
 * @param preset - A validated preset.
 * @param now - The current instant; injectable so the maths is testable.
 * @returns Upstream's `datefrom`/`dateto` pair, IST, `yyyy-MM-dd HH:mm:ss`.
 */
export function istRange(
	preset: DatePreset,
	now: Date = new Date(),
): { datefrom: string; dateto: string } {
	const midnightToday = startOfIstDay(now.getTime());
	if (preset === "today") {
		return {
			datefrom: formatIst(midnightToday),
			dateto: formatIst(now.getTime()),
		};
	}
	return {
		datefrom: formatIst(midnightToday - DAYS_BACK[preset] * MS_PER_DAY),
		// One second before midnight: upstream's format carries no milliseconds,
		// so Eloka's `23:59:59.999` would serialize to the same string anyway.
		dateto: formatIst(midnightToday - 1000),
	};
}
