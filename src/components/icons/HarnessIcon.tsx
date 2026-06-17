/**
 * Resolves a harness `id` (from the install matrix) to its brand icon.
 * Uses Simple Icons (react-icons/si) where available, two inline custom
 * marks for Cursor and opencode, and falls back to a generic code icon for
 * any harness without a mapping. Icons render in `currentColor` so they
 * adapt to the pill's active/inactive text color.
 */
import type { ComponentType } from "react";
import { Code2 } from "lucide-react";
import {
	SiClaude,
	SiGithubcopilot,
	SiGooglegemini,
	SiJetbrains,
	SiOpenai,
	SiWindsurf,
	SiZedindustries,
} from "react-icons/si";
import { CursorIcon } from "./CursorIcon";
import { OpencodeIcon } from "./OpencodeIcon";

type IconComponent = ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, IconComponent> = {
	"claude-code": SiClaude,
	cursor: CursorIcon,
	codex: SiOpenai,
	"gemini-cli": SiGooglegemini,
	opencode: OpencodeIcon,
	copilot: SiGithubcopilot,
	windsurf: SiWindsurf,
	zed: SiZedindustries,
	"jetbrains-ai": SiJetbrains,
};

interface HarnessIconProps {
	id: string;
	className?: string;
}

export const HarnessIcon = ({ id, className }: HarnessIconProps) => {
	const Icon = ICON_MAP[id] ?? Code2;
	return <Icon className={className} />;
};
