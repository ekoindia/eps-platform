import {
	FileUpload,
	acceptsOnlyImagesAndPdfs,
	acceptsType,
} from "@/components/FileUpload";
import { ConnectDialogProvider } from "@/components/connect/DialogHost";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

/** Mirrors `SLOW_STEP_MS` in the component — the delay before a step is named. */
const SLOW_STEP_MS = 1000;
import { EncryptedPdfError } from "@/lib/pdf/pdf-errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => toastError(...args),
		warning: (...args: unknown[]) => toastWarning(...args),
	},
}));

const blurScorePdfMock = vi.fn();
const pdfPageCountMock = vi.fn();
const verifyPdfPasswordMock = vi.fn();
const unlockPdfMock = vi.fn();
vi.mock("@/lib/pdf/pdf-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/pdf/pdf-client")>()),
	blurScorePdf: (...args: unknown[]) => blurScorePdfMock(...args),
	pdfPageCount: (...args: unknown[]) => pdfPageCountMock(...args),
	verifyPdfPassword: (...args: unknown[]) => verifyPdfPasswordMock(...args),
	unlockPdf: (...args: unknown[]) => unlockPdfMock(...args),
}));

beforeEach(() => {
	// The default document is not encrypted, which is what every test that is
	// not about encryption expects to happen.
	pdfPageCountMock.mockResolvedValue(1);
	unlockPdfMock.mockResolvedValue(
		new Blob(["unlocked"], { type: "application/pdf" }),
	);
});

/** Renders the control inside the provider its dialogs need. */
function renderUpload(props: Partial<Parameters<typeof FileUpload>[0]> = {}) {
	return render(
		<ConnectDialogProvider>
			<FileUpload file={null} onFileChange={vi.fn()} {...props} />
		</ConnectDialogProvider>,
	);
}

/** A file of an exact byte length, without allocating that many bytes. */
function fileOf(name: string, size: number, type = "application/pdf"): File {
	const file = new File(["x"], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}

/** Picks a file through the hidden native input, as the picker button does. */
function pickFile(container: HTMLElement, file: File) {
	const input = container.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) throw new Error("no file input rendered");
	fireEvent.change(input, { target: { files: [file] } });
}

describe("acceptsType", () => {
	it("takes anything when accept is empty", () => {
		expect(acceptsType("", "application/pdf")).toBe(true);
	});

	it("matches the image/* wildcard", () => {
		// Regression: Eloka's `accept.indexOf(type)` refused a PNG dropped on a
		// zone accepting `image/*`.
		expect(acceptsType("image/*", "image/png")).toBe(true);
		expect(acceptsType("image/*", "application/pdf")).toBe(false);
	});

	it("matches an exact list, ignoring case and spacing", () => {
		const accept = "image/jpeg, application/pdf";
		expect(acceptsType(accept, "APPLICATION/PDF")).toBe(true);
		expect(acceptsType(accept, "image/png")).toBe(false);
	});

	it("rejects a type the browser could not identify", () => {
		expect(acceptsType("image/*", "")).toBe(false);
	});
});

