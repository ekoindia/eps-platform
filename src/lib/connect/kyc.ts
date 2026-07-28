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
	status: number;
	/** Upstream's own wording for `status`. Usually "". */
	statusDesc: string;
	/** Upstream's rejection reason, when it sends one. */
	error: string;
}

/** Badge variants, narrowed to what the document status pill uses. */
type StatusVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * `status` → how the row should read.
 *
 * UNCONFIRMED against a live account. The only payload we have is a freshly
 * issued list in which every document — uploaded or not — carries `status: 1`
 * with an empty `status_desc`, so 1 cannot mean "uploaded" and nothing in that
 * sample distinguishes the other codes. Rather than guess, this map claims only
 * what the sample supports and `statusOfDocument` treats everything else as
 * not-yet-uploaded: the failure mode is telling a user they still have work to
 * do when they don't, which they can act on, instead of telling them they are
 * finished when upstream disagrees, which they cannot.
 *
 * Widen this map — do not add heuristics elsewhere — once a real UAT account
 * shows what the codes mean.
 */
const DOCUMENT_STATUS: Record<
	number,
	{ label: string; variant: StatusVariant; uploaded: boolean }
> = {
	1: { label: "Not uploaded", variant: "outline", uploaded: false },
};

/** How an unrecognised `status` reads. Deliberately the same as "nothing yet". */
const UNKNOWN_STATUS = {
	label: "Not uploaded",
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
		documents.push({
			docType,
			name: str(row.name) || `Document ${docType}`,
			info: str(row.info),
			pages: parsePages(row.pages),
			status: Number(row.status ?? NaN),
			statusDesc: str(row.status_desc),
			error: str(row.error),
		});
	}
	return documents;
}

/**
 * How one document's status should read.
 *
 * Label prefers upstream's own wording — `error` first, since a rejection
 * reason is the most useful thing a row can say, then `status_desc` — and falls
 * back to the map. Same idiom as `statusOf` in `lib/console/transactions.ts`,
 * and for the same reason: one status code spans several upstream wordings.
 * @param doc - The document row.
 * @param justUploaded - Whether this session has uploaded it successfully since
 *   the list was fetched. Not optimism: it is set from an upstream success
 *   envelope, and it exists because `DOCUMENT_STATUS` cannot yet recognise the
 *   uploaded state on its own. It drops away on the next fetch.
 * @returns The label to show, the Badge variant to show it in, and whether the
 *   document counts as done.
 */
export function statusOfDocument(
	doc: KycDocument,
	justUploaded = false,
): { label: string; variant: StatusVariant; uploaded: boolean } {
	if (justUploaded) {
		return { label: "Uploaded", variant: "default", uploaded: true };
	}
	const mapped = DOCUMENT_STATUS[doc.status] ?? UNKNOWN_STATUS;
	if (doc.error) {
		return { label: doc.error, variant: "destructive", uploaded: false };
	}
	return { ...mapped, label: doc.statusDesc || mapped.label };
}

/**
 * Completion counts for the whole pack.
 * @param documents - Every document upstream listed.
 * @param uploadedNow - Doc types uploaded successfully in this session.
 * @returns How many are done out of how many there are.
 */
export function progressOf(
	documents: KycDocument[],
	uploadedNow: ReadonlySet<string> = new Set(),
): { uploaded: number; total: number } {
	const uploaded = documents.filter(
		(doc) => statusOfDocument(doc, uploadedNow.has(doc.docType)).uploaded,
	).length;
	return { uploaded, total: documents.length };
}
