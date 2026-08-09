import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageEditorDialog } from "./ImageEditorDialog";

const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => toastError(...args),
		warning: (...args: unknown[]) => toastWarning(...args),
	},
}));

const blurScoreFromSource = vi.fn();
const setBlurScore = vi.fn();
vi.mock("@/lib/connect/blur", () => ({
	DEFAULT_BLUR_THRESHOLD: 30,
	blurScoreFromSource: (...args: unknown[]) => blurScoreFromSource(...args),
	setBlurScore: (...args: unknown[]) => setBlurScore(...args),
}));

// Everything canvas-touching is mocked — jsdom has no 2D context.
const processedFile = new File(["x"], "processed.jpg", { type: "image/jpeg" });
vi.mock("@/lib/connect/image", () => ({
	getProcessedImage: () => "data:image/jpeg;base64,processed",
	getRotatedImage: () => "data:image/jpeg;base64,rotated",
	dataUrlToFile: async () => processedFile,
}));

const IMAGE = "data:image/png;base64,source";

function renderEditor(
	options: Parameters<typeof ImageEditorDialog>[0]["options"] = {},
) {
	const onClose = vi.fn();
	render(
		<ImageEditorDialog image={IMAGE} options={options} onClose={onClose} />,
	);
	return onClose;
}

function clickAccept() {
	fireEvent.click(screen.getByRole("button", { name: /accept image/i }));
}

async function flush() {
	// onAccept awaits dataUrlToFile before calling onClose.
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ImageEditorDialog blur check", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("never scores when the mode is off (the default)", async () => {
		const onClose = renderEditor();
		clickAccept();
		await flush();

		expect(blurScoreFromSource).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledWith(
			expect.objectContaining({ accepted: true }),
		);
	});

	it("keeps the editor open for a blurry capture in block mode", async () => {
		blurScoreFromSource.mockReturnValue(10);
		const onClose = renderEditor({ blurCheck: "block" });
		clickAccept();
		await flush();

		expect(toastError).toHaveBeenCalledWith(
			expect.stringContaining("blurry or out of focus"),
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("accepts a sharp capture in block mode and stamps its score", async () => {
		blurScoreFromSource.mockReturnValue(75);
		const onClose = renderEditor({ blurCheck: "block" });
		clickAccept();
		await flush();

		expect(onClose).toHaveBeenCalledWith(
			expect.objectContaining({ accepted: true, file: processedFile }),
		);
		expect(setBlurScore).toHaveBeenCalledWith(processedFile, 75);
	});

	it("warns about a blurry capture but accepts it in warn mode", async () => {
		blurScoreFromSource.mockReturnValue(10);
		const onClose = renderEditor({ blurCheck: "warn" });
		clickAccept();
		await flush();

		expect(toastWarning).toHaveBeenCalledWith(
			expect.stringContaining("blurry or out of focus"),
		);
		expect(onClose).toHaveBeenCalledWith(
			expect.objectContaining({ accepted: true }),
		);
	});

	it("accepts silently in measure mode, keeping only the score", async () => {
		blurScoreFromSource.mockReturnValue(10);
		const onClose = renderEditor({ blurCheck: "measure" });
		clickAccept();
		await flush();

		expect(toastError).not.toHaveBeenCalled();
		expect(toastWarning).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledWith(
			expect.objectContaining({ accepted: true }),
		);
		expect(setBlurScore).toHaveBeenCalledWith(processedFile, 10);
	});

	it("accepts when the scorer cannot judge (fail open)", async () => {
		blurScoreFromSource.mockReturnValue(null);
		const onClose = renderEditor({ blurCheck: "block" });
		clickAccept();
		await flush();

		expect(toastError).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledWith(
			expect.objectContaining({ accepted: true }),
		);
		expect(setBlurScore).not.toHaveBeenCalled();
	});
});