describe("FileUpload", () => {
	it("offers both sources when images are allowed", () => {
		renderUpload({ accept: "image/*" });

		// Images only: the picker says "photo", not "file".
		expect(
			screen.getByRole("button", { name: /select photo/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /camera/i })).toBeInTheDocument();
	});

	it("hides the camera when images are not allowed", () => {
		renderUpload({ accept: "application/pdf" });

		expect(
			screen.getByRole("button", { name: /select file/i }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /camera/i })).toBeNull();
	});

	it("leaves only the camera in cameraOnly mode", () => {
		renderUpload({ cameraOnly: true });

		expect(
			screen.getByRole("button", { name: /open camera/i }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /select/i })).toBeNull();
		expect(screen.queryByText(/drag and drop/i)).toBeNull();
	});

	// Every source — picker, drop, camera, editor — funnels through `attach`, so
	// this is the one guard standing between a caller and an unbounded upload.
	describe("maxBytes", () => {
		const createObjectURL = vi.fn(() => "blob:preview");
		const revokeObjectURL = vi.fn();
		const original = {
			create: URL.createObjectURL,
			revoke: URL.revokeObjectURL,
		};

		beforeEach(() => {
			vi.clearAllMocks();
			URL.createObjectURL = createObjectURL;
			URL.revokeObjectURL = revokeObjectURL;
		});

		afterEach(() => {
			URL.createObjectURL = original.create;
			URL.revokeObjectURL = original.revoke;
		});

		it("refuses a file over the limit and hands the caller nothing", async () => {
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				maxBytes: 5 * 1024 * 1024,
				onFileChange,
			});

			pickFile(container, fileOf("huge.pdf", 5 * 1024 * 1024 + 1));

			await waitFor(() =>
				expect(toastError).toHaveBeenCalledWith(
					"huge.pdf is larger than 5 MB.",
				),
			);
			expect(onFileChange).not.toHaveBeenCalled();
			expect(screen.queryByText("huge.pdf")).toBeNull();
		});

		it("takes a file at exactly the limit", async () => {
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				maxBytes: 5 * 1024 * 1024,
				onFileChange,
			});

			pickFile(container, fileOf("scan.pdf", 5 * 1024 * 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastError).not.toHaveBeenCalled();
		});

		it("refuses nothing when no limit is set", async () => {
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				onFileChange,
			});

			pickFile(container, fileOf("huge.pdf", 500 * 1024 * 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
		});

		it("releases the preview URL of a capture it refuses", async () => {
			// disableImageConfirm skips the editor, so the object URL created for the
			// preview is still unowned when the size check rejects it.
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "image/*",
				maxBytes: 1024,
				options: { disableImageConfirm: true },
				onFileChange,
			});

			pickFile(container, fileOf("photo.jpg", 2048, "image/jpeg"));

			await waitFor(() =>
				expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview"),
			);
			expect(onFileChange).not.toHaveBeenCalled();
		});
	});

	// The blur check must only ever degrade to today's behaviour: everything
	// short of "confidently blurry in block mode" attaches the file.
	describe("blur check", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("never runs when the mode is off (the default)", async () => {
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				onFileChange,
			});

			pickFile(container, fileOf("scan.pdf", 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(blurScorePdfMock).not.toHaveBeenCalled();
		});

		it("blocks a blurry PDF in block mode", async () => {
			blurScorePdfMock.mockResolvedValue(10);
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "block" },
				onFileChange,
			});

			pickFile(container, fileOf("blurry.pdf", 1024));

			await waitFor(() =>
				expect(toastError).toHaveBeenCalledWith(
					expect.stringContaining("blurry.pdf looks blurry"),
				),
			);
			expect(onFileChange).not.toHaveBeenCalled();
		});

		it("attaches a sharp PDF in block mode", async () => {
			blurScorePdfMock.mockResolvedValue(80);
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "block" },
				onFileChange,
			});

			pickFile(container, fileOf("sharp.pdf", 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastError).not.toHaveBeenCalled();
		});

		it("attaches when the scorer cannot judge (null)", async () => {
			// A born-digital PDF, a blank page, a timed-out check.
			blurScorePdfMock.mockResolvedValue(null);
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "block" },
				onFileChange,
			});

			pickFile(container, fileOf("digital.pdf", 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastError).not.toHaveBeenCalled();
		});

		it("attaches when the scorer throws (fail open)", async () => {
			blurScorePdfMock.mockRejectedValue(new Error("encrypted"));
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "block" },
				onFileChange,
			});

			pickFile(container, fileOf("locked.pdf", 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastError).not.toHaveBeenCalled();
		});

		it("warns about a blurry file but still attaches it in warn mode", async () => {
			blurScorePdfMock.mockResolvedValue(10);
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "warn" },
				onFileChange,
			});

			pickFile(container, fileOf("soft.pdf", 1024));

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastWarning).toHaveBeenCalledWith(
				expect.stringContaining("soft.pdf looks blurry"),
			);
			expect(toastError).not.toHaveBeenCalled();
		});

		it("names the step once it has been running for a second", async () => {
			// Nothing to show while the check is quick, and an explanation once it
			// is slow enough that silence would read as a hang.
			let finish!: (score: number | null) => void;
			blurScorePdfMock.mockReturnValue(
				new Promise<number | null>((resolve) => {
					finish = resolve;
				}),
			);
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "measure" },
				onFileChange: vi.fn(),
			});

			vi.useFakeTimers({ shouldAdvanceTime: true });
			try {
				pickFile(container, fileOf("slow.pdf", 1024));
				expect(screen.queryByText("Checking quality…")).toBeNull();

				await act(async () => {
					await vi.advanceTimersByTimeAsync(SLOW_STEP_MS);
				});
				expect(screen.getByText("Checking quality…")).toBeInTheDocument();

				await act(async () => {
					finish(80);
				});
				expect(screen.queryByText("Checking quality…")).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});

		it("scores silently in measure mode, stamping the file for telemetry", async () => {
			blurScorePdfMock.mockResolvedValue(10);
			const onFileChange = vi.fn();
			const { container } = renderUpload({
				accept: "application/pdf",
				options: { blurCheck: "measure" },
				onFileChange,
			});

			const picked = fileOf("soft.pdf", 1024);
			pickFile(container, picked);

			await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
			expect(toastWarning).not.toHaveBeenCalled();
			expect(toastError).not.toHaveBeenCalled();
			const { getBlurScore } = await import("@/lib/connect/blur");
			expect(getBlurScore(picked)).toBe(10);
		});
	});

	it("shows the file name and a discard control once attached", async () => {
		const onFileChange = vi.fn();
		renderUpload({
			file: new File(["x"], "statement.pdf", { type: "application/pdf" }),
			onFileChange,
		});

		expect(screen.getByText("statement.pdf")).toBeInTheDocument();
		const discard = screen.getByRole("button", { name: /discard file/i });
		discard.click();

		expect(onFileChange).toHaveBeenCalledWith(null);
	});
});

