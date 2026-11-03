import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, authClient, type CrmLeadView } from "@/lib/auth/client";
import { profileCompanyType } from "@/lib/auth/identity";
import { SquarePen } from "lucide-react";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useEffect,
	useId,
	useState,
} from "react";

/**
 * The partner's CRM Lead, as the page sees it.
 *
 * `none` covers both deliberate 404s — the deployment has no Zoho credentials
 * (`CRM_DISABLED`) or the profile links no Lead (`NO_CRM_LEAD`). Neither is a
 * failure the partner can do anything about, so both render as empty fields
 * rather than an error, and neither offers editing: there is no record to write.
 */
type CrmState =
	| { status: "loading" }
	| {
			status: "ok";
			fields: Record<string, unknown>;
			picklists: Record<string, readonly string[]>;
	  }
	| { status: "none" }
	| { status: "error" };

/**
 * Fetches the CRM Lead once; a late answer after unmount is dropped. Returns a
 * setter too, so a save can replace the record without a second fetch.
 */
function useCrmLead(): [CrmState, Dispatch<SetStateAction<CrmState>>] {
	const [state, setState] = useState<CrmState>({ status: "loading" });
	useEffect(() => {
		let current = true;
		authClient
			.crmLead()
			.then(({ fields, picklists }) => {
				if (!current) return;
				setState(
					fields
						? { status: "ok", fields, picklists: picklists ?? {} }
						: { status: "none" },
				);
			})
			.catch((error: unknown) => {
				if (!current) return;
				const deliberate =
					error instanceof ApiError && error.httpStatus === 404;
				setState({ status: deliberate ? "none" : "error" });
			});
		return () => {
			current = false;
		};
	}, []);
	return [state, setState];
}

/**
 * The raw CRM value as an editable string — `""` for unset or non-scalar.
 * Kept unformatted (no digit grouping) because it is what an input shows.
 */
function rawText(fields: Record<string, unknown> | null, name: string): string {
	const value = fields?.[name];
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "string") return value.trim();
	return "";
}

/**
 * One CRM value as display text, or null.
 *
 * The record is Zoho's, untyped: picklists arrive as strings, numeric fields as
 * numbers, unset fields as null. Anything else (a lookup object, a multi-select
 * array) is not a field this page renders, and stringifying it would print
 * "[object Object]".
 */
function crmText(
	fields: Record<string, unknown> | null,
	name: string,
): string | null {
	const value = fields?.[name];
	if (typeof value === "number" && Number.isFinite(value)) {
		return value.toLocaleString("en-IN");
	}
	if (typeof value === "string" && value.trim()) return value.trim();
	return null;
}

/** An http(s) URL — the only kind this page will render as a link or save. */
const HTTP_URL = /^https?:\/\/\S+$/i;

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

/** GSTIN: state code, PAN, entity number, `Z`, checksum. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Zoho's `length` for the free-text Lead fields on this page. */
const MAX_TEXT_LEN = 255;

/**
 * How a CRM field is edited, and the rule a typed value must pass. Picklist
 * options are NOT here — they come from the backend with the record.
 */
type FieldKind = "picklist" | "text" | "gstin" | "url" | "integer";

/**
 * Checks one draft value's shape; returns an error message or null. Empty
 * passes here — whether empty is allowed depends on the field's current value,
 * which `save` checks.
 */
function validate(kind: FieldKind, value: string): string | null {
	if (!value) return null;
	if (kind === "integer" && !/^\d{1,2}$/.test(value)) {
		return "Enter a whole number up to 99.";
	}
	if (kind === "url" && !HTTP_URL.test(value)) {
		return "Enter a full address starting with https://";
	}
	if (kind === "gstin" && !GSTIN.test(value)) {
		return "Enter a valid 15-character GSTIN.";
	}
	if (value.length > MAX_TEXT_LEN) {
		return `Keep this under ${MAX_TEXT_LEN} characters.`;
	}
	return null;
}

/** Normalises a draft value the way it should be stored. */
function normalise(kind: FieldKind, value: string): string {
	const trimmed = value.trim();
	return kind === "gstin" ? trimmed.toUpperCase() : trimmed;
}

/**
 * The draft value as Zoho should receive it: an integer field sends a number.
 * Never called with `""` — an empty draft is either unchanged (field was
 * already empty) or refused (field was filled), so nothing is ever cleared.
 */
function toPayload(kind: FieldKind, value: string): unknown {
	return kind === "integer" ? Number(value) : value;
}

/**
 * One labelled row. A row with `crmField` reads from — and, in edit mode,
 * writes to — that Lead field; a row without one shows `value` read-only.
 */
interface DetailRow {
	label: string;
	/** Profile-sourced value. Ignored when `crmField` is set. */
	value?: ReactNode;
	/** Zoho `api_name` this row shows and edits. */
	crmField?: string;
	kind?: FieldKind;
}

