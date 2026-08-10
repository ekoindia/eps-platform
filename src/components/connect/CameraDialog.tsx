import { useConnectDialogs } from "@/components/connect/DialogHost";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { blurScoreFromVideo, DEFAULT_BLUR_THRESHOLD } from "@/lib/connect/blur";
import {
	blobToDataUrl,
	hasTorch,
	requestContinuousFocus,
	setTorch,
	takeFullResolutionPhoto,
} from "@/lib/connect/camera";
import { dataUrlToFile, timestampedFileName } from "@/lib/connect/image";
import { Camera, SwitchCamera, X, Zap, ZapOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

/** Device labels are all we get to tell cameras apart with. */
const WEBCAM_PATTERN = /webcam|usb/i;
const FACING_USER_PATTERN = /front|self|user/i;
const FACING_ENVIRONMENT_PATTERN = /back|rear/i;

/** Capture resolution asked of `getUserMedia`. */
const RESOLUTION = { width: 1920, height: 1080 };

interface CameraDevice {
	label: string;
	deviceId: string;
	type: "user" | "environment" | "webcam" | "other";
	/** Front-facing previews are mirrored, or the user cannot aim. */
	mirrored: boolean;
}

/** What the flow may ask of the capture — passed straight through to the editor. */
export interface CameraOptions extends ImageEditorOptions {
	preferredFacingMode?: "user" | "environment";
	/** Hand the raw capture back without showing the editor. */
	disableImageConfirm?: boolean;
}

/** The camera's answer. `accepted: false` means no usable capture. */
export interface CameraResult {
	image: string;
	file?: File;
	accepted: boolean;
	[key: string]: unknown;
}

/**
 * Classifies each camera by what its label says it is.
 * @param devices - Video inputs from `enumerateDevices`.
 * @param preferredFacingMode - Which way an unlabelled camera should be assumed
 *   to face, which decides whether its preview is mirrored.
 * @returns The same devices, typed.
 */
function classifyDevices(
	devices: MediaDeviceInfo[],
	preferredFacingMode: "user" | "environment",
): CameraDevice[] {
	return devices.map(({ label, deviceId }) => {
		const lowerCaseLabel = label.toLowerCase();
		if (FACING_USER_PATTERN.test(lowerCaseLabel)) {
			return { label, deviceId, type: "user", mirrored: true };
		}
		if (FACING_ENVIRONMENT_PATTERN.test(lowerCaseLabel)) {
			return { label, deviceId, type: "environment", mirrored: false };
		}
		return {
			label,
			deviceId,
			type: WEBCAM_PATTERN.test(lowerCaseLabel) ? "webcam" : "other",
			mirrored: preferredFacingMode === "user",
		};
	});
}

/**
 * Picks which camera to open: a laptop webcam if there is one, otherwise the
 * first camera facing the way the flow asked for.
 * @param devices - The classified cameras.
 * @param preferredFacingMode - The flow's preference.
 * @returns Index into `devices`.
 */
function pickDeviceIndex(
	devices: CameraDevice[],
	preferredFacingMode: "user" | "environment",
): number {
	const firstOfType: Partial<Record<CameraDevice["type"], number>> = {};
	devices.forEach((device, index) => {
		if (firstOfType[device.type] === undefined)
			firstOfType[device.type] = index;
	});
	return firstOfType.webcam ?? firstOfType[preferredFacingMode] ?? 0;
}

/** Round toolbar button. */
function IconButton({
	label,
	onClick,
	isMain = false,
	className = "",
	children,
}: {
	label: string;
	onClick: () => void;
	isMain?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`flex cursor-pointer items-center justify-center rounded-full p-2.5 shadow-md hover:brightness-90 ${
				isMain
					? "h-15 w-15 outline-2 outline-offset-2 outline-white"
					: "h-12 w-12"
			} ${className || "bg-white text-black"}`}
		>
			{children}
		</button>
	);
}

/**
 * Full-screen camera capture.
 *
 * Unless the flow disabled confirmation, the capture is handed to the image
 * editor stacked on top of this dialog: accepting there closes both, rejecting
 * resumes the paused preview so the user can simply take another shot.
 * @param props.options - Capture and downstream editing requirements.
 * @param props.onClose - Called once, with the accepted capture or a rejection.
 */
