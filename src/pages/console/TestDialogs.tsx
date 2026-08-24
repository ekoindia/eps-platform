import { FileUpload } from "@/components/FileUpload";
import type { CameraOptions } from "@/components/connect/CameraDialog";
import { useConnectDialogs } from "@/components/connect/DialogHost";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { PrintReceipt } from "@/components/connect/PrintReceipt";
import { KycUploadDialog } from "@/components/console/KycUploadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KYC_DOCUMENTS_SAMPLE } from "@/lib/connect/kyc.fixture";
import { parseDocumentList, type KycDocument } from "@/lib/connect/kyc";
import type { FeedbackOrigin } from "@/lib/connect/support";
import {
	compressPdf,
	extractPdfImages,
	mergePdfs,
	pdfFromImages,
	pdfPageCount,
} from "@/lib/pdf/pdf-client";
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
 * Mounted only under `import.meta.env.DEV`, so it never reaches a production bundle.
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
			<Section title="File upload">
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
			<Section title="KYC document upload">
				<KycUploadTest />
			</Section>
			<Section title="PDF tools">
				<PdfToolsTest />
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

/** A labelled `<select>`, for bench options with a fixed set of values. */
function Picker({
	label,
	value,
	options,
	onChange,
	width = "w-40",
}: {
	label: string;
	value: string;
	options: ReadonlyArray<{ label: string; value: string }>;
	onChange: (value: string) => void;
	width?: string;
}) {
	const id = `opt-${label.replace(/\W+/g, "-").toLowerCase()}`;
	return (
		<div className={`flex flex-col gap-1 ${width}`}>
			<Label htmlFor={id} className="text-[10px]">
				{label}
			</Label>
			<select
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-8 rounded-md border border-input bg-background px-2 text-xs"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
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

/** Accept presets for File Upload test */
const ACCEPT_PRESETS = [
	{ label: "Any file type", value: "" },
	{ label: "JPG / PNG / PDF", value: "image/jpeg,image/png,application/pdf" },
	{ label: "Any image type", value: "image/*" },
	{ label: "PDF only", value: "application/pdf" },
];

/** The reusable upload control, with every switch it exposes. */
function FileUploadTest() {
	// The control owns the watermark here, so the editor's free-text field is
	// hidden: two boxes both labelled "watermark" would say nothing about which
	// one wins.
	const { options, controls } = useEditorOptions({ watermarkField: false });
	const [file, setFile] = useState<File | null>(null);
	const [accept, setAccept] = useState("");
	const [cameraOnly, setCameraOnly] = useState(false);
	const [disableImageConfirm, setDisableImageConfirm] = useState(false);
	const [kycWatermark, setKycWatermark] = useState(false);
	const [customWatermark, setCustomWatermark] = useState("");
	const [multiple, setMultiple] = useState(false);

	return (
		<div>
			{controls}
			<div className="mb-3 flex flex-wrap items-end gap-3">
				<Toggle
					label="cameraOnly"
					checked={cameraOnly}
					onChange={setCameraOnly}
				/>
				<Toggle label="multiple" checked={multiple} onChange={setMultiple} />
				<Toggle
					label="disableImageConfirm"
					checked={disableImageConfirm}
					onChange={setDisableImageConfirm}
				/>
				<Toggle
					label="watermark (KYC defaults)"
					checked={kycWatermark}
					onChange={setKycWatermark}
				/>
				<Field
					label="watermark text (overrides)"
					value={customWatermark}
					onChange={setCustomWatermark}
					width="w-56"
				/>
				<Picker
					label="accept"
					value={accept}
					options={ACCEPT_PRESETS.map((preset) => ({
						label: preset.label,
						value: preset.value,
					}))}
					onChange={setAccept}
				/>
			</div>
			{kycWatermark && !customWatermark ? (
				<p className="mb-3 text-xs text-muted-foreground">
					Asks for location permission and calls <code>/me/ip</code>. Stamps
					name + code, org, position + IP, and the timestamp — sign in first, or
					the name and IP lines come out empty.
				</p>
			) : null}
			<FileUpload
				label="Upload your photo"
				accept={accept}
				cameraOnly={cameraOnly}
				// A string wins over the flag, which is what the component does: an
				// explicit caption replaces the KYC defaults rather than joining them.
				watermark={customWatermark || kycWatermark}
				file={file}
				onFileChange={setFile}
				multiple={multiple}
				options={{ ...options, disableImageConfirm }}
				className="max-w-md"
			/>
			{multiple ? (
				<p className="mb-3 text-xs text-muted-foreground">
					Engages only while <code>accept</code> is images and/or PDFs. Two or
					more attachments are combined into one PDF; a single one is passed
					through as itself.
				</p>
			) : null}
			<ResultJson
				value={
					file ? { name: file.name, type: file.type, size: file.size } : null
				}
			/>
		</div>
	);
}

/**
 * Editor options, shared by the editor, camera and upload benches.
 * @param props.watermarkField - Render the free-text watermark box. Off where
 *   the component under test owns the watermark itself.
 */
function useEditorOptions({ watermarkField = true } = {}) {
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
			{watermarkField ? (
				<Field
					label="watermark"
					value={watermark}
					onChange={setWatermark}
					width="w-48"
				/>
			) : null}
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

/**
 * Every `FeedbackOrigin`, flagged with whether interaction 10022 returns issue
 * types for it.
 *
 * Upstream honours only the first four; `Other` and `Error-Boundary` come back
 * `issuetype_list: null`, which the dialog answers with its fallback issue.
 * Both are on the menu on purpose — picking one is how you exercise that path,
 * and how this bench would have caught the blank card it was pinned to.
 */
const FEEDBACK_ORIGINS = [
	{ label: "Response", value: "Response" },
	{ label: "History", value: "History" },
	{ label: "Global-Help", value: "Global-Help" },
	{ label: "Command-Bar", value: "Command-Bar" },
	{ label: "Other (no issue types)", value: "Other" },
	{ label: "Error-Boundary (no issue types)", value: "Error-Boundary" },
] as const satisfies ReadonlyArray<{ label: string; value: FeedbackOrigin }>;

/** Raise a real ticket against UAT, and show what came back to the caller. */
function RaiseIssueTest() {
	const { showRaiseIssue } = useConnectDialogs();
	const [tid, setTid] = useState("");
	const [txTypeId, setTxTypeId] = useState("");
	const [status, setStatus] = useState("");
	const [origin, setOrigin] = useState<FeedbackOrigin>("Global-Help");
	const [autoCapture, setAutoCapture] = useState(false);
	const [result, setResult] = useState<unknown>(null);

	return (
		<div>
			<p className="mb-3 text-xs text-muted-foreground">
				Files a real ticket against whichever connect-api the backend points at.
				Non-production hosts prefix the subject with <code>[IGNORE]</code>.
				<br />
				<code>feedback_origin</code> decides which issue types come back at all
				— the two marked <em>no issue types</em> return none, and land on the
				fallback issue.
			</p>
			<div className="mb-3 flex flex-wrap items-end gap-3">
				<Picker
					label="feedback_origin"
					value={origin}
					options={FEEDBACK_ORIGINS}
					onChange={(value) => setOrigin(value as FeedbackOrigin)}
					width="w-56"
				/>
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
						origin,
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

/**
 * The KYC upload dialog, on the sample document list and without an entitled
 * account.
 *
 * Worth a bench slot for one reason beyond convenience: this dialog is a plain
 * shadcn `Dialog`, and the camera and image editor it opens are portalled by
 * `ConnectDialogProvider` instead. Pick a multi-page document here and open the
 * camera on one of its pages to confirm the two still stack the right way up.
 *
 * It posts for real — expect the upload to fail on an account without the 587
 * entitlement, which is itself the interesting half of the test.
 */
function KycUploadTest() {
	const documents = parseDocumentList(KYC_DOCUMENTS_SAMPLE.data.document_list);
	const [doc, setDoc] = useState<KycDocument | null>(null);
	const [result, setResult] = useState<unknown>(null);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				{documents.map((candidate) => (
					<Button
						key={candidate.docType}
						variant="outline"
						size="sm"
						onClick={() => setDoc(candidate)}
					>
						{candidate.name} ({candidate.pages}p)
					</Button>
				))}
			</div>
			<KycUploadDialog
				doc={doc}
				onClose={(uploaded) => {
					setDoc(null);
					setResult(uploaded ?? { cancelled: true });
				}}
			/>
			<ResultJson value={result} />
		</div>
	);
}

/**
 * The browser-side PDF toolkit, one button per operation.
 *
 * Nothing here touches the network: page counts, merges, image-to-PDF and
 * compression all run in the worker (and pdf.js) on this machine.
 */
function PdfToolsTest() {
	const { showFile } = useConnectDialogs();
	const [files, setFiles] = useState<File[]>([]);
	const [result, setResult] = useState<unknown>(null);
	const [output, setOutput] = useState<string | null>(null);
	const [thumbnails, setThumbnails] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);

	const pdfs = files.filter((file) => file.type === "application/pdf");
	const images = files.filter((file) => file.type.startsWith("image/"));

	/** Runs an operation, showing whatever it produced or why it refused. */
	async function run(label: string, action: () => Promise<unknown>) {
		setBusy(true);
		setResult(null);
		setThumbnails([]);
		const startedAt = performance.now();
		try {
			const value = await action();
			setResult({
				op: label,
				ms: Math.round(performance.now() - startedAt),
				...(value as object),
			});
		} catch (error) {
			setResult({
				op: label,
				error: error instanceof Error ? error.name : "Error",
				message: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setBusy(false);
		}
	}

	/** Publishes a produced PDF so it can be viewed and downloaded. */
	function publish(blob: Blob): { size: number } {
		if (output) URL.revokeObjectURL(output);
		setOutput(URL.createObjectURL(blob));
		return { size: blob.size };
	}

	return (
		<div className="flex flex-col gap-3">
			<Input
				type="file"
				multiple
				accept="application/pdf,image/*"
				onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
			/>
			<p className="text-xs text-muted-foreground">
				{files.length === 0
					? "Pick PDFs and/or images. Everything runs locally."
					: `${pdfs.length} PDF(s), ${images.length} image(s) selected.`}
			</p>

			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={busy || pdfs.length === 0}
					onClick={() =>
						run("pageCount", async () => ({
							pages: await pdfPageCount(pdfs[0]),
							file: pdfs[0].name,
						}))
					}
				>
					Page count
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={busy || pdfs.length < 2}
					onClick={() =>
						run("merge", async () => {
							const merged = await mergePdfs(pdfs);
							return {
								...publish(merged),
								pages: await pdfPageCount(merged),
							};
						})
					}
				>
					Merge PDFs
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={busy || images.length === 0}
					onClick={() =>
						run("pdfFromImages", async () => {
							const built = await pdfFromImages(images);
							return { ...publish(built), pages: images.length };
						})
					}
				>
					Images → PDF
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={busy || pdfs.length === 0}
					onClick={() =>
						run("compress", async () => {
							const compressed = await compressPdf(pdfs[0]);
							publish(compressed.blob);
							return {
								compressed: compressed.compressed,
								originalSize: compressed.originalSize,
								outputSize: compressed.outputSize,
								saved: `${Math.round(
									(1 - compressed.outputSize / compressed.originalSize) * 100,
								)}%`,
							};
						})
					}
				>
					Compress
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={busy || pdfs.length === 0}
					onClick={() =>
						run("extractImages", async () => {
							const extracted = await extractPdfImages(pdfs[0]);
							setThumbnails(extracted.map((blob) => URL.createObjectURL(blob)));
							return { found: extracted.length };
						})
					}
				>
					Extract images
				</Button>
			</div>

			{output && (
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => showFile(output, { type: "pdf" })}
					>
						View result
					</Button>
					<a
						href={output}
						download="result.pdf"
						className="text-sm text-eko-blue underline"
					>
						Download
					</a>
				</div>
			)}

			{thumbnails.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{thumbnails.map((source) => (
						<img
							key={source}
							src={source}
							alt="Extracted"
							className="max-h-32 rounded-md border"
						/>
					))}
				</div>
			)}

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
