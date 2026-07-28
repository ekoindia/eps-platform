import { KycUploadDialog } from "@/components/console/KycUploadDialog";
import type { KycDocument } from "@/lib/connect/kyc";
import { KYC_MAX_FILE_BYTES } from "@/lib/connect/kyc-docs";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real FileUpload needs a ConnectDialogProvider, the camera and a
// geolocation prompt; the same cut Documents.test makes one level up. The stub
// keeps the contract this dialog actually depends on: a label, the props it
// forwards, and a way to hand a file back.
vi.mock("@/components/FileUpload", () => ({
	FileUpload: ({
		label,
		accept,
		cameraOnly,
		onFileChange,
	}: {
		label?: string;
		accept?: string;
		cameraOnly?: boolean;
		onFileChange: (file: File | null) => void;
	}) => (
		<button
			type="button"
			data-testid="file-upload"
			data-accept={accept}
			data-camera-only={String(Boolean(cameraOnly))}
			onClick={() => onFileChange(pick())}
		>
			{label}
		</button>
	),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => toastError(...args),
		success: vi.fn(),
	},
}));

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { connectKyc: { documents: vi.fn(), upload: vi.fn() } },
}));

const { authClient } = await import("@/lib/auth/client");
const upload = vi.mocked(authClient.connectKyc.upload);

/** What the stubbed FileUpload hands back on click. Set per test. */
let pick: () => File;

/** A file of an exact byte length, without allocating that many bytes. */
function fileOf(name: string, size: number, type = "application/pdf"): File {
	const file = new File(["x"], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}

function doc(overrides: Partial<KycDocument> = {}): KycDocument {
	return {
		docType: "999",
		name: "Some document",
		info: "",
		pages: 1,
		status: 1,
		statusDesc: "",
		error: "",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	pick = () => fileOf("scan.pdf", 1024);
	upload.mockResolvedValue({ message: "Received" });
});

describe("KycUploadDialog", () => {
	it("opens one slot per page", () => {
		render(<KycUploadDialog doc={doc({ pages: 3 })} onClose={vi.fn()} />);

		expect(screen.getAllByTestId("file-upload")).toHaveLength(3);
		expect(screen.getByText("Page 1")).toBeVisible();
	});

	it("labels a single-page document's only slot plainly", () => {
		render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

		expect(screen.getByText("File")).toBeVisible();
	});

	it("names each page from the local config", () => {
		// doc_type 1 is the Aadhaar seed in KYC_DOC_CONFIG.
		render(
			<KycUploadDialog
				doc={doc({ docType: "1", pages: 2 })}
				onClose={vi.fn()}
			/>,
		);

		expect(screen.getByText("Aadhaar front")).toBeVisible();
		expect(screen.getByText("Aadhaar back")).toBeVisible();
	});

	it("passes the backend's allow-list on to an unconfigured document", () => {
		render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);
		const slot = screen.getByTestId("file-upload");

		expect(slot).toHaveAttribute(
			"data-accept",
			"image/jpeg,image/png,application/pdf",
		);
		expect(slot).toHaveAttribute("data-camera-only", "false");
	});

	it("refuses a file over the limit, and never submits it", async () => {
		const onClose = vi.fn();
		pick = () => fileOf("huge.pdf", KYC_MAX_FILE_BYTES + 1);
		render(<KycUploadDialog doc={doc()} onClose={onClose} />);

		fireEvent.click(screen.getByTestId("file-upload"));

		expect(toastError).toHaveBeenCalledWith(
			expect.stringContaining("larger than 5 MB"),
		);
		// Nothing attached, so Upload stays disabled and nothing reaches the wire.
		expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
		expect(upload).not.toHaveBeenCalled();
	});

	it("submits every page under the limit", async () => {
		const onClose = vi.fn();
		render(<KycUploadDialog doc={doc({ pages: 2 })} onClose={onClose} />);

		for (const slot of screen.getAllByTestId("file-upload")) {
			fireEvent.click(slot);
		}
		fireEvent.click(screen.getByRole("button", { name: "Upload" }));

		await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		const form = upload.mock.calls[0][0];
		expect(form.get("doc_type")).toBe("999");
		expect(form.get("pages")).toBe("2");
		expect(form.get("file1")).toBeInstanceOf(File);
		expect(form.get("file2")).toBeInstanceOf(File);
		expect(onClose).toHaveBeenCalledWith({
			docType: "999",
			message: "Received",
		});
	});
});
