import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	type NewPaletteRow,
	openPaletteStore,
	type PaletteRow,
	scheduleRetention,
} from "./paletteStore";

type NewRow = NewPaletteRow;

const row = (over: Partial<NewRow>): NewRow => ({
	ts: "2026-09-10T10:00:00.000Z",
	query: "upi",
	scope: "all",
	resultCount: 3,
	outcome: "click",
	clickedCategory: "endpoint",
	clickedRank: 1,
	...over,
});

function seeded() {
	const store = openPaletteStore(":memory:");
	[
		row({ query: "UPI " }),
		row({
			query: "upi",
			outcome: "abandon",
			clickedCategory: null,
			clickedRank: null,
		}),
		row({
			query: "gst verify",
			resultCount: 0,
			outcome: "abandon",
			clickedCategory: null,
			clickedRank: null,
		}),
		row({
			query: "gst verify",
			resultCount: 0,
			outcome: "ask_ai",
			clickedCategory: null,
			clickedRank: null,
		}),
		row({ query: "100%_off", ts: "2026-09-20T10:00:00.000Z", scope: "docs" }),
	].forEach((r) => store.insert(r));
	return store;
}

describe("paletteStore", () => {
	it("summarises outcomes and zero-result sessions", () => {
		expect(seeded().summary({})).toEqual({
			total: 5,
			zeroResult: 2,
			click: 2,
			askAi: 1,
			abandon: 2,
		});
	});

	it("folds case and whitespace in top queries; failing keeps misses only", () => {
		const store = seeded();

		expect(store.topQueries({}, { failing: false, limit: 2 })).toEqual([
			{ query: "gst verify", count: 2 },
			{ query: "upi", count: 2 },
		]);
		expect(store.topQueries({}, { failing: true, limit: 10 })).toEqual([
			{ query: "gst verify", count: 2 },
			{ query: "upi", count: 1 },
		]);
	});

	it("applies date, text, outcome and scope filters the same way everywhere", () => {
		const store = seeded();

		expect(store.summary({ from: "2026-09-15T00:00:00.000Z" }).total).toBe(1);
		expect(store.summary({ to: "2026-09-15T00:00:00.000Z" }).total).toBe(4);
		expect(store.summary({ outcome: "abandon" }).total).toBe(2);
		expect(store.summary({ scope: "docs" }).total).toBe(1);
		// A typed % or _ is literal, not a wildcard.
		expect(store.summary({ q: "%_" }).total).toBe(1);
		expect(store.summary({ q: "_" }).total).toBe(1);
		expect(store.summary({ q: "GST" }).total).toBe(2);
	});

	it("pages newest first by id cursor", () => {
		const store = seeded();

		const first = store.rows({}, { limit: 2 });
		const next = store.rows({}, { beforeId: first[1].id, limit: 2 });

		expect(first.map((r) => r.query)).toEqual(["100%_off", "gst verify"]);
		expect(next.map((r) => r.id)).toEqual([3, 2]);
		expect(first[0]).toMatchObject({ scope: "docs", clickedRank: 1 });
	});

	it("exports every matching row oldest first", () => {
		const ids = [...seeded().exportRows({ outcome: "abandon" })].map(
			(r) => r.id,
		);

		expect(ids).toEqual([2, 3]);
	});

	it("purges rows older than the cutoff", () => {
		const store = seeded();

		expect(store.purgeBefore("2026-09-15T00:00:00.000Z")).toBe(4);
		expect(store.summary({}).total).toBe(1);
	});
});

describe("scheduleRetention", () => {
	it("purges past 365 days immediately", () => {
		const store = seeded();

		const stop = scheduleRetention(store, () =>
			Date.parse("2027-09-15T00:00:00.000Z"),
		);
		stop();

		expect(store.summary({}).total).toBe(1);
	});
});

describe("schema upgrade", () => {
	// Prod may hold a file written before the context columns existed.
	it("adds missing columns in place; old rows read them as null", () => {
		const dir = mkdtempSync(join(tmpdir(), "palette-"));
		const path = join(dir, "old.db");
		const legacy = new DatabaseSync(path);
		legacy.exec(`CREATE TABLE palette_query (
			id INTEGER PRIMARY KEY, ts TEXT NOT NULL, query TEXT NOT NULL,
			scope TEXT NOT NULL, result_count INTEGER NOT NULL, outcome TEXT NOT NULL,
			clicked_category TEXT, clicked_rank INTEGER)`);
		legacy.exec(`INSERT INTO palette_query (ts, query, scope, result_count, outcome)
			VALUES ('2026-09-01T10:00:00.000Z', 'old', 'all', 0, 'abandon')`);
		legacy.close();

		const store = openPaletteStore(path);
		store.insert(
			row({
				query: "new",
				auth: "developer",
				stage: "active",
				bodyIndexLoaded: true,
			}),
		);
		const [newer, older] = store.rows({}, { limit: 10 });
		store.close();
		// Reopening an upgraded file must not try to add the columns again.
		openPaletteStore(path).close();
		rmSync(dir, { recursive: true });

		expect(older).toMatchObject({
			query: "old",
			auth: null,
			bodyIndexLoaded: null,
		});
		expect(newer).toMatchObject({
			query: "new",
			auth: "developer",
			stage: "active",
			bodyIndexLoaded: true,
		});
	});
});
