import { FileViewDialog } from "@/components/connect/FileViewDialog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("FileViewDialog", () => {
	it("refuses a javascript: URL", () => {
		render(<FileViewDialog file="javascript:alert(document.cookie)" />);

		expect(screen.getByText(/can't be shown/i)).toBeInTheDocument();
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("frames a YouTube video by its embed URL", () => {
		render(
			<FileViewDialog
				file="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
				options={{ type: "youtube" }}
			/>,
		);

		expect(document.querySelector("iframe")?.getAttribute("src")).toContain(
			"/embed/dQw4w9WgXcQ",
		);
	});

	it("sniffs an image from its extension", () => {
		render(<FileViewDialog file="https://files.example.com/receipt.png" />);

		expect(screen.getByAltText("Attachment")).toBeInTheDocument();
	});

	// The editor hands its result back as a data URL, which has no extension to
	// sniff — it used to fall through to the iframe, which showed the image at
	// its original size with scrollbars instead of fitting it to the screen.
	it("shows a data: image rather than framing it", () => {
		render(
			<FileViewDialog file="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" />,
		);

		expect(screen.getByAltText("Attachment")).toBeInTheDocument();
		expect(document.querySelector("iframe")).toBeNull();
	});

	// An object URL carries no type at all, so the caller has to say.
	it("honours an image type override on a blob: URL", () => {
		render(
			<FileViewDialog
				file="blob:https://console.eko.in/8f14e45f"
				options={{ type: "image" }}
			/>,
		);

		expect(screen.getByAltText("Attachment")).toBeInTheDocument();
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("zooms in from fit-to-screen and back", async () => {
		render(<FileViewDialog file="https://files.example.com/receipt.png" />);
		// The controls appear once the image has laid out and been measured, which
		// jsdom does not do on its own.
		const image = screen.getByAltText("Attachment");
		Object.defineProperty(image, "clientWidth", { value: 800 });
		Object.defineProperty(image, "clientHeight", { value: 600 });
		fireEvent.load(image);

		expect(screen.getByLabelText("Zoom out")).toBeDisabled();

		fireEvent.click(screen.getByLabelText("Zoom in"));

		expect(screen.getByText("125%")).toBeInTheDocument();
		expect(screen.getByLabelText("Zoom out")).toBeEnabled();

		fireEvent.click(screen.getByLabelText("Reset zoom"));

		expect(screen.getByText("100%")).toBeInTheDocument();
	});
});