describe("acceptsOnlyImagesAndPdfs", () => {
	it("allows an empty accept, which constrains nothing", () => {
		expect(acceptsOnlyImagesAndPdfs("")).toBe(true);
	});

	it("allows images and PDFs in any combination", () => {
		expect(acceptsOnlyImagesAndPdfs("image/*,application/pdf")).toBe(true);
		expect(acceptsOnlyImagesAndPdfs("image/jpeg, image/png")).toBe(true);
		expect(acceptsOnlyImagesAndPdfs("APPLICATION/PDF")).toBe(true);
		expect(acceptsOnlyImagesAndPdfs(".jpg,.png,.pdf")).toBe(true);
	});

	it("refuses anything that cannot go into a PDF", () => {
		// A zone that also takes a spreadsheet keeps single-file behaviour
		// rather than silently dropping the one file it cannot fold in.
		expect(acceptsOnlyImagesAndPdfs("image/*,.docx")).toBe(false);
		expect(
			acceptsOnlyImagesAndPdfs("application/pdf,application/vnd.ms-excel"),
		).toBe(false);
	});

	it("ignores a trailing comma", () => {
		expect(acceptsOnlyImagesAndPdfs("image/*,")).toBe(true);
	});
});

describe("FileUpload multi-file mode", () => {
	/** The hidden native input, which carries the `multiple` attribute. */
	function inputOf(container: HTMLElement) {
		const input =
			container.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("no file input rendered");
		return input;
	}

	it("engages when every accepted type can go into a PDF", () => {
		const { container } = renderUpload({
			multiple: true,
			accept: "image/*,application/pdf",
		});

		expect(inputOf(container).multiple).toBe(true);
	});

	it("falls back to single-file when a type cannot go into a PDF", () => {
		const { container } = renderUpload({
			multiple: true,
			accept: "image/*,.docx",
		});

		expect(inputOf(container).multiple).toBe(false);
	});

	it("stays single-file unless asked", () => {
		const { container } = renderUpload({ accept: "image/*,application/pdf" });

		expect(inputOf(container).multiple).toBe(false);
	});

	it("invites several files rather than one", () => {
		const { container } = renderUpload({
			multiple: true,
			accept: "image/*,application/pdf",
		});

		expect(container.textContent).toContain("drag and drop files here");
	});

	it("says Add more above the sources once a row exists", async () => {
		// Not on the picker's label: a camera-only field has no picker, and
		// "Open camera" alone does not say whether the shot joins or replaces.
		const { container } = renderUpload({
			multiple: true,
			accept: "image/*,application/pdf",
		});
		expect(screen.queryByText("Add more")).toBeNull();

		pickFile(container, fileOf("statement.pdf", 1024));

		expect(await screen.findByText("Add more")).toBeVisible();
		expect(
			screen.getByRole("button", { name: /select files/i }),
		).toBeInTheDocument();
	});

	it("opens an attached row in the viewer when its thumbnail is clicked", async () => {
		// jsdom has neither, and the viewer is handed an object URL.
		const original = {
			create: URL.createObjectURL,
			revoke: URL.revokeObjectURL,
		};
		URL.createObjectURL = vi.fn(() => "blob:row");
		URL.revokeObjectURL = vi.fn();
		try {
			const { container } = renderUpload({
				multiple: true,
				accept: "image/*,application/pdf",
			});
			pickFile(container, fileOf("statement.pdf", 1024));

			const view = await screen.findByRole("button", {
				name: "View statement.pdf",
			});
			fireEvent.click(view);

			// The hosted viewer, not a new tab: the file never leaves the page.
			await screen.findByRole("dialog");
			expect(URL.createObjectURL).toHaveBeenCalled();
		} finally {
			URL.createObjectURL = original.create;
			URL.revokeObjectURL = original.revoke;
		}
	});
});

