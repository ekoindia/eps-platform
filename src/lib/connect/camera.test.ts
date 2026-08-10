import { afterEach, describe, expect, it, vi } from "vitest";
import {
	blobToDataUrl,
	hasTorch,
	requestContinuousFocus,
	setTorch,
	takeFullResolutionPhoto,
} from "./camera";

/** A stream carrying one fake video track. */
function streamOf(track: Partial<MediaStreamTrack>): MediaStream {
	const filled = { readyState: "live", ...track };
	return {
		getVideoTracks: () => [filled],
	} as unknown as MediaStream;
}

/** Installs (or removes) a fake ImageCapture global for one test. */
function stubImageCapture(takePhoto: (() => Promise<Blob>) | null) {
	const holder = globalThis as { ImageCapture?: unknown };
	if (takePhoto === null) {
		delete holder.ImageCapture;
		return;
	}
	holder.ImageCapture = class {
		takePhoto = takePhoto;
	};
}

afterEach(() => {
	stubImageCapture(null);
});

describe("takeFullResolutionPhoto", () => {
	const photo = new Blob(["x"], { type: "image/jpeg" });

	it("returns the photo when the browser can take one", async () => {
		stubImageCapture(() => Promise.resolve(photo));
		expect(await takeFullResolutionPhoto(streamOf({}))).toBe(photo);
	});

	it("admits defeat without ImageCapture — the screenshot fallback's cue", async () => {
		stubImageCapture(null);
		expect(await takeFullResolutionPhoto(streamOf({}))).toBeNull();
	});

	it("admits defeat without a live track", async () => {
		stubImageCapture(() => Promise.resolve(photo));
		expect(await takeFullResolutionPhoto(null)).toBeNull();
		expect(
			await takeFullResolutionPhoto(streamOf({ readyState: "ended" })),
		).toBeNull();
	});

	it("never throws when takePhoto rejects", async () => {
		stubImageCapture(() => Promise.reject(new Error("driver says no")));
		expect(await takeFullResolutionPhoto(streamOf({}))).toBeNull();
	});

	it("gives up when the focus hunt outlives the timeout", async () => {
		stubImageCapture(() => new Promise<Blob>(() => undefined));
		expect(await takeFullResolutionPhoto(streamOf({}), 10)).toBeNull();
	});

	it("refuses a photo that is not an image", async () => {
		stubImageCapture(() =>
			Promise.resolve(new Blob(["x"], { type: "application/octet-stream" })),
		);
		expect(await takeFullResolutionPhoto(streamOf({}))).toBeNull();
	});
});

describe("torch", () => {
	it("reports a torch only when capabilities say so", () => {
		expect(
			hasTorch(
				streamOf({
					// `torch` is not in the standard capability types yet.
					getCapabilities: () => ({ torch: true }) as MediaTrackCapabilities,
				}),
			),
		).toBe(true);
		expect(hasTorch(streamOf({ getCapabilities: () => ({}) }))).toBe(false);
		// Desktop browsers often have no getCapabilities at all.
		expect(hasTorch(streamOf({}))).toBe(false);
		expect(hasTorch(null)).toBe(false);
	});

	it("applies the torch constraint and reports acceptance", async () => {
		const applyConstraints = vi.fn().mockResolvedValue(undefined);
		expect(await setTorch(streamOf({ applyConstraints }), true)).toBe(true);
		expect(applyConstraints).toHaveBeenCalledWith({
			advanced: [{ torch: true }],
		});
	});

	it("reports refusal without throwing", async () => {
		const applyConstraints = vi.fn().mockRejectedValue(new Error("no torch"));
		expect(await setTorch(streamOf({ applyConstraints }), true)).toBe(false);
		expect(await setTorch(null, true)).toBe(false);
	});
});

describe("requestContinuousFocus", () => {
	it("asks for continuous focus and swallows refusal", () => {
		const applyConstraints = vi.fn().mockRejectedValue(new Error("fixed"));
		requestContinuousFocus(streamOf({ applyConstraints }));
		expect(applyConstraints).toHaveBeenCalledWith({
			advanced: [{ focusMode: "continuous" }],
		});
		// No track: must be a no-op, not a crash.
		requestContinuousFocus(null);
	});
});

describe("blobToDataUrl", () => {
	it("round-trips a blob", async () => {
		const url = await blobToDataUrl(new Blob(["hi"], { type: "text/plain" }));
		expect(url).toMatch(/^data:text\/plain;base64,/);
	});
});
