import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { dataUrlToFile } from "@/lib/connect/image";
import {
	buildIssueCatalogue,
	GENERIC_ISSUE_TYPE,
	isRaiseWindowOpen,
	REQUIREMENT,
	type Category,
	type FeedbackOrigin,
	type IssueCatalogue,
	type IssueFile,
	type IssueInput,
	type IssueType,
} from "@/lib/connect/support";
import { CheckCircle2, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";

/** What the flow (or a history row) knows about the thing being queried. */
export interface RaiseIssueOptions {
	origin?: FeedbackOrigin;
	tid?: string;
	tx_typeid?: string;
	status?: string | number;
	/**
	 * When the transaction happened, which gates `raise_issue_after`.
	 *
	 * Both spellings are accepted on purpose: Eloka's card read `transactionTime`
	 * while its own history rows sent `transaction_time`, so the gate silently
	 * never applied there.
	 */
	transactionTime?: string;
	transaction_time?: string;
	metadata?: {
		transaction_detail?: Record<string, unknown>;
		pre_msg_template?: string;
	};
	/** Opaque caller context, echoed back untouched on close. */
	context?: unknown;
}

/** What the caller gets back. Empty on a plain dismissal. */
export interface RaiseIssueResult {
	feedback_ticket_id?: string;
	context?: unknown;
	[key: string]: unknown;
}

/** Screen capture options; `preferCurrentTab` and friends are not in lib.dom. */
const DISPLAY_MEDIA_OPTIONS = {
	video: { displaySurface: "browser" },
	audio: false,
	preferCurrentTab: true,
	selfBrowserSurface: "include",
	systemAudio: "exclude",
	surfaceSwitching: "exclude",
	// A whole-screen share would capture whatever else is on the user's desktop.
	monitorTypeSurfaces: "exclude",
} as unknown as DisplayMediaStreamOptions;

/** Selectable chip, used for categories and issue types alike. */
function Chip({
	selected,
	onClick,
	disabled,
	children,
}: {
	selected?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant={selected ? "default" : "outline"}
			size="sm"
			disabled={disabled}
			onClick={onClick}
			className="h-auto rounded-full whitespace-normal py-1.5 text-xs"
		>
			{children}
		</Button>
	);
}

/** One step of the category → sub-category → issue narrowing. */
function ChipList({
	label,
	items,
	selectedId,
	disabled,
	alwaysExpanded = false,
	onSelect,
}: {
	label: string;
	items: Array<{ id: string | number; title: string }>;
	selectedId: string | number | null;
	disabled?: boolean;
	/** The issue list stays expanded even with one option; the others collapse. */
	alwaysExpanded?: boolean;
	onSelect: (id: string | number | null) => void;
}) {
	if (!items.length) return null;
	// A single choice is not a choice: it is auto-selected, so showing the step
	// would only add a click.
	if (!alwaysExpanded && items.length <= 1 && selectedId !== null) return null;

	const selected = items.find((item) => item.id === selectedId);

	return (
		<div className="mb-6">
			<p className="mb-1 ml-1 text-xs font-medium text-muted-foreground">
				{label}
			</p>
			<div className="flex flex-wrap gap-2">
				{!alwaysExpanded && selected ? (
					<>
						<Chip selected>{selected.title}</Chip>
						<Chip disabled={disabled} onClick={() => onSelect(null)}>
							Change…
						</Chip>
					</>
				) : (
					items.map((item) => (
						<Chip
							key={item.id}
							selected={item.id === selectedId}
							disabled={disabled}
							onClick={() => onSelect(item.id)}
						>
							{item.title}
						</Chip>
					))
				)}
			</div>
		</div>
	);
}

/** Capture, preview and discard a screenshot of the page behind this dialog. */
function ScreenshotField({
	screenshot,
	disabled,
	onCapture,
	setHidden,
}: {
	screenshot: string | null;
	disabled?: boolean;
	onCapture: (image: string | null) => void;
	setHidden: (hidden: boolean) => void;
}) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	function stopCapture() {
		const video = videoRef.current;
		const stream = video?.srcObject as MediaStream | null;
		stream?.getTracks().forEach((track) => track.stop());
		if (video) video.srcObject = null;
		setHidden(false);
	}

	async function captureScreen() {
		if (disabled) return;
		// Out of the way first, or the shot is a picture of this form.
		setHidden(true);
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia(
				DISPLAY_MEDIA_OPTIONS,
			);
			if (videoRef.current) videoRef.current.srcObject = stream;
		} catch {
			setHidden(false);
		}
	}

	function captureFrame() {
		// The first frame after `loadeddata` can still be blank; a beat later it
		// is the page.
		setTimeout(() => {
			const video = videoRef.current;
			if (!video) return;
			const canvas = document.createElement("canvas");
			canvas.width = Math.floor(video.videoWidth);
			canvas.height = Math.floor(video.videoHeight);
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				try {
					onCapture(canvas.toDataURL("image/jpeg", 0.8));
				} catch {
					toast.error("Couldn't capture the screenshot.");
				}
			}
			stopCapture();
		}, 100);
	}

	return (
		<div className="mb-4 max-w-sm">
			<video
				ref={videoRef}
				autoPlay
				muted
				onLoadedData={captureFrame}
				className="pointer-events-none fixed left-0 top-0 -z-50 max-h-[90%] max-w-[90%] opacity-0"
			/>
			{screenshot ? (
				<div className="relative inline-block">
					<img
						src={screenshot}
						alt="Screenshot to attach"
						className="max-h-50 max-w-50 rounded-sm shadow-sm"
					/>
					<button
						type="button"
						aria-label="Discard screenshot"
						onClick={() => onCapture(null)}
						className="absolute -right-2.5 -top-2.5 cursor-pointer rounded-full bg-eko-navy p-1 text-white"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>
			) : (
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={captureScreen}
					className="gap-2"
				>
					<ScanLine className="h-4 w-4" />
					Capture screenshot
				</Button>
			)}
		</div>
	);
}

