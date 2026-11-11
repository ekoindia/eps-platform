import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/auth/client";
import {
	HTTP_URL,
	MAX_TEXT_LEN,
	PROFILE_SECTIONS,
	type ProfileField,
	crmText,
	normalise,
	profileFields,
	rawText,
	saveFailureMessage,
	toPayload,
	validate,
} from "@/lib/console/profile-fields";
import type { CrmLeadState } from "@/lib/crm/lead-store";
import { useCrmLead } from "@/lib/crm/use-crm-lead";
import { SquarePen } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

/**
 * A website as a link — but only an http(s) one. The value is partner-editable
 * CRM data, and rendering an arbitrary string as an `href` would let a
 * `javascript:` URL run in the console.
 */
function websiteNode(value: string | null): ReactNode {
	if (!value || !HTTP_URL.test(value)) return value;
	return (
		<a
			href={value}
			target="_blank"
			rel="noopener noreferrer"
			className="break-all text-eko-navy underline underline-offset-4 hover:no-underline"
		>
			{value}
		</a>
	);
}

/** Shared look for the native select, matching the signup form's. */
const SELECT_CLASS =
	"h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50";

/**
 * The control for one CRM field in edit mode.
 *
 * A picklist offers the backend's options, and a row with its own `options`
 * offers those. If the record already holds a value
 * outside them (a legacy option sales set before the list was trimmed), that
 * value is kept as the first choice so the select can show it — and because
 * only changed fields are saved, leaving it alone never rewrites it.
 */
