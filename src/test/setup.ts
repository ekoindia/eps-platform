import "@testing-library/jest-dom";
import { afterAll } from "vitest";

// Guarded so node-environment suites (e.g. the xlsx renderer test) can share
// this setup file without a DOM.
if (typeof window !== "undefined") {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => {},
		}),
	});

	// input-otp observes its container for resizes; jsdom has no ResizeObserver.
	window.ResizeObserver =
		window.ResizeObserver ??
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};

	// input-otp (1.4.2) schedules setState timeouts at 0/10/50ms and never
	// clears them. Any still pending when a file ends fire after jsdom is torn
	// down, and React's `window` access then throws an unhandled error that
	// fails the whole run — intermittently, since it depends on machine speed.
	// Drain them while the environment is still alive. Remove once upstream
	// returns a cleanup from that effect.
	afterAll(() => new Promise((resolve) => setTimeout(resolve, 60)));
}
