import { cn } from "@/lib/utils";

type Method = "GET" | "POST" | "PUT" | "DELETE";

/** Per-method colour, tuned to read on both light and dark surfaces. */
const METHOD_STYLES: Record<Method, string> = {
	GET: "text-emerald-600 dark:text-emerald-400",
	POST: "text-sky-600 dark:text-sky-400",
	PUT: "text-amber-600 dark:text-amber-400",
	DELETE: "text-rose-600 dark:text-rose-400",
};

const SHORT: Record<Method, string> = {
	GET: "GET",
	POST: "POST",
	PUT: "PUT",
	DELETE: "DEL",
};

/**
 * Compact, uppercase HTTP-method label used in the docs nav and endpoint
 * headers. Monospace + semibold so methods align and scan quickly.
 */
export const HttpMethodTag = ({
	method,
	className,
	short = false,
}: {
	method: Method;
	className?: string;
	short?: boolean;
}) => (
	<span
		className={cn(
			"font-mono text-[0.625rem] font-semibold uppercase tracking-wider",
			METHOD_STYLES[method],
			className,
		)}
	>
		{short ? SHORT[method] : method}
	</span>
);
