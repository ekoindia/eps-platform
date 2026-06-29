/**
 * SSR entry point for static pre-rendering.
 *
 * Exports a single `renderPage(url)` function that renders any route to HTML
 * and extracts `<head>` tags set by react-helmet-async.
 *
 * This is the abstraction boundary — if migrating to Vike / Astro later,
 * only this file and the SSG plugin need to change. Page components, data
 * layer, and routing remain untouched.
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import type { HelmetServerState } from "react-helmet-async";
import App from "./AppServer";

interface RenderResult {
	/** The rendered HTML for inside <div id="root"> */
	html: string;
	/** Serialised <head> tags (title, meta, link, script) to inject into the template */
	head: string;
}

export function renderPage(url: string): RenderResult {
	// react-helmet-async requires a mutable context object
	const helmetContext: { helmet?: HelmetServerState } = {};

	const html = renderToString(
		<StaticRouter location={url}>
			<App helmetContext={helmetContext} />
		</StaticRouter>,
	);

	const { helmet } = helmetContext;

	// Combine all head tags produced by <Helmet> across the component tree
	const head = helmet
		? [
				helmet.title.toString(),
				helmet.meta.toString(),
				helmet.link.toString(),
				helmet.script.toString(),
			]
				.filter(Boolean)
				.join("\n")
		: "";

	return { html, head };
}
