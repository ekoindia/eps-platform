import {
	clampBoxToBounds,
	getCompositeFaceBound,
	getDefaultCrop,
	initializeFaceDetector,
} from "@/lib/connect/face-detector";
import {
	dataUrlToFile,
	getProcessedImage,
	getRotatedImage,
} from "@/lib/connect/image";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { Check, Crop as CropIcon, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";

/** Face detection is a nicety; never make the user wait on it. */
const FACE_DETECTION_TIMEOUT_MS = 3000;

/** What the flow may ask the editor to enforce. */
export interface ImageEditorOptions {
	/** Name for the `File` handed back; generated when absent. */
	fileName?: string;
	/** Cap for the longer side of the result, in pixels. */
	maxLength?: number;
	/** Locks the crop to a ratio — 1 for a square portrait, say. */
	aspectRatio?: number;
	/** Find faces, and pre-crop to them. */
	detectFace?: boolean;
	/** Refuse to accept an image with fewer faces than this. */
	minFaceCount?: number;
	/** How many faces the pre-crop should cover. */
	maxFaceCount?: number;
	disableCrop?: boolean;
	disableRotate?: boolean;
	/** Confirm-only: no crop, no rotate. */
	disableImageEdit?: boolean;
	/** Text burnt into the bottom-left of the result. */
	watermark?: string;
}

/** The editor's answer. `accepted: false` means the user rejected the image. */
export interface ImageEditorResult {
	image: string;
	file?: File;
	accepted: boolean;
	[key: string]: unknown;
}

/** Round toolbar button. */
function ToolButton({
	label,
	onClick,
	selected = false,
	variant = "default",
	children,
}: {
	label: string;
	onClick: () => void;
	selected?: boolean;
	variant?: "default" | "accept" | "reject";
	children: React.ReactNode;
}) {
	const tone =
		variant === "accept"
			? "bg-emerald-600 text-white"
			: variant === "reject"
				? "bg-destructive text-white"
				: selected
					? "bg-eko-navy text-white"
					: "bg-white text-black";
	// Accept is a wide pill — the primary action; the rest are circles, which
	// needs an explicit width or the icon plus padding decides it and they come
	// out as slightly squashed ovals.
	const shape = variant === "accept" ? "min-w-25 px-6" : "w-12";
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			aria-pressed={selected}
			className={`flex h-12 cursor-pointer items-center justify-center rounded-full shadow-md hover:brightness-90 ${shape} ${tone}`}
		>
			{children}
		</button>
	);
}

/**
 * Crop, rotate and confirm an image before the flow uploads it.
 *
 * Ports Eloka's editor, minus the ~250-line Chakra `sx` block that
 * re-implemented react-image-crop's own stylesheet inline — the stylesheet is
 * imported instead.
 * @param props.image - Data URL or URL of the image to edit.
 * @param props.options - What the flow requires of the result.
 * @param props.onClose - Called once, with the user's decision.
 */
