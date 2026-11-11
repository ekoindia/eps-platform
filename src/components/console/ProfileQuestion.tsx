import { SegmentMeter } from "@/components/console/SegmentMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/auth/client";
import {
	MAX_TEXT_LEN,
	type ProfileField,
	type ProfileFieldsView,
	checkAnswer,
	questionOrder,
	saveFailureMessage,
	useProfileFields,
} from "@/lib/console/profile-fields";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/** Up to this many choices show as tappable chips; more get a select. */
const MAX_CHIPS = 8;

/** Matches the profile page's select, sized to the chips' tap target. */
const SELECT_CLASS =
	"h-11 w-full rounded-[10px] border border-slate-300 bg-slate-50 px-3 text-sm text-eko-navy";

/**
 * The front card: one question, answered by a chip, a select or a text box.
 * Keyed by field, so its draft and error reset when the question changes.
 */
function QuestionCard({
	field,
	view,
	count,
	focusOnMount,
	onSaved,
	onSkip,
}: {
	field: ProfileField;
	view: ProfileFieldsView;
	count: number;
	focusOnMount: boolean;
	onSaved: () => void;
	onSkip: () => void;
}) {
	const id = useId();
	const cardRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const options = view.optionsOf(field);
	const chips = options && options.length <= MAX_CHIPS;
	// Save appears only once the draft would pass, so an empty card stays short.
	// Enter on an invalid draft still submits, and the check says what's wrong.
	const valid = checkAnswer(field, draft, options).ok;

	// After a save or skip the old card unmounts; land keyboard focus on the
	// next question rather than dropping it to <body>.
	useEffect(() => {
		if (focusOnMount) {
			cardRef.current?.querySelector<HTMLElement>("[data-question]")?.focus();
		}
	}, [focusOnMount]);

	async function submit(value: string) {
		const checked = checkAnswer(field, value, options);
		if ("error" in checked) {
			setError(checked.error);
			return;
		}
		setError(null);
		setSaving(true);
		try {
			await view.save(field, checked.payload);
			onSaved();
		} catch (failure) {
			setError(saveFailureMessage(failure));
			setSaving(false);
		}
	}

	const errorId = `${id}-error`;
	return (
		<div
			ref={cardRef}
			className="relative flex flex-col gap-3 rounded-[14px] bg-white p-4 text-eko-navy shadow-[0_6px_18px_rgba(4,30,40,0.25)]">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-bold uppercase tracking-wider text-eko-navy-light">
					{field.label}
				</span>
				<span className="text-xs text-slate-600">1 of {count}</span>
			</div>
			{chips ? (
				<>
					<p
						data-question
						tabIndex={-1}
						className="text-base font-semibold leading-snug outline-hidden"
					>
						{field.question}
					</p>
					<div className="grid grid-cols-2 gap-2">
						{options.map((option) => (
							<button
								key={option}
								type="button"
								disabled={saving}
								onClick={() => void submit(option)}
								className="min-h-11 rounded-[10px] border border-slate-300 bg-slate-50 px-2.5 text-[13px] font-medium transition-colors hover:bg-eko-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eko-gold disabled:opacity-50"
							>
								{option}
							</button>
						))}
					</div>
				</>
			) : (
				<form
					noValidate
					className="flex flex-col gap-2.5"
					onSubmit={(event) => {
						event.preventDefault();
						void submit(draft);
					}}
				>
					<label
						data-question
						tabIndex={-1}
						htmlFor={id}
						className="text-base font-semibold leading-snug outline-hidden"
					>
						{field.question}
					</label>
					{options ? (
						<select
							id={id}
							value={draft}
							disabled={saving}
							className={SELECT_CLASS}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? errorId : undefined}
							onChange={(e) => {
								setDraft(e.target.value);
								setError(null);
							}}
						>
							<option value="">Choose one</option>
							{options.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					) : (
						<Input
							id={id}
							value={draft}
							disabled={saving}
							type={field.kind === "url" ? "url" : "text"}
							inputMode={field.kind === "integer" ? "numeric" : undefined}
							placeholder={field.kind === "url" ? "https://" : undefined}
							maxLength={MAX_TEXT_LEN}
							className={
								field.kind === "gstin"
									? "h-11 rounded-[10px] bg-slate-50 uppercase"
									: "h-11 rounded-[10px] bg-slate-50"
							}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? errorId : undefined}
							onChange={(e) => {
								setDraft(e.target.value);
								setError(null);
							}}
						/>
					)}
					{valid || saving ? (
						<Button
							type="submit"
							variant="navy"
							className="h-11 rounded-[10px] hover:translate-y-0"
							disabled={saving}
						>
							{saving ? "Saving…" : "Save"}
						</Button>
					) : null}
				</form>
			)}
			{error ? (
				<p id={errorId} role="alert" className="text-xs text-destructive">
					{error}
				</p>
			) : null}
			<button
				type="button"
				onClick={onSkip}
				disabled={saving || count < 2}
				className="min-h-8 self-center px-2 text-[13px] font-medium text-slate-600 hover:text-eko-navy disabled:opacity-45"
			>
				Skip this one
			</button>
		</div>
	);
}

