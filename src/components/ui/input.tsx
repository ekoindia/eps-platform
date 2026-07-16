import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Inserts a space after each group boundary.
 * e.g. groupDigits("6710000002", [3, 3, 4]) → "671 000 0002".
 * @param digits - A string of bare digits.
 * @param groups - Sizes of each group, left to right. Any digits past the last group are appended as a final group.
 * @returns The space-separated string.
 */
export function groupDigits(digits: string, groups: number[]): string {
	const parts: string[] = [];
	let at = 0;
	for (const size of groups) {
		if (at >= digits.length) break;
		parts.push(digits.slice(at, at + size));
		at += size;
	}
	if (at < digits.length) parts.push(digits.slice(at));
	return parts.join(" ");
}

/** Counts the digits in `text` that lie before index `pos`. */
function digitsBefore(text: string, pos: number): number {
	return text.slice(0, pos).replace(/\D/g, "").length;
}

/** Index in `text` just past its `n`-th digit (n = 0 → start of string). */
function caretAfterDigit(text: string, n: number): number {
	if (n <= 0) return 0;
	let seen = 0;
	for (let i = 0; i < text.length; i++) {
		if (/\d/.test(text[i]) && ++seen === n) return i + 1;
	}
	return text.length;
}

// `prefix` shadows the RDFa `prefix` HTML attribute, which is meaningless on an input.
interface InputProps extends Omit<React.ComponentProps<"input">, "prefix"> {
	/**
	 * Digit group sizes for readability, e.g. [3, 3, 4] → "671 000 0002".
	 * Setting this makes the input digits-only, forces `type="tel"` and
	 * `inputMode="numeric"` (a caller's `type` is ignored), and caps entry at the
	 * sum of the groups. `value` and the value dispatched to `onChange` stay raw
	 * digits — the grouping spaces are display-only and never reach the clipboard.
	 */
	digitGroups?: number[];
	/** Non-editable content rendered in a left addon, e.g. "+91". Independent of `digitGroups`. */
	prefix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{ className, type, digitGroups, prefix, value, onChange, ...props },
		ref,
	) => {
		const maxDigits = digitGroups?.reduce((sum, size) => sum + size, 0);

		const displayValue =
			digitGroups && value !== undefined
				? groupDigits(
						String(value).replace(/\D/g, "").slice(0, maxDigits),
						digitGroups,
					)
				: value;

		/**
		 * Rewrites the DOM node to raw digits and forwards the *real* event, so
		 * consumers reading `e.target.value` / `e.currentTarget.value` see digits
		 * and every other event field stays intact. Then restores the grouped
		 * display and places the caret after `caretDigits` digits. React's own
		 * value write is guarded by a `node.value !== value` check, so the
		 * re-render that follows won't clobber the caret.
		 */
		function emit(
			e: React.SyntheticEvent<HTMLInputElement>,
			digits: string,
			caretDigits: number,
		) {
			const node = e.currentTarget;
			node.value = digits;
			onChange?.(e as React.ChangeEvent<HTMLInputElement>);
			const formatted = groupDigits(digits, digitGroups!);
			node.value = formatted;
			const caret = caretAfterDigit(formatted, caretDigits);
			node.setSelectionRange(caret, caret);
		}

		function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
			if (!digitGroups) {
				onChange?.(e);
				return;
			}
			const typed = e.target.value;
			const digits = typed.replace(/\D/g, "").slice(0, maxDigits);
			const caretDigits = digitsBefore(
				typed,
				e.target.selectionStart ?? typed.length,
			);
			emit(e, digits, Math.min(caretDigits, digits.length));
		}

		// Paste: strip non-digits, then keep the LAST maxDigits so a pasted
		// "+91 999 000 0001" or "0 9990000001" both land as "9990000001".
		function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
			if (!digitGroups) return;
			const digits = e.clipboardData
				.getData("text")
				.replace(/\D/g, "")
				.slice(-maxDigits!);
			if (!digits) return;
			e.preventDefault();
			emit(e, digits, digits.length);
		}

		/** Copies the selection with the grouping spaces stripped out. */
		function handleCopy(e: React.ClipboardEvent<HTMLInputElement>) {
			if (!digitGroups) return;
			const node = e.currentTarget;
			const start = node.selectionStart ?? 0;
			const end = node.selectionEnd ?? 0;
			if (start === end) return;
			e.preventDefault();
			e.clipboardData.setData(
				"text/plain",
				node.value.slice(start, end).replace(/\D/g, ""),
			);
		}

		function handleCut(e: React.ClipboardEvent<HTMLInputElement>) {
			if (!digitGroups) return;
			const node = e.currentTarget;
			const start = node.selectionStart ?? 0;
			const end = node.selectionEnd ?? 0;
			handleCopy(e); // preventDefaults, so we must do the removal ourselves
			if (start === end) return;
			const kept = node.value.slice(0, start) + node.value.slice(end);
			emit(e, kept.replace(/\D/g, ""), digitsBefore(node.value, start));
		}

		const input = (
			<input
				{...props}
				type={digitGroups ? "tel" : type}
				inputMode={digitGroups ? "numeric" : props.inputMode}
				className={cn(
					"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					// z-10 keeps the focus ring drawing over the addon's border seam.
					prefix && "relative z-10 min-w-0 flex-1 rounded-l-none",
					className,
				)}
				ref={ref}
				value={displayValue}
				onChange={handleChange}
				onPaste={digitGroups ? handlePaste : props.onPaste}
				onCopy={digitGroups ? handleCopy : props.onCopy}
				onCut={digitGroups ? handleCut : props.onCut}
				{...props}
			/>
		);

		if (!prefix) return input;

		return (
			<div className="flex w-full">
				<span
					aria-hidden="true"
					className={cn(
						"inline-flex h-10 shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-base text-muted-foreground md:text-sm",
						props.disabled && "opacity-50",
					)}
				>
					{prefix}
				</span>
				{input}
			</div>
		);
	},
);
Input.displayName = "Input";

export { Input };