/** Shared look for the native select, matching the signup form's. */
const SELECT_CLASS =
	"h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50";

/**
 * The control for one CRM field in edit mode.
 *
 * A picklist offers the backend's options. If the record already holds a value
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
	row: DetailRow;
	value: string;
	original: string;
	options: readonly string[] | undefined;
	disabled: boolean;
	error: string | null;
	onChange: (value: string) => void;
}) {
	const describedBy = error ? `${id}-error` : undefined;
	if (row.kind === "picklist") {
		const choices =
			original && !options?.includes(original)
				? [original, ...(options ?? [])]
				: (options ?? []);
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
	crm,
	onSaved,
}: {
	title: string;
	rows: DetailRow[];
	crm: CrmState;
	onSaved: (view: CrmLeadView, sent: Record<string, unknown>) => void;
}) {
	const baseId = useId();
	const [form, setForm] = useState<FormState>({ mode: "view" });
	const fields = crm.status === "ok" ? crm.fields : null;
	const crmRows = rows.filter((row) => row.crmField);
	const canEdit = crm.status === "ok" && crmRows.length > 0;

	function startEdit() {
		const draft: Record<string, string> = {};
		for (const row of crmRows)
			draft[row.crmField!] = rawText(fields, row.crmField!);
		setForm({ mode: "edit", draft, errors: {}, saving: false, failure: null });
	}

	async function save() {
		if (form.mode !== "edit") return;
		const errors: Record<string, string> = {};
		const changed: Record<string, unknown> = {};
		for (const row of crmRows) {
			const name = row.crmField!;
			const kind = row.kind ?? "text";
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
			const view = await authClient.updateCrmLead(changed);
			onSaved(view, changed);
			setForm({ mode: "view" });
		} catch (error) {
			// A 400 names the field in plain words (the backend writes them for
			// this console); anything else is the CRM being unreachable.
			const failure =
				error instanceof ApiError && error.httpStatus === 400
					? error.message
					: "Couldn't save to our records. Please try again shortly.";
			setForm({ ...form, errors: {}, saving: false, failure });
		}
	}

	const editing = form.mode === "edit";
	const body = (
		<dl className="grid grid-cols-2 gap-x-4 gap-y-5">
			{rows.map((row) => {
				const id = `${baseId}-${row.crmField ?? row.label}`;
				const name = row.crmField;
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
						crm.status === "loading" ? (
							<span className="text-muted-foreground">…</span>
						) : (
							((row.kind === "url"
								? websiteNode(crmText(fields, name))
								: crmText(fields, name)) ?? "—")
						);
				} else {
					content = row.value ?? "—";
				}
				return (
					<div key={row.label} className="flex min-w-0 flex-col gap-1">
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
	const [crm, setCrm] = useCrmLead();

	/**
	 * Adopts the server's re-read record. When the write landed but the
	 * read-back failed (`fields: null`), the save still succeeded, so the values
	 * just sent are merged into what the page already had.
	 */
	function onSaved(view: CrmLeadView, sent: Record<string, unknown>) {
		// Functional update: two cards saved back to back must not each start
		// from the record as it was before the other's save.
		setCrm((prev) =>
			prev.status === "ok"
				? {
						status: "ok",
						fields: view.fields ?? { ...prev.fields, ...sent },
						picklists: view.picklists ?? prev.picklists,
					}
				: prev,
		);
	}

	const sections: { title: string; rows: DetailRow[] }[] = [
		{
			title: "Business Profile",
			rows: [
				{ label: "Company Type", value: profileCompanyType(me.profile) },
				{ label: "Industry", crmField: "Industry", kind: "picklist" },
				{
					label: "Annual Turnover",
					crmField: "Annual_Turnover",
					kind: "picklist",
				},
				{
					label: "Employees",
					crmField: "Number_of_Employees",
					kind: "picklist",
				},
				{ label: "Clients", crmField: "Number_of_Clients", kind: "picklist" },
			],
		},
		{
			title: "Legal & Compliance",
			rows: [
				{ label: "GST Number", crmField: "GST_No", kind: "gstin" },
				{
					label: "Number of Directors",
					crmField: "Count_of_Directors",
					kind: "integer",
				},
				{
					label: "Authorized Signatory",
					crmField: "Authorized_Signatory_Full_name",
				},
			],
		},
		{
			title: "Contact & Online Presence",
			rows: [
				{ label: "Email", value: me.profile?.email?.trim() || null },
				{ label: "Website", crmField: "Website", kind: "url" },
				{ label: "Mobile App", crmField: "Mobile_App_Name" },
			],
		},
	];

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
					crm={crm}
					onSaved={onSaved}
				/>
			))}
		</>
	);
}
