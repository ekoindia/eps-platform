import { centerCrop, makeAspectCrop, type Crop } from "react-image-crop";
import type { Detection, FaceDetector } from "@mediapipe/tasks-vision";

/** A face's box as MediaPipe reports it, in natural-image pixels. */
type BoundingBox = {
	originX: number;
	originY: number;
	width: number;
	height: number;
};

/** A rectangle in natural-image pixels. */
export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Loads MediaPipe and builds a face detector.
 *
 * The import is dynamic and the WASM is fetched from a CDN, so nothing here is
 * paid for unless a flow actually asks for face detection. The caller is
 * expected to time this out — see `ImageEditorDialog`.
 * @param runningMode - `IMAGE` for stills, `VIDEO` for a stream.
 * @returns A ready detector.
 */
export async function initializeFaceDetector(
	runningMode: "IMAGE" | "VIDEO" = "IMAGE",
): Promise<FaceDetector> {
	const { FaceDetector, FilesetResolver } =
		await import("@mediapipe/tasks-vision");
	const vision = await FilesetResolver.forVisionTasks(
		"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
	);
	return FaceDetector.createFromOptions(vision, {
		baseOptions: {
			modelAssetPath: "/wasm/mediapipe-models/blaze_face_short_range.tflite",
			delegate: "GPU",
		},
		runningMode,
	});
}

/**
 * Expands a detection box to the whole head.
 *
 * The model returns a tight eyes-to-lips box; a portrait crop of that looks
 * decapitated, so grow it to include hair, forehead and chin and square it off.
 * @param boundingBox - The model's box.
 * @returns The head box, clamped to the image's top-left corner.
 */
export function getFullFaceBound(boundingBox: BoundingBox): Box {
	const { originX: x, originY: y, width, height } = boundingBox;

	const extraHeight = height * 0.55;
	const extraChinHeight = height * 0.1;
	const fullFaceY = y - extraHeight;
	const fullFaceHeight = height + extraHeight + extraChinHeight;

	let fullFaceWidth = width;
	let fullFaceX = x;
	if (width < fullFaceHeight) {
		fullFaceX -= (fullFaceHeight - width) / 2;
		fullFaceWidth = fullFaceHeight;
	}

	return {
		x: fullFaceX < 0 ? 0 : fullFaceX,
		y: fullFaceY < 0 ? 0 : fullFaceY,
		width: fullFaceWidth,
		height: fullFaceHeight,
	};
}

/**
 * The smallest box containing every face worth keeping.
 * @param detections - Faces found in the image.
 * @param maxFaceCount - How many of them to include.
 * @returns One box covering those faces.
 */
export function getCompositeFaceBound(
	detections: Detection[],
	maxFaceCount = 1,
): Box {
	let x1 = Number.MAX_VALUE;
	let y1 = Number.MAX_VALUE;
	let x2 = 0;
	let y2 = 0;

	const faceCount = Math.min(detections.length, maxFaceCount);
	for (let i = 0; i < faceCount; i++) {
		const box = detections[i].boundingBox;
		if (!box) continue;
		const { x, y, width, height } = getFullFaceBound(box);
		x1 = Math.min(x1, x);
		y1 = Math.min(y1, y);
		x2 = Math.max(x2, x + width);
		y2 = Math.max(y2, y + height);
	}

	return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Fits a box inside the image.
 *
 * `getFullFaceBound` grows a detection by half its height to take in hair and
 * chin, and squares it off — for a face near an edge that lands partly outside
 * the picture, and react-image-crop will happily render the selection there.
 * The crop is then read back scaled against the source bitmap, so the overhang
 * is not merely cosmetic: it crops from pixels that do not exist.
 *
 * Shrinking keeps the aspect ratio rather than clipping one side, because a
 * square face box is what makes `circularCrop` a circle instead of an ellipse.
 * @param box - The box to fit, in the same units as `bounds`.
 * @param bounds - The image's width and height.
 * @returns A box wholly inside the image.
 */
export function clampBoxToBounds(
	box: Box,
	bounds: { width: number; height: number },
): Box {
	const scale = Math.min(
		1,
		bounds.width / box.width,
		bounds.height / box.height,
	);
	const width = box.width * scale;
	const height = box.height * scale;

	return {
		x: Math.min(Math.max(box.x, 0), bounds.width - width),
		y: Math.min(Math.max(box.y, 0), bounds.height - height),
		width,
		height,
	};
}

/**
 * The crop selection to start with: the whole image, or the largest centred
 * rectangle of the required aspect ratio.
 * @param width - Displayed image width.
 * @param height - Displayed image height.
 * @param aspectRatio - Required ratio, if the flow demands one.
 * @returns The initial crop.
 */
export function getDefaultCrop(
	width: number,
	height: number,
	aspectRatio?: number,
): Crop {
	const full = { unit: "px", x: 0, y: 0, width, height } as const;
	if (!aspectRatio || aspectRatio <= 0) return full;
	return centerCrop(
		makeAspectCrop(full, aspectRatio, width, height),
		width,
		height,
	);
}
