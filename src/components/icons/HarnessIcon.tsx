/**
 * Resolves a harness `id` (from the install matrix) to its brand icon.
 * Prefers brand-specific inline marks (from @lobehub/icons-static-svg) where
 * available, falls back to Simple Icons (react-icons/si), then to a generic
 * code icon for any harness without a mapping. Icons render in `currentColor`
 * so they adapt to the pill's active/inactive text color.
 */
import type { ComponentType } from "react";
import { Boxes, Code2 } from "lucide-react";
import {
	SiGithubcopilot,
	SiGooglegemini,
	SiJetbrains,
	SiWindsurf,
	SiZedindustries,
} from "react-icons/si";
import { AntigravityIcon } from "./AntigravityIcon";
import { ClaudeCodeIcon } from "./ClaudeCodeIcon";
import { CodexIcon } from "./CodexIcon";
import { CursorIcon } from "./CursorIcon";
import { KiroIcon } from "./KiroIcon";
import { OpencodeIcon } from "./OpencodeIcon";

type IconComponent = ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, IconComponent> = {
	"claude-code": ClaudeCodeIcon,
	cursor: CursorIcon,
	codex: CodexIcon,
	"gemini-cli": SiGooglegemini,
	opencode: OpencodeIcon,
	copilot: SiGithubcopilot,
	windsurf: SiWindsurf,
	zed: SiZedindustries,
	"jetbrains-ai": SiJetbrains,
	kiro: KiroIcon,
	antigravity: AntigravityIcon,
	others: Boxes,
};

interface HarnessIconProps {
	id: string;
	className?: string;
}

export const HarnessIcon = ({ id, className }: HarnessIconProps) => {
	const Icon = ICON_MAP[id] ?? Code2;
	return <Icon className={className} />;
};
