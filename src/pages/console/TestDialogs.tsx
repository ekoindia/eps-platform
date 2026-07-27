import { FileUpload } from "@/components/FileUpload";
import { useConnectDialogs } from "@/components/connect/DialogHost";
import { PrintReceipt } from "@/components/connect/PrintReceipt";
import type { CameraOptions } from "@/components/connect/CameraDialog";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { printPage } from "@/lib/print";
import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";

/**
 * A dev-only bench for the dialogs the Eko Connect widget drives.
 *
 * Those dialogs are normally reachable only from inside a transaction flow,
 * which needs an entitled UAT account and a widget that has finished loading —
 * far too much ceremony to check that a crop still lands on the right pixels.
 * Each section here opens one dialog directly and shows what it resolved with.
 *
 * Modelled on Eloka's `/test` page. Mounted only under `import.meta.env.DEV`,
 * so it never reaches a production bundle.
 */
export default function TestDialogs() {
	return (
		<div className="flex flex-col gap-6">
			<Helmet>
				<title>Dialog test bench | Eko Console</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">
					Dialog test bench
				</h2>
				<p className="text-sm text-muted-foreground">
					Dev-only. Drives the connect dialogs without a transaction flow.
				</p>
			</div>

			<Section title="File viewer">
				<FileViewerTest />
			</Section>
			<Section title="File upload (Eloka's Dropzone)">
				<FileUploadTest />
			</Section>
			<Section title="Image editor">
				<ImageEditorTest />
			</Section>
			<Section title="Camera">
				<CameraTest />
			</Section>
			<Section title="Raise issue">
				<RaiseIssueTest />
			</Section>
			<Section title="Print receipt">
				<PrintTest />
			</Section>
		</div>
	);
}

/** One bordered test block. */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-lg border p-4">
			<h3 className="mb-4 font-medium">{title}</h3>
			{children}
		</section>
	);
}

/** Labelled checkbox, for the option grids. */
function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex items-center gap-1.5 text-xs">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{label}
		</label>
	);
}

/** Labelled short number/text box, for the option grids. */
function Field({
	label,
	value,
	onChange,
	width = "w-24",
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	width?: string;
}) {
	const id = `opt-${label.replace(/\W+/g, "-").toLowerCase()}`;
	return (
		<div className={`flex flex-col gap-1 ${width}`}>
			<Label htmlFor={id} className="text-[10px]">
				{label}
			</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-8 text-xs"
			/>
		</div>
	);
}

/** The accepted image, with the dimensions the pipeline actually produced. */
function ImageResult({ image }: { image: string | null }) {
	const [dimensions, setDimensions] = useState("");
	if (!image) return null;
	return (
		<div className="mt-3 flex flex-col items-start gap-1">
			<img
				src={image}
				alt="Result"
				onLoad={(event) =>
					setDimensions(
						`${event.currentTarget.naturalWidth}×${event.currentTarget.naturalHeight}`,
					)
				}
				className="max-h-100 max-w-full rounded-md border"
			/>
			<p className="text-xs text-muted-foreground">{dimensions}</p>
		</div>
	);
}

/** Pretty-printed dialog result. */
function ResultJson({ value }: { value: unknown }) {
	if (value === null || value === undefined) return null;
	return (
		<pre className="mt-3 max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs">
			{JSON.stringify(value, null, 2)}
		</pre>
	);
}

/** Every viewer branch: image, YouTube, framed page, PDF, and a local file. */
function FileViewerTest() {
	const { showFile } = useConnectDialogs();

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					void showFile(
						"https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg",
					)
				}
			>
				Image
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					void showFile("https://www.youtube.com/watch?v=EzFXDvC-EwM", {
						type: "youtube",
					})
				}
			>
				YouTube
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					void showFile("https://eko.in", { label: "Eko", type: "url" })
				}
			>
				Webpage
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					void showFile(
						"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
						{ label: "Dummy PDF" },
					)
				}
			>
				PDF
			</Button>
			<Button
				variant="outline"
				size="sm"
				// Refused by `isSafeUrl` — this must NOT open a frame.
				onClick={() => void showFile("javascript:alert(1)")}
			>
				javascript: (should refuse)
			</Button>
			<label className="text-xs">
				<span className="mr-2">Local file:</span>
				<input
					type="file"
					onChange={(event) => {
						const picked = event.target.files?.[0];
						if (!picked) return;
						const url = URL.createObjectURL(picked);
						void showFile(url).finally(() => URL.revokeObjectURL(url));
					}}
				/>
			</label>
		</div>
	);
}

