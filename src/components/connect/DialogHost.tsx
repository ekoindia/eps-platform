import { ignoreNestedDialogInteraction } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
	createContext,
	lazy,
	Suspense,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { CameraOptions, CameraResult } from "./CameraDialog";
import type { FileViewOptions } from "./FileViewDialog";
import type {
	ImageEditorOptions,
	ImageEditorResult,
} from "./ImageEditorDialog";
import type { RaiseIssueOptions, RaiseIssueResult } from "./RaiseIssueDialog";

// Lazily loaded, and worth it: the editor pulls in react-image-crop and the
// camera react-webcam, neither of which most console sessions ever open.
const FileViewDialog = lazy(() =>
	import("./FileViewDialog").then((m) => ({ default: m.FileViewDialog })),
);
const ImageEditorDialog = lazy(() =>
	import("./ImageEditorDialog").then((m) => ({ default: m.ImageEditorDialog })),
);
const CameraDialog = lazy(() =>
	import("./CameraDialog").then((m) => ({ default: m.CameraDialog })),
);
const RaiseIssueDialog = lazy(() =>
	import("./RaiseIssueDialog").then((m) => ({ default: m.RaiseIssueDialog })),
);

/** One open dialog, discriminated by `kind`. */
type DialogRequest =
	| { kind: "file"; file: string; options?: FileViewOptions }
	| { kind: "image"; image: string; options?: ImageEditorOptions }
	| { kind: "camera"; options?: CameraOptions }
	| { kind: "issue"; options?: RaiseIssueOptions };

/** What a dialog hands back. Closing without a decision resolves `{}`. */
export type DialogResult = Record<string, unknown>;

interface StackEntry {
	id: number;
	request: DialogRequest;
	resolve: (result: DialogResult) => void;
	/** Set while the dialog asks the browser to capture the page behind it. */
	hidden: boolean;
	/**
	 * What to resolve with if the dialog is dismissed rather than closed from
	 * inside it — the raise-issue dialog files its ticket well before the user
	 * gets round to pressing Close.
	 */
	pending?: DialogResult;
}

/** Per-kind dialog chrome. Media fills the screen; forms get a panel. */
const CHROME: Record<
	DialogRequest["kind"],
	{ className: string; closeButton: boolean }
> = {
	file: { className: "bg-transparent", closeButton: true },
	// Both carry their own accept/reject/close controls, and a second close
	// button would leave the caller's promise resolving `{}` instead of a
	// decision.
	image: { className: "bg-transparent", closeButton: false },
	camera: { className: "bg-transparent", closeButton: false },
	// A form, not media: a readable panel, and its own close control so a close
	// after submitting still carries the ticket id back.
	issue: {
		className: "w-full max-w-[100vw] px-2 md:w-162 lg:w-200",
		closeButton: false,
	},
};

/** Screen-reader titles; Radix requires one per dialog. */
const TITLES: Record<DialogRequest["kind"], string> = {
	file: "File preview",
	image: "Edit image",
	camera: "Camera",
	issue: "Raise a query",
};

/**
 * The dialogs a transaction flow can ask the console to open.
 *
 * Every call resolves when the dialog closes — with the dialog's result, or an
 * empty object if the user simply dismissed it. Callers must therefore treat a
 * missing field as "cancelled" rather than assume a shape.
 */
export interface ConnectDialogs {
	/** Shows a file (image, video, PDF, page) full-screen. */
	showFile: (file: string, options?: FileViewOptions) => Promise<DialogResult>;
	/** Lets the user crop, rotate and confirm an image. */
	editImage: (
		image: string,
		options?: ImageEditorOptions,
	) => Promise<Partial<ImageEditorResult>>;
	/** Opens the camera; resolves with the capture the user accepted. */
	openCamera: (options?: CameraOptions) => Promise<Partial<CameraResult>>;
	/** Opens the support-ticket form for a transaction. */
	showRaiseIssue: (
		options?: RaiseIssueOptions,
	) => Promise<Partial<RaiseIssueResult>>;
}

const DialogContext = createContext<ConnectDialogs | null>(null);

/**
 * Access to the console's dialog host.
 * @returns The dialog openers.
 * @throws If called outside `<ConnectDialogProvider>`.
 */
export function useConnectDialogs(): ConnectDialogs {
	const dialogs = useContext(DialogContext);
	if (!dialogs) {
		throw new Error(
			"useConnectDialogs must be used within ConnectDialogProvider",
		);
	}
	return dialogs;
}

/**
 * Hosts the dialogs the Eko Connect widget drives — file viewing today, camera,
 * image editing and raise-issue as they land.
 *
 * Replaces Eloka's pub/sub `DynamicPopupModuleLoader`. The indirection there
 * exists only because the loader is mounted in a Next.js layout that cannot see
 * its callers; a context does the same job directly. Dialogs stack (the camera
 * opens the editor on top of itself), so this keeps an array rather than a
 * single slot, and each entry owns the promise its opener is waiting on.
 * @param props.children - The console subtree that can open dialogs.
 */
