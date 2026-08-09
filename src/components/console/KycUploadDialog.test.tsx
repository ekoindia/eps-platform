import { KycUploadDialog } from "@/components/console/KycUploadDialog";
import { setBlurScore } from "@/lib/connect/blur";
import type { KycDocument } from "@/lib/connect/kyc";
import {
	configOf,
	KYC_BLUR_CHECK,
	KYC_BLUR_THRESHOLD,
	KYC_MAX_FILE_BYTES,
} from "@/lib/connect/kyc-docs";
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
		maxBytes,
		cameraOnly,
		multiple,
		combinedFileName,
		watermark,
		options,
		onFileChange,
	}: {
		label?: string;
		accept?: string;
		maxBytes?: number;
		cameraOnly?: boolean;
		multiple?: boolean;
		combinedFileName?: string;
		watermark?: boolean | string | Record<string, string>;
		options?: { blurCheck?: string; blurThreshold?: number };
		onFileChange: (file: File | null) => void;
	}) => (
		<button
			type="button"
			data-testid="file-upload"
			data-accept={accept}
			data-max-bytes={String(maxBytes)}
			data-camera-only={String(Boolean(cameraOnly))}
			data-multiple={String(Boolean(multiple))}
			data-combined-name={combinedFileName}
			data-watermark={String(watermark)}
			data-blur-check={options?.blurCheck}
			data-blur-threshold={String(options?.blurThreshold)}
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

// Only `configOf` is stubbed, and only so a sample link can be exercised
// without committing a real .docx to satisfy a test. Every other test here keeps
// the real map: it is restored in `beforeEach`.
vi.mock("@/lib/connect/kyc-docs", async (orig) => ({
	...(await orig<typeof import("@/lib/connect/kyc-docs")>()),
	configOf: vi.fn(),
}));

const realConfigOf = (
	await vi.importActual<typeof import("@/lib/connect/kyc-docs")>(
		"@/lib/connect/kyc-docs",
	)
).configOf;

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
	vi.mocked(configOf).mockImplementation(realConfigOf);
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

	it("takes the live photograph from the camera or not at all", () => {
		// doc_type 24. A "live" photograph picked from the gallery is not live.
		render(<KycUploadDialog doc={doc({ docType: "24" })} onClose={vi.fn()} />);

		expect(screen.getByTestId("file-upload")).toHaveAttribute(
			"data-camera-only",
			"true",
		);
	});

	it("stamps provenance on the live photograph, which this console witnessed", () => {
		render(<KycUploadDialog doc={doc({ docType: "24" })} onClose={vi.fn()} />);

		expect(screen.getByTestId("file-upload")).toHaveAttribute(
			"data-watermark",
			"true",
		);
	});

	it("leaves every other document unstamped", () => {
		// The watermark is opt-in, per document. A stamp on a scan of a card that
		// existed long before the upload defaces someone's Aadhaar and proves
		// nothing about it — only a capture taken here carries provenance.
		for (const docType of ["999", "1"]) {
			const { unmount } = render(
				<KycUploadDialog doc={doc({ docType })} onClose={vi.fn()} />,
			);
			for (const slot of screen.getAllByTestId("file-upload")) {
				expect(slot).toHaveAttribute("data-watermark", "undefined");
			}
			unmount();
		}
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

	// The refusal itself belongs to FileUpload, which every source funnels
	// through — see FileUpload.test. What this dialog owes is the right ceiling.
	it("hands each slot the size ceiling the backend enforces", () => {
		render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

		expect(screen.getByTestId("file-upload")).toHaveAttribute(
			"data-max-bytes",
			String(KYC_MAX_FILE_BYTES),
		);
	});

	describe("sample document", () => {
		it("offers the blank to fill in, when the document has one", () => {
			vi.mocked(configOf).mockReturnValue({
				sampleUrl: "/kyc-samples/authorisation-letter.docx",
			});
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			const link = screen.getByRole("link", { name: /sample/i });
			expect(link).toHaveAttribute(
				"href",
				"/kyc-samples/authorisation-letter.docx",
			);
			// Without `download` the browser navigates away from a half-filled
			// dialog, or opens the .docx in a viewer that cannot save it back.
			expect(link).toHaveAttribute("download");
		});

		it("offers nothing to download for a document that has no blank", () => {
			// A PAN card has no sample: it exists whether or not we describe it.
			render(
				<KycUploadDialog doc={doc({ docType: "15" })} onClose={vi.fn()} />,
			);

			expect(screen.queryByRole("link")).toBeNull();
		});
	});

	describe("instructions", () => {
		it("renders the notice as markdown, not as source", () => {
			vi.mocked(configOf).mockReturnValue({
				instructions:
					"Print on **company letterhead**.\n\n- Signed by a director\n- Dated within 30 days",
			});
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			// The asterisks and hyphens are formatting, not text the user should see.
			expect(screen.getByText("company letterhead").tagName).toBe("STRONG");
			expect(screen.getAllByRole("listitem")).toHaveLength(2);
		});

		it("shows embedded markup as text rather than parsing it", () => {
			// No `rehype-raw`: a notice is copy, never a way to inject markup.
			vi.mocked(configOf).mockReturnValue({
				instructions: "<img src=x onerror=alert(1)> Sign in blue ink",
			});
			const { container } = render(
				<KycUploadDialog doc={doc()} onClose={vi.fn()} />,
			);

			expect(container.querySelector("img")).toBeNull();
		});

		it("shows no notice for a document that has nothing extra to say", () => {
			// `999` is this file's unknown-type sentinel: `configOf` answers
			// NO_CONFIG, which is the only way a document genuinely has nothing to
			// say now that every configured type carries instructions.
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			expect(screen.queryByRole("listitem")).toBeNull();
			expect(screen.queryByRole("link")).toBeNull();
		});
	});

	it("never submits a page the picker refused", () => {
		render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

		// A refused file never reaches onFileChange, so the slot stays empty.
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

	describe("blur check", () => {
		it("applies one legibility rule to every slot", () => {
			render(<KycUploadDialog doc={doc({ pages: 2 })} onClose={vi.fn()} />);

			for (const slot of screen.getAllByTestId("file-upload")) {
				expect(slot.dataset.blurCheck).toBe(KYC_BLUR_CHECK);
				expect(slot.dataset.blurThreshold).toBe(String(KYC_BLUR_THRESHOLD));
			}
		});

		it("cannot be opted out of by a document config", () => {
			// The type already forbids it; this pins the runtime order too, since a
			// spread the wrong way round would silently reinstate per-doc rules.
			vi.mocked(configOf).mockReturnValue({
				options: { blurCheck: "off" } as never,
			});
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			expect(screen.getByTestId("file-upload").dataset.blurCheck).toBe(
				KYC_BLUR_CHECK,
			);
		});

		it("writes the score into the uploaded file name and a form field", async () => {
			const scanned = fileOf("scan.pdf", 1024);
			setBlurScore(scanned, 18);
			pick = () => scanned;
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			fireEvent.click(screen.getByTestId("file-upload"));
			fireEvent.click(screen.getByRole("button", { name: "Upload" }));

			await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
			const form = upload.mock.calls[0][0];
			// The name is the channel that survives upstream; the field is the one
			// to keep once upstream records it.
			expect((form.get("file1") as File).name).toBe("scan_blur_score18.pdf");
			expect(form.get("blur_score1")).toBe("18");
		});

		it("leaves the name alone when nothing scored the file", async () => {
			render(<KycUploadDialog doc={doc()} onClose={vi.fn()} />);

			fireEvent.click(screen.getByTestId("file-upload"));
			fireEvent.click(screen.getByRole("button", { name: "Upload" }));

			await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
			const form = upload.mock.calls[0][0];
			expect((form.get("file1") as File).name).toBe("scan.pdf");
			expect(form.get("blur_score1")).toBeNull();
		});
	});

	describe("multi-file capture", () => {
		/** The `multiple` flag each slot was handed. */
		function multipleFlags() {
			return screen
				.getAllByTestId("file-upload")
				.map((slot) => slot.dataset.multiple);
		}

		it("lets both sides of an Aadhaar take several photos", () => {
			render(
				<KycUploadDialog
					doc={doc({ docType: "1", pages: 2 })}
					onClose={vi.fn()}
				/>,
			);

			expect(multipleFlags()).toEqual(["true", "true"]);
		});

		// Upstream uses two codes for a PAN card; the 586 sample only carries the
		// second, so a config on one of them alone would silently do nothing.
		it.each(["2", "15"])("lets PAN %s take several photos", (docType) => {
			render(<KycUploadDialog doc={doc({ docType })} onClose={vi.fn()} />);

			expect(multipleFlags()).toEqual(["true"]);
		});

		it("takes several frames of the live photograph, images only", () => {
			render(
				<KycUploadDialog doc={doc({ docType: "24" })} onClose={vi.fn()} />,
			);

			const [slot] = screen.getAllByTestId("file-upload");
			expect(slot.dataset.multiple).toBe("true");
			expect(slot.dataset.cameraOnly).toBe("true");
			// A "live" photograph that arrives as a PDF is not one, so the accept
			// list is narrower than the backend's.
			expect(slot.dataset.accept).toBe("image/jpeg,image/png");
		});

		it("leaves an unconfigured document on single-file upload", () => {
			render(
				<KycUploadDialog doc={doc({ docType: "999" })} onClose={vi.fn()} />,
			);

			expect(multipleFlags()).toEqual(["false"]);
		});

		it("names a combined page after its slot", () => {
			render(
				<KycUploadDialog
					doc={doc({ docType: "1", pages: 2 })}
					onClose={vi.fn()}
				/>,
			);

			// Two files both called "combined-documents.pdf" tell a reviewer
			// nothing about which side of the card they are looking at.
			expect(
				screen
					.getAllByTestId("file-upload")
					.map((slot) => slot.dataset.combinedName),
			).toEqual(["aadhaar-front.pdf", "aadhaar-back.pdf"]);
		});
	});
});