/**
 * Raise a support ticket about a transaction.
 *
 * The user narrows category → sub-category → issue type, fills whatever that
 * issue type asks for, and submits. Nothing about the ticket's shape is decided
 * here: the browser posts its answers and the BFF assembles the ticket — see
 * `support-ticket.ts` in eps-backend.
 * @param props.options - What is being queried, from the flow.
 * @param props.onClose - Resolves the caller's promise.
 * @param props.setHidden - Hides this dialog while the page behind it is captured.
 * @param props.setPending - Records the result to resolve with if the user
 *   dismisses the dialog rather than pressing Close.
 */
export function RaiseIssueDialog({
	options = {},
	onClose,
	setHidden,
	setPending,
}: {
	options?: RaiseIssueOptions;
	onClose: (result: RaiseIssueResult) => void;
	setHidden: (hidden: boolean) => void;
	setPending: (result: RaiseIssueResult) => void;
}) {
	const transactionTime = options.transactionTime ?? options.transaction_time;
	const txTypeId =
		options.tx_typeid ||
		String(options.metadata?.transaction_detail?.tx_typeid ?? "") ||
		GENERIC_ISSUE_TYPE.DEFAULT;

	const [catalogue, setCatalogue] = useState<IssueCatalogue | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [categoryId, setCategoryId] = useState<number | null>(null);
	const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
	const [issue, setIssue] = useState<IssueType | null>(null);
	const [inputs, setInputs] = useState<IssueInput[]>([]);
	const [files, setFiles] = useState<IssueFile[]>([]);
	const [comment, setComment] = useState("");
	const [screenshot, setScreenshot] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [done, setDone] = useState<{
		ticketId: string;
		message: string;
	} | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		const detail = options.metadata?.transaction_detail ?? {};
		authClient.connectSupport
			.queryTypes(
				{
					tid: options.tid ?? "",
					tx_typeid: txTypeId,
					feedback_origin: options.origin ?? "Other",
					status: options.status === undefined ? "" : String(options.status),
					operator: String(detail.operator ?? ""),
					partner_id: String(detail.partner_id ?? ""),
					channel: String(detail.channel ?? ""),
				},
				controller.signal,
			)
			.then((response) =>
				setCatalogue(buildIssueCatalogue(response.issueTypes)),
			)
			.catch(() => {
				if (!controller.signal.aborted) setLoadError(true);
			});
		return () => controller.abort();
		// Opened for one transaction and closed again; re-fetching mid-dialog would
		// discard whatever the user has already filled in.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Skip a step that offers no choice.
	useEffect(() => {
		if (catalogue?.categories.length === 1) {
			setCategoryId(catalogue.categories[0].id);
		}
	}, [catalogue]);

	useEffect(() => {
		if (categoryId === null) return;
		const subs = catalogue?.subCategories[categoryId] ?? [];
		if (subs.length === 1) setSubCategoryId(subs[0].id);
	}, [categoryId, catalogue]);

	// The selected issue decides which fields exist at all.
	useEffect(() => {
		setInputs(issue?.inputs?.map((input) => ({ ...input })) ?? []);
		setFiles(issue?.files?.map((file) => ({ ...file })) ?? []);
	}, [issue]);

	const windowOpen = issue ? isRaiseWindowOpen(issue, transactionTime) : true;
	const disabled = submitting || done !== null;

	async function submit() {
		// Re-entrancy guard: a second click while the first request is in flight
		// would file a duplicate ticket.
		if (submitting) {
			toast.warning("Already in progress. Please wait.");
			return;
		}
		if (!issue) return;

		if (inputs.some((input) => input.is_required && !input.value)) {
			toast.error("Please fill all the required fields");
			return;
		}
		if (issue.comment === REQUIREMENT.MANDATORY && !comment.trim()) {
			toast.error("Please enter your comments");
			return;
		}
		if (files.some((file) => file.is_required && !file.value)) {
			toast.error("Please upload the required file(s)");
			return;
		}
		if (issue.screenshot === REQUIREMENT.MANDATORY && !screenshot) {
			toast.error("Please capture a screenshot");
			return;
		}

		setSubmitting(true);
		const form = new FormData();
		form.append(
			"payload",
			JSON.stringify({
				summary: issue.label,
				category: issue.category.title,
				subCategory: issue.sub_category.title,
				comment,
				// The issue type's own notes for the support desk — not the caller's
				// opaque `options.context`, which never leaves the browser.
				context: issue.context,
				inputs: inputs.map((input) => ({
					label: input.label,
					value: String(input.value ?? ""),
				})),
				origin: options.origin ?? "Other",
				tat: issue.tat,
				priority: issue.priority,
				tid: options.tid ?? "",
				txTypeId,
				transactionDetail: options.metadata?.transaction_detail,
				preMsgTemplate: options.metadata?.pre_msg_template,
				client: {
					useragent: navigator.userAgent,
					screen: `${window.innerWidth}x${window.innerHeight} of ${screen.width}x${screen.height}`,
					deviceTime: new Date().toISOString(),
					url: window.location.href,
				},
			}),
		);

		files.forEach((file, index) => {
			if (!file.value) return;
			const slug = (file.label || "")
				.replace(/[^0-9a-zA-Z]+/g, "_")
				.toLowerCase();
			form.append(`file_${index + 1}_${slug}`, file.value, file.value.name);
		});
		if (screenshot) {
			form.append(
				"screenshot.jpg",
				await dataUrlToFile(screenshot, "screenshot.jpg"),
			);
		}

		try {
			const response = await authClient.connectSupport.ticket(form);
			const result: RaiseIssueResult = {
				feedback_ticket_id: response.feedbackTicketId,
				context: options.context,
			};
			// Stash it now: the user may dismiss this dialog instead of pressing
			// Close, and the flow still needs its ticket id.
			setPending(result);
			setDone({
				ticketId: response.feedbackTicketId,
				message: response.message,
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error creating ticket. Please try again later.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	function close() {
		onClose(
			done
				? { feedback_ticket_id: done.ticketId, context: options.context }
				: {},
		);
	}

	if (loadError) {
		return (
			<Panel onClose={close}>
				<p className="text-sm text-destructive">
					Couldn't load the issue types. Please check your connection and try
					again.
				</p>
			</Panel>
		);
	}

	if (!catalogue) {
		return (
			<Panel onClose={close}>
				<p className="text-sm text-muted-foreground" role="status">
					Loading…
				</p>
			</Panel>
		);
	}

	if (done) {
		return (
			<Panel onClose={close}>
				<div className="flex gap-4">
					<CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-600/70" />
					<div>
						<p className="text-lg">{done.message}</p>
						{done.ticketId ? (
							<p className="text-sm text-muted-foreground">
								Ticket ID: {done.ticketId}
							</p>
						) : null}
					</div>
				</div>
				<Button className="mt-8 self-start" onClick={close}>
					Close
				</Button>
			</Panel>
		);
	}

	const subCategories: Category[] =
		categoryId === null ? [] : (catalogue.subCategories[categoryId] ?? []);
	const issues =
		categoryId === null || subCategoryId === null
			? []
			: catalogue.issues.filter(
					(row) =>
						row.category.id === categoryId &&
						row.sub_category.id === subCategoryId,
				);

	return (
		<Panel onClose={close}>
			<ChipList
				label={categoryId === null ? "Select a category" : "Category"}
				items={catalogue.categories}
				selectedId={categoryId}
				disabled={disabled}
				onSelect={(id) => {
					setIssue(null);
					setSubCategoryId(null);
					setCategoryId(id === null ? null : Number(id));
				}}
			/>

			<ChipList
				label={
					subCategoryId === null ? "Select a sub-category" : "Sub-category"
				}
				items={subCategories}
				selectedId={subCategoryId}
				disabled={disabled}
				onSelect={(id) => {
					setIssue(null);
					setSubCategoryId(id === null ? null : Number(id));
				}}
			/>

			<ChipList
				alwaysExpanded
				label="Select your query or issue"
				items={issues.map((row) => ({ id: row.label, title: row.label }))}
				selectedId={issue?.label ?? null}
				disabled={disabled}
				onSelect={(label) =>
					setIssue(issues.find((row) => row.label === label) ?? null)
				}
			/>

			{issue ? (
				<>
					{issue.desc && issue.desc !== issue.value ? (
						<div className="prose prose-sm mb-6 max-w-none dark:prose-invert">
							<Markdown>{issue.desc.replace(/<br ?\/?>/gi, "\n")}</Markdown>
						</div>
					) : null}

					{issue.tat && issue.tat !== "0" ? (
						<p className="mb-6 text-sm text-muted-foreground">
							Expected resolution time: {issue.tat}{" "}
							{issue.tat === "1" ? "day" : "days"}
						</p>
					) : null}

					{!windowOpen ? (
						<p className="mb-6 text-sm font-medium text-destructive">
							This query can only be raised {issue.raise_issue_after} after the
							transaction.
						</p>
					) : null}

					{inputs.map((input, index) => (
						<div
							key={input.label}
							className="mb-4 flex max-w-sm flex-col gap-1.5"
						>
							<Label htmlFor={`issue-input-${index}`}>
								{input.label}
								{input.is_required ? " *" : ""}
							</Label>
							<Input
								id={`issue-input-${index}`}
								type={input.type === 11 ? "number" : "text"}
								value={input.value ?? ""}
								minLength={input.length_min}
								maxLength={input.length_max ?? 60}
								disabled={disabled}
								onChange={(event) =>
									setInputs((prev) =>
										prev.map((field, i) =>
											i === index
												? { ...field, value: event.target.value }
												: field,
										),
									)
								}
							/>
						</div>
					))}

					{files.map((file, index) => (
						<div
							key={file.label}
							className="mb-4 flex max-w-sm flex-col gap-1.5"
						>
							<Label htmlFor={`issue-file-${index}`}>
								{file.label}
								{file.is_required ? " *" : ""}
							</Label>
							<Input
								id={`issue-file-${index}`}
								type="file"
								accept={
									file.accept ||
									"image/jpeg,image/pjpeg,image/png,application/pdf"
								}
								disabled={disabled}
								onChange={(event) =>
									setFiles((prev) =>
										prev.map((field, i) =>
											i === index
												? { ...field, value: event.target.files?.[0] }
												: field,
										),
									)
								}
							/>
						</div>
					))}

					{issue.screenshot === REQUIREMENT.DISABLED ? null : (
						<ScreenshotField
							screenshot={screenshot}
							disabled={disabled}
							onCapture={setScreenshot}
							setHidden={setHidden}
						/>
					)}

					{/* type 1 issues answer themselves — there is nothing to submit. */}
					{issue.type === 0 ? (
						<>
							{issue.comment === REQUIREMENT.DISABLED ? null : (
								<div className="mb-4 flex max-w-sm flex-col gap-1.5">
									<Label htmlFor="issue-comment">
										Comments
										{issue.comment === REQUIREMENT.MANDATORY ? " *" : ""}
									</Label>
									<textarea
										id="issue-comment"
										value={comment}
										disabled={disabled}
										onChange={(event) => setComment(event.target.value)}
										placeholder="Please enter your comments or any additional details here…"
										className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
									/>
								</div>
							)}

							<Button
								className="mt-4 self-start"
								disabled={disabled || !windowOpen}
								onClick={() => void submit()}
							>
								{submitting ? "Please wait…" : "Submit"}
							</Button>
						</>
					) : null}
				</>
			) : null}
		</Panel>
	);
}

/** The dialog's white card, with its own close control. */
function Panel({
	onClose,
	children,
}: {
	onClose: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-lg bg-background p-5 text-left md:p-8">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-eko-navy md:text-xl">
					Raise a query
				</h2>
				<button
					type="button"
					aria-label="Close"
					onClick={onClose}
					className="cursor-pointer rounded-full p-2 hover:bg-muted"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			{children}
		</div>
	);
}
