/**
 * Progressive enhancements for photographing documents, on top of the plain
 * `getUserMedia` preview the camera dialog already has.
 *
 * Everything here feature-detects and fails soft: on browsers without
 * `ImageCapture` (Safari, Firefox) every function quietly answers "no", and
 * the dialog falls back to the video-frame screenshot it always took. Nothing
 * throws at the caller.
 *
 * Why this exists: a screenshot of the preview is a re-encoded 1080p video
 * frame grabbed without waiting for focus — the worst way to photograph a
 * document, and the source of much of the blur the KYC checks then flag.
 * `ImageCapture.takePhoto()` asks the camera for a real still instead: full
 * sensor resolution, after autofocus has converged.
 */

/** How long `takePhoto()` may hunt for focus before the screenshot fallback. */
export const TAKE_PHOTO_TIMEOUT_MS = 3000;

/** The slice of the ImageCapture API this module uses; the global is absent
 * from several browsers (and from some TS lib configs), so it is typed here
 * rather than assumed. */
interface ImageCaptureLike {
	takePhoto(): Promise<Blob>;
}

type ImageCaptureConstructor = new (
	track: MediaStreamTrack,
) => ImageCaptureLike;

/** The first live video track of a stream, or null. */
function videoTrackOf(stream: MediaStream | null): MediaStreamTrack | null {
	const track = stream?.getVideoTracks?.()[0];
	return track && track.readyState === "live" ? track : null;
}

/**
 * Takes a real photograph — full sensor resolution, focused — when the
 * browser can, and admits it cannot otherwise.
 *
 * @param stream - The stream behind the live preview.
 * @param timeoutMs - Ceiling on the focus hunt; some devices stall here.
 * @returns The photo as a JPEG/PNG blob, or null when the screenshot path
 * should be used instead. Never throws.
 */
export async function takeFullResolutionPhoto(
	stream: MediaStream | null,
	timeoutMs: number = TAKE_PHOTO_TIMEOUT_MS,
): Promise<Blob | null> {
	const track = videoTrackOf(stream);
	const ImageCaptureCtor = (
		globalThis as { ImageCapture?: ImageCaptureConstructor }
	).ImageCapture;
	if (!track || !ImageCaptureCtor) return null;

	try {
		const photo = await Promise.race([
			new ImageCaptureCtor(track).takePhoto(),
			new Promise<null>((resolve) =>
				setTimeout(() => resolve(null), timeoutMs),
			),
		]);
		// A photo that is not an image (or an empty blob) is a driver quirk;
		// the screenshot fallback beats uploading it.
		if (!photo || photo.size === 0 || !photo.type.startsWith("image/")) {
			return null;
		}
		return photo;
	} catch {
		return null;
	}
}

/**
 * Asks the camera to keep refocusing on whatever is in frame.
 *
 * Most phones default to continuous autofocus already; this makes it a rule
 * rather than a default, for the drivers that start in single-shot mode.
 * Fire-and-forget: rejection means the camera does not expose focus control.
 *
 * @param stream - The stream behind the live preview.
 */
export function requestContinuousFocus(stream: MediaStream | null): void {
	const track = videoTrackOf(stream);
	// `focusMode` is not in the standard constraint types yet.
	void track
		?.applyConstraints({
			advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
		})
		.catch(() => undefined);
}

/**
 * Whether this camera has a controllable light.
 *
 * @param stream - The stream behind the live preview.
 * @returns True when {@link setTorch} can work — in practice the rear camera
 * on Android/Chrome. Front cameras and laptops answer false.
 */
export function hasTorch(stream: MediaStream | null): boolean {
	const track = videoTrackOf(stream);
	if (!track || typeof track.getCapabilities !== "function") return false;
	// `torch` is not in the standard capability types yet.
	return (track.getCapabilities() as { torch?: boolean }).torch === true;
}

/**
 * Turns the camera light on or off.
 *
 * A dim room is one of the three ways a document capture goes wrong, and the
 * torch is the only one of the three the device can fix by itself.
 *
 * @param stream - The stream behind the live preview.
 * @param on - Desired state.
 * @returns True when the constraint was accepted. Never throws.
 */
export async function setTorch(
	stream: MediaStream | null,
	on: boolean,
): Promise<boolean> {
	const track = videoTrackOf(stream);
	if (!track) return false;
	try {
		await track.applyConstraints({
			advanced: [{ torch: on } as MediaTrackConstraintSet],
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Reads a blob back as a data URL.
 *
 * For the confirm-disabled capture path, which hands its result straight to
 * callers that treat the string as an owned, never-revoked preview — an
 * object URL there would leak, a data URL cannot.
 *
 * @param blob - An image blob.
 * @returns The data URL, or null when the blob cannot be read.
 */
export function blobToDataUrl(blob: Blob): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () =>
			resolve(typeof reader.result === "string" ? reader.result : null);
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(blob);
	});
}
