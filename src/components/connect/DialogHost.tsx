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
import type { FileViewOptions } from "./FileViewDialog";

const FileViewDialog = lazy(() =>
	import("./FileViewDialog").then((m) => ({ default: m.FileViewDialog })),
);

/** One open dialog, discriminated by `kind`. */
type DialogRequest = { kind: "file"; file: string; options?: FileViewOptions };

/** What a dialog hands back. Closing without a decision resolves `{}`. */
export type DialogResult = Record<string, unknown>;

interface StackEntry {
	id: number;
	request: DialogRequest;
	resolve: (result: DialogResult) => void;
	/** Set while the dialog asks the browser to capture the page behind it. */
	hidden: boolean;
}

/** Per-kind dialog chrome. Media fills the screen; forms get a panel. */
const CHROME: Record<
	DialogRequest["kind"],
	{ className: string; closeButton: boolean }
> = {
	file: { className: "bg-transparent", closeButton: true },
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

	const dialogs = useMemo<ConnectDialogs>(
		() => ({
			showFile: (file, options) => open({ kind: "file", file, options }),
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
}: {
	entry: StackEntry;
	onClose: (id: number, result: DialogResult) => void;
	onHiddenChange: (id: number, hidden: boolean) => void;
}) {
	const chrome = CHROME[entry.request.kind];
	const dismiss = (result: DialogResult = {}) => onClose(entry.id, result);
	// Hiding must not unmount: the raise-issue dialog hides itself so the browser's
	// screen-capture picker photographs the page underneath, then shows itself
	// again with its form state intact.
	const hiddenClass = entry.hidden ? "invisible" : "";

	return (
		<DialogPrimitive.Root open onOpenChange={(open) => !open && dismiss()}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay
					className={`fixed inset-0 z-50 bg-black/80 ${hiddenClass}`}
				/>
				<DialogPrimitive.Content
					aria-describedby={undefined}
					className={`fixed left-1/2 top-1/2 z-50 flex max-h-screen max-w-[100vw] -translate-x-1/2 -translate-y-1/2 items-center justify-center focus:outline-hidden ${chrome.className} ${hiddenClass}`}
				>
					{/* Radix requires a title; these dialogs carry their own visible chrome. */}
					<DialogPrimitive.Title className="sr-only">
						{entry.request.kind === "file" ? "File preview" : "Dialog"}
					</DialogPrimitive.Title>
					<Suspense
						fallback={<p className="p-8 text-sm text-white">Loading…</p>}
					>
						<DialogBody
							entry={entry}
							dismiss={dismiss}
							setHidden={(hidden) => onHiddenChange(entry.id, hidden)}
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
}: {
	entry: StackEntry;
	dismiss: (result?: DialogResult) => void;
	setHidden: (hidden: boolean) => void;
}) {
	void dismiss;
	void setHidden;
	switch (entry.request.kind) {
		case "file":
			return (
				<FileViewDialog
					file={entry.request.file}
					options={entry.request.options}
				/>
			);
	}
}
