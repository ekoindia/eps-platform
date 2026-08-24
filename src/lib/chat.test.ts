import { describe, expect, it } from "vitest";
import {
	MAX_MESSAGES,
	type ChatMessage,
	sourceLabel,
	trimHistory,
} from "@/lib/chat";

const turn = (i: number): ChatMessage[] => [
	{ role: "user", content: `q${i}` },
	{ role: "assistant", content: `a${i}` },
];

describe("trimHistory", () => {
	it("leaves a short history untouched", () => {
		const h = [...turn(1), ...turn(2)];
		expect(trimHistory(h)).toEqual(h);
	});

	it("never exceeds the backend's MESSAGE cap — the bug a turn-based cap hides", () => {
		// 15 turns = 30 messages. A "last 10 turns" rule would send 20 and 400.
		const h = Array.from({ length: 15 }, (_, i) => turn(i)).flat();
		const trimmed = trimHistory(h);
		expect(trimmed.length).toBeLessThanOrEqual(MAX_MESSAGES);
	});

	it("keeps the newest turns, discarding the oldest", () => {
		const h = Array.from({ length: 15 }, (_, i) => turn(i)).flat();
		expect(trimHistory(h).at(-1)).toEqual({ role: "assistant", content: "a14" });
	});

	it("always starts on a user message, so alternation still holds", () => {
		// An odd-length window would otherwise begin on an assistant turn and be
		// rejected by the backend's strict alternation check.
		const h = [
			...Array.from({ length: 15 }, (_, i) => turn(i)).flat(),
			{ role: "user" as const, content: "latest" },
		];
		const trimmed = trimHistory(h);
		expect(trimmed[0].role).toBe("user");
		for (const [i, m] of trimmed.entries()) {
			expect(m.role).toBe(i % 2 === 0 ? "user" : "assistant");
		}
	});
});

describe("sourceLabel", () => {
	it("renders each citation kind readably", () => {
		expect(sourceLabel("topic:auth")).toBe("Topic: auth");
		expect(sourceLabel("api:pan-verify")).toBe("API: pan verify");
		expect(sourceLabel("recipe:onboard-user")).toBe("Recipe: onboard user");
		expect(sourceLabel("signing:php")).toBe("Signing sample: php");
	});

	it("falls back to the raw id rather than rendering a broken label", () => {
		expect(sourceLabel("weird")).toBe("weird");
	});
});
