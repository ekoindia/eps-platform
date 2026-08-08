import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import Documents from "@/pages/console/Documents";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const { authClient } = await import("@/lib/auth/client");
const fetchDocuments = vi.mocked(authClient.connectKyc.documents);

beforeEach(() => {
	kycEnabled.mockReset().mockReturnValue(true);
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
		render(<Documents />);

		expect(await screen.findByText("5 documents pending")).toBeVisible();
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

		screen.getAllByRole("button", { name: "Upload" })[1].click();

		await waitFor(() =>
			expect(screen.getByTestId("upload-dialog")).toHaveTextContent(
				"Director PAN Card",
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
});
