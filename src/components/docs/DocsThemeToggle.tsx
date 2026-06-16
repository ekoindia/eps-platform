import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

export type DocsTheme = "light" | "dark";

/**
 * Sun/moon toggle for the docs-local theme. Stateless — the parent owns the
 * theme and applies `.dark` to the docs root subtree (the rest of the site is
 * untouched). The icon reflects the current theme.
 */
export const DocsThemeToggle = ({
	theme,
	onToggle,
	className,
}: {
	theme: DocsTheme;
	onToggle: () => void;
	className?: string;
}) => (
	<button
		type="button"
		onClick={onToggle}
		aria-label={
			theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
		}
		title={theme === "dark" ? "Light theme" : "Dark theme"}
		className={cn(
			"inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer",
			className,
		)}
	>
		{theme === "dark" ? (
			<Sun className="h-4 w-4" />
		) : (
			<Moon className="h-4 w-4" />
		)}
	</button>
);
