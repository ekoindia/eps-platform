/**
 * Local, hand-maintained metadata for individual KYC document types.
 *
 * Upstream's document list (interaction 586) is shared across every Eko
 * product. It says what a document is called and how many files it takes, and
 * nothing at all about how it should be captured — whether a cheque may be
 * picked from disk, whether a "live" photograph must come from the camera, what
 * the second page of an Aadhaar card actually is. This module is where this
 * console records what it knows that the shared list cannot express.
 *
 * A config wins over upstream for every field it names, unconditionally. That
 * is the point: the entries exist to correct or enrich a generic list. The cost
 * is that an upstream rename is invisible once overridden, so keep this map
 * small and override only what is demonstrably wrong or missing.
 *
 * Capture metadata is consumed by `KycUploadDialog` via {@link configOf};
 * presentation fields are overlaid onto every parsed row by
 * {@link withDocConfig}, which `parseDocumentList` calls for us.
 */

import type { FileUploadOptions } from "@/components/FileUpload";
import type { WatermarkSpec } from "@/hooks/use-watermark";
import type { KycDocument } from "@/lib/connect/kyc";

/**
 * What a KYC document may be, matching the backend's allow-list exactly.
 *
 * The backend checks MIME *and* extension against `KYC_TYPES` in
 * `packages/eps-backend/src/http/connect.ts`, which is the authority. A
 * per-document `accept` may narrow this; widening it only moves the rejection
 * from the file picker to a 400.
 */
export const KYC_ACCEPT = "image/jpeg,image/png,application/pdf";

/** The backend's per-file ceiling, mirrored so the picker can refuse early. */
export const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** The backend's per-document file-count ceiling. Above it, every upload 400s. */
export const KYC_MAX_PAGES = 6;

/**
 * What this console knows about one document type, over and above upstream.
 *
 * Every field is optional and every field that is set replaces upstream's
 * value. Note the merge uses `??`, not `||`: `info: ""` is a deliberate
 * instruction to show no note at all, not an omission.
 */
export interface KycDocConfig {
	/** Replaces upstream's `name`. */
	name?: string;
	/** Replaces upstream's `info`. `""` deliberately blanks a note. */
	info?: string;
	/**
	 * Replaces upstream's page count, and so the number of files uploaded.
	 *
	 * This is a claim about upstream's contract rather than about presentation —
	 * the backend takes our count at face value and sends exactly that many files
	 * on. Use it only to correct a count upstream got wrong, never as a UI
	 * preference, and never above {@link KYC_MAX_PAGES}.
	 */
	pages?: number;
	/** What each page is, in order. Falls back to "Page 1", "Page 2", … */
	pageLabels?: string[];
	/** Narrows {@link KYC_ACCEPT} for this document, e.g. images only. */
	accept?: string;
	/** The camera as the only source: no file picker, no drag and drop. */
	cameraOnly?: boolean;
	/** Overrides the KYC default provenance stamp. See `useWatermarkText`. */
	watermark?: WatermarkSpec;
	/**
	 * Editing requirements for images of this document — crop ratio, size cap,
	 * face checks.
	 *
	 * `fileName` and `watermark` are excluded on purpose: the first is per-file,
	 * and the second would be a second watermark knob that `FileUpload` silently
	 * resolves in favour of the outer one.
	 *
	 * Never set `disableImageConfirm` on a document that needs provenance. It
	 * skips the editor, and the editor is where the watermark is burnt into the
	 * pixels — the capture would arrive unstamped.
	 */
	options?: Omit<FileUploadOptions, "fileName" | "watermark">;
	/**
	 * A tighter per-file size limit than {@link KYC_MAX_FILE_BYTES}.
	 *
	 * Only ever lower. Raising it past the backend's ceiling does not accept a
	 * larger file; it just spends the upload before the same rejection.
	 */
	maxBytes?: number;
}

/**
 * Per-`doc_type` overrides, keyed by upstream's own code.
 *
 * Deliberately sparse. A document type absent from here behaves exactly as
 * upstream describes it, which is what must happen when upstream adds a new one
 * tomorrow — an unknown code is not an error.
 *
 * MARK: Docs Config
 */
export const KYC_DOC_CONFIG: Record<string, KycDocConfig> = {
	// Two identical "Page 1 / Page 2" slots is how a user ends up attaching the
	// front twice and hearing about it a week later, at review.
	"1": { pageLabels: ["Aadhaar front", "Aadhaar back"] },

	// The live photograph. Upstream's name spells out the capture instructions
	// ("with Location Coordinates", and an `info` naming a third-party GPS camera
	// app) because upstream cannot enforce them. This console can: the camera is
	// the only source, a face has to be in frame, and the watermark carries the
	// coordinates — so the name goes back to naming the document.
	"24": {
		name: "Directors' Live Photograph",
		cameraOnly: true,
		watermark: true,
		options: { detectFace: true, minFaceCount: 1 },
	},
};

/** Frozen so a caller cannot mutate the fallback into every unknown document. */
const NO_CONFIG: KycDocConfig = Object.freeze({});

/**
 * What this console knows about a document type.
 * @param docType - Upstream's document-type code.
 * @returns The overrides for that type, or an empty config when there are none.
 */
export function configOf(docType: string): KycDocConfig {
	return KYC_DOC_CONFIG[docType] ?? NO_CONFIG;
}

/**
 * Overlays the local presentation overrides onto a parsed document.
 *
 * Capture metadata is deliberately not merged in: it belongs to the upload
 * dialog, which reads it straight from {@link configOf}, and copying it onto
 * every row would put fields on `KycDocument` that nothing rendering a row
 * needs.
 * @param doc - A document row as upstream described it.
 * @param config - The overrides to apply. Defaults to this document type's, and
 *   is only ever passed explicitly by tests exercising the merge itself.
 * @returns The row with any locally configured name, note or page count.
 */
export function withDocConfig(
	doc: KycDocument,
	config: KycDocConfig = configOf(doc.docType),
): KycDocument {
	return {
		...doc,
		name: config.name ?? doc.name,
		info: config.info ?? doc.info,
		pages: config.pages ?? doc.pages,
	};
}