export function ConnectDialogProvider({ children }: { children: ReactNode }) {
	const [stack, setStack] = useState<StackEntry[]>([]);
	const nextId = useRef(0);

	const open = useCallback(
		(request: DialogRequest) =>
			new Promise<DialogResult>((resolve) => {
				setStack((prev) => [
					...prev,
					{ id: nextId.current++, request, resolve, hidden: false },
				]);
			}),
		[],
	);

	const close = useCallback((id: number, result: DialogResult) => {
		setStack((prev) => {
			const entry = prev.find((e) => e.id === id);
			entry?.resolve(result);
			return prev.filter((e) => e.id !== id);
		});
	}, []);

	const setHidden = useCallback((id: number, hidden: boolean) => {
		setStack((prev) =>
			prev.map((entry) => (entry.id === id ? { ...entry, hidden } : entry)),
		);
	}, []);

	const setPending = useCallback((id: number, pending: DialogResult) => {
		setStack((prev) =>
			prev.map((entry) => (entry.id === id ? { ...entry, pending } : entry)),
		);
	}, []);

	const dialogs = useMemo<ConnectDialogs>(
		() => ({
			showFile: (file, options) => open({ kind: "file", file, options }),
			editImage: (image, options) => open({ kind: "image", image, options }),
			openCamera: (options) => open({ kind: "camera", options }),
			showRaiseIssue: (options) => open({ kind: "issue", options }),
		}),
		[open],
	);

	return (
		<DialogContext.Provider value={dialogs}>
			{children}
			{stack.map((entry) => (
				<HostedDialog
					key={entry.id}
					entry={entry}
					onClose={close}
					onHiddenChange={setHidden}
					onPendingChange={setPending}
				/>
			))}
		</DialogContext.Provider>
	);
}

/** Renders one stack entry inside a Radix dialog. */
function HostedDialog({
	entry,
	onClose,
	onHiddenChange,
	onPendingChange,
}: {
	entry: StackEntry;
	onClose: (id: number, result: DialogResult) => void;
	onHiddenChange: (id: number, hidden: boolean) => void;
	onPendingChange: (id: number, pending: DialogResult) => void;
}) {
	const chrome = CHROME[entry.request.kind];
	const dismiss = (result?: DialogResult) =>
		onClose(entry.id, result ?? entry.pending ?? {});
	// Hiding must not unmount: the raise-issue dialog hides itself so the browser's
	// screen-capture picker photographs the page underneath, then shows itself
	// again with its form state intact.
	const hiddenClass = entry.hidden ? "invisible" : "";

	return (
		<DialogPrimitive.Root open onOpenChange={(open) => !open && dismiss()}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay
					// See `ignoreNestedDialogInteraction`.
					data-dialog-layer=""
					className={`fixed inset-0 z-50 bg-black/80 ${hiddenClass}`}
				/>
				<DialogPrimitive.Content
					aria-describedby={undefined}
					// These dialogs stack on each other — the camera opens the editor —
					// and are hand-rolled rather than the shadcn `DialogContent`, so they
					// need the same guard it applies.
					onInteractOutside={ignoreNestedDialogInteraction}
					className={`fixed left-1/2 top-1/2 z-50 flex max-h-screen max-w-[100vw] -translate-x-1/2 -translate-y-1/2 items-center justify-center focus:outline-hidden ${chrome.className} ${hiddenClass}`}
				>
					{/* Radix requires a title; these dialogs carry their own visible chrome. */}
					<DialogPrimitive.Title className="sr-only">
						{TITLES[entry.request.kind]}
					</DialogPrimitive.Title>
					<Suspense
						fallback={<p className="p-8 text-sm text-white">Loading…</p>}
					>
						<DialogBody
							entry={entry}
							dismiss={dismiss}
							setHidden={(hidden) => onHiddenChange(entry.id, hidden)}
							setPending={(pending) => onPendingChange(entry.id, pending)}
						/>
					</Suspense>
					{chrome.closeButton ? (
						<DialogPrimitive.Close
							className="fixed right-2.5 top-1.5 rounded-full bg-gray-100 p-1.5 opacity-90 shadow-lg hover:bg-destructive hover:text-white md:p-3"
							aria-label="Close"
						>
							<X className="h-4 w-4" />
						</DialogPrimitive.Close>
					) : null}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

/** Picks the component for a request. One case per dialog kind. */
function DialogBody({
	entry,
	dismiss,
	setHidden,
	setPending,
}: {
	entry: StackEntry;
	dismiss: (result?: DialogResult) => void;
	setHidden: (hidden: boolean) => void;
	setPending: (pending: DialogResult) => void;
}) {
	switch (entry.request.kind) {
		case "file":
			return (
				<FileViewDialog
					file={entry.request.file}
					options={entry.request.options}
				/>
			);
		case "image":
			return (
				<ImageEditorDialog
					image={entry.request.image}
					options={entry.request.options}
					onClose={dismiss}
				/>
			);
		case "camera":
			return <CameraDialog options={entry.request.options} onClose={dismiss} />;
		case "issue":
			return (
				<RaiseIssueDialog
					options={entry.request.options}
					onClose={dismiss}
					setHidden={setHidden}
					setPending={setPending}
				/>
			);
	}
}
