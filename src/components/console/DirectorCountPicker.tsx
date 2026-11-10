import type { DirectorRule } from "@/lib/connect/directors";
import { cn } from "@/lib/utils";
import { useId, useState } from "react";
import { toast } from "sonner";

/** How many counts get a one-tap chip; the rest go in the "More" select. */
const CHIPS = 7;

export interface DirectorCountPickerProps {
	/** The business type's rule — only the asking kind has a picker. */
	rule: Extract<DirectorRule, { kind: "ask" }>;
	/** The partner's saved answer, or null when there is none to show. */
	value: number | null;
	/** Saves a new answer; rejects when the save failed. */
	onSave: (count: number) => Promise<void>;
	/** Holds the control still, e.g. while the saved answer is still loading. */
	disabled?: boolean;
}

/**
 * Asks how many directors (or partners) the business has.
 *
 * A row of one-tap chips for the common counts and a native select for the
 * rest: a small, known range is quicker to tap than to open a list for, and
 * the select hands the long tail to the phone's own picker. The chips are real
 * radio inputs, so arrow keys, focus and screen readers come from the browser.
 *
 * Marked required, and tinted until answered: every per-director check below
 * runs on this number, so an empty one is worth drawing the eye to.
 *
 * Saves on every choice. The chosen chip shows straight away and the control
 * holds still until the save settles, so two saves can never race; a failed
 * save puts the previous answer back.
 * @param props - See {@link DirectorCountPickerProps}.
 */
export function DirectorCountPicker({
	rule,
	value,
	onSave,
	disabled = false,
}: DirectorCountPickerProps) {
	const name = useId();
	const hintId = useId();
	const [saving, setSaving] = useState<number | null>(null);
	const shown = saving ?? value;
	const locked = disabled || saving !== null;
	// Nothing chosen yet: the section asks for attention until it is answered.
	const unanswered = shown === null;

	const counts = Array.from(
		{ length: rule.max - rule.min + 1 },
		(_, i) => rule.min + i,
	);
	const chips = counts.slice(0, CHIPS);
	const more = counts.slice(CHIPS);
	const label = `Number of ${rule.noun.many}`;

	async function choose(count: number) {
		if (locked || count === value) return;
		setSaving(count);
		try {
			await onSave(count);
		} catch {
			toast.error(
				`Couldn't save the number of ${rule.noun.many}. Please try again.`,
			);
		} finally {
			setSaving(null);
		}
	}

	return (
		<fieldset
			className={cn(
				"flex flex-col gap-2 rounded-lg border p-4",
				unanswered && "border-eko-gold bg-eko-gold-light/40",
			)}
			disabled={locked}
			aria-describedby={hintId}
		>
			<legend className="px-1 text-sm font-medium">
				{label}
				<span aria-hidden="true" className="text-destructive">
					{" "}
					*
				</span>
			</legend>
			<div className="flex flex-wrap gap-1.5">
				{chips.map((count) => (
					<label key={count} className="cursor-pointer">
						<input
							type="radio"
							name={name}
							value={count}
							checked={shown === count}
							onChange={() => void choose(count)}
							required
							className="peer sr-only"
						/>
						<span
							className={cn(
								"grid h-9 min-w-9 place-items-center rounded-md border bg-card px-2 text-sm font-medium transition-colors",
								"peer-checked:border-eko-navy peer-checked:bg-eko-navy peer-checked:text-white",
								"peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
								"peer-disabled:cursor-not-allowed peer-disabled:opacity-60 hover:bg-muted peer-checked:hover:bg-eko-navy",
							)}
						>
							{count}
						</span>
					</label>
				))}
				{more.length > 0 ? (
					<select
						aria-label={`${label}, more than ${chips[chips.length - 1]}`}
						value={shown !== null && more.includes(shown) ? shown : ""}
						onChange={(event) => void choose(Number(event.target.value))}
						className={cn(
							"h-9 rounded-md border bg-card px-2 text-sm font-medium disabled:opacity-60",
							shown !== null &&
								more.includes(shown) &&
								"border-eko-navy bg-eko-navy text-white",
						)}
					>
						<option value="" disabled>
							More
						</option>
						{more.map((count) => (
							<option key={count} value={count}>
								{count}
							</option>
						))}
					</select>
				) : null}
			</div>
			{unanswered ? (
				<p id={hintId} className="text-sm font-medium text-foreground">
					Please select the number of {rule.noun.many} in your company.
				</p>
			) : (
				<p id={hintId} className="text-sm text-muted-foreground">
					Upload one Aadhaar, PAN and live photograph for each {rule.noun.one}.
				</p>
			)}
		</fieldset>
	);
}
