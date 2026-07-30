import {
	attachWidgetEvents,
	type FileViewRequest,
	type WidgetEventHandlers,
} from "@/lib/connect/widget-events";
import { afterEach, describe, expect, it, vi } from "vitest";

let detach: (() => void) | null = null;

/** Attaches the listeners with everything stubbed, returning the handlers. */
function listen(): WidgetEventHandlers {
	const handlers = {
		onFileView: vi.fn(),
		onCameraCapture: vi.fn(),
		onRaiseIssue: vi.fn(),
		onBalanceChanged: vi.fn(),
		onLoginAgain: vi.fn(),
		onGotoTransaction: vi.fn(),
		onGotoHistory: vi.fn(),
		onOpenUrl: vi.fn(),
	};
	detach = attachWidgetEvents(handlers);
	return handlers;
}

/** Dispatches what the widget dispatches for a `file-view`. */
function fireFileView(data: Record<string, unknown>) {
	window.dispatchEvent(
		new CustomEvent("iron-signal", { detail: { name: "file-view", data } }),
	);
}

afterEach(() => {
	detach?.();
	detach = null;
});

describe("file-view", () => {
	it("carries the flow's editor requirements to the confirmation path", () => {
		const handlers = listen();

		fireFileView({
			file: "https://files.example.com/selfie.jpg",
			name: "selfie.jpg",
			userConfirmation: true,
			options: { detectFace: true, minFaceCount: 1, aspectRatio: 1 },
		});

		const request = vi.mocked(handlers.onFileView).mock
			.calls[0][0] as FileViewRequest;
		expect(request.userConfirmation).toBe(true);
		// Regression: confirming a face photo with no face check and no aspect
		// ratio would silently accept the wrong image.
		expect(request.editorOptions).toMatchObject({
			detectFace: true,
			minFaceCount: 1,
			aspectRatio: 1,
			fileName: "selfie.jpg",
		});
	});

	it("expands a YouTube id and marks the type", () => {
		const handlers = listen();

		fireFileView({ file: "dQw4w9WgXcQ", is_youtube: true });

		expect(handlers.onFileView).toHaveBeenCalledWith(
			expect.objectContaining({
				file: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				options: expect.objectContaining({ type: "youtube" }),
			}),
		);
	});

	it("ignores a payload with no file", () => {
		const handlers = listen();

		fireFileView({ userConfirmation: true });

		expect(handlers.onFileView).not.toHaveBeenCalled();
	});
});

describe("camera and raise-issue", () => {
	it("defaults an empty detail to empty options", () => {
		const handlers = listen();

		window.dispatchEvent(new CustomEvent("request-camera-capture"));
		window.dispatchEvent(new CustomEvent("feedback-dialog-event"));

		expect(handlers.onCameraCapture).toHaveBeenCalledWith({});
		expect(handlers.onRaiseIssue).toHaveBeenCalledWith({});
	});

	it("stops listening once detached", () => {
		const handlers = listen();
		detach?.();
		detach = null;

		window.dispatchEvent(
			new CustomEvent("request-camera-capture", { detail: {} }),
		);

		expect(handlers.onCameraCapture).not.toHaveBeenCalled();
	});
});
