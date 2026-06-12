// Regression test: SSG prerenders FadeIn with `fade-in-hidden` (no CSS API on
// the server), but browsers with scroll-driven animation support hydrate with
// `fade-in-css`. React skips attribute patching during hydration, so the DOM
// keeps `fade-in-hidden` (opacity: 0) and content stays invisible on reload.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";

// IntersectionObserver stub for the jsdom environment (fallback path).
class IntersectionObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}

/** Import a fresh FadeIn module with CSS.supports stubbed to `supported`. */
async function importFadeIn(supported: boolean) {
	vi.resetModules();
	vi.stubGlobal("CSS", { supports: () => supported });
	const { FadeIn } = await import("@/components/FadeIn");
	return FadeIn;
}

describe("FadeIn SSG hydration", () => {
	let container: HTMLDivElement;
	let root: Root | undefined;

	beforeEach(() => {
		vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(async () => {
		if (root) {
			await act(async () => root?.unmount());
			root = undefined;
		}
		container.remove();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("becomes visible after hydrating server HTML in a scroll-driven-animation browser", async () => {
		// Server render: CSS API unavailable → fallback class in the HTML.
		const ServerFadeIn = await importFadeIn(false);
		const serverHtml = renderToString(
			<ServerFadeIn>
				<h2>Section title</h2>
			</ServerFadeIn>,
		);
		expect(serverHtml).toContain("fade-in-hidden");
		container.innerHTML = serverHtml;

		// Client hydration: browser supports `animation-timeline: view()`.
		const ClientFadeIn = await importFadeIn(true);
		await act(async () => {
			root = hydrateRoot(
				container,
				<ClientFadeIn>
					<h2>Section title</h2>
				</ClientFadeIn>,
			);
		});

		const el = container.firstElementChild as HTMLElement;
		const visible =
			!el.classList.contains("fade-in-hidden") ||
			el.classList.contains("fade-in-visible");
		expect(visible).toBe(true);
		expect(el.classList.contains("fade-in-css")).toBe(true);
	});
});
