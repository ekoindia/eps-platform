/** Two-digit zero pad, for the printed timestamp. */
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Prints the current page.
 *
 * The document title is swapped for the duration of the call because browsers
 * derive the "Save as PDF" filename from it — without this every receipt saves
 * as "Developer Console — EPS". `window.print()` blocks until the print dialog
 * is dismissed, so the title is back to normal by the time the user sees the
 * page again.
 * @param pageTitle - Prefix for the print/PDF filename, e.g. "Receipt (Copy)".
 */
export function printPage(pageTitle = ""): void {
	const originalTitle = document.title;
	const now = new Date();
	const stamp =
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
		`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

	document.title = `${pageTitle} ${stamp}`.trim();
	try {
		window.print();
	} finally {
		document.title = originalTitle;
	}
}
