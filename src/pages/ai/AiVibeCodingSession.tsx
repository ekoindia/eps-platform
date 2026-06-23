import { AntigravityIcon } from "@/components/icons/AntigravityIcon";
import { ClaudeCodeIcon } from "@/components/icons/ClaudeCodeIcon";
import { CodexIcon } from "@/components/icons/CodexIcon";
import { OpencodeIcon } from "@/components/icons/OpencodeIcon";
import type { IconComponent } from "@/components/icons/types";
import { useEffect, useState } from "react";

interface VibeAgent {
	/** Display name in the session banner. */
	name: string;
	/** Model line shown under the name. */
	model: string;
	/**
	 * Brand "theme" color. Deliberate raw-hex exception (not in the EPS palette):
	 * third-party brand marks read as authentic only in their own colors. Tints
	 * the agent glyph and every tool-call `●` marker.
	 */
	color: string;
	/** Inline currentColor brand mark from @lobehub/icons-static-svg. */
	Icon: IconComponent;
}

/**
 * The coding agents the EPS MCP platform supports, cycled in the hero terminal so
 * the illustration reads as agent-agnostic rather than Claude-only.
 */
const VIBE_AGENTS: VibeAgent[] = [
	{
		name: "Claude Code",
		model: "Opus 4.8 with high effort",
		color: "#D97757",
		Icon: ClaudeCodeIcon,
	},
	{
		name: "Codex",
		model: "GPT-5.4 Codex, high reasoning",
		color: "#10A37F",
		Icon: CodexIcon,
	},
	{
		name: "Antigravity CLI",
		model: "Gemini 3 Pro",
		color: "#4285F4",
		Icon: AntigravityIcon,
	},
	{
		name: "OpenCode",
		model: "Claude Opus 4.8 · any model",
		color: "#FAB283",
		Icon: OpencodeIcon,
	},
];

/** How long each agent stays on screen before rotating. */
const ROTATE_MS = 3500;

/**
 * Decorative hero visual: a simplified CLI coding session that drives the EPS MCP
 * to write KYC code automatically. The agent identity (brand glyph, name, model,
 * tool-call marker color) rotates through {@link VIBE_AGENTS} every few seconds;
 * the session transcript is constant. Honors `prefers-reduced-motion` by locking
 * to the first agent. Rendered inside the glass `CodeBlock` shell — purely
 * illustrative, so the whole block is `aria-hidden`.
 */
export const AiVibeCodingSession = () => {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (reduce.matches) {
			setIndex(0);
			return;
		}
		const id = window.setInterval(
			() => setIndex((i) => (i + 1) % VIBE_AGENTS.length),
			ROTATE_MS,
		);
		// Stop rotating if the user enables reduced motion while the page is open.
		const onChange = (e: MediaQueryListEvent) => {
			if (e.matches) {
				window.clearInterval(id);
				setIndex(0);
			}
		};
		reduce.addEventListener("change", onChange);
		return () => {
			window.clearInterval(id);
			reduce.removeEventListener("change", onChange);
		};
	}, []);

	const agent = VIBE_AGENTS[index];
	const { Icon, color } = agent;
	const dot = { color };

	return (
		<div aria-hidden className="leading-[1.5rem] text-white/70">
			{/* Banner: rotating brand glyph + model label */}
			<div key={agent.name} className="flex animate-fade-in items-center gap-3">
				<span style={dot}>
					<Icon className="h-9 w-9 shrink-0" />
				</span>
				<div className="min-h-[2.75rem]">
					<div className="font-semibold text-white">{agent.name}</div>
					<div className="text-white/40">{agent.model}</div>
				</div>
			</div>

			{/* Prompt */}
			<div className="my-4 border-y border-white/10 py-2">
				<span className="text-eko-gold">❯</span>{" "}
				<span className="text-white/80">
					Add PAN verification to my onboarding form
				</span>
			</div>

			{/* Session transcript (constant; markers retint to the active agent) */}
			<div className="space-y-2.5">
				<div>
					<span style={dot}>●</span> I'll wire this up with the EPS MCP.
				</div>

				<div className="pt-1 mb-0">
					<span style={dot}>●</span>{" "}
					<span className="text-white/40">eps · search(</span>
					<span className="text-amber-200">"verify PAN"</span>
					<span className="text-white/40">)</span>
				</div>
				<div className="pl-4 text-emerald-300/80">
					<span className="text-white/40">⎿</span> pan-lite, pan-advanced,
					bulk-pan-verify
				</div>

				<div className="pt-1 mb-0">
					<span style={dot}>●</span>{" "}
					<span className="text-white/40">eps · get_signing_snippet(</span>
					<span className="text-amber-200">"node"</span>
					<span className="text-white/40">)</span>
				</div>
				<div className="pl-4 text-emerald-300/80">
					<span className="text-white/40">⎿</span> HMAC-SHA256 signing ready
				</div>

				<div className="pt-1 mb-0">
					<span style={dot}>●</span>{" "}
					<span className="text-white/40">Writing</span>{" "}
					<span className="text-white/80">src/kyc/verify-pan.ts</span>{" "}
					<span className="text-white/40">…</span>
				</div>
				<div className="pl-4 text-white/40">
					<span className="text-white/40">⎿</span> Updated 1 file{" "}
					<span className="text-emerald-300/80">(+34 -0)</span>
				</div>

				<div className="pt-2 text-emerald-300/90">
					<span className="text-white/40">✓</span> PAN verification wired —
					signed EPS call, name-match on
					<span className="ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse-soft bg-eko-gold" />
				</div>
			</div>
		</div>
	);
};
