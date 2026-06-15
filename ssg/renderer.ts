/**
 * Renders a single route to a complete HTML page by calling the SSR entry
 * point and injecting the result into the HTML template.
 */
import type { renderPage as RenderPageFn } from "../src/entry-server";

/**
 * Given a URL path, the SSR render function, and the built HTML template,
 * produce a fully self-contained HTML string ready to write to disk.
 */
export function renderRoute(
	url: string,
	template: string,
	renderPage: typeof RenderPageFn,
): string {
	const { html, head } = renderPage(url);

	let output = template;

	// Inject Helmet <head> tags (title, meta, link, script)
	if (head) {
		output = output.replace("<!--ssr-head-->", head);
	}

	// Inject rendered React tree into the root element
	output = output.replace("<!--ssr-outlet-->", html);

	return output;
}
