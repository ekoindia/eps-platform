import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import {
	KYC_LIST_ID,
	KYC_UPLOAD_ID,
	kycEnabled,
	parseDocumentList,
	statusOfDocument,
	type KycDocument,
} from "@/lib/connect/kyc";
import { describe, expect, it } from "vitest";

const SAMPLE_LIST = KYC_DOCUMENTS_SAMPLE.data.document_list;

/** A minimal row, overridable per test. */
function doc(overrides: Partial<KycDocument> = {}): KycDocument {
	return {
		docType: "1",
		name: "Aadhaar Card",
		info: "",
		pages: 1,
		status: 0,
		statusDesc: "",
		error: "",
		...overrides,
	};
}

/** An interaction list carrying exactly the given ids. */
function listOf(...ids: number[]) {
	return Object.fromEntries(ids.map((id) => [String(id), { id }]));
}

describe("kycEnabled", () => {
	it("needs both the list and the upload interaction", () => {
		expect(kycEnabled(listOf(KYC_LIST_ID, KYC_UPLOAD_ID))).toBe(true);
	});

	it("refuses a user who can list but not upload", () => {
		expect(kycEnabled(listOf(KYC_LIST_ID))).toBe(false);
	});

	it("refuses a user who can upload but not list", () => {
		expect(kycEnabled(listOf(KYC_UPLOAD_ID))).toBe(false);
	});

	it("refuses an unrelated entitlement", () => {
		expect(kycEnabled(listOf(491, 240))).toBe(false);
	});
});

describe("parseDocumentList", () => {
	it("reads the sample response", () => {
		const documents = parseDocumentList(SAMPLE_LIST);

		expect(documents).toHaveLength(5);
		expect(documents[0]).toEqual({
			docType: "1",
			name: "Aadhaar Card",
			info: "Director's Aadhaar Card",
			pages: 2,
			status: 0,
			statusDesc: "",
			error: "",
		});
		expect(documents.map((d) => d.docType)).toEqual([
			"1",
			"15",
			"12",
			"7",
			"13",
		]);
	});

	it("overlays this console's own overrides", async () => {
		// The merge itself is covered in kyc-docs.test; what matters here is that
		// parsing runs it at all, which is what keeps the dev bench and the console
		// showing the same thing. Stubbed, because the shipped map deliberately
		// overrides no presentation field yet and an unrun merge would be invisible.
		vi.doMock("@/lib/connect/kyc-docs", async (orig) => ({
			...(await orig<typeof import("@/lib/connect/kyc-docs")>()),
			withDocConfig: (row: KycDocument) => ({
				...row,
				name: `overlaid ${row.name}`,
			}),
		}));
		vi.resetModules();
		try {
			const { parseDocumentList: parseWithStub } =
				await import("@/lib/connect/kyc");

			expect(parseWithStub([{ doc_type: "9", name: "Upstream" }])[0].name).toBe(
				"overlaid Upstream",
			);
		} finally {
			vi.doUnmock("@/lib/connect/kyc-docs");
			vi.resetModules();
		}
	});

	it("treats an optional document exactly like a required one", () => {
		const documents = parseDocumentList(SAMPLE_LIST);
		const required = documents.find((d) => d.docType === "1");
		const optional = documents.find((d) => d.docType === "13");

		// `is_required` is 1 and 0 respectively upstream; nothing survives parsing
		// that could tell the two apart.
		expect(Object.keys(required!)).toEqual(Object.keys(optional!));
		expect(JSON.stringify(required)).not.toContain("required");
	});

	it("falls back to one page for an unusable count", () => {
		for (const pages of ["", "0", "N/A", null, undefined, "abc"]) {
			expect(parseDocumentList([{ doc_type: "1", pages }])[0].pages).toBe(1);
		}
	});

	it("takes the low end of a range", () => {
		expect(parseDocumentList([{ doc_type: "1", pages: "1-2" }])[0].pages).toBe(
			1,
		);
	});

	it("accepts a numeric page count", () => {
		expect(parseDocumentList([{ doc_type: "1", pages: 3 }])[0].pages).toBe(3);
	});

	it("drops rows with no doc_type, which could never be uploaded", () => {
		const documents = parseDocumentList([
			{ doc_type: "", name: "Nameless" },
			{ name: "Missing" },
			{ doc_type: "9", name: "Fine" },
		]);

		expect(documents.map((d) => d.name)).toEqual(["Fine"]);
	});

	it("survives junk", () => {
		expect(parseDocumentList(null)).toEqual([]);
		expect(parseDocumentList("nope")).toEqual([]);
		expect(parseDocumentList([null, 4, "x"])).toEqual([]);
	});

	it("names a document upstream forgot to name", () => {
		expect(parseDocumentList([{ doc_type: "77" }])[0].name).toBe("Document 77");
	});
});

