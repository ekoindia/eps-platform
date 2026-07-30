/**
 * The HTML Imports / custom-elements polyfill the widget needs.
 *
 * `<tf-wlc-widget>` is Polymer v1 and ships as an HTML import — a standard
 * removed from Chrome in 80. This polyfill is what keeps it loadable, and is the
 * same version Eloka pins.
 */
const POLYFILL_URL =
	"https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/0.7.24/webcomponents-lite.min.js";

/** Path of the widget import, relative to the configured widget origin. */
const WIDGET_PATH = "/elements/tf-eko-connect-widget/tf-wlc-widget.html";

declare global {
	interface Window {
		Polymer?: Record<string, unknown>;
	}
}

// One load per page, shared by every mount. Not reset on failure: a broken CDN
// or a blocked origin does not become retryable by remounting, and retrying
// would just re-append elements.
let loading: Promise<void> | null = null;

/**
 * Appends an element and resolves when it loads.
 * @param el - A `<script>` or `<link>` already configured with its URL.
 * @param what - Human-readable name for the failure message.
 */
function append(el: HTMLScriptElement | HTMLLinkElement, what: string) {
	return new Promise<void>((resolve, reject) => {
		el.onload = () => resolve();
		el.onerror = () => reject(new Error(`Failed to load ${what}`));
		document.head.appendChild(el);
	});
}

/**
 * Polymer reads this global at import time, so it must be set BEFORE the import
 * is appended — not after, and not from a later effect.
 *
 * `dom: "shadow"` keeps the widget's styles from leaking into the console (and
 * the console's Tailwind reset out of the widget).
 */
function configurePolymer(): void {
	window.Polymer ??= {
		dom: "shadow",
		lazyRegister: true,
		useNativeCSSProperties: false,
	};
}

/**
 * Loads the Connect widget's runtime, once per page.
 *
 * Order is load-bearing: the polyfill installs the HTML-imports machinery that
 * the widget's `<link rel="import">` depends on, so it is awaited first rather
 * than raced.
 * @param widgetOrigin - Origin serving the bundle, e.g. `https://beta.ekoconnect.in`.
 */
export function loadConnectRuntime(widgetOrigin: string): Promise<void> {
	loading ??= (async () => {
		configurePolymer();

		const script = document.createElement("script");
		script.src = POLYFILL_URL;
		await append(script, "the web-components polyfill");

		const link = document.createElement("link");
		link.rel = "import";
		// `href`, not `src`: Eloka's shared loader sets `src` on link elements too,
		// which is not the attribute a `<link>` loads from.
		link.href = `${widgetOrigin.replace(/\/+$/, "")}${WIDGET_PATH}`;
		await append(link, "the Connect widget");
	})();
	return loading;
}
