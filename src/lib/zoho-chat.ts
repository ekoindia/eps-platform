/**
 * Opens the Zoho SalesIQ chat widget reliably,
 * even after the user has closed it previously.
 */
import {
	getCalculatorContext,
	getStoredTrackingParams,
} from "@/hooks/use-tracking-params";
import type { ChatIdentity } from "@/lib/auth/identity";

interface ZohoSalesIQ {
	ready?: () => void;
	floatbutton?: {
		visible?: (mode: "show" | "hide") => void;
	};
	chatwindow?: {
		visible?: (mode: "show" | "hide") => void;
	};
	chat?: {
		start?: () => void;
	};
	visitor?: {
		info?: (data: Record<string, string>) => void;
		name?: (value: string) => void;
		email?: (value: string) => void;
		contactnumber?: (value: string) => void;
		/** Fires when the visitor initiates a chat. */
		chat?: (handler: VisitorHandler) => void;
		/** Fires when the visitor submits a message with all operators offline. */
		offlineMessage?: (handler: VisitorHandler) => void;
	};
}

/**
 * SalesIQ's documented shape is `{ name, email, question, visitid }`, but the
 * widget is free to send more — hence the open record. Logged verbatim so we can
 * see whether a mobile number or a Zoho Lead/Contact id ever arrives.
 */
type VisitorHandler = (visitid: string, data: Record<string, unknown>) => void;

/**
 * Last known logged-in identity, or `null` when anonymous. Written by
 * AuthProvider as auth state settles and read when chat opens.
 *
 * It is stored rather than pushed on login because the widget lazy-loads on the
 * visitor's first interaction, so it usually does not exist yet when `/me`
 * resolves. Applying at open time makes the two orders equivalent.
 */
let identity: ChatIdentity | null = null;

/** Sets (or clears, on logout) the identity attached to subsequent chat opens. */
export function setChatIdentity(next: ChatIdentity | null): void {
	identity = next;
}

/** Identifies the visitor to the operator console. No-op when anonymous. */
function pushVisitorIdentity(salesiq: ZohoSalesIQ) {
	if (!identity) return;
	try {
		const visitor = salesiq.visitor;
		if (identity.name) visitor?.name?.(identity.name);
		if (identity.email) visitor?.email?.(identity.email);
		if (identity.contactNumber)
			visitor?.contactnumber?.(identity.contactNumber);
	} catch {
		// Widget API shape changed or unavailable — ignore
	}
}

interface ZohoGlobal {
	salesiq?: ZohoSalesIQ;
}

declare global {
	interface Window {
		$zoho?: ZohoGlobal;
		/**
		 * Loader exposed by the inline widget bootstrap in `index.html`. Present
		 * even on routes where that bootstrap declines to auto-load, so a later
		 * navigation to a chat-enabled route can pull the widget in. Idempotent.
		 */
		__loadZohoWidget?: () => void;
	}
}

function getSalesIQ(): ZohoSalesIQ | undefined {
	return window.$zoho?.salesiq;
}

/**
 * True on the routes that must not show the chat bubble: the signup form and the
 * console work surfaces. `/console` itself (the partner home) keeps chat.
 *
 * Duplicated — deliberately — by the inline bootstrap in `index.html`, which
 * runs before any module can load and therefore cannot import this. Keep both in
 * sync; `zoho-chat.test.ts` pins the cases.
 */
export function isChatHiddenPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	return path === "/signup" || path.startsWith("/console/");
}

/** Route-derived intent, re-applied whenever the widget (re)becomes available. */
let hiddenForRoute = false;
/** An app overlay (mobile menu, command palette) is covering the page. */
let hiddenForOverlay = false;
/** An open was requested before the widget existed; honour it once it loads. */
let pendingOpen = false;
/** The `salesiq` object whose `ready` we already chained onto. */
let hookedSalesIQ: ZohoSalesIQ | undefined;

/**
 * Chains our state onto SalesIQ's `ready` callback, seeding the `$zoho.salesiq`
 * stub if the bootstrap has not run. Without this, a route change that lands on
 * a hidden page while the widget is still downloading would be a no-op and the
 * bubble would appear as soon as it finished.
 */
