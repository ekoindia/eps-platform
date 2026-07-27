import { FileUpload, acceptsType } from "@/components/FileUpload";
import { ConnectDialogProvider } from "@/components/connect/DialogHost";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Renders the control inside the provider its dialogs need. */
function renderUpload(props: Partial<Parameters<typeof FileUpload>[0]> = {}) {
	return render(
		<ConnectDialogProvider>
			<FileUpload file={null} onFileChange={vi.fn()} {...props} />
		</ConnectDialogProvider>,
	);
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