/**
 * Console Home's profile nudge: the strength meter, then the partner's empty
 * profile fields asked one at a time on a stack of cards.
 *
 * Highest-priority questions come first, shuffled within each priority (see
 * `questionOrder`); "Skip" sends one to the back of the whole queue. The order
 * is fixed once per mount, so the card doesn't reshuffle as answers land — a
 * field filled anywhere (here, the profile page, another tab) just drops out.
 *
 * Renders nothing until the CRM record is loaded, and asks nothing when there
 * is no record to write to.
 * @param profile - The signed-in developer's profile, or null.
 * @param contact - Shown above the meter only while no question is: the deck
 * needs the room, and the same details are on the profile page.
 */
export function ProfileQuestions({
	profile,
	contact,
}: {
	profile: Profile | null;
	contact?: ReactNode;
}) {
	const view = useProfileFields(profile);
	const [order, setOrder] = useState(() => questionOrder(view.fields));
	const [flash, setFlash] = useState<string | null>(null);
	const [interacted, setInteracted] = useState(false);
	if (!view.strength) return contact ?? null;

	const byKey = new Map(view.fields.map((field) => [field.key, field]));
	const queue = order
		.map((key) => byKey.get(key))
		.filter(
			(field): field is ProfileField =>
				!!field &&
				view.valueOf(field) === "" &&
				// A picklist whose options haven't arrived can't be answered.
				(field.kind !== "picklist" || !!view.optionsOf(field)?.length),
		);
	const current = queue[0];

	return (
		<>
			{current ? null : contact}
			<SegmentMeter strength={view.strength} next={!!current} />
			{flash ? (
				<p
					role="status"
					className="-mt-2 flex items-center gap-1.5 text-xs text-green-300"
				>
					<Check className="h-3.5 w-3.5" aria-hidden="true" />
					{flash}
				</p>
			) : null}
			{current ? (
				// Bottom padding leaves room for the two cards peeking out below.
				<div className="relative pb-3.5">
					{queue.length > 2 ? (
						<div
							aria-hidden="true"
							className="absolute inset-x-6 top-3.5 bottom-0 rounded-[14px] bg-white/30"
						/>
					) : null}
					{queue.length > 1 ? (
						<div
							aria-hidden="true"
							className="absolute inset-x-3 top-[7px] bottom-[7px] rounded-[14px] bg-white/55"
						/>
					) : null}
					<QuestionCard
						key={current.key}
						field={current}
						view={view}
						count={queue.length}
						focusOnMount={interacted}
						onSaved={() => {
							setFlash(`${current.label} saved`);
							setInteracted(true);
						}}
						onSkip={() => {
							setOrder((keys) => [
								...keys.filter((key) => key !== current.key),
								current.key,
							]);
							setFlash(null);
							setInteracted(true);
						}}
					/>
				</div>
			) : view.strength.percent === 100 ? (
				<div className="flex items-center gap-2.5 rounded-[14px] bg-white p-4 text-sm font-semibold text-eko-navy">
					<Check className="h-5 w-5 text-eko-success" aria-hidden="true" />
					Profile complete. Nice work.
				</div>
			) : null}
		</>
	);
}