export function CameraDialog({
	options = {},
	onClose,
}: {
	options?: CameraOptions;
	onClose: (result: CameraResult) => void;
}) {
	const {
		preferredFacingMode = "environment",
		disableImageConfirm = false,
		...editorOptions
	} = options;

	const { editImage } = useConnectDialogs();
	const webcamRef = useRef<Webcam | null>(null);
	const [devices, setDevices] = useState<CameraDevice[]>([]);
	const [deviceIndex, setDeviceIndex] = useState(0);
	const [videoConstraints, setVideoConstraints] =
		useState<MediaTrackConstraints>(RESOLUTION);
	const [status, setStatus] = useState<"init" | "ready" | "error">("init");
	const [errorMessage, setErrorMessage] = useState("");
	// `takePhoto` hunts for focus for up to a few seconds; a second tap during
	// that window would race two captures into one dialog.
	const [capturing, setCapturing] = useState(false);
	const [torchAvailable, setTorchAvailable] = useState(false);
	const [torchOn, setTorchOn] = useState(false);

	// Live sharpness of the preview, smoothed. Null until there is a frame to
	// judge, and whenever the check is off for this capture.
	const [liveSharpness, setLiveSharpness] = useState<number | null>(null);
	const smoothedRef = useRef<number | null>(null);
	const liveCheckEnabled = (editorOptions.blurCheck ?? "off") !== "off";
	const liveThreshold = editorOptions.blurThreshold ?? DEFAULT_BLUR_THRESHOLD;

	// Score the preview a few times a second so the UI can say "hold steady"
	// BEFORE the shot — far kinder than rejecting the photo after. An interval,
	// not rAF: four frames a second is plenty for a hand to react to, and a
	// phone mid-preview has better uses for its frame budget.
	useEffect(() => {
		if (!liveCheckEnabled || status !== "ready") return;
		const timer = setInterval(() => {
			const video = webcamRef.current?.video;
			// Frozen preview (editor open) keeps the last verdict rather than
			// re-judging a still.
			if (!video || video.paused) return;
			const frame = blurScoreFromVideo(video);
			if (frame === null) return;
			// Light smoothing so the badge does not flicker on the hand's jitter.
			smoothedRef.current =
				smoothedRef.current === null
					? frame
					: Math.round(smoothedRef.current * 0.6 + frame * 0.4);
			setLiveSharpness(smoothedRef.current);
		}, 250);
		return () => clearInterval(timer);
	}, [liveCheckEnabled, status]);

	/** Reads the device list once permission has been granted and labels exist. */
	const loadDevices = useCallback(
		(mediaDevices: MediaDeviceInfo[]) => {
			const found = classifyDevices(
				mediaDevices.filter((device) => device.kind === "videoinput"),
				preferredFacingMode,
			);
			if (!found.length) return;
			const index = pickDeviceIndex(found, preferredFacingMode);
			setDevices(found);
			setDeviceIndex(index);
			setVideoConstraints({ ...RESOLUTION, deviceId: found[index].deviceId });
		},
		[preferredFacingMode],
	);

	function switchCamera() {
		if (devices.length <= 1) return;
		const next = deviceIndex < devices.length - 1 ? deviceIndex + 1 : 0;
		setDeviceIndex(next);
		setVideoConstraints({ ...RESOLUTION, deviceId: devices[next].deviceId });
		// The new track starts torch-off and may not have one at all.
		setTorchOn(false);
		setTorchAvailable(false);
	}

	async function toggleTorch() {
		const next = !torchOn;
		if (await setTorch(webcamRef.current?.stream ?? null, next)) {
			setTorchOn(next);
		}
	}

	/**
	 * The best still this browser can produce: a real photograph at sensor
	 * resolution where `ImageCapture` exists, the 1080p video-frame screenshot
	 * everywhere else. The screenshot also covers `takePhoto()` failing or
	 * timing out mid-focus-hunt.
	 */
	async function bestCapture(): Promise<{
		/** URL for the editor/preview — object URL for a photo, data URL for a screenshot. */
		src: string;
		isObjectUrl: boolean;
		photo: Blob | null;
	} | null> {
		const photo = await takeFullResolutionPhoto(
			webcamRef.current?.stream ?? null,
		);
		if (photo) {
			return { src: URL.createObjectURL(photo), isObjectUrl: true, photo };
		}
		const imageSrc = webcamRef.current?.getScreenshot();
		return imageSrc ? { src: imageSrc, isObjectUrl: false, photo: null } : null;
	}

	async function onCapture() {
		if (capturing) return;
		setCapturing(true);
		try {
			const captured = await bestCapture();
			if (!captured) return;

			if (disableImageConfirm) {
				// Callers own `image` as a never-revoked preview string, so it must
				// be a data URL — an object URL handed over here would leak.
				const image = captured.photo
					? ((await blobToDataUrl(captured.photo)) ??
						webcamRef.current?.getScreenshot())
					: captured.src;
				if (captured.isObjectUrl) URL.revokeObjectURL(captured.src);
				if (!image) return;
				onClose({
					image,
					file: await dataUrlToFile(
						image,
						timestampedFileName("Cam", "image/jpeg"),
					),
					accepted: true,
				});
				return;
			}

			// Freeze the preview while the editor is up, so the live feed does not
			// keep running behind a still of itself.
			const video = webcamRef.current?.video;
			video?.pause();
			try {
				const result = await editImage(captured.src, editorOptions);
				if (result.accepted) {
					onClose(result as CameraResult);
					return;
				}
				// Rejected: back to the camera rather than out of it.
				void video?.play();
			} finally {
				// The editor re-encodes into its own data URL, so the source can go.
				if (captured.isObjectUrl) URL.revokeObjectURL(captured.src);
			}
		} finally {
			setCapturing(false);
		}
	}

	return (
		// `relative`: the sharpness badge anchors to the preview's top edge.
		<div className="relative flex flex-col items-center">
			<Webcam
				ref={webcamRef}
				audio={false}
				screenshotFormat="image/jpeg"
				screenshotQuality={0.9}
				minScreenshotHeight={500}
				minScreenshotWidth={500}
				forceScreenshotSourceSize
				imageSmoothing
				mirrored={devices[deviceIndex]?.mirrored ?? false}
				videoConstraints={videoConstraints}
				onUserMedia={(stream) => {
					// Only after permission is granted do device labels arrive — before
					// that every camera is an unnamed "other" and cannot be classified.
					if (!devices.length) {
						navigator.mediaDevices
							.enumerateDevices()
							.then(loadDevices)
							.catch(() => undefined);
					}
					// Both are progressive: a camera without focus control or a torch
					// simply ignores us.
					requestContinuousFocus(stream);
					setTorchAvailable(hasTorch(stream));
					setStatus("ready");
				}}
				onUserMediaError={(error) => {
					setStatus("error");
					setErrorMessage(String(error));
				}}
				className="max-h-[calc(100vh-80px)] max-w-full rounded-md"
			/>
			{status === "ready" && liveCheckEnabled && liveSharpness !== null ? (
				// Over the preview's top edge, where the eye already is while
				// framing. Says what to DO, not what the number is.
				<p
					className={`pointer-events-none absolute left-1/2 top-2.5 z-10 -translate-x-1/2 select-none rounded-full px-3 py-1 text-xs font-medium text-white shadow-md ${
						liveSharpness >= liveThreshold
							? "bg-emerald-600/90"
							: "bg-amber-600/90"
					}`}
				>
					{liveSharpness >= liveThreshold ? "Sharp" : "Blurry — hold steady"}
					{import.meta.env.DEV ? ` · ${liveSharpness}` : null}
				</p>
			) : null}
			{status === "ready" ? (
				// Under the preview, not over it: a fixed bar hides whatever the user
				// is trying to frame at the bottom of the shot.
				<div className="flex h-20 w-full shrink-0 flex-row-reverse items-center justify-center gap-2.5 rounded-b-md bg-black/60 md:gap-6">
					<IconButton
						label={capturing ? "Capturing…" : "Capture image"}
						isMain
						onClick={() => void onCapture()}
					>
						<Camera className={`h-7 w-7 ${capturing ? "animate-pulse" : ""}`} />
					</IconButton>
					{devices.length > 1 ? (
						<IconButton label="Switch camera" onClick={switchCamera}>
							<SwitchCamera className="h-6 w-6" />
						</IconButton>
					) : null}
					{torchAvailable ? (
						<IconButton
							label={torchOn ? "Turn light off" : "Turn light on"}
							onClick={() => void toggleTorch()}
							className={torchOn ? "bg-amber-400 text-black" : ""}
						>
							{torchOn ? (
								<Zap className="h-6 w-6" />
							) : (
								<ZapOff className="h-6 w-6" />
							)}
						</IconButton>
					) : null}
				</div>
			) : (
				<p className="fixed inset-0 flex items-center justify-center text-sm text-white">
					{status === "error" ? errorMessage : "Starting camera…"}
				</p>
			)}
			<IconButton
				label="Close camera"
				className="fixed right-2.5 top-2.5 bg-black/40 text-white hover:bg-red-900/60"
				onClick={() => onClose({ image: "", accepted: false })}
			>
				<X className="h-6 w-6" />
			</IconButton>
		</div>
	);
}
