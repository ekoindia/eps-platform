import { cn } from "@/lib/utils";
import {
	AlertCircle,
	AlertTriangle,
	Info,
	Lightbulb,
	OctagonAlert,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * Styled callout/admonition for endpoint descriptions. Rendered for GitHub-alert
 * blockquotes (`> [!WARNING]`) which {@link ../../lib/docs/remark-callout} maps
 * to a `callout` element. Colours track the docs light/dark theme via Tailwind
 * `dark:` variants. The `type` prop arrives from the alert marker.
 */
type CalloutVariant = {
	icon: ComponentType<{ className?: string }>;
	label: string;
	box: string;
	accent: string;
};

const VARIANTS: Record<string, CalloutVariant> = {
	note: {
		icon: Info,
		label: "Note",
		box: "border-sky-500/30 bg-sky-50 dark:border-sky-400/30 dark:bg-sky-950/40",
		accent: "text-sky-700 dark:text-sky-300",
	},
	tip: {
		icon: Lightbulb,
		label: "Tip",
		box: "border-emerald-500/30 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-950/40",
		accent: "text-emerald-700 dark:text-emerald-300",
	},
	important: {
		icon: AlertCircle,
		label: "Important",
		box: "border-eko-navy/25 bg-eko-navy/5 dark:border-eko-gold/30 dark:bg-eko-gold/10",
		accent: "text-eko-navy dark:text-eko-gold",
	},
	warning: {
		icon: AlertTriangle,
		label: "Warning",
		box: "border-amber-500/30 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-950/40",
		accent: "text-amber-700 dark:text-amber-300",
	},
	danger: {
		icon: OctagonAlert,
		label: "Danger",
		box: "border-red-500/30 bg-red-50 dark:border-red-400/30 dark:bg-red-950/40",
		accent: "text-red-700 dark:text-red-300",
	},
};

/** `caution` is GitHub's red alert — alias it to the `danger` styling. */
const ALIAS: Record<string, string> = { caution: "danger" };

export const Callout = ({
	type = "note",
	children,
}: {
	type?: string;
	children?: ReactNode;
}) => {
	const key = ALIAS[type] ?? type;
	const variant = VARIANTS[key] ?? VARIANTS.note;
	const Icon = variant.icon;

	return (
		<div
			className={cn(
				"my-5 flex gap-3 rounded-lg border border-l-4 px-4 py-3",
				variant.box,
			)}
		>
			<Icon className={cn("mt-0.5 h-5 w-5 shrink-0", variant.accent)} />
			<div className="min-w-0 flex-1">
				<div
					className={cn(
						"mb-1 text-xs font-semibold uppercase tracking-wide",
						variant.accent,
					)}
				>
					{variant.label}
				</div>
				<div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
					{children}
				</div>
			</div>
		</div>
	);
};
