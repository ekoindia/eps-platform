import { FileUpload, acceptsType } from "@/components/FileUpload";
import { ConnectDialogProvider } from "@/components/connect/DialogHost";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({
	toast: { error: (...args: unknown[]) => toastError(...args) },
}));

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
