/**
 * SSR entry point for static pre-rendering.
 *
 * Exports a single `renderPage(url)` function that renders any route to HTML
 * and moves the `<head>` tags React hoisted (title, meta, link) into `head`.
 *
 * This is the abstraction boundary — if migrating to Vike / Astro later,
 * only this file and the SSG plugin need to change. Page components, data
 * layer, and routing remain untouched.
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { findHeadProblems, splitHoistedHead } from "./lib/ssr-head";
import App from "./AppServer";

interface RenderResult {
	/** The rendered HTML for inside <div id="root"> */
	html: string;
	/** Serialised <head> tags (title, meta, link) to inject into the template */
	head: string;
}

export function renderPage(url: string): RenderResult {
	// React 19 emits <Helmet> tags as a leading block of the markup (see
	// lib/ssr-head.ts); react-helmet-async's server context stays empty.
	const { head, html } = splitHoistedHead(
		renderToString(
			<StaticRouter location={url}>
				<App />
			</StaticRouter>,
		),
	);

	const problems = findHeadProblems(head, html);
	if (problems.length) {
		throw new Error(`invalid <head>: ${problems.join("; ")}`);
	}

	return { head, html };
}