/** Accept presets, mirroring Eloka's Dropzone bench. */
const ACCEPT_PRESETS = [
	{ label: "Any file type", value: "" },
	{ label: "JPG / PNG / PDF", value: "image/jpeg,image/png,application/pdf" },
	{ label: "Any image type", value: "image/*" },
	{ label: "PDF only", value: "application/pdf" },
];

/** The reusable upload control, with every switch it exposes. */
function FileUploadTest() {
	const { options, controls } = useEditorOptions();
	const [file, setFile] = useState<File | null>(null);
	const [accept, setAccept] = useState("");
	const [cameraOnly, setCameraOnly] = useState(false);
	const [disableImageConfirm, setDisableImageConfirm] = useState(false);
	const [watermark, setWatermark] = useState(false);

	return (
		<div>
			{controls}
			<div className="mb-3 flex flex-wrap items-end gap-3">
				<Toggle
					label="cameraOnly"
					checked={cameraOnly}
					onChange={setCameraOnly}
				/>
				<Toggle
					label="disableImageConfirm"
					checked={disableImageConfirm}
					onChange={setDisableImageConfirm}
				/>
				<div className="flex flex-col gap-1">
					<Label htmlFor="opt-accept" className="text-[10px]">
						accept
					</Label>
					<select
						id="opt-accept"
						value={accept}
						onChange={(event) => setAccept(event.target.value)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					>
						{ACCEPT_PRESETS.map((preset) => (
							<option key={preset.label} value={preset.value}>
								{preset.label}
							</option>
						))}
					</select>
				</div>
			</div>
			<FileUpload
				label="Upload your photo"
				accept={accept}
				cameraOnly={cameraOnly}
				// Prompts for location and asks the backend for the IP, exactly as a
				// KYC field would. Takes precedence over the free-text `watermark`
				// option above, which is the fallback.
				watermark={watermark}
				file={file}
				onFileChange={setFile}
				options={{ ...options, disableImageConfirm }}
				className="max-w-md"
			/>
			<ResultJson
				value={
					file ? { name: file.name, type: file.type, size: file.size } : null
				}
			/>
		</div>
	);
}

/** Editor options, shared by the editor and camera benches. */
function useEditorOptions() {
	const [detectFace, setDetectFace] = useState(false);
	const [disableCrop, setDisableCrop] = useState(false);
	const [disableRotate, setDisableRotate] = useState(false);
	const [disableImageEdit, setDisableImageEdit] = useState(false);
	const [maxLength, setMaxLength] = useState("1200");
	const [aspectRatio, setAspectRatio] = useState("");
	const [minFaceCount, setMinFaceCount] = useState("1");
	const [maxFaceCount, setMaxFaceCount] = useState("1");
	const [watermark, setWatermark] = useState("");

	const options: ImageEditorOptions = {
		detectFace,
		disableCrop,
		disableRotate,
		disableImageEdit,
		maxLength: Number(maxLength) || undefined,
		aspectRatio: Number(aspectRatio) || undefined,
		minFaceCount: Number(minFaceCount) || 0,
		maxFaceCount: Number(maxFaceCount) || 1,
		watermark: watermark || undefined,
	};

	const controls = (
		<div className="mb-3 flex flex-wrap items-end gap-3">
			<Toggle
				label="detectFace"
				checked={detectFace}
				onChange={setDetectFace}
			/>
			<Toggle
				label="disableCrop"
				checked={disableCrop}
				onChange={setDisableCrop}
			/>
			<Toggle
				label="disableRotate"
				checked={disableRotate}
				onChange={setDisableRotate}
			/>
			<Toggle
				label="disableImageEdit"
				checked={disableImageEdit}
				onChange={setDisableImageEdit}
			/>
			<Field label="maxLength" value={maxLength} onChange={setMaxLength} />
			<Field
				label="aspectRatio"
				value={aspectRatio}
				onChange={setAspectRatio}
			/>
			<Field label="minFaces" value={minFaceCount} onChange={setMinFaceCount} />
			<Field label="maxFaces" value={maxFaceCount} onChange={setMaxFaceCount} />
			<Field
				label="watermark"
				value={watermark}
				onChange={setWatermark}
				width="w-48"
			/>
		</div>
	);

	return { options, controls };
}

/** Pick a local image, run it through the editor, inspect what comes back. */
function ImageEditorTest() {
	const { editImage } = useConnectDialogs();
	const { options, controls } = useEditorOptions();
	const [image, setImage] = useState<string | null>(null);
	const [result, setResult] = useState<unknown>(null);

	return (
		<div>
			{controls}
			<input
				type="file"
				accept="image/*"
				className="text-xs"
				onChange={async (event) => {
					const picked = event.target.files?.[0];
					if (!picked) return;
					const url = URL.createObjectURL(picked);
					try {
						const editorResult = await editImage(url, {
							...options,
							fileName: picked.name,
						});
						setResult({
							...editorResult,
							image: editorResult.image ? "<data URL>" : undefined,
							file: editorResult.file
								? {
										name: editorResult.file.name,
										type: editorResult.file.type,
										size: editorResult.file.size,
									}
								: undefined,
						});
						if (editorResult.accepted) setImage(editorResult.image ?? null);
					} finally {
						URL.revokeObjectURL(url);
						event.target.value = "";
					}
				}}
			/>
			<ImageResult image={image} />
			<ResultJson value={result} />
		</div>
	);
}

/** Open the camera with the same options a flow would send. */
function CameraTest() {
	const { openCamera } = useConnectDialogs();
	const { options, controls } = useEditorOptions();
	const [disableImageConfirm, setDisableImageConfirm] = useState(false);
	const [facing, setFacing] =
		useState<CameraOptions["preferredFacingMode"]>("environment");
	const [image, setImage] = useState<string | null>(null);

	return (
		<div>
			{controls}
			<div className="mb-3 flex flex-wrap items-center gap-3">
				<Toggle
					label="disableImageConfirm"
					checked={disableImageConfirm}
					onChange={setDisableImageConfirm}
				/>
				<Toggle
					label="prefer front camera"
					checked={facing === "user"}
					onChange={(checked) => setFacing(checked ? "user" : "environment")}
				/>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={async () => {
					const result = await openCamera({
						...options,
						disableImageConfirm,
						preferredFacingMode: facing,
					});
					if (result.accepted) setImage(result.image ?? null);
				}}
			>
				Open camera
			</Button>
			<ImageResult image={image} />
		</div>
	);
}

/** Raise a real ticket against UAT, and show what came back to the caller. */
function RaiseIssueTest() {
	const { showRaiseIssue } = useConnectDialogs();
	const [tid, setTid] = useState("");
	const [txTypeId, setTxTypeId] = useState("");
	const [status, setStatus] = useState("");
	const [autoCapture, setAutoCapture] = useState(false);
	const [result, setResult] = useState<unknown>(null);

	return (
		<div>
			<p className="mb-3 text-xs text-muted-foreground">
				Files a real ticket against whichever connect-api the backend points at.
				Non-production hosts prefix the subject with <code>[IGNORE]</code>.
			</p>
			<div className="mb-3 flex flex-wrap items-end gap-3">
				<Field label="tid" value={tid} onChange={setTid} width="w-36" />
				<Field label="tx_typeid" value={txTypeId} onChange={setTxTypeId} />
				<Field label="status" value={status} onChange={setStatus} />
				<Toggle
					label="autoCaptureScreenshot"
					checked={autoCapture}
					onChange={setAutoCapture}
				/>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={async () => {
					setResult(null);
					const answer = await showRaiseIssue({
						origin: "Other",
						tid: tid || undefined,
						tx_typeid: txTypeId || undefined,
						status: status || undefined,
						autoCaptureScreenshot: autoCapture,
						// Echoed back untouched, exactly as a flow's context would be.
						context: { source: "test-bench" },
					});
					setResult(answer);
				}}
			>
				Raise a query
			</Button>
			<ResultJson value={result} />
		</div>
	);
}

/** The print header/footer and the title swap, without a transaction flow. */
function PrintTest() {
	return (
		<div>
			<PrintReceipt heading="Test Receipt">
				<div className="rounded-md border border-dashed p-4 text-sm">
					Printable content. The console rail, header and footer are
					`print:hidden`; the receipt header and footer appear only on paper.
				</div>
			</PrintReceipt>
			<Button
				variant="outline"
				size="sm"
				className="mt-3 print:hidden"
				onClick={() => printPage("Test Receipt")}
			>
				Print
			</Button>
		</div>
	);
}
