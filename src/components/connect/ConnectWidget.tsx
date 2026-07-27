import { useConnectDialogs } from "@/components/connect/DialogHost";
import { PrintReceipt } from "@/components/connect/PrintReceipt";
import { useAppLink } from "@/hooks/use-app-link";
import {
	fetchRoleTransactionList,
	type RoleTransactionList,
} from "@/lib/connect/interactions";
import { loadConnectRuntime } from "@/lib/connect/runtime";
import { clearConnectTokens, ensureConnectTokens } from "@/lib/connect/token";
import { attachWidgetEvents } from "@/lib/connect/widget-events";
import { authClient } from "@/lib/auth/client";
import { CONNECT_WIDGET_URL, SHOW_CONNECT_WIDGET } from "@/lib/config/features";
import { resetWalletBalanceCache } from "@/lib/wallet-balance";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * `<tf-wlc-widget>` — the Eko Connect widget, a Polymer v1 custom element loaded
 * at runtime via HTML import.
 *
 * No data props are passed through JSX; they are assigned as DOM properties in
 * an effect. See `syncWidgetProps` for why.
 *
 * Declared here rather than in `vite-env.d.ts` because module augmentation
 * requires a module: in a global script file `declare module "react"` *replaces*
 * React's types instead of extending them.
 */
declare module "react" {
	// The JSX namespace is React 19's own shape for this; there is no module-syntax
	// equivalent to augment.
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			"tf-wlc-widget": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			> &
				Record<string, unknown>;
		}
	}
}

type Status = "loading" | "ready" | "error" | "unavailable";

/** The widget's own response methods, which exist only once Polymer upgrades it. */
interface WidgetElement extends HTMLElement {
	fileViewResponse?: (result: unknown) => void;
	cameraResponse?: (image: string) => void;
	feedbackResponse?: (result: unknown) => void;
}

/**
 * Types the upgraded custom element for its response callbacks.
 * @param el - The element, if it is mounted.
 * @returns The same element, or null.
 */
function widgetOf(el: HTMLElement | null): WidgetElement | null {
	return el as WidgetElement | null;
}

/**
 * Assigns the widget's inputs as DOM properties rather than JSX attributes.
 *
 * React 19 sets *properties* on an upgraded custom element when the property
 * exists, instead of the attributes older React set. Polymer only JSON-parses
 * values that arrive as attributes, so a `JSON.stringify`'d object passed
 * through JSX lands on the property as a raw string — and the widget then does
 * `interaction_id in role_trxn_list`, which throws "Cannot use 'in' operator".
 * Eloka gets away with stringifying because it runs an older React.
 *
 * Assigning the real objects here bypasses attribute serialization entirely and
 * triggers Polymer's observers the same way.
 * @param el - The upgraded `<tf-wlc-widget>` element.
 * @param props - The values to hand it.
 */
function syncWidgetProps(
	el: HTMLElement,
	props: {
		interactionId: number;
		paths: string[];
		roleTxList: RoleTransactionList;
		language: string;
	},
): void {
	const w = el as unknown as Record<string, unknown>;
	// Polymer's camel-case form of the `enable-print` attribute Eloka sets: it
	// puts a print button on the receipt card, which calls `window.print()`.
	w.enablePrint = true;
	w.role_trxn_list = props.roleTxList;
	w.route_params = {
		trxntypeid: props.interactionId,
		subpath_list: props.paths,
	};
	w.language = props.language;
	w.logged_in = true;
	// Last: it is the observed property that kicks off loading the flow, so the
	// rest must already be in place when it changes.
	w.interaction_id = props.interactionId;
}

export interface ConnectWidgetProps {
	/** The interaction id to open — the start of the flow. */
	interactionId: number;
	/** Sub-path segments, for deep-linking into a step of the flow. */
	paths?: string[];
	/** Localization code the widget loads strings for. */
	language?: string;
}

/**
 * Renders an Eko Connect transaction flow inline.
 *
 * The widget authenticates by reading `sessionStorage` in this page's realm, so
 * the credentials are written BEFORE the runtime loads and removed on unmount —
 * see `lib/connect/token.ts` for why there is no prop-based alternative.
 */
