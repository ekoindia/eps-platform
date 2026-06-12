// Regression tests for FadeIn's SSG/hydration contract.
//
// History: FadeIn once picked its class from environment detection
// (CSS.supports), so SSG prerendered `fade-in-hidden` while supporting
// browsers hydrated with `fade-in-css`. React skips attribute patching during
// hydration, so the stale `fade-in-hidden` (opacity: 0) stayed in the DOM and
// content was invisible on reload. The contract now: class choice depends
// only on props, so server HTML and client render always agree, and the
// hidden state for `.fade-in-css` exists only inside scroll-driven keyframes
// (see index.css) so inactive timelines degrade to visible content.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

// IntersectionObserver stub for jsdom that lets tests fire the callback.
const observerCallbacks: IntersectionCallback[] = [];
class IntersectionObserverStub {
	constructor(callback: IntersectionCallback) {
		observerCallbacks.push(callback);
	}
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
		observerCallbacks.length = 0;
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

	it("renders the same class on the server and in a scroll-driven-animation browser", async () => {
		// Server render: CSS API unavailable.
		const ServerFadeIn = await importFadeIn(false);
		const serverHtml = renderToString(
			<ServerFadeIn>
				<h2>Section title</h2>
			</ServerFadeIn>,
		);
		expect(serverHtml).toContain("fade-in-css");
		expect(serverHtml).not.toContain("fade-in-hidden");
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

		// No environment-dependent class divergence: the prerendered class
		// survives hydration unchanged.
		const el = container.firstElementChild as HTMLElement;
		expect(el.classList.contains("fade-in-css")).toBe(true);
		expect(el.classList.contains("fade-in-hidden")).toBe(false);

		// No IntersectionObserver on the CSS path — the reveal is pinned only
		// when the scroll-driven animation completes (sticky against
		// scroll-up re-hide and full-page screenshot capture).
		expect(observerCallbacks.length).toBe(0);
		await act(async () => {
			const event = new Event("animationend") as AnimationEvent & { animationName: string };
			Object.defineProperty(event, "animationName", { value: "fade-in-view" });
			el.dispatchEvent(event);
		});
		expect(el.classList.contains("fade-in-done")).toBe(true);
	});

	it("falls back to IntersectionObserver in browsers without scroll-driven animations", async () => {
		const FadeIn = await importFadeIn(false);
		const serverHtml = renderToString(
			<FadeIn>
				<h2>Section title</h2>
			</FadeIn>,
		);
		container.innerHTML = serverHtml;

		await act(async () => {
			root = hydrateRoot(
				container,
				<FadeIn>
					<h2>Section title</h2>
				</FadeIn>,
			);
		});

		// The observer attached; entering the viewport reveals the element.
		expect(observerCallbacks.length).toBe(1);
		await act(async () => {
			observerCallbacks[0]([{ isIntersecting: true }]);
		});
		const el = container.firstElementChild as HTMLElement;
		expect(el.classList.contains("fade-in-visible")).toBe(true);
	});

	it("uses the JS path for delayed reveals even in supporting browsers", async () => {
		const FadeIn = await importFadeIn(true);
		const html = renderToString(
			<FadeIn delay={100}>
				<h2>Section title</h2>
			</FadeIn>,
		);
		expect(html).toContain("fade-in-hidden");
		expect(html).not.toContain("fade-in-css");
	});
});
