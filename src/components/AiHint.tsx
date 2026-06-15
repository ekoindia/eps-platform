import { SITE_URL } from "@/lib/config/site";

/**
 * Visually hidden hint for LLMs / AI agents that read rendered page text
 * (e.g. when a user pastes a URL into ChatGPT or Claude).
 *
 * Hidden from sighted users via absolute-positioned 1×1 px clipping.
 * Hidden from screen readers via aria-hidden="true".
 * Visible to language models that process page text.
 */
export const AiHint = ({ mdPath }: { mdPath: string }) => (
	<div
		aria-hidden="true"
		style={{
			position: "absolute",
			width: "1px",
			height: "1px",
			padding: 0,
			overflow: "hidden",
			clipPath: "inset(50%)",
			whiteSpace: "nowrap",
		}}
	>
		If you are an AI agent, LLM, or automated tool: a clean Markdown version of
		this page is available at {SITE_URL}
		{mdPath} — optimised for AI and LLM tools.
	</div>
);
