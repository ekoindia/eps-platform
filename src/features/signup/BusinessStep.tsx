import { CheckCircle2, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupClient } from "@/lib/auth/client";
import {
	BUSINESS_FIELDS,
	BUSINESS_GROUPS,
	COMPANY_TYPES,
	INDIAN_STATES,
	type BusinessField,
	validateField,
} from "./businessFields";
import { companyTypeForPan, orderCompanyTypes } from "./panCategory";
import type { StepProps } from "./resolveSteps";
import { useSignupProfile } from "./SignupProfileContext";

/** A complete PIN code, and the gate for firing a lookup. */
const PINCODE_PATTERN = /^\d{6}$/;

/** The two address fields a PIN-code lookup is allowed to fill. */
const LOOKUP_FIELDS = ["current_address_district", "current_address_state"];

/**
 * State names the PIN-code lookup answers with that are not in `INDIAN_STATES`
 * character for character, keyed lower-cased.
 *
 * Case-insensitive matching alone is not enough: 522's list spells Delhi out in
 * full with a "(UT)" suffix and still calls Puducherry "PondiCherry", so a
 * literal "Delhi" from the lookup would find nothing and silently leave the
 * dropdown empty. Anything not listed here and not a case-insensitive hit is
 * left for the user rather than guessed at.
 */
const STATE_ALIASES: Record<string, string> = {
	delhi: "National Capital Territory of Delhi (UT)",
	"nct of delhi": "National Capital Territory of Delhi (UT)",
	"new delhi": "National Capital Territory of Delhi (UT)",
	puducherry: "PondiCherry",
	pondicherry: "PondiCherry",
	"andhra pradesh": "Andhra Pradesh (New)",
	orissa: "Odisha",
};

/**
 * Resolves an upstream state name to the exact string interaction 522 accepts.
 * @param raw - The name as the lookup returned it.
 * @returns The matching `INDIAN_STATES` entry, or null when there is no match.
 */
function matchState(raw: string): string | null {
	const key = raw.trim().toLowerCase();
	if (!key) return null;
	const exact = INDIAN_STATES.find((s) => s.toLowerCase() === key);
	return exact ?? STATE_ALIASES[key] ?? null;
}

/** Looks up a field's spec by name. */
const specOf = (name: string): BusinessField =>
	BUSINESS_FIELDS.find((f) => f.name === name) as BusinessField;

/** Every field starts empty, including the optional ones. */
const emptyValues = (): Record<string, string> =>
	Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.name, ""]));

/**
 * Collects company, contact, and registered-address details for onboarding.
 *
 * Most of the form is generated from `BUSINESS_FIELDS`, so a field is declared
 * once and both rendered and validated from that one entry. Two fields are
 * rendered by hand instead: the registered name, which is shown as verified
 * rather than asked for, and the business type, which is only asked for when
 * the PAN cannot answer it. Client validation is for feedback only — the BFF
 * re-checks every field before calling upstream.
 */
