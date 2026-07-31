/**
 * KYC document upload — types and pure logic.
 *
 * Two upstream transactions back this feature, and the ids below are two
 * different numbering schemes that happen to sit side by side in one payload:
 * the `*_ID` constants are the *interaction* ids that appear in the
 * `/transactions/wlc` list and gate the feature, while the `*_TYPE` constants
 * are the `interaction_type_id` values that go in the request body. They are
 * not interchangeable — see `buildRoleTransactionList` in `interactions.ts` for
 * why the list is keyed by the former.
 *
 * Everything here is presentation-agnostic and directly testable; the page is
 * JSX over these functions.
 */

import type { RoleTransactionList } from "@/lib/connect/interactions";
import { withDocConfig } from "@/lib/connect/kyc-docs";

/** Interaction id for "fetch the required document list". Gates the feature. */
export const KYC_LIST_ID = 586;

/** Interaction id for "upload a document". Gates the feature. */
export const KYC_UPLOAD_ID = 587;

/** `interaction_type_id` sent to `/transactions/do` to fetch the list. */
export const KYC_LIST_TYPE = 539;

/** `interaction_type_id` sent to `/transactions/upload` to upload a document. */
export const KYC_UPLOAD_TYPE = 523;

/**
 * One row of the 586 response's `document_list`.
 *
 * `is_required` is deliberately NOT carried across. Upstream marks some
 * documents optional, but this console treats every listed document as
 * mandatory — a partial KYC pack only comes back as a rejection later, so
 * offering "optional" is offering a way to fail slowly. Dropping the field here
 * rather than ignoring it at the call sites means no component can accidentally
 * start branching on it.
 */
export interface KycDocument {
	/** Upstream document-type code, e.g. `"1"` for Aadhaar. The upload key. */
	docType: string;
	name: string;
	/** Upstream's own clarifying note, e.g. "Director's Aadhaar Card". Often "". */
	info: string;
	/** How many files this document takes. Always >= 1; see `parseDocumentList`. */
	pages: number;
	/** Confirmed against a live UAT account: 1 pending, 2 uploaded/approved, 3 needs resubmission. */
	status: number;
	/** Upstream's own wording for `status`. Usually "". */
	statusDesc: string;
	/** Upstream's rejection reason, when it sends one. Only meaningful at status 3. */
	error: string;
}

/** Badge variants, narrowed to what the document status pill uses. */
type StatusVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * `status` → how the row should read. Confirmed against a live UAT account:
 * 1 pending upload, 2 uploaded and approved, 3 needs resubmission.
 *
 * 1 keeps an empty label — the Upload button next to a pending row already
 * says "not uploaded", so a matching pill would be redundant. 3's label here
 * is only the fallback; `statusOfDocument` prefers upstream's own `error` or
 * `status_desc` text when either is present.
 */
const DOCUMENT_STATUS: Record<
	number,
	{ label: string; variant: StatusVariant; uploaded: boolean }
> = {
	1: { label: "", variant: "outline", uploaded: false },
	2: { label: "Uploaded", variant: "default", uploaded: true },
	3: { label: "Resubmission needed", variant: "destructive", uploaded: false },
};

/** How an unrecognised `status` reads. Deliberately the same as "nothing yet". */
const UNKNOWN_STATUS = {
	label: "",
	variant: "outline" as StatusVariant,
	uploaded: false,
};

/**
 * Whether this user may run the KYC document flow.
 *
 * Requires BOTH interactions. An account entitled to read the list but not to
 * upload would get a page whose every button fails upstream, which reads as a
 * broken console rather than an unavailable feature.
 * @param list - The caller's interaction list.
 * @returns True when the user can both list and upload documents.
 */
export function kycEnabled(list: RoleTransactionList): boolean {
	return Boolean(list[String(KYC_LIST_ID)] && list[String(KYC_UPLOAD_ID)]);
}

/**
 * Reads a `pages` value that arrives as a string.
 *
 * Falls back to 1 for anything that is not a positive integer — `""`, `"0"`,
 * `"N/A"`, a range like `"1-2"`, or an absent field. A document that asks for
 * zero (or an unparseable number of) files could never be submitted at all, so
 * the fallback is the difference between a usable row and a dead one. A range
 * takes its LOW end for the same reason: asking for too few files fails at
 * review, asking for too many blocks the upload outright.
 * @param raw - The upstream `pages` field, of unknown type.
 * @returns A page count of at least 1.
 */
function parsePages(raw: unknown): number {
	const first = String(raw ?? "").match(/\d+/)?.[0];
	const parsed = Number(first);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Reads an upstream field that may arrive as a string, a number or not at all. */
function str(value: unknown): string {
	return value === undefined || value === null ? "" : String(value).trim();
}

/**
 * Normalizes the 586 response's `document_list` into rows the page can render.
 *
 * Tolerant by design: the sample response is the only payload we have, upstream
 * sends numbers and numeric strings interchangeably across sibling fields, and a
 * single malformed row should cost that row, not the page. Rows without a
 * `doc_type` are dropped — that field is the upload key, so a row missing it
 * could be listed but never submitted.
 *
 * Rows are normalized *and* overlaid: `withDocConfig` applies this console's own
 * overrides for the document types it knows about. Merging here rather than at
 * each call site is what stops the dev bench and the console from drifting apart
 * — see `kyc-docs.ts`.
 * @param raw - The `document_list` array, of unknown shape.
 * @returns The documents, in upstream's order.
 */
export function parseDocumentList(raw: unknown): KycDocument[] {
	if (!Array.isArray(raw)) return [];
	const documents: KycDocument[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const docType = str(row.doc_type);
		if (!docType) continue;
		documents.push(
			withDocConfig({
				docType,
				name: str(row.name) || `Document ${docType}`,
				info: str(row.info),
				pages: parsePages(row.pages),
				status: Number(row.status ?? NaN),
				statusDesc: str(row.status_desc),
				error: str(row.error),
			}),
		);
	}
	return documents;
}

/**
 * How one document's status should read.
 *
 * At status 3 (needs resubmission), the label prefers upstream's own
 * wording — `error` first, since a rejection reason is the most useful thing
 * a row can say, then `status_desc` — and falls back to the map's generic
 * "Resubmission needed". Every other status prefers `status_desc` over the
 * map. Same idiom as `statusOf` in `lib/console/transactions.ts`, and for the
 * same reason: one status code spans several upstream wordings.
 * @param doc - The document row.
 * @param justUploaded - Whether this session has uploaded it successfully since
 *   the list was fetched. Set from an upstream success envelope; it is an
 *   optimistic overlay for the gap between that envelope and the refetch that
 *   follows it, not a stand-in for `status` — it drops away on the next fetch,
 *   by which point upstream's own `status: 2` reports the same thing.
 * @returns The label to show, the Badge variant to show it in, and whether the
 *   document counts as done. An empty label means upstream has nothing to say
 *   about this document yet — the row shows no pill, since "not uploaded" is
 *   already what an Upload button next to a listed document means.
 */
export function statusOfDocument(
	doc: KycDocument,
	justUploaded = false,
): { label: string; variant: StatusVariant; uploaded: boolean } {
	if (justUploaded) {
		return { label: "Uploaded", variant: "default", uploaded: true };
	}
	const mapped = DOCUMENT_STATUS[doc.status] ?? UNKNOWN_STATUS;
	const label =
		doc.status === 3
			? doc.error || doc.statusDesc || mapped.label
			: doc.statusDesc || mapped.label;
	return { ...mapped, label };
}
