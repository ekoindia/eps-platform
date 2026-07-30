import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import Documents from "@/pages/console/Documents";
import { render, screen, waitFor } from "@testing-library/react";
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
// the list, and the dialog has the bench for its own exercise.
vi.mock("@/components/console/KycUploadDialog", () => ({
	KycUploadDialog: ({ doc }: { doc: { name: string } | null }) =>
		doc ? <div data-testid="upload-dialog">{doc.name}</div> : null,
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
});
