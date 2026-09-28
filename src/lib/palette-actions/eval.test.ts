import { readFileSync } from "node:fs";
import { buildEngine } from "@/lib/search-engine";
import { describe, expect, it } from "vitest";
import { resolveAction } from "./resolve";
import type { ActionCard, ActionIntent } from "./types";

/**
 * One labelled palette query. `intent: null` = off-topic or plain search: the
 * right answer is no card. `target` is the card id the answer must point at
 * (`action:find_api:bbps-fetch-bill`); omit it to score the intent only.
 */
export interface LabelledQuery {
	query: string;
	intent: ActionIntent | null;
	target?: string;
	/** `test` rows are the held-out split — never used for tuning rules or a model. */
	split?: "dev" | "test";
}

/** Gate metrics — docs/palette-router-roadmap.md, Phase 1c. */
export interface EvalScore {
	total: number;
	/** Rows where the shown intent (or no card) equals the label. */
	intentAccuracy: number;
	/** Of `intent: null` rows, the share that showed no card. */
	offTopicRefusal: number;
	/** Of cards shown, the share with the right intent and (when labelled) target. */
	cardPrecision: number;
	/** Of rows labelled with a target, the share whose card pointed at it. */
	targetAccuracy: number;
}

const share = (hits: number, of: number): number => (of ? hits / of : 1);

/**
 * Scores a router against labelled queries. Router-agnostic: rules today, a
 * model later — both map a query to a card or null.
 * @param rows - Labelled queries.
 * @param route - Query → card or null.
 */
export function scoreRouter(
	rows: LabelledQuery[],
	route: (query: string) => ActionCard | null,
): EvalScore {
	const results = rows.map((row) => ({ row, card: route(row.query) }));
	const rightIntent = results.filter(
		({ row, card }) => (card?.intent ?? null) === row.intent,
	);
	const offTopic = results.filter(({ row }) => row.intent === null);
	const shown = results.filter(({ card }) => card !== null);
	const targeted = results.filter(({ row }) => row.target);
	const correctCard = ({ row, card }: (typeof results)[number]) =>
		card !== null &&
		card.intent === row.intent &&
		(!row.target || card.id === row.target);
	return {
		total: rows.length,
		intentAccuracy: share(rightIntent.length, rows.length),
		offTopicRefusal: share(
			offTopic.filter(({ card }) => card === null).length,
			offTopic.length,
		),
		cardPrecision: share(shown.filter(correctCard).length, shown.length),
		targetAccuracy: share(targeted.filter(correctCard).length, targeted.length),
	};
}

describe("scoreRouter", () => {
	const card = (intent: ActionIntent, id: string) =>
		({ intent, id }) as ActionCard;

	it("scores intent, refusal, precision and target separately", () => {
		const rows: LabelledQuery[] = [
			{
				query: "dmt api",
				intent: "find_api",
				target: "action:find_api:dmt-api",
			},
			{ query: "fetch bill", intent: "find_api", target: "action:find_api:x" },
			{ query: "weather", intent: null },
			{ query: "hello", intent: null },
		];
		const routes: Record<string, ActionCard | null> = {
			"dmt api": card("find_api", "action:find_api:dmt-api"),
			"fetch bill": card("find_api", "action:find_api:wrong"),
			weather: null,
			hello: card("find_api", "action:find_api:hello"),
		};

		expect(scoreRouter(rows, (q) => routes[q])).toEqual({
			total: 4,
			intentAccuracy: 0.75,
			offTopicRefusal: 0.5,
			cardPrecision: 1 / 3,
			targetAccuracy: 0.5,
		});
	});
});

// Real run: PALETTE_EVAL_FILE=path/to/labelled.jsonl npx vitest run src/lib/palette-actions/eval.test.ts
// Prints the gate table for the rules router. See scripts/palette-eval/README.md.
const EVAL_FILE = process.env.PALETTE_EVAL_FILE;

describe.skipIf(!EVAL_FILE)("palette eval (rules router)", () => {
	it("prints gate metrics", () => {
		const rows = readFileSync(EVAL_FILE as string, "utf8")
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line) as LabelledQuery);
		const engine = buildEngine();
		const route = (query: string) => resolveAction(engine, query);
		const bySplit = {
			all: scoreRouter(rows, route),
			dev: scoreRouter(
				rows.filter((r) => r.split !== "test"),
				route,
			),
			test: scoreRouter(
				rows.filter((r) => r.split === "test"),
				route,
			),
		};
		console.table(bySplit);
		expect(bySplit.all.total).toBe(rows.length);
	});
});
