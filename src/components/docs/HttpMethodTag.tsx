import { cn } from "@/lib/utils";

type Method = "GET" | "POST" | "PUT" | "DELETE";

type Variant = "soft" | "solid" | "onDark";

/** Per-method pill colour (tinted background + text), reads on light and dark. */
const METHOD_STYLES: Record<Variant, Record<Method, string>> = {
	soft: {
		GET: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
		POST: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30",
		PUT: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30",
		DELETE:
			"bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30",
	},
	// Always-dark surfaces (the code panel): dark tint regardless of site theme.
	onDark: {
		GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
		POST: "bg-sky-500/15 text-sky-400 border-sky-500/25",
		PUT: "bg-violet-500/15 text-violet-400 border-violet-500/25",
		DELETE: "bg-rose-500/15 text-rose-400 border-rose-500/25",
	},
	// Inverted: light text on a saturated method-coloured background.
	solid: {
		GET: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
		POST: "bg-sky-600 text-white border-transparent dark:bg-sky-500",
		PUT: "bg-violet-600 text-white border-transparent dark:bg-violet-500",
		DELETE: "bg-rose-600 text-white border-transparent dark:bg-rose-500",
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
			"inline-flex items-center rounded-[5px] border px-[7px] py-[3px] font-mono text-[0.625rem] font-semibold uppercase leading-none tracking-[0.04em]",
			METHOD_STYLES[variant][method],
			className,
		)}
	>
		{short ? SHORT[method] : method}
	</span>
);