function FieldControl({
	id,
	row,
	value,
	original,
	options,
	disabled,
	error,
	onChange,
}: {
	id: string;
	row: ProfileField;
	value: string;
	original: string;
	options: readonly string[] | undefined;
	disabled: boolean;
	error: string | null;
	onChange: (value: string) => void;
}) {
	const describedBy = error ? `${id}-error` : undefined;
	const list = row.options ?? (row.kind === "picklist" ? options : null);
	if (list) {
		const choices =
			original && !list.includes(original) ? [original, ...list] : list;
		return (
			<select
				id={id}
				value={value}
				disabled={disabled}
				className={SELECT_CLASS}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				onChange={(e) => onChange(e.target.value)}
			>
				{/* Once a value exists it can be replaced, never removed — so the
				    blank choice is offered only while the field is still unset. */}
				{original ? null : <option value="">Not specified</option>}
				{choices.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		);
	}
	return (
		<Input
			id={id}
			value={value}
			disabled={disabled}
			inputMode={row.kind === "integer" ? "numeric" : undefined}
			type={row.kind === "url" ? "url" : "text"}
			placeholder={row.kind === "url" ? "https://" : undefined}
			maxLength={row.kind === "integer" ? 2 : MAX_TEXT_LEN}
			className={row.kind === "gstin" ? "uppercase" : undefined}
			aria-required={original ? true : undefined}
			aria-invalid={error ? true : undefined}
			aria-describedby={describedBy}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}

/** What a section's form is doing. */
type FormState =
	| { mode: "view" }
	| {
			mode: "edit";
			draft: Record<string, string>;
			errors: Record<string, string>;
			saving: boolean;
			/** Whole-form failure from the server, shown above the buttons. */
			failure: string | null;
	  };

/**
 * A titled card of label/value pairs, editable in place when the CRM record is
 * loaded and the card has CRM rows.
 *
 * Saving sends only the fields whose value changed — so a field the partner
 * never touched (including a legacy picklist value) is never rewritten, and an
 * unchanged form makes no request at all.
 */
function DetailSection({
	title,
	rows,
	profile,
	crm,
	update,
}: {
	title: string;
	rows: ProfileField[];
	profile: Profile | null;
	crm: CrmLeadState;
	update: (changes: Record<string, unknown>) => Promise<void>;
}) {
	const baseId = useId();
	const [form, setForm] = useState<FormState>({ mode: "view" });
	const fields = crm.status === "ok" ? crm.fields : null;
	const crmRows = rows.filter((row) => row.saveTo?.crm);
	const canEdit = crm.status === "ok" && crmRows.length > 0;

	function startEdit() {
		const draft: Record<string, string> = {};
		for (const row of crmRows)
			draft[row.saveTo!.crm!] = rawText(fields, row.saveTo!.crm!);
		setForm({ mode: "edit", draft, errors: {}, saving: false, failure: null });
	}

	async function save() {
		if (form.mode !== "edit") return;
		const errors: Record<string, string> = {};
		const changed: Record<string, unknown> = {};
		for (const row of crmRows) {
			const name = row.saveTo!.crm!;
			const kind = row.kind;
			const value = normalise(kind, form.draft[name] ?? "");
			const original = rawText(fields, name);
			// A filled field may be overwritten with a valid value, never emptied.
			const error =
				original && !value
					? "This can't be left empty once filled in."
					: validate(kind, value);
			if (error) errors[name] = error;
			else if (value !== original) changed[name] = toPayload(kind, value);
		}
		if (Object.keys(errors).length > 0) {
			setForm({ ...form, errors, failure: null });
			return;
		}
		if (Object.keys(changed).length === 0) {
			setForm({ mode: "view" });
			return;
		}
		setForm({ ...form, errors: {}, saving: true, failure: null });
		try {
			await update(changed);
			setForm({ mode: "view" });
		} catch (error) {
			setForm({
				...form,
				errors: {},
				saving: false,
				failure: saveFailureMessage(error),
			});
		}
	}

	const editing = form.mode === "edit";
	const body = (
		<dl className="grid grid-cols-2 gap-x-4 gap-y-5">
			{rows.map((row) => {
				const id = `${baseId}-${row.key}`;
				const name = row.saveTo?.crm;
				let content: ReactNode;
				if (editing && name) {
					const error = form.errors[name] ?? null;
					content = (
						<>
							<FieldControl
								id={id}
								row={row}
								value={form.draft[name] ?? ""}
								original={rawText(fields, name)}
								options={crm.status === "ok" ? crm.picklists[name] : undefined}
								disabled={form.saving}
								error={error}
								onChange={(value) =>
									setForm({
										...form,
										draft: { ...form.draft, [name]: value },
									})
								}
							/>
							{error ? (
								<span id={`${id}-error`} className="text-xs text-destructive">
									{error}
								</span>
							) : null}
						</>
					);
				} else if (name) {
					content =
						crm.status === "loading" || crm.status === "idle" ? (
							<span className="text-muted-foreground">…</span>
						) : (
							((row.kind === "url"
								? websiteNode(crmText(fields, name))
								: crmText(fields, name)) ?? "—")
						);
				} else {
					content = row.read?.(profile) || "—";
				}
				return (
					<div key={row.key} className="flex min-w-0 flex-col gap-1">
						<dt className="text-sm text-muted-foreground">
							{editing && name ? (
								<label htmlFor={id}>{row.label}</label>
							) : (
								row.label
							)}
						</dt>
						<dd className="break-words text-sm font-medium">{content}</dd>
					</div>
				);
			})}
		</dl>
	);

	return (
		<section className="flex flex-col gap-4 rounded-lg border p-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-eko-navy">{title}</h3>
				{canEdit && !editing ? (
					<button
						type="button"
						onClick={startEdit}
						className="flex items-center gap-1.5 text-sm font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
						aria-label={`Edit ${title}`}
					>
						<SquarePen className="h-4 w-4" aria-hidden="true" />
						Edit
					</button>
				) : null}
			</div>
			{editing ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
					noValidate
					className="flex flex-col gap-4"
				>
					{body}
					{form.failure ? (
						<p role="alert" className="text-sm text-destructive">
							{form.failure}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={form.saving}
							onClick={() => setForm({ mode: "view" })}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={form.saving}>
							{form.saving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			) : (
				body
			)}
		</section>
	);
}

/**
 * Business, compliance and contact details — the login profile's own fields
 * alongside the partner's CRM Lead, the CRM ones editable in place.
 *
 * Profile-sourced rows render immediately and stay read-only (they belong to
 * the Eko profile, which this console does not write); CRM rows wait on one
 * `GET /crm/lead`. A CRM outage leaves the profile rows intact and says so
 * once, rather than blanking the page.
 */
export function BusinessDetails() {
	const me = useConsoleMe();
	const { state: crm, update } = useCrmLead();
	// Grouped from the shared config; the director row follows the business
	// type (see `directors.ts`), the same rule the Documents page asks by.
	const fields = profileFields(me.profile);
	const sections = PROFILE_SECTIONS.map((title) => ({
		title,
		rows: fields.filter((field) => field.section === title),
	}));

	// A fragment, not a wrapper: the cards are items of the page's own grid, so
	// they flow alongside the identity card and Manage My Account.
	return (
		<>
			{crm.status === "error" ? (
				<p role="status" className="col-span-full text-sm text-destructive">
					Couldn&apos;t load your business details from our records. Reload the
					page to try again.
				</p>
			) : null}
			{sections.map((section) => (
				<DetailSection
					key={section.title}
					{...section}
					profile={me.profile}
					crm={crm}
					update={update}
				/>
			))}
		</>
	);
}
