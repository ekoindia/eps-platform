import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import Documents from "@/pages/console/Documents";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked at the module boundary, per repo convention — never `fetch`.
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: {
		connectKyc: { documents: vi.fn(), upload: vi.fn() },
	},
}));

// The rail's entitlement hook has its own coverage in ConsoleLayout.nav.test;
// here it is the switch under test, so it is driven directly.
const kycEnabled = vi.fn();
vi.mock("@/lib/connect/use-kyc", () => ({
	useKycEnabled: () => kycEnabled(),
}));

// The e-sign entitlement, same treatment: the page only reads it to decide
// whether the approved callout carries a link, and the real hook would reach
// for an `authClient` method this file's mock deliberately does not have.
const esignEntitlement = vi.fn();
vi.mock("@/lib/connect/use-interactions", () => ({
	useRoleTransactionList: () => esignEntitlement(),
}));

// The dialog pulls in the camera and image editor; this page's tests are about
// the list, and the dialog has the bench for its own exercise. The extra
// button lets tests drive `onClose` the way a real upload success would.
vi.mock("@/components/console/KycUploadDialog", () => ({
	KycUploadDialog: ({
		doc,
		onClose,
	}: {
		doc: { docType: string; name: string } | null;
		onClose: (result: { docType: string; message: string } | null) => void;
	}) =>
		doc ? (
			<div data-testid="upload-dialog">
				{doc.name}
				<button
					onClick={() => onClose({ docType: doc.docType, message: "Uploaded" })}
				>
					simulate-upload-success
				</button>
			</div>
		) : null,
}));

const { KYC_POLL_MS } = await import("@/lib/connect/kyc");
const { authClient } = await import("@/lib/auth/client");
const fetchDocuments = vi.mocked(authClient.connectKyc.documents);

beforeEach(() => {
	kycEnabled.mockReset().mockReturnValue(true);
	esignEntitlement.mockReset().mockReturnValue(null);
	fetchDocuments.mockReset().mockResolvedValue({
		documents: [...KYC_DOCUMENTS_SAMPLE.data.document_list],
	});
});

