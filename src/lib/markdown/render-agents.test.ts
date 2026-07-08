/**
 * Regression guard for the retired one-command install. The vercel-labs
 * `plugins` CLI path (`npx plugins add …`) was dropped, and the runtime
 * `eps-transact` plugin was removed from the coding marketplace — so neither the
 * `/ai.md` twin nor the `/agents.md` twin may promote them again. Cheap durable
 * check so a re-added block fails CI instead of shipping stale install copy.
 */
import { describe, expect, it } from "vitest";
import { renderAgentsMarkdown } from "@/lib/markdown/render-agents";
import { renderTransactAgentsMarkdown } from "@/lib/markdown/render-transact";

describe("agent markdown twins — retired install commands", () => {
	const ai = renderAgentsMarkdown();
	const transact = renderTransactAgentsMarkdown();

	it("/ai.md leads with the native plugin install, not `npx plugins add`", () => {
		expect(ai).not.toContain("npx plugins add");
		expect(ai).toContain("/plugin install eps@ekoindia");
	});

	it("/agents.md offers only hosted + local stdio, no coding-agent plugin", () => {
		expect(transact).not.toContain("npx plugins add");
		expect(transact).not.toContain("eps-transact` plugin");
		expect(transact).toContain("mcp.eko.in/transact/mcp");
	});
});
