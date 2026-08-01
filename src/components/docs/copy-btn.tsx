/**
 * Small inline copy-to-clipboard button (light/dark aware), shared by the
 * interactive widgets embedded in MDX guides.
 *
 * Clipboard access is unavailable on an insecure origin and can be denied by
 * the user, so a failure is surfaced as a short "Failed" state rather than
 * swallowed — a button that silently does nothing reads as a broken page.
 */
import { cn } from "@/lib/utils";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export const CopyBtn = ({ text, label }: { text: string; label: string }) => {
	const [state, setState] = useState<CopyState>("idle");
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	// Never fire setState after unmount: the reset is a 1.5s tail on a click.
	useEffect(() => () => clearTimeout(timer.current), []);

	const flash = (next: CopyState) => {
		setState(next);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setState("idle"), 1500);
	};

	const copy = () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) {
			flash("failed");
			return;
		}
		navigator.clipboard.writeText(text).then(
			() => flash("copied"),
			() => flash("failed"),
		);
	};

	return (
		<button
			type="button"
			onClick={copy}
			aria-label={label}
			className={cn(
				"inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs transition-colors dark:border-slate-600",
				state === "copied" && "text-emerald-600 dark:text-emerald-400",
				state === "failed" && "text-red-600 dark:text-red-400",
				state === "idle" &&
					"text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
			)}
		>
			{state === "copied" ? (
				<Check className="h-3.5 w-3.5" />
			) : state === "failed" ? (
				<X className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
			{state === "copied" ? "Copied" : state === "failed" ? "Failed" : label}
		</button>
	);
};
