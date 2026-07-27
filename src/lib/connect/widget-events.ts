/**
 * Callbacks the widget's events are translated into.
 *
 * The widget talks to its host entirely through global `window` events — it has
 * no props or callbacks — so this is where its vocabulary is mapped onto the
 * console's.
 */
export interface WidgetEventHandlers {
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
	data?: { balance?: unknown };
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
		}
	};

	const onOpenUrl = (e: Event) => {
		const url = (e as CustomEvent<string>).detail;
		if (url) handlers.onOpenUrl(url);
	};

	window.addEventListener("iron-signal", onIronSignal, { signal });
	window.addEventListener("open-url", onOpenUrl, { signal });

	return () => controller.abort();
}
