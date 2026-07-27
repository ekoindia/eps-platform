import type { Crop } from "react-image-crop";

/**
 * Scales a size down so its longer side fits `maxLength`, keeping the ratio.
 * @param size.width - Width in pixels.
 * @param size.height - Height in pixels.
 * @param size.maxLength - Cap for the longer side; no cap when omitted.
 * @returns The size to render at.
 */
export function getFinalImageDimensions({
	width,
	height,
	maxLength,
}: {
	width: number;
	height: number;
	maxLength?: number;
}): { finalWidth: number; finalHeight: number } {
	const isLandscape = width > height;
	const longerSide = isLandscape ? width : height;
	if (!maxLength || longerSide <= maxLength) {
		return { finalWidth: width, finalHeight: height };
	}
	const aspectRatio = width / height;
	return isLandscape
		? { finalWidth: maxLength, finalHeight: maxLength / aspectRatio }
		: { finalWidth: maxLength * aspectRatio, finalHeight: maxLength };
}

/**
 * Crops, scales and watermarks an image into a JPEG data URL.
 *
 * The crop rectangle comes from react-image-crop in *displayed* pixels, so it
 * is scaled by `natural/displayed` before it can index the source bitmap —
 * otherwise every crop on a shrunk-to-fit image cuts the wrong region.
 * @param params.image - The loaded `<img>` being edited.
 * @param params.cropEnabled - Whether the user's crop applies at all.
 * @param params.crop - The selection, in displayed pixels.
 * @param params.maxLength - Cap for the longer side of the result.
 * @param params.watermark - Text stamped bottom-left, newline separated.
 * @returns A `data:image/jpeg` URL.
 */
export function getProcessedImage({
	image,
	cropEnabled,
	crop,
	maxLength,
	watermark,
}: {
	image: HTMLImageElement;
	cropEnabled?: boolean;
	crop?: Crop | null;
	maxLength?: number;
	watermark?: string;
}): string {
	const area: Crop =
		cropEnabled && crop
			? crop
			: { unit: "px", x: 0, y: 0, width: image.width, height: image.height };

	const scaleX = image.naturalWidth / image.width;
	const scaleY = image.naturalHeight / image.height;

	const { finalWidth, finalHeight } = getFinalImageDimensions({
		width: area.width * scaleX,
		height: area.height * scaleY,
		maxLength,
	});

	const canvas = document.createElement("canvas");
	canvas.width = Math.floor(finalWidth);
	canvas.height = Math.floor(finalHeight);
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context unavailable");

	ctx.drawImage(
		image,
		area.x * scaleX,
		area.y * scaleY,
		area.width * scaleX,
		area.height * scaleY,
		0,
		0,
		finalWidth,
		finalHeight,
	);

	if (watermark) {
		const fontSize = Math.max(7, Math.min(12, finalWidth / 30));
		ctx.font = `${fontSize}px Arial`;
		ctx.fillStyle = "rgba(255, 255, 0)";
		ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;
		ctx.shadowBlur = 3;
		const lines = watermark.split("\n");
		lines.forEach((line, index) => {
			ctx.fillText(
				line,
				10,
				finalHeight - 2 - (lines.length - index) * fontSize,
			);
		});
	}

	return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * Rotates an image a quarter turn clockwise, into a JPEG data URL.
 *
 * Eloka carried a general any-angle rotation — sixty lines of trig picking a
 * transform origin per quadrant — for a button that only ever passes 90°.
 * @param image - The loaded `<img>` to rotate.
 * @returns A `data:image/jpeg` URL of the rotated image.
 */
export function getRotatedImage(image: HTMLImageElement): string {
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalHeight;
	canvas.height = image.naturalWidth;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context unavailable");

	ctx.translate(canvas.width, 0);
	ctx.rotate(Math.PI / 2);
	ctx.drawImage(image, 0, 0);

	return canvas.toDataURL("image/jpeg");
}

/**
 * Names a capture after the moment it was taken, e.g. `Cam_27_7_2026_18_04.jpg`.
 * @param prefix - Leading word, e.g. `Cam` or `Image`.
 * @param mimeType - The blob's type, used for the extension.
 * @returns A filename.
 */
export function timestampedFileName(prefix: string, mimeType: string): string {
	const stamp = new Date().toLocaleString().replace(/[^0-9]+/g, "_");
	return `${prefix}_${stamp}.${mimeType.split("/")[1] || "jpg"}`;
}

/**
 * Turns a data URL into a `File`, for flows that upload rather than post the
 * base64 string.
 * @param dataUrl - The `data:` URL.
 * @param fileName - Name to use; a timestamped one is generated when omitted.
 * @returns The file.
 */
export async function dataUrlToFile(
	dataUrl: string,
	fileName?: string,
): Promise<File> {
	const blob = await fetch(dataUrl).then((response) => response.blob());
	return new File([blob], fileName || timestampedFileName("Image", blob.type), {
		type: blob.type,
	});
}