function hookReady(): void {
	const zoho = (window.$zoho ??= {});
	const salesiq = (zoho.salesiq ??= {});
	if (hookedSalesIQ === salesiq) return;
	hookedSalesIQ = salesiq;
	const previous = salesiq.ready;
	salesiq.ready = () => {
		try {
			previous?.();
		} finally {
			logVisitorEvents(salesiq);
			applyState();
		}
	};
}

/** Guards against re-registering when `ready` fires more than once. */
let visitorLoggingBound = false;

/**
 * Logs what SalesIQ hands back when a visitor starts a chat or leaves an offline
 * message. Observation only — we want to see whether the payload carries a mobile
 * number or a Zoho Lead/Contact id before deciding what to do with it.
 */
function logVisitorEvents(salesiq: ZohoSalesIQ): void {
	if (visitorLoggingBound) return;
	const visitor = salesiq.visitor;
	if (!visitor?.chat && !visitor?.offlineMessage) return;
	visitorLoggingBound = true;
	try {
		visitor.chat?.((visitid, data) => {
			console.log("[SalesIQ] visitor.chat", { visitid, data });
		});
		visitor.offlineMessage?.((visitid, data) => {
			console.log("[SalesIQ] visitor.offlineMessage", { visitid, data });
		});
	} catch {
		// Widget API shape changed or unavailable — ignore
	}
}

/** Pushes `hiddenForRoute` / `pendingOpen` to the widget. No-op until it loads. */
function applyState(): void {
	const salesiq = getSalesIQ();
	if (!salesiq?.floatbutton && !salesiq?.chat) return;
	try {
		salesiq.floatbutton?.visible?.(
			hiddenForRoute || hiddenForOverlay ? "hide" : "show",
		);
		if (hiddenForRoute) salesiq.chatwindow?.visible?.("hide");
	} catch {
		// Widget API shape changed or unavailable — ignore
	}
	if (pendingOpen && salesiq.chat?.start) {
		pendingOpen = false;
		startChat(salesiq);
	}
}

/**
 * Hides or restores the chat bubble for the current route. Safe to call before
 * the widget loads; the intent is replayed from SalesIQ's `ready` callback.
 */
export function setZohoChatHidden(hidden: boolean): void {
	hiddenForRoute = hidden;
	hookReady();
	// The bootstrap skips loading entirely on hidden routes, so a navigation
	// away from one has to ask for the widget itself.
	if (!hidden) window.__loadZohoWidget?.();
	applyState();
}

/**
 * Hides the chat bubble while a full-screen overlay (mobile menu, command
 * palette) is open, so it does not float over it. Separate from the route rule
 * so closing the overlay restores whatever the route asked for.
 */
export function setZohoChatOverlayHidden(hidden: boolean): void {
	hiddenForOverlay = hidden;
	hookReady();
	applyState();
}

/**
 * Pushes lead context (ad/UTM attribution + pricing-calculator selection)
 * to SalesIQ as visitor info so chat-created leads carry it even when the
 * current page URL doesn't. Best-effort — never blocks opening the chat.
 */
function pushVisitorInfo(salesiq: ZohoSalesIQ) {
	try {
		const calcSelection = getCalculatorContext();
		const info: Record<string, string> = {
			...getStoredTrackingParams(),
			...(calcSelection ? { apis_interested: calcSelection } : {}),
		};
		if (Object.keys(info).length > 0) {
			salesiq.visitor?.info?.(info);
		}
	} catch {
		// Widget API shape changed or unavailable — ignore
	}
}

function startChat(salesiq: ZohoSalesIQ) {
	pushVisitorIdentity(salesiq);
	pushVisitorInfo(salesiq);

	// Show the chat window first (works even after close)
	if (salesiq.chatwindow?.visible) {
		salesiq.chatwindow.visible("show");
	}
	// Then start a new chat conversation
	if (salesiq.chat?.start) {
		salesiq.chat.start();
	}
}

export function openZohoChat() {
	// An explicit CTA outranks the route rule until the next navigation — the
	// Footer's chat links render on hidden routes too.
	hiddenForRoute = false;
	hiddenForOverlay = false;
	const salesiq = getSalesIQ();
	if (!salesiq?.chat?.start) {
		// Widget absent (hidden route, or still downloading): pull it in and open
		// from the ready callback instead of dropping the click.
		pendingOpen = true;
		hookReady();
		window.__loadZohoWidget?.();
		return;
	}
	salesiq.floatbutton?.visible?.("show");
	startChat(salesiq);
}