export function ImageEditorDialog({
	image,
	options = {},
	onClose,
}: {
	image: string;
	options?: ImageEditorOptions;
	onClose: (result: ImageEditorResult) => void;
}) {
	const {
		fileName,
		maxLength,
		aspectRatio,
		detectFace = false,
		minFaceCount = 0,
		maxFaceCount = 1,
		disableCrop = false,
		disableRotate = false,
		disableImageEdit = false,
		watermark,
	} = options;

	const [sourceImage, setSourceImage] = useState(image);
	const [crop, setCrop] = useState<Crop | null>(null);
	const [cropEnabled, setCropEnabled] = useState(
		!(disableCrop || disableImageEdit),
	);
	const [manualCropStarted, setManualCropStarted] = useState(false);
	const [enableCropAfterImageLoad, setEnableCropAfterImageLoad] =
		useState(false);
	const [imageLoaded, setImageLoaded] = useState(false);
	const imageRef = useRef<HTMLImageElement | null>(null);

	const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null);
	const [detectedFaceCount, setDetectedFaceCount] = useState(0);
	const [faceDetectionStatus, setFaceDetectionStatus] = useState<
		"idle" | "loading" | "ready" | "detected" | "failed"
	>("idle");

	// Load MediaPipe, but never let it hold the user up: after the timeout the
	// editor carries on without detection rather than showing a stuck spinner.
	useEffect(() => {
		if (!detectFace) return;

		const abortController = new AbortController();
		setFaceDetectionStatus("loading");

		const timeoutId = setTimeout(() => {
			if (!abortController.signal.aborted) {
				abortController.abort();
				setFaceDetectionStatus("failed");
			}
		}, FACE_DETECTION_TIMEOUT_MS);

		initializeFaceDetector("IMAGE")
			.then((detector) => {
				if (abortController.signal.aborted) return;
				clearTimeout(timeoutId);
				setFaceDetector(detector);
				setFaceDetectionStatus("ready");
			})
			.catch(() => {
				if (abortController.signal.aborted) return;
				clearTimeout(timeoutId);
				setFaceDetectionStatus("failed");
			});

		return () => {
			abortController.abort();
			clearTimeout(timeoutId);
		};
	}, [detectFace]);

	// Pre-crop to the faces once both the image and the detector are ready.
	useEffect(() => {
		const element = imageRef.current;
		if (!imageLoaded || !element || !faceDetector) return;

		try {
			const { detections } = faceDetector.detect(element);
			setDetectedFaceCount(detections?.length ?? 0);
			setFaceDetectionStatus("detected");

			if (!detections?.length || manualCropStarted) return;

			const fullFace = getCompositeFaceBound(detections, maxFaceCount);
			// Detections are in natural pixels; the crop rectangle is in displayed
			// ones. Clamped after scaling: the head box is grown past the detection
			// to take in hair and chin, which for a face near an edge lands outside
			// the picture.
			const scale = element.height / element.naturalHeight;
			const fitted = clampBoxToBounds(
				{
					x: fullFace.x * scale,
					y: fullFace.y * scale,
					width: fullFace.width * scale,
					height: fullFace.height * scale,
				},
				{ width: element.width, height: element.height },
			);
			setCrop({ unit: "px", ...fitted });
		} catch {
			setFaceDetectionStatus("failed");
		}
	}, [imageLoaded, faceDetector, manualCropStarted, maxFaceCount]);

	// Default selection, once the image has laid out and has a displayed size.
	useEffect(() => {
		if (!imageLoaded || !cropEnabled || crop !== null || !imageRef.current) {
			return;
		}
		const { width, height } = imageRef.current;
		setCrop(getDefaultCrop(width, height, aspectRatio));
	}, [imageLoaded, cropEnabled, crop, aspectRatio]);

	function onImageLoad() {
		setImageLoaded(true);
		if (enableCropAfterImageLoad && !(disableCrop || disableImageEdit)) {
			setEnableCropAfterImageLoad(false);
			setCropEnabled(true);
		}
	}

	/** Bakes a quarter turn into the source image, and drops the stale crop. */
	function rotateImage() {
		if (!imageRef.current) return;
		if (crop !== null && cropEnabled) {
			setCrop(null);
			setEnableCropAfterImageLoad(true);
		}
		const rotated = getRotatedImage(imageRef.current);
		setImageLoaded(false);
		setSourceImage(rotated);
	}

	async function onAccept() {
		const element = imageRef.current;
		if (!element) {
			onClose({
				image,
				file: await dataUrlToFile(image, fileName),
				accepted: true,
			});
			return;
		}

		// Enforce the face count only when detection actually ran. Loading, timed
		// out or failed all mean "we don't know" — and a delight feature must not
		// become a gate the user cannot pass.
		const faceDetectionCompleted = faceDetectionStatus === "detected";
		if (
			detectFace &&
			minFaceCount > 0 &&
			faceDetectionCompleted &&
			detectedFaceCount < minFaceCount
		) {
			toast.error(
				(minFaceCount === 1
					? "No face detected."
					: `Minimum ${minFaceCount} faces required.`) + " Please try again",
			);
			return;
		}

		try {
			const processed = getProcessedImage({
				image: element,
				cropEnabled,
				crop,
				maxLength,
				watermark,
			});
			onClose({
				image: processed || sourceImage || image,
				file: await dataUrlToFile(processed, fileName),
				accepted: true,
			});
		} catch {
			onClose({ image, accepted: false });
		}
	}

	const canCrop = !(disableCrop || disableImageEdit);
	const canRotate = !(disableRotate || disableImageEdit);

	return (
		<div className="flex max-h-screen flex-col items-center">
			<ReactCrop
				keepSelection
				aspect={aspectRatio && aspectRatio > 0 ? aspectRatio : undefined}
				crop={crop ?? undefined}
				circularCrop={detectFace && aspectRatio === 1 && maxFaceCount <= 1}
				minWidth={100}
				minHeight={100}
				disabled={!cropEnabled}
				onChange={(next) => {
					setCrop(next);
					if (!manualCropStarted) setManualCropStarted(true);
				}}
			>
				<img
					src={sourceImage}
					ref={imageRef}
					alt="Capture being edited"
					onLoad={onImageLoad}
					className="block max-h-[calc(100vh-60px)] max-w-screen"
				/>
			</ReactCrop>
			{/* In flow, under the image: fixed to the viewport it covered the bottom
			    of the photo — including the crop handles the user needs to drag. */}
			<div className="flex h-15 w-full shrink-0 flex-row-reverse items-center justify-center gap-2.5 rounded-b-md bg-gray-200 md:gap-6">
				<ToolButton label="Accept image" variant="accept" onClick={onAccept}>
					<Check className="h-6 w-6" />
				</ToolButton>
				<ToolButton
					label="Reject image"
					variant="reject"
					onClick={() => onClose({ image, accepted: false })}
				>
					<X className="h-6 w-6" />
				</ToolButton>
				{canCrop ? (
					<ToolButton
						label="Crop image"
						selected={cropEnabled}
						onClick={() => setCropEnabled((enabled) => !enabled)}
					>
						<CropIcon className="h-6 w-6" />
					</ToolButton>
				) : null}
				{canRotate ? (
					<ToolButton label="Rotate image" onClick={rotateImage}>
						<RotateCw className="h-6 w-6" />
					</ToolButton>
				) : null}
			</div>
		</div>
	);
}