describe("Documents", () => {
	it("lists every document upstream returned", async () => {
		render(<Documents />);

		expect(await screen.findByText("Aadhaar Card")).toBeVisible();
		for (const name of [
			"Director PAN Card",
			"Company Registration certificate",
			"Bank statement",
			"Blank Check",
		]) {
			expect(screen.getByText(name)).toBeVisible();
		}
	});

	it("offers no way to tell an optional document from a required one", async () => {
		render(<Documents />);
		await screen.findByText("Aadhaar Card");

		// "Blank Check" is `is_required: 0` upstream and must read like the rest.
		expect(screen.queryByText(/optional/i)).toBeNull();
		expect(screen.getAllByRole("button", { name: "Upload" })).toHaveLength(5);
	});

	it("shows upstream's own note, and never a page count", async () => {
		render(<Documents />);

		expect(await screen.findByText("Director's Aadhaar Card")).toBeVisible();
		// The dialog asks for the pages; the list does not advertise them.
		expect(screen.queryByText(/\d+ pages?/)).toBeNull();
	});

	it("counts what is still outstanding, not what is done", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) =>
				d.doc_type === "1" ? { ...d, status: 2 } : d,
			),
		});

		render(<Documents />);

		// The approved one is listed but not owed.
		expect(await screen.findByText("4 of 5 documents pending")).toBeVisible();
		// Work is still owed, so the header still asks for it.
		expect(screen.getByText(/Upload the documents we need/i)).toBeVisible();
	});

	it("stops asking for uploads once every document is under review", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) => ({
				...d,
				status: 1,
			})),
		});

		render(<Documents />);

		// The callout below says this better than the header subtitle did, so the
		// subtitle stands down rather than saying it twice.
		expect(await screen.findByText(/Documents received/i)).toBeVisible();
		expect(screen.getByText(/up to 3 hours on working days/i)).toBeVisible();
		expect(screen.queryByText(/Please wait while we verify/i)).toBeNull();
		expect(screen.queryByText(/Upload the documents we need/i)).toBeNull();
		// Nothing to act on, so nothing to click either.
		expect(
			screen.queryByRole("button", { name: /upload|retry|capture/i }),
		).toBeNull();
	});

	it("says so plainly when nothing is left to upload", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) => ({
				...d,
				status: 2,
			})),
		});

		render(<Documents />);

		expect(await screen.findByText("All documents uploaded")).toBeVisible();
	});

	it("refuses the page, and fires no request, without the entitlement", async () => {
		kycEnabled.mockReturnValue(false);

		render(<Documents />);

		expect(
			await screen.findByText(/isn't available on this account/i),
		).toBeVisible();
		expect(fetchDocuments).not.toHaveBeenCalled();
	});

	it("waits rather than refusing while the entitlement is unresolved", async () => {
		kycEnabled.mockReturnValue(null);

		render(<Documents />);

		expect(screen.getByTestId("documents-loading")).toBeVisible();
		expect(screen.queryByText(/isn't available/i)).toBeNull();
		expect(fetchDocuments).not.toHaveBeenCalled();
	});

	it("surfaces a failed fetch", async () => {
		fetchDocuments.mockRejectedValue(new Error("boom"));

		render(<Documents />);

		expect(
			await screen.findByText(/couldn't load your documents/i),
		).toBeVisible();
	});

	it("reassures rather than alarms when there is nothing to upload", async () => {
		fetchDocuments.mockResolvedValue({ documents: [] });

		render(<Documents />);

		// The common case for a live account, so it must not read as a failure.
		expect(
			await screen.findByText(/no pending documents at this time/i),
		).toBeVisible();
		expect(screen.getByText(/pending verification/i)).toBeVisible();
	});

	it("opens the dialog for the document that was clicked", async () => {
		render(<Documents />);
		await screen.findByText("Aadhaar Card");

		// Second row by the list's own order — every sample row is status 0, so
		// that is `doc_type` 7, not upstream's second entry. See `parseDocumentList`.
		screen.getAllByRole("button", { name: "Upload" })[1].click();

		await waitFor(() =>
			expect(screen.getByTestId("upload-dialog")).toHaveTextContent(
				"Bank statement",
			),
		);
	});

	it("keeps the row locked when the post-upload refetch lands stale", async () => {
		// The refetch a successful upload triggers is not guaranteed to already
		// reflect the write it's chasing — upstream may still report `status: 0`
		// for a moment. `uploadedNow` must survive that redraw rather than let a
		// stale read hand the Upload button back.
		fetchDocuments.mockResolvedValueOnce({
			documents: [...KYC_DOCUMENTS_SAMPLE.data.document_list],
		});
		fetchDocuments.mockResolvedValueOnce({
			documents: [...KYC_DOCUMENTS_SAMPLE.data.document_list],
		});

		render(<Documents />);
		await screen.findByText("Aadhaar Card");
		screen.getAllByRole("button", { name: "Upload" })[0].click();
		await screen.findByTestId("upload-dialog");
		screen.getByText("simulate-upload-success").click();

		await waitFor(() => expect(fetchDocuments).toHaveBeenCalledTimes(2));
		expect(await screen.findByText("Approval Pending")).toBeVisible();
		// One row less to act on: the uploaded one no longer offers a button.
		expect(screen.getAllByRole("button", { name: "Upload" })).toHaveLength(4);
	});

	it("locks the row once the refetch itself reports an approved status", async () => {
		fetchDocuments.mockResolvedValueOnce({
			documents: [...KYC_DOCUMENTS_SAMPLE.data.document_list],
		});
		fetchDocuments.mockResolvedValueOnce({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) =>
				d.doc_type === "1" ? { ...d, status: 2 } : d,
			),
		});

		render(<Documents />);
		await screen.findByText("Aadhaar Card");
		screen.getAllByRole("button", { name: "Upload" })[0].click();
		await screen.findByTestId("upload-dialog");
		screen.getByText("simulate-upload-success").click();

		await waitFor(() => expect(fetchDocuments).toHaveBeenCalledTimes(2));
		expect(await screen.findByText("Uploaded")).toBeVisible();
		expect(screen.getAllByRole("button", { name: "Upload" })).toHaveLength(4);
	});

	it("explains an uploaded document's status in a tooltip", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) =>
				d.doc_type === "1" ? { ...d, status: 1 } : d,
			),
		});

		render(<Documents />);
		const pill = await screen.findByText("Approval Pending");

		// Radix opens on focus as well as hover, which is the path a keyboard user
		// takes and the one jsdom can actually drive.
		fireEvent.focus(pill.closest("[data-state]")!);

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Document uploaded, waiting for review",
		);
	});

	it("offers Retry, not Upload, once upstream reports resubmission needed", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) =>
				d.doc_type === "1" ? { ...d, status: 3, error: "Blurred scan" } : d,
			),
		});

		render(<Documents />);
		await screen.findByText("Aadhaar Card");

		expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
		expect(screen.getByText("Blurred scan")).toBeVisible();
	});

	it("says Capture on a camera-only document, never Upload", async () => {
		// doc_type 24 is the live photograph: `cameraOnly` in `kyc-docs.ts`, so
		// there is no file to "upload" and the button says what the tap does.
		const [first, ...rest] = KYC_DOCUMENTS_SAMPLE.data.document_list;
		fetchDocuments.mockResolvedValue({
			documents: [{ ...first, doc_type: "24" }, ...rest],
		});

		render(<Documents />);

		expect(
			await screen.findByRole("button", { name: "Capture" }),
		).toBeVisible();
	});

	it("says Capture Again once a camera-only document was rejected", async () => {
		const [first, ...rest] = KYC_DOCUMENTS_SAMPLE.data.document_list;
		fetchDocuments.mockResolvedValue({
			documents: [
				{ ...first, doc_type: "24", status: 3, error: "Too dark" },
				...rest,
			],
		});

		render(<Documents />);

		expect(
			await screen.findByRole("button", { name: "Capture Again" }),
		).toBeVisible();
		expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
	});

	/** Runs `body` on fake timers, always restoring real ones. */
	const withFakeTimers = async (body: () => Promise<void>) => {
		vi.useFakeTimers();
		try {
			await body();
		} finally {
			vi.useRealTimers();
		}
	};

	/** Advances fake time inside `act`, so the resulting effects flush first. */
	const tick = (ms: number) =>
		act(async () => {
			await vi.advanceTimersByTimeAsync(ms);
		});

	/** The sample pack, every row forced to one status. */
	const packAt = (status: number) =>
		KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) => ({ ...d, status }));

	it("re-asks upstream while the pack sits with the reviewer", async () => {
		await withFakeTimers(async () => {
			fetchDocuments.mockResolvedValue({ documents: packAt(1) });
			render(<Documents />);
			await tick(0);
			expect(fetchDocuments).toHaveBeenCalledTimes(1);

			await tick(KYC_POLL_MS);

			expect(fetchDocuments).toHaveBeenCalledTimes(2);
			// A background refresh must not replace what the partner is reading with
			// four grey bars.
			expect(screen.queryByTestId("documents-loading")).toBeNull();
			expect(screen.getByText("Aadhaar Card")).toBeVisible();
		});
	});

	it("fires no timer while a document is still owed", async () => {
		await withFakeTimers(async () => {
			const [first, ...rest] = packAt(1);
			fetchDocuments.mockResolvedValue({
				documents: [{ ...first, status: 0 }, ...rest],
			});
			render(<Documents />);
			await tick(0);

			await tick(KYC_POLL_MS * 2);

			expect(fetchDocuments).toHaveBeenCalledTimes(1);
			expect(screen.queryByText(/Documents received/i)).toBeNull();
		});
	});

	it("stops asking once the decision has come back", async () => {
		await withFakeTimers(async () => {
			fetchDocuments
				.mockResolvedValueOnce({ documents: packAt(1) })
				.mockResolvedValue({ documents: packAt(2) });
			render(<Documents />);
			await tick(0);

			await tick(KYC_POLL_MS);
			expect(fetchDocuments).toHaveBeenCalledTimes(2);
			// Approved is a settled answer; there is nothing left to ask about.
			await tick(KYC_POLL_MS * 2);

			expect(fetchDocuments).toHaveBeenCalledTimes(2);
			expect(screen.getByText(/Documents approved/i)).toBeVisible();
		});
	});

	it("keeps the list on screen when a background refresh fails", async () => {
		await withFakeTimers(async () => {
			fetchDocuments
				.mockResolvedValueOnce({ documents: packAt(1) })
				.mockRejectedValueOnce(new Error("upstream down"))
				.mockResolvedValue({ documents: packAt(2) });
			render(<Documents />);
			await tick(0);

			await tick(KYC_POLL_MS);

			expect(screen.getByText("Aadhaar Card")).toBeVisible();
			expect(screen.queryByRole("alert")).toBeNull();

			// And the poll that follows it recovers.
			await tick(KYC_POLL_MS);
			expect(screen.getByText(/Documents approved/i)).toBeVisible();
		});
	});

	it("points an approved pack at the signature it still owes", async () => {
		esignEntitlement.mockReturnValue({ [String(223)]: { name: "E-sign" } });
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) => ({
				...d,
				status: 2,
			})),
		});

		render(
			<MemoryRouter>
				<Documents />
			</MemoryRouter>,
		);

		expect(await screen.findByText(/Documents approved/i)).toBeVisible();
		expect(
			screen.getByRole("link", { name: /E-sign Documents/i }),
		).toHaveAttribute("href", "/console/transaction/223");
		// Superseded by the callout.
		expect(screen.queryByText(/Please wait while we verify/i)).toBeNull();
	});

	// Entitlement gates the link, not the news: a partner whose documents were
	// just approved is owed that either way, and a link into a flow this account
	// cannot run is worse than no link.
	it("still says approved without the e-sign entitlement, but offers no link", async () => {
		fetchDocuments.mockResolvedValue({
			documents: KYC_DOCUMENTS_SAMPLE.data.document_list.map((d) => ({
				...d,
				status: 2,
			})),
		});

		render(<Documents />);

		expect(await screen.findByText(/Documents approved/i)).toBeVisible();
		expect(screen.queryByRole("link", { name: /E-sign/i })).toBeNull();
	});

	// The optimistic overlay bridges an upload and the refetch chasing it. Left
	// in place, it would keep reading a rejection as "Approval Pending" — with no
	// button to act on it.
	it("drops the just-uploaded overlay once upstream refuses the document", async () => {
		// Only one row left owing anything, so there is exactly one button to click.
		const [first, ...rest] = KYC_DOCUMENTS_SAMPLE.data.document_list;
		const approvedRest = rest.map((d) => ({ ...d, status: 2 }));
		fetchDocuments.mockResolvedValueOnce({
			documents: [{ ...first, status: 0 }, ...approvedRest],
		});
		render(<Documents />);

		fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
		fetchDocuments.mockResolvedValue({
			documents: [
				{ ...first, status: 3, error: "Blurred scan" },
				...approvedRest,
			],
		});
		fireEvent.click(screen.getByText("simulate-upload-success"));

		expect(await screen.findByText("Blurred scan")).toBeVisible();
		expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
	});
});
