import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
	openPaletteStore,
	type PaletteRow,
	type PaletteSummary,
	type QueryCount,
} from "../analytics/paletteStore";
import { createSessions } from "../auth/session";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";
import { csvLine, mountSearchLogs } from "./searchLogs";

const cfg = loadConfig({
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "h",
	SIMPLIBANK_API_PORT: "1",
	SIMPLIBANK_API_PATH: "/p",
	EKO_DEVELOPER_KEY: "k",
	GITHUB_CLIENT_ID: "g",
	GITHUB_CLIENT_SECRET: "s",
	GITHUB_CALLBACK_URL: "https://x/cb",
	GITHUB_REPO: "o/r",
	COOKIE_SECURE: "false",
});

interface Overview {
	summary: PaletteSummary;
	top: QueryCount[];
	topFailing: QueryCount[];
}
interface Page {
	rows: PaletteRow[];
	nextBefore: number | null;
}
const json = async <T>(res: Response | Promise<Response>): Promise<T> =>
	(await (await res).json()) as T;

async function harness() {
	const sessions = createSessions(cfg, createInMemoryKV());
	const store = openPaletteStore(":memory:");
	const base = {
		scope: "all",
		clickedCategory: null,
		clickedRank: null,
	};
	store.insert({
		...base,
		ts: "2026-09-10T10:00:00.000Z",
		query: "upi",
		resultCount: 4,
		outcome: "click",
		clickedCategory: "endpoint",
		clickedRank: 2,
	});
	store.insert({
		...base,
		ts: "2026-09-11T10:00:00.000Z",
		query: "gst",
		resultCount: 0,
		outcome: "abandon",
	});
	store.insert({
		...base,
		ts: "2026-09-12T10:00:00.000Z",
		query: "=HYPERLINK(1)",
		resultCount: 0,
		outcome: "abandon",
	});

	const app = new Hono<AppEnv>();
	app.onError((err, c) =>
		err instanceof AppError
			? c.json({ error: { code: err.code } }, err.status as 400)
			: c.json({ error: { code: "UNHANDLED" } }, 500),
	);
	mountSearchLogs(app, { sessions, store });

	const admin = await sessions.mintAccess({
		sub: "gh:o",
		role: "admin",
		orgId: 1,
	});
	const dev = await sessions.mintAccess({
		sub: "999",
		role: "developer",
		orgId: 1,
	});
	const get = (path: string, token: string | null = admin) =>
		app.request(path, token ? { headers: { cookie: `eps_at=${token}` } } : {});
	return { get, dev };
}

describe("admin search-log routes", () => {
	it("refuses anonymous and non-admin sessions", async () => {
		const { get, dev } = await harness();

		expect((await get("/admin/search-logs/overview", null)).status).toBe(401);
		expect((await get("/admin/search-logs/overview", dev)).status).toBe(403);
	});

	it("returns summary and both top tables, uncached", async () => {
		const { get } = await harness();

		const res = await get("/admin/search-logs/overview");
		const body = await json<Overview>(res);

		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(body.summary).toEqual({
			total: 3,
			zeroResult: 2,
			click: 1,
			askAi: 0,
			abandon: 2,
		});
		expect(body.top).toHaveLength(3);
		expect(body.topFailing.map((t) => t.query)).toEqual([
			"=hyperlink(1)",
			"gst",
		]);
	});

	it("treats `to` as an inclusive UTC day", async () => {
		const { get } = await harness();

		const body = await json<Overview>(
			get("/admin/search-logs/overview?from=2026-09-11&to=2026-09-11"),
		);

		expect(body.summary.total).toBe(1);
	});

	it("pages rows with a cursor that ends on a short page", async () => {
		const { get } = await harness();

		const first = await json<Page>(get("/admin/search-logs/rows?limit=2"));
		const second = await json<Page>(
			get(`/admin/search-logs/rows?limit=2&before=${first.nextBefore}`),
		);

		expect(first.rows.map((r) => r.query)).toEqual(["=HYPERLINK(1)", "gst"]);
		expect(second.rows.map((r) => r.query)).toEqual(["upi"]);
		expect(second.nextBefore).toBeNull();
	});

	it.each([
		["from=2026-13-01"],
		["to=yesterday"],
		["outcome=maybe"],
		["scope=DROP"],
		["limit=500"],
		["before=-1"],
	])("rejects bad filter %s with 400", async (qs) => {
		const { get } = await harness();

		expect((await get(`/admin/search-logs/rows?${qs}`)).status).toBe(400);
	});

	it("exports JSONL and formula-safe CSV as attachments", async () => {
		const { get } = await harness();

		const jsonl = await get("/admin/search-logs/export");
		const lines = (await jsonl.text())
			.trim()
			.split("\n")
			.map((l) => JSON.parse(l));
		const csv = await get(
			"/admin/search-logs/export?format=csv&outcome=abandon",
		);
		const csvText = await csv.text();

		expect(jsonl.headers.get("content-disposition")).toMatch(
			/attachment; filename="search-logs-.*\.jsonl"/,
		);
		expect(lines.map((r) => r.query)).toEqual(["upi", "gst", "=HYPERLINK(1)"]);
		expect(csvText.split("\n")[0]).toBe(
			"id,ts,query,scope,resultCount,outcome,clickedCategory,clickedRank",
		);
		expect(csvText).toContain(",'=HYPERLINK(1),");
		expect(csvText).not.toContain("upi");
	});
});

describe("csvLine", () => {
	it("quotes commas and quotes", () => {
		expect(
			csvLine({
				id: 1,
				ts: "t",
				query: 'say "hi", ok',
				scope: "all",
				resultCount: 0,
				outcome: "abandon",
				clickedCategory: null,
				clickedRank: null,
			}),
		).toBe('1,t,"say ""hi"", ok",all,0,abandon,,\n');
	});
});