describe("statusOfDocument", () => {
	it("does not claim a document is uploaded at status 0", () => {
		// Every row in the sample carries status 0 while still needing an upload,
		// so 0 must never read as done.
		expect(statusOfDocument(doc({ status: 0 })).uploaded).toBe(false);
	});

	it("treats an unrecognised status as not uploaded, and still uploadable", () => {
		const status = statusOfDocument(doc({ status: 42 }));

		expect(status.uploaded).toBe(false);
		expect(status.variant).toBe("outline");
		expect(status.desc).toBeUndefined();
		// An empty label is the signal to render no pill.
		expect(status.label).toBe("");
		// An unknown code must not strand a partner on a row they cannot act on.
		expect(status.canUpload).toBe(true);
	});

	it("prefers upstream's own wording", () => {
		expect(statusOfDocument(doc({ statusDesc: "Under review" })).label).toBe(
			"Under review",
		);
	});

	it("keeps the mapped tooltip even when the label is upstream's", () => {
		// The pill can wear a terse upstream string; the tooltip still has to say
		// what happens next.
		const status = statusOfDocument(doc({ status: 1, statusDesc: "In queue" }));

		expect(status.label).toBe("In queue");
		expect(status.desc).toBe("Document uploaded, waiting for review");
	});

	it("reads status 1 as uploaded, awaiting approval, and not re-uploadable", () => {
		// Replacing a file mid-review sends the reviewer a second document
		// against a decision they have already started.
		expect(statusOfDocument(doc({ status: 1 }))).toEqual({
			label: "Approval Pending",
			variant: "secondary",
			uploaded: true,
			canUpload: false,
			desc: "Document uploaded, waiting for review",
		});
	});

	it("reads status 2 as uploaded, approved, and not re-uploadable", () => {
		expect(statusOfDocument(doc({ status: 2 }))).toEqual({
			label: "Uploaded",
			variant: "default",
			uploaded: true,
			canUpload: false,
			desc: "Document uploaded and approved",
		});
	});

	it("keeps a pending document uploadable", () => {
		expect(statusOfDocument(doc({ status: 0 })).canUpload).toBe(true);
	});

	it("surfaces a rejection reason, in red, at status 3", () => {
		const status = statusOfDocument(doc({ status: 3, error: "Blurred scan" }));

		expect(status).toEqual({
			label: "Blurred scan",
			variant: "destructive",
			uploaded: false,
			canUpload: true,
			desc: "Document rejected, requires resubmission",
		});
	});

	it("falls back to status_desc at status 3 when there is no error text", () => {
		const status = statusOfDocument(
			doc({ status: 3, statusDesc: "Photo unclear" }),
		);

		expect(status.label).toBe("Photo unclear");
		expect(status.variant).toBe("destructive");
	});

	it("falls back to a generic label at status 3 when upstream sends neither", () => {
		const status = statusOfDocument(doc({ status: 3 }));

		expect(status).toEqual({
			label: "Resubmission needed",
			variant: "destructive",
			uploaded: false,
			canUpload: true,
			desc: "Document rejected, requires resubmission",
		});
	});

	it("surfaces a rejection reason at status 4 too", () => {
		// 4 is refused outright rather than resubmittable, and reads the same way:
		// upstream's own reason first, in red.
		const status = statusOfDocument(
			doc({ status: 4, error: "Not a director" }),
		);

		expect(status).toEqual({
			label: "Not a director",
			variant: "destructive",
			uploaded: false,
			canUpload: true,
			desc: "Document rejected",
		});
	});

	it("does not read a stray error as a rejection on an accepted status", () => {
		// error only means something once the status itself says refused.
		const status = statusOfDocument(doc({ status: 1, error: "Blurred scan" }));

		expect(status.variant).not.toBe("destructive");
		expect(status.label).toBe("Approval Pending");
	});

	it("shows a document uploaded in this session as awaiting approval", () => {
		// The optimistic overlay reads as 1, not 2: this console handed the file
		// over, it did not approve it.
		expect(statusOfDocument(doc({ status: 0 }), true)).toEqual({
			label: "Approval Pending",
			variant: "secondary",
			uploaded: true,
			canUpload: false,
			desc: "Document uploaded, waiting for review",
		});
	});

	it("yields to a refetch that already reports the document approved", () => {
		// The overlay only fills the gap before upstream catches up; once it has,
		// a stale "Approval Pending" would hide an approval that already happened.
		expect(statusOfDocument(doc({ status: 2 }), true).label).toBe("Uploaded");
	});
});