export function ConnectWidget({
	interactionId,
	paths,
	language = "en",
}: ConnectWidgetProps) {
	const [status, setStatus] = useState<Status>(
		SHOW_CONNECT_WIDGET && CONNECT_WIDGET_URL ? "loading" : "unavailable",
	);
	const [roleTxList, setRoleTxList] = useState<RoleTransactionList>({});
	const widgetRef = useRef<HTMLElement | null>(null);
	const navigate = useNavigate();
	const { openUrl } = useAppLink();
	const { showFile, editImage, openCamera, showRaiseIssue } =
		useConnectDialogs();

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET || !CONNECT_WIDGET_URL) return;
		let live = true;

		void (async () => {
			try {
				// Tokens first, and awaited: the widget starts calling connect-api as
				// soon as it upgrades, and a request that beats the token into storage
				// is sent as `Bearer null`.
				const [, list] = await Promise.all([
					ensureConnectTokens(),
					fetchRoleTransactionList(),
				]);
				if (!live) return;
				setRoleTxList(list);
				await loadConnectRuntime(CONNECT_WIDGET_URL);
				if (!live) return;
				setStatus("ready");
			} catch {
				if (live) setStatus("error");
			}
		})();

		return () => {
			live = false;
			// The credentials exist only while a flow is on screen.
			clearConnectTokens();
		};
	}, []);

	// `paths` is rebuilt from the URL on every render, so its identity alone would
	// re-run this effect forever; key on the value instead.
	const pathsKey = (paths ?? []).join("/");

	useEffect(() => {
		const el = widgetRef.current;
		if (status !== "ready" || !el) return;
		syncWidgetProps(el, {
			interactionId,
			paths: pathsKey ? pathsKey.split("/") : [],
			roleTxList,
			language,
		});
	}, [status, interactionId, pathsKey, roleTxList, language]);

	useEffect(() => {
		if (status !== "ready") return;
		return attachWidgetEvents({
			onBalanceChanged: () => {
				// The flow just moved the balance, so the cached one is wrong. This is
				// the in-page flow the cache's own note anticipated.
				resetWalletBalanceCache();
			},
			onLoginAgain: () => {
				void (async () => {
					// Rotate our session first — that is what re-seals the upstream
					// tokens server-side — then republish the refreshed lite token.
					await authClient.refresh().catch(() => undefined);
					clearConnectTokens();
					await ensureConnectTokens().catch(() => undefined);
				})();
			},
			onGotoTransaction: (id) => navigate(`/console/transaction/${id}`),
			onGotoHistory: (productId) =>
				navigate(
					productId
						? `/console/transactions?product_id=${encodeURIComponent(productId)}`
						: "/console/transactions",
				),
			onOpenUrl: openUrl,
			onFileView: ({ file, options, userConfirmation }) => {
				if (!userConfirmation) {
					void showFile(file, options);
					return;
				}
				// The flow is waiting on an answer, and takes the editor's result
				// verbatim — `{ image, file?, accepted }`.
				void editImage(file).then((result) => {
					widgetOf(widgetRef.current)?.fileViewResponse?.(result);
				});
			},
			onRaiseIssue: (options) => {
				void showRaiseIssue(options).then((result) => {
					// Nothing to report when the user just closed the dialog.
					if (!result.feedback_ticket_id) return;
					widgetOf(widgetRef.current)?.feedbackResponse?.({
						feedback_ticket_id: result.feedback_ticket_id,
						// The flow's own context, echoed back untouched under the name it
						// expects.
						to_and_fro_data: result.context,
					});
				});
			},
			onCameraCapture: (options) => {
				void openCamera(options).then((result) => {
					// Unlike the editor, this one takes a bare data URL, not an object.
					if (result.image) {
						widgetOf(widgetRef.current)?.cameraResponse?.(result.image);
					}
				});
			},
		});
	}, [
		status,
		navigate,
		openUrl,
		showFile,
		editImage,
		openCamera,
		showRaiseIssue,
	]);

	if (status === "unavailable") {
		return (
			<p className="text-sm text-muted-foreground">
				Transaction flows aren't enabled here yet.
			</p>
		);
	}

	if (status === "error") {
		return (
			<div className="text-sm">
				<p className="font-medium text-destructive">
					Couldn't load this transaction flow.
				</p>
				<button
					type="button"
					onClick={() => location.reload()}
					className="mt-2 cursor-pointer underline underline-offset-4"
				>
					Try again
				</button>
			</div>
		);
	}

	if (status === "loading") {
		return (
			<p className="text-sm text-muted-foreground" role="status">
				Loading…
			</p>
		);
	}

	return (
		<PrintReceipt heading="Transaction Receipt">
			<tf-wlc-widget ref={widgetRef} />
		</PrintReceipt>
	);
}
