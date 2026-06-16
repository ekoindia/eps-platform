import { cn } from "@/lib/utils";

type Method = "GET" | "POST" | "PUT" | "DELETE";

type Variant = "soft" | "solid" | "onDark";

/** Per-method pill colour (tinted background + text), reads on light and dark. */
const METHOD_STYLES: Record<Variant, Record<Method, string>> = {
	soft: {
		GET: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
		POST: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
		PUT: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
		DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
	},
	// Always-dark surfaces (the code panel): dark tint regardless of site theme.
	onDark: {
		GET: "bg-emerald-500/15 text-emerald-400",
		POST: "bg-sky-500/15 text-sky-400",
		PUT: "bg-amber-500/15 text-amber-400",
		DELETE: "bg-rose-500/15 text-rose-400",
	},
	// Inverted: light text on a saturated method-coloured background.
	solid: {
		GET: "bg-emerald-600 text-white dark:bg-emerald-500",
		POST: "bg-sky-600 text-white dark:bg-sky-500",
		PUT: "bg-amber-600 text-white dark:bg-amber-500",
		DELETE: "bg-rose-600 text-white dark:bg-rose-500",
	},
};

const SHORT: Record<Method, string> = {
	GET: "GET",
	POST: "POST",
	PUT: "PUT",
	DELETE: "DEL",
};

/**
 * Compact, uppercase HTTP-method pill used in the docs nav, endpoint headers,
 * page titles and code panel. Tinted, slightly-rounded background (mirrors the
 * `UAT` badge); monospace + semibold so methods align and scan quickly.
 */
export const HttpMethodTag = ({
	method,
	className,
	short = false,
	variant = "soft",
}: {
	method: Method;
	className?: string;
	short?: boolean;
	variant?: Variant;
}) => (
	<span
		className={cn(
			"inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-wider",
			METHOD_STYLES[variant][method],
			className,
		)}
	>
		{short ? SHORT[method] : method}
	</span>
);
