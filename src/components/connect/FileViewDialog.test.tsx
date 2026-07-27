import { FileViewDialog } from "@/components/connect/FileViewDialog";
import { render, screen } from "@testing-library/react";
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
});
