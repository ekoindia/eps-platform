import type { CameraOptions } from "@/components/connect/CameraDialog";
import type { FileViewOptions } from "@/components/connect/FileViewDialog";

/** A file the flow wants shown, already normalised for the viewer. */
export interface FileViewRequest {
	file: string;
	options: FileViewOptions;
	/**
	 * The flow is not showing the file, it is asking the user to accept it — so
	 * this opens the image editor and the answer is sent back to the widget.
	 */
	userConfirmation: boolean;
}

/**
 * Callbacks the widget's events are translated into.
 *
 * The widget talks to its host entirely through global `window` events — it has
 * no props or callbacks — so this is where its vocabulary is mapped onto the
 * console's.
 */
export interface WidgetEventHandlers {
	/** Show (or ask the user to confirm) a file the flow produced. */
	onFileView: (request: FileViewRequest) => void;
	/** The flow wants a photo taken — an ID document, a customer's face. */
	onCameraCapture: (options: CameraOptions) => void;
	/** The flow moved the user's E-value. */
	onBalanceChanged: (balance: number) => void;
	/** The upstream session expired mid-flow and must be renewed. */
	onLoginAgain: () => void;
	/** Navigate to another interaction id. */
	onGotoTransaction: (interactionId: string) => void;
	/** Navigate to transaction history, optionally filtered by product. */
	onGotoHistory: (productId?: string) => void;
	/** Follow a link the flow asked to open (internal route or external site). */
	onOpenUrl: (url: string) => void;
}

/** The event `detail` shape the widget dispatches on `iron-signal`. */
interface IronSignalDetail {
	name?: string;
	trxnid?: string;
	product_id?: string;
	data?: {
		balance?: unknown;
		/** `file-view`: URL of the file, or a bare video id when `is_youtube`. */
		file?: string;
		options?: FileViewOptions;
		userConfirmation?: boolean;
		is_youtube?: boolean;
		label?: string;
	};
}

/**
 * Wires the widget's window events to the console.
 *
 * Uses one `AbortController` for every listener so unmount removes them all at
 * once — the widget outlives a React remount, and a leaked listener would keep
 * updating a card that no longer exists.
 * @param handlers - What each event should do.
 * @returns A cleanup function that removes every listener.
 */
export function attachWidgetEvents(handlers: WidgetEventHandlers): () => void {
	const controller = new AbortController();
	const { signal } = controller;

	const onIronSignal = (e: Event) => {
		const detail = (e as CustomEvent<IronSignalDetail>).detail;
		if (!detail?.name) return;

		switch (detail.name) {
			case "update-status": {
				// The flow reports the post-transaction balance. Coerce and sanity-check
				// rather than trust it: this crosses a JSON boundary owned by another
				// codebase and arrives as a number in some flows and a string in others.
				const raw = detail.data?.balance;
				if (raw === null || raw === undefined || raw === "") return;
				const balance = Number(raw);
				if (Number.isFinite(balance)) handlers.onBalanceChanged(balance);
				return;
			}
			case "login-again":
				handlers.onLoginAgain();
				return;
			case "goto-transaction":
				if (detail.trxnid) handlers.onGotoTransaction(String(detail.trxnid));
				return;
			case "goto-history":
				handlers.onGotoHistory(
					detail.product_id ? String(detail.product_id) : undefined,
				);
				return;
			case "file-view": {
				const data = detail.data;
				if (!data?.file) return;
				// A YouTube payload carries the bare video id, not a URL.
				const file = data.is_youtube
					? `https://www.youtube.com/watch?v=${data.file}`
					: data.file;
				handlers.onFileView({
					file,
					options: {
						label: data.label,
						...data.options,
						...(data.is_youtube ? { type: "youtube" as const } : {}),
					},
					userConfirmation: Boolean(data.userConfirmation),
				});
				return;
			}
		}
	};

	const onOpenUrl = (e: Event) => {
		const url = (e as CustomEvent<string>).detail;
		if (url) handlers.onOpenUrl(url);
	};

	const onRequestCameraCapture = (e: Event) => {
		handlers.onCameraCapture(
			(e as CustomEvent<CameraOptions | undefined>).detail ?? {},
		);
	};

	window.addEventListener("iron-signal", onIronSignal, { signal });
	window.addEventListener("open-url", onOpenUrl, { signal });
	window.addEventListener("request-camera-capture", onRequestCameraCapture, {
		signal,
	});

	return () => controller.abort();
}
