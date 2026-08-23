/**
 * Shared types and limits for the docs-chat assistant.
 *
 * The limits mirror `packages/eps-backend/src/http/chat.ts`. They are repeated
 * rather than imported because the browser bundle must not pull in backend
 * code — so the two must be kept in step by hand, and the UI enforces them
 * only to give a better error than a round-trip 400.
 */

/** One turn of the conversation, as sent to and from the backend. */
export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

/** A successful `/chat/ask` reply. */
export interface ChatAnswer {
	/** Markdown. Rendered without raw HTML — see `AskAiDialog`. */
	answer: string;
	/** Canonical ids of the context slices that actually informed the answer. */
	sources: string[];
	usage: { inputTokens: number; outputTokens: number };
}

/** Max messages the backend accepts in one request (user + assistant). */
export const MAX_MESSAGES = 20;

/** Max characters in any single message. */
export const MAX_MESSAGE_CHARS = 4_000;

/**
 * Trims the history to the newest turns that fit the backend's cap.
 *
 * Slices on MESSAGES, not on turns: a "turn" is a user/assistant pair, so a cap
 * counted in turns would send up to twice the messages the backend allows and
 * earn a 400 on exactly the long conversations this is meant to protect.
 *
 * @param messages - full client-held history, oldest first.
 * @returns the newest window, always starting on a user message so the
 *   alternation the backend requires still holds.
 */
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
	const window = messages.slice(-MAX_MESSAGES);
	const firstUser = window.findIndex((m) => m.role === "user");
	return firstUser <= 0 ? window : window.slice(firstUser);
}

/**
 * Human-readable label for a `sources` id (`topic:auth`, `api:pan-verify`).
 * @param id - canonical source id from the backend.
 */
export function sourceLabel(id: string): string {
	const [kind, rest] = id.split(":");
	const name = (rest ?? "").replace(/-/g, " ");
	if (kind === "api") return `API: ${name}`;
	if (kind === "topic") return `Topic: ${name}`;
	if (kind === "recipe") return `Recipe: ${name}`;
	if (kind === "signing") return `Signing sample: ${rest}`;
	return id;
}