describe("password-protected PDFs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pdfPageCountMock.mockRejectedValue(new EncryptedPdfError());
		unlockPdfMock.mockResolvedValue(
			new Blob(["unlocked"], { type: "application/pdf" }),
		);
	});

	/** The dialog's password field, once the lazy chunk has rendered. */
	function passwordField() {
		return screen.findByLabelText(/document password/i);
	}

	/** Types a password and submits the prompt. */
	function submitPassword(field: HTMLElement, password: string) {
		fireEvent.change(field, { target: { value: password } });
		fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
	}

	it("unlocks a permissions-locked document without asking", async () => {
		// No user password: the empty string opens it, so a prompt would be noise.
		verifyPdfPasswordMock.mockResolvedValue("ok");
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		pickFile(container, fileOf("statement.pdf", 1024));

		await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
		expect(unlockPdfMock).toHaveBeenCalledWith(expect.anything(), "");
		expect(
			screen.queryByLabelText(/document password/i),
		).not.toBeInTheDocument();
		// The unlocked bytes are what gets attached, under the original name.
		expect(onFileChange.mock.calls[0][0].name).toBe("statement.pdf");
	});

	it("asks for a password and attaches the unlocked file", async () => {
		verifyPdfPasswordMock.mockImplementation(async (_file, password) =>
			password === "secret" ? "ok" : "wrong",
		);
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		pickFile(container, fileOf("locked.pdf", 1024));

		submitPassword(await passwordField(), "secret");

		await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
		expect(unlockPdfMock).toHaveBeenCalledWith(expect.anything(), "secret");
		expect(onFileChange.mock.calls[0][0].name).toBe("locked.pdf");
	});

	it("keeps the prompt open and says so when the password is wrong", async () => {
		verifyPdfPasswordMock.mockResolvedValue("wrong");
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		pickFile(container, fileOf("locked.pdf", 1024));
		submitPassword(await passwordField(), "nope");

		expect(await screen.findByRole("alert")).toHaveTextContent(/didn't work/i);
		// Still open, so the user can try again without re-picking the file.
		expect(await passwordField()).toBeInTheDocument();
		expect(onFileChange).not.toHaveBeenCalled();
		expect(unlockPdfMock).not.toHaveBeenCalled();
	});

	it("refuses the file when the prompt is cancelled", async () => {
		verifyPdfPasswordMock.mockResolvedValue("wrong");
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		pickFile(container, fileOf("locked.pdf", 1024));
		await passwordField();
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				expect.stringContaining("locked.pdf is password-protected"),
			),
		);
		expect(onFileChange).not.toHaveBeenCalled();
	});

	it("blames the document, not the password, when it cannot be read", async () => {
		verifyPdfPasswordMock
			.mockResolvedValueOnce("wrong")
			.mockRejectedValue(new Error("Invalid PDF structure"));
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		pickFile(container, fileOf("damaged.pdf", 1024));
		submitPassword(await passwordField(), "anything");

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				expect.stringContaining("Could not read damaged.pdf"),
			),
		);
		expect(onFileChange).not.toHaveBeenCalled();
	});

	it("attaches unchanged when the check itself fails", async () => {
		// A dead worker or a failed chunk load says nothing about the document,
		// so it must not cost the user their upload.
		pdfPageCountMock.mockRejectedValue(new Error("The PDF worker crashed."));
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			onFileChange,
		});

		const picked = fileOf("scan.pdf", 1024);
		pickFile(container, picked);

		await waitFor(() => expect(onFileChange).toHaveBeenCalledWith(picked));
		expect(unlockPdfMock).not.toHaveBeenCalled();
	});

	it("skips a cancelled file in multi mode and keeps the rest", async () => {
		verifyPdfPasswordMock.mockResolvedValue("wrong");
		pdfPageCountMock
			.mockRejectedValueOnce(new EncryptedPdfError())
			.mockResolvedValue(1);
		const onFileChange = vi.fn();
		const { container } = renderUpload({
			accept: "application/pdf",
			multiple: true,
			onFileChange,
		});

		const input =
			container.querySelector<HTMLInputElement>('input[type="file"]');
		fireEvent.change(input, {
			target: {
				files: [fileOf("locked.pdf", 1024), fileOf("clean.pdf", 1024)],
			},
		});

		await passwordField();
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => expect(onFileChange).toHaveBeenCalledTimes(1));
		expect(onFileChange.mock.calls[0][0].name).toBe("clean.pdf");
	});
});