export function BusinessStep({ onSubmit, busy, error }: StepProps) {
	const profile = useSignupProfile();
	// The PAN's holder-type letter narrows Business Type: for the categories
	// that determine one it supplies the answer outright, and it floats that
	// category's candidates to the top of the list either way. It is evidence,
	// not a verdict — hence the edit control on the answer below.
	const panCat = profile.panCategory ?? null;
	const autoFilledType = companyTypeForPan(panCat);
	const companyTypeOptions = orderCompanyTypes(panCat);

	// Seed name/email from the profile when present; every other field starts
	// empty. Computed once for the initial state — the wizard only mounts this
	// step after SignupState (and thus the profile) has loaded, so there is no
	// late-arriving-prop race.
	const [values, setValues] = useState<Record<string, string>>(() => ({
		...emptyValues(),
		name: profile.name ?? "",
		email: profile.email ?? "",
		company_type: autoFilledType ?? "",
	}));
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [editingType, setEditingType] = useState(false);
	const [lookingUp, setLookingUp] = useState(false);

	// Provenance for the two lookup-filled fields, so a later lookup knows what
	// it may overwrite or clear. Refs, not state: nothing renders from them, and
	// the lookup's own async callbacks have to read the CURRENT value rather
	// than whatever was captured when the request went out.
	const editedByUser = useRef<Set<string>>(new Set());
	const filledByLookup = useRef<Set<string>>(new Set());

	const nameSpec = specOf("name");
	// The verified box stands in for the name input. It needs a name that is
	// both present and valid: an upstream name containing "&" fails the field
	// pattern, and showing it as verified would leave the form permanently
	// unsubmittable with nowhere to fix it.
	const nameVerified =
		Boolean(profile.name) && !validateField(nameSpec, profile.name ?? "");
	// Ask the question whenever the PAN did not answer it, the user reopened it,
	// OR the verified box is not rendering — without that last clause a C/F PAN
	// with an unusable name would hide the only control for a required field.
	const showTypeQuestion = !nameVerified || !autoFilledType || editingType;
	const selectedTypeLabel = COMPANY_TYPES.find(
		(t) => t.value === values.company_type,
	)?.label;

	/** Records a user edit and marks the field as theirs, not the lookup's. */
	const set = (name: string, value: string) => {
		if (LOOKUP_FIELDS.includes(name)) {
			editedByUser.current.add(name);
			filledByLookup.current.delete(name);
		}
		setValues((prev) => ({ ...prev, [name]: value }));
	};

	/** A field is locked when its spec opts in AND the profile actually prefilled it. */
	const isLocked = (field: BusinessField): boolean => {
		if (!field.lockWhenPrefilled) return false;
		if (field.name === "name") return nameVerified;
		if (field.name === "email") return Boolean(profile.email);
		return false;
	};

	// Fill City and State from the PIN code. No debounce and none needed: a
	// complete six digits is the natural gate, the same reasoning as the PAN
	// step's "only a complete entry can be wrong".
	const pincode = values.current_address_pincode;
	useEffect(() => {
		if (!PINCODE_PATTERN.test(pincode)) return;
		const controller = new AbortController();

		// A new PIN code invalidates whatever the previous lookup filled in.
		// Without this, a second code that upstream does not recognise would
		// leave the first one's city and state sitting there — valid, complete
		// and wrong. Only the lookup's own values are cleared; anything the user
		// typed is theirs to keep.
		// Snapshot BEFORE clearing the ref: `setValues` runs its updater during
		// the next render, by which point the ref would already be empty and the
		// loop would clear nothing.
		const stale = [...filledByLookup.current];
		filledByLookup.current.clear();
		if (stale.length > 0) {
			setValues((prev) => {
				const next = { ...prev };
				for (const name of stale) next[name] = "";
				return next;
			});
		}

		setLookingUp(true);
		// Deliberately not wrapped in `withRetries`: this is a convenience, and
		// retrying it would triple the traffic against an upstream that is
		// already answering badly. One attempt, then the user types.
		signupClient
			.lookupPincode(pincode, controller.signal)
			.then(({ city, state }) => {
				if (controller.signal.aborted) return;
				const matchedState = state ? matchState(state) : null;
				setValues((prev) => {
					const next = { ...prev };
					// Only non-empty strings are assigned: form state is
					// Record<string, string>, so a null would break validateField
					// and the trim on submit. And never over an edit the user made
					// while this request was in flight — aborting on a PIN-code
					// change does not cover that case.
					if (city && !editedByUser.current.has("current_address_district")) {
						next.current_address_district = city;
						filledByLookup.current.add("current_address_district");
					}
					if (
						matchedState &&
						!editedByUser.current.has("current_address_state")
					) {
						next.current_address_state = matchedState;
						filledByLookup.current.add("current_address_state");
					}
					return next;
				});
			})
			// Silent by design: an unknown PIN code and a broken lookup look the
			// same here, and neither should block a form the user can just fill
			// in. The backend tells the two apart and logs a broken one as a 502.
			.catch(() => {})
			.finally(() => {
				if (!controller.signal.aborted) setLookingUp(false);
			});

		return () => controller.abort();
	}, [pincode]);

	const errorFor = (field: BusinessField): string | null =>
		touched[field.name] ? validateField(field, values[field.name]) : null;

	const canSubmit =
		!busy && BUSINESS_FIELDS.every((f) => !validateField(f, values[f.name]));

	/** Renders one spec-driven field, label through error line. */
	const renderField = (name: string) => {
		const field = specOf(name);
		const fieldError = errorFor(field);
		const describedBy = fieldError
			? `${name}-error`
			: field.description
				? `${name}-hint`
				: undefined;
		return (
			// Helper text sits BELOW the control, so the label-to-input gap is
			// identical whether or not a field has a description.
			<div
				key={name}
				className={`flex flex-col gap-2 ${field.fullWidth ? "sm:col-span-2" : ""}`}
			>
				<Label htmlFor={name}>{field.label}</Label>
				{field.kind === "select" ? (
					<select
						id={name}
						value={values[name]}
						disabled={busy}
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
						aria-invalid={fieldError ? true : undefined}
						aria-describedby={describedBy}
						onChange={(e) => set(name, e.target.value)}
						onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
					>
						<option value="">{field.placeholder ?? "Select…"}</option>
						{field.options?.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				) : (
					<Input
						id={name}
						value={values[name]}
						disabled={busy}
						readOnly={isLocked(field)}
						maxLength={field.max}
						placeholder={field.placeholder}
						type={field.inputMode === "email" ? "email" : "text"}
						inputMode={field.inputMode}
						autoComplete="off"
						aria-invalid={fieldError ? true : undefined}
						aria-describedby={describedBy}
						className={
							isLocked(field) ? "bg-muted text-muted-foreground" : undefined
						}
						onChange={(e) => set(name, e.target.value)}
						onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
					/>
				)}
				{name === "current_address_pincode" && lookingUp && (
					<p
						id="pincode-status"
						role="status"
						aria-live="polite"
						className="flex items-center gap-1.5 text-sm text-muted-foreground"
					>
						Looking up your city and state…
					</p>
				)}
				{fieldError ? (
					<p id={`${name}-error`} className="text-sm text-destructive">
						{fieldError}
					</p>
				) : (
					field.description && (
						<p id={`${name}-hint`} className="text-xs text-muted-foreground">
							{field.description}
						</p>
					)
				)}
			</div>
		);
	};

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (!canSubmit) return;
				const trimmed = Object.fromEntries(
					BUSINESS_FIELDS.map((f) => [f.name, values[f.name].trim()]),
				);
				void onSubmit(trimmed);
			}}
		>
			<div className="flex flex-col gap-1.5">
				<h2 className="text-2xl font-semibold tracking-tight">
					Now, your business details
				</h2>
				<p className="text-muted-foreground">
					Your name came from the PAN. One question about your business, then
					the address.
				</p>
			</div>

			{/* Same geometry as PanAside's soft box, in the success tone. Not a
			    <Callout>: its green variant renders a lightbulb and a "Tip" label,
			    which is not what a confirmation reads as. */}
			{nameVerified && (
				<div className="flex flex-col gap-1 rounded-lg border border-eko-success/25 bg-eko-success/5 p-4">
					<p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.12em] text-eko-success uppercase">
						<CheckCircle2 className="h-4 w-4 shrink-0" />
						{/* The PAN is shown only when we still have it — the server
						    forwards it once upstream back-fills the profile, and this
						    session's own copy dies on reload. */}
						{profile.pan ? `Verified from PAN ${profile.pan}` : "Verified"}
					</p>
					<div className="flex flex-col">
						<span className="text-[0.7rem] text-muted-foreground">
							Registered name
						</span>
						<span className="text-base font-semibold text-foreground">
							{profile.name}
						</span>
					</div>
					{autoFilledType && !editingType && (
						<div className="flex flex-col">
							<span className="text-[0.7rem] text-muted-foreground">
								Business type
							</span>
							<span className="flex items-center gap-2 text-base font-semibold text-foreground">
								{selectedTypeLabel}
								{/* Always visible, never hover-only: the PAN narrows the
								    business type but does not prove it, so the way to
								    correct it has to be as findable as the value. */}
								<button
									type="button"
									aria-label="Change business type"
									disabled={busy}
									className="text-muted-foreground hover:text-foreground disabled:opacity-50"
									onClick={() => setEditingType(true)}
								>
									<Pencil className="h-3.5 w-3.5" />
								</button>
							</span>
						</div>
					)}
				</div>
			)}

			{/* The name input only appears when the verified box could not — a
			    missing upstream name, or one that fails the field's own pattern. */}
			{!nameVerified && (
				<div className="grid gap-4 sm:grid-cols-2">{renderField("name")}</div>
			)}

			{showTypeQuestion && (
				<div className="flex flex-col gap-2 rounded-lg border-2 border-eko-navy p-4">
					<h3 className="text-base font-semibold">
						How is the business registered?
					</h3>
					<p className="text-sm text-muted-foreground">
						{autoFilledType
							? "Pick what's on your registration certificate — it decides which documents we ask for at KYC."
							: "Your PAN doesn't say which of these you are. Pick what's on your registration certificate — it decides which documents we ask for at KYC."}
					</p>
					<select
						id="company_type"
						aria-label="Business Type"
						value={values.company_type}
						disabled={busy}
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
						aria-invalid={errorFor(specOf("company_type")) ? true : undefined}
						onChange={(e) => set("company_type", e.target.value)}
						onBlur={() =>
							setTouched((t) => ({ ...t, company_type: true }))
						}
					>
						<option value="">Select business type…</option>
						{companyTypeOptions.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
					<p className="text-xs text-muted-foreground">
						Not sure? Your certificate of registration names it on the first
						page.
					</p>
				</div>
			)}

			{BUSINESS_GROUPS.map((group) => (
				// No divider rule: a `legend` renders inside its fieldset's border
				// and punches a gap in it, so a bordered group reads as a broken
				// line. Whitespace does the separating instead.
				<fieldset key={group.heading} className="border-0 p-0">
					{/* Same uppercase eyebrow as the aside's section labels: these
					    head a group of fields, they are not fields themselves, and
					    at this size they never compete with the step's own h2. */}
					<legend className="mb-3 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
						{group.heading}
					</legend>
					<div className="grid gap-4 sm:grid-cols-2">
						{group.fields.map(renderField)}
					</div>
					{group.fields.includes("email") && (
						<p className="mt-2 text-xs text-muted-foreground">
							The agreement goes to this email for signing. Everything else
							reaches you on +91 {profile.mobile}.
						</p>
					)}
				</fieldset>
			))}

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<div className="flex flex-col gap-2">
				<Button type="submit" className="w-full" disabled={!canSubmit}>
					{busy ? "Saving…" : "Continue"}
				</Button>
				<p className="text-center text-[0.7em] text-muted-foreground">
					You'll see the full agreement before signing anything.
				</p>
			</div>
		</form>
	);
}
