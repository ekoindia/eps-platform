import { useConnectDialogs } from "@/components/connect/DialogHost";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWatermarkText, type WatermarkSpec } from "@/hooks/use-watermark";
import { cn } from "@/lib/utils";
import { Camera, FolderOpen, ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** What the picked image must satisfy before it is accepted. */
export interface FileUploadOptions extends ImageEditorOptions {
	/** Take the capture as-is, skipping the crop/confirm step. */
	disableImageConfirm?: boolean;
}

export interface FileUploadProps {
	/** Field label. */
	label?: string;
	/** The currently attached file. */
	file: File | null | undefined;
	/** Called with the new file, or null when discarded. */
	onFileChange: (file: File | null) => void;
	/** `accept` for the file input, e.g. `image/*,application/pdf`. */
	accept?: string;
	/** Camera as the only source: no picker, no drag and drop. */
	cameraOnly?: boolean;
	/**
	 * Provenance burnt into the bottom-left of a captured or edited image.
	 *
	 * `true` stamps the KYC defaults — who is signed in, the org, the position
	 * and IP, and the moment — which is what makes a capture evidence rather
	 * than just a photo. An object keeps those and overrides the keys it names;
	 * a string is stamped verbatim. See {@link useWatermarkText}.
	 */
	watermark?: WatermarkSpec;
	/** Editing requirements applied to images from every source. */
	options?: FileUploadOptions;
	required?: boolean;
	disabled?: boolean;
	className?: string;
}

/**
 * Whether a MIME type names an image.
 * @param type - A MIME type, possibly empty.
 * @returns True for `image/*`.
 */
function isImageType(type?: string): boolean {
	return Boolean(type && type.toLowerCase().startsWith("image/"));
}

/**
 * Whether an `accept` string permits a MIME type.
 *
 * Handles the `image/*` wildcard, which Eloka's `accept.indexOf(type)` check
 * rejected — dragging a PNG onto a zone that accepts `image/*` was refused.
 * @param accept - The accept attribute; empty means everything.
 * @param type - The candidate MIME type.
 * @returns True when the type is allowed.
 */
export function acceptsType(accept: string, type: string): boolean {
	if (!accept) return true;
	if (!type) return false;
	return accept.split(",").some((entry) => {
		const rule = entry.trim().toLowerCase();
		if (!rule) return false;
		if (rule.endsWith("/*"))
			return type.toLowerCase().startsWith(rule.slice(0, -1));
		return rule === type.toLowerCase();
	});
}

/** Whether the zone can take an image at all. */
function acceptsImages(accept: string): boolean {
	return !accept || accept.split(",").some((rule) => isImageType(rule.trim()));
}

/** Whether the zone can take something that is not an image. */
function acceptsNonImages(accept: string): boolean {
	return !accept || accept.split(",").some((rule) => !isImageType(rule.trim()));
}

/**
 * File input with a camera, an image editor and a preview.
 *
 * An attachment is rarely usable as it leaves the phone: it is 4 MB, rotated, and shows the whole desk around the document.
 * So every image — picked, dropped or captured — goes through the editor
 * (`options` decide crop, ratio, size cap, face checks) and only the processed
 * result is handed to the caller.
 *
 * Requires a `ConnectDialogProvider` above it, which owns the three dialogs
 * this drives.
 *
 * `watermark` carries provenance into the pixels: pass `true` for the KYC
 * defaults (user, org, position, IP, timestamp) as Eloka's flag did, an object
 * to override individual fields, or a string to stamp exact text.
 * @param props - See {@link FileUploadProps}.
 * @example
 * <FileUpload
 *   label="Shop photo"
 *   accept="image/*"
 *   file={photo}
 *   onFileChange={setPhoto}
 *   options={{ aspectRatio: 1, maxLength: 1200 }}
 * />
 */
export function FileUpload({
	label,
	file,
	onFileChange,
	accept = "",
	cameraOnly = false,
	watermark,
	options = {},
	required = false,
	disabled = false,
	className,
}: FileUploadProps) {
	const { editImage, openCamera, showFile } = useConnectDialogs();
	// Resolved here rather than at capture time: the position prompt and the IP
	// call must already have settled when the editor draws, or the first capture
	// of a session is stamped with a blank location.
	const watermarkText = useWatermarkText(watermark);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [dragState, setDragState] = useState<"none" | "valid" | "invalid">(
		"none",
	);

	// Previews of unedited files are object URLs; the editor's are data URLs.
	// Track and release the former, or a long form leaks every image the user
	// tried.
	const objectUrlRef = useRef<string | null>(null);
	useEffect(
		() => () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		},
		[],
	);

	const imageAllowed = acceptsImages(accept);
	const nonImageAllowed = acceptsNonImages(accept);
	const editorOptions = {
		...options,
		watermark: watermarkText || options.watermark,
	};

	/** Replaces the preview, releasing the previous object URL if there was one. */
	function showPreview(url: string | null, isObjectUrl = false) {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		objectUrlRef.current = isObjectUrl ? url : null;
		setPreview(url);
	}

	/** Clears the native input so re-picking the same file still fires `change`. */
	function resetInput() {
		if (inputRef.current) inputRef.current.value = "";
	}

	/** Hands a file to the caller and shows its preview. */
	function attach(picked: File, image: string | null, isObjectUrl = false) {
		showPreview(image, isObjectUrl);
		onFileChange(picked);
	}

	/** Routes a file: images through the editor, anything else straight through. */
	async function handleFile(picked: File | undefined | null) {
		if (!picked || disabled) return;

		if (!isImageType(picked.type)) {
			attach(picked, null);
			return;
		}

		const objectUrl = URL.createObjectURL(picked);

		if (options.disableImageConfirm) {
			// Taken as-is, but still previewed — the URL now belongs to the preview.
			attach(picked, objectUrl, true);
			return;
		}

		try {
			const result = await editImage(objectUrl, {
				fileName: picked.name,
				...editorOptions,
			});
			if (result.accepted && result.file) {
				attach(result.file, result.image ?? null);
			} else {
				resetInput();
			}
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	async function captureFromCamera() {
		const result = await openCamera(editorOptions);
		if (result.accepted && result.file) {
			attach(result.file, result.image ?? null);
		}
	}

	function onDragOver(event: React.DragEvent) {
		if (cameraOnly || disabled) return;
		event.preventDefault();
		const type = event.dataTransfer.items[0]?.type ?? "";
		setDragState(type && acceptsType(accept, type) ? "valid" : "invalid");
	}

	async function onDrop(event: React.DragEvent) {
		if (cameraOnly || disabled) return;
		event.preventDefault();
		const wasValid = dragState === "valid";
		setDragState("none");
		if (!wasValid) return;

		const dropped = event.dataTransfer.files[0];
		if (dropped) {
			void handleFile(dropped);
			return;
		}

		// Dragged from another tab rather than the file system: the item is a URL,
		// and the bytes have to be fetched. Cross-origin hosts without CORS simply
		// refuse, which is why this is a fallback and not the main path.
		const item = event.dataTransfer.items[0];
		if (item?.kind !== "string") return;
		const url = await new Promise<string>((resolve) =>
			item.getAsString(resolve),
		);
		try {
			const blob = await fetch(url).then((response) => response.blob());
			if (!acceptsType(accept, blob.type)) return;
			const stamp = new Date().toLocaleString().replace(/[^0-9]+/g, "_");
			const name = `FileDrop_${stamp}.${blob.type.split("/")[1] || "jpg"}`;
			void handleFile(new File([blob], name, { type: blob.type }));
		} catch {
			// Nothing to attach; the user can still pick the file.
		}
	}

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			{label ? (
				<Label>
					{label}
					{required ? " *" : ""}
				</Label>
			) : null}
			<div
				onDragOver={onDragOver}
				onDragLeave={() => setDragState("none")}
				onDrop={(event) => void onDrop(event)}
				className={cn(
					"flex flex-col items-center gap-2 rounded-lg border-2 p-5 transition-colors",
					cameraOnly ? "border-solid" : "border-dashed",
					dragState === "valid" && "border-emerald-500 bg-emerald-500/10",
					dragState === "invalid" && "border-destructive bg-destructive/10",
					disabled && "pointer-events-none opacity-50",
				)}
			>
				{file ? (
					<div className="relative">
						{preview ? (
							<img
								src={preview}
								alt={label ?? "Attachment"}
								onClick={() => void showFile(preview)}
								className="max-h-50 max-w-full cursor-pointer rounded-sm shadow-sm"
							/>
						) : (
							<p className="max-w-60 truncate text-xs" title={file.name}>
								{file.name}
							</p>
						)}
						<button
							type="button"
							aria-label="Discard file"
							onClick={() => {
								showPreview(null);
								onFileChange(null);
								resetInput();
							}}
							className="absolute -right-2.5 -top-2.5 cursor-pointer rounded-full bg-eko-navy p-1 text-white"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
				) : (
					<>
						<input
							ref={inputRef}
							type="file"
							accept={accept || undefined}
							disabled={disabled}
							hidden
							onChange={(event) => void handleFile(event.target.files?.[0])}
						/>
						<div className="flex flex-wrap items-center justify-center gap-2">
							{cameraOnly ? null : (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={disabled}
									onClick={() => inputRef.current?.click()}
									className="gap-2"
								>
									{nonImageAllowed ? (
										<FolderOpen className="h-4 w-4" />
									) : (
										<ImageIcon className="h-4 w-4" />
									)}
									Select {nonImageAllowed ? "file" : "photo"}
								</Button>
							)}
							{imageAllowed ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={disabled}
									onClick={() => void captureFromCamera()}
									className="gap-2"
								>
									<Camera className="h-4 w-4" />
									{cameraOnly ? "Open camera" : "Camera"}
								</Button>
							) : null}
						</div>
						{cameraOnly ? null : (
							<p className="select-none text-xs text-muted-foreground">
								{dragState === "none"
									? "or drag and drop the file here"
									: dragState === "valid"
										? "Drop your file here"
										: "File type not allowed"}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
}
