import { useConnectDialogs } from "@/components/connect/DialogHost";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { dataUrlToFile, timestampedFileName } from "@/lib/connect/image";
import { Camera, SwitchCamera, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
	}

	async function onCapture() {
		const imageSrc = webcamRef.current?.getScreenshot();
		if (!imageSrc) return;

		if (disableImageConfirm) {
			onClose({
				image: imageSrc,
				file: await dataUrlToFile(
					imageSrc,
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
		const result = await editImage(imageSrc, editorOptions);
		if (result.accepted) {
			onClose(result as CameraResult);
			return;
		}
		// Rejected: back to the camera rather than out of it.
		void video?.play();
	}

	return (
		<div className="flex flex-col items-center">
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
				onUserMedia={() => {
					// Only after permission is granted do device labels arrive — before
					// that every camera is an unnamed "other" and cannot be classified.
					if (!devices.length) {
						navigator.mediaDevices
							.enumerateDevices()
							.then(loadDevices)
							.catch(() => undefined);
					}
					setStatus("ready");
				}}
				onUserMediaError={(error) => {
					setStatus("error");
					setErrorMessage(String(error));
				}}
				className="max-h-[calc(100vh-80px)] max-w-full rounded-md"
			/>
			<div className="h-20 w-full" />
			{status === "ready" ? (
				<div className="fixed inset-x-0 bottom-0 flex h-20 flex-row-reverse items-center justify-center gap-2.5 bg-black/60 md:gap-6 md:rounded-md">
					<IconButton label="Capture image" isMain onClick={onCapture}>
						<Camera className="h-7 w-7" />
					</IconButton>
					{devices.length > 1 ? (
						<IconButton label="Switch camera" onClick={switchCamera}>
							<SwitchCamera className="h-6 w-6" />
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
