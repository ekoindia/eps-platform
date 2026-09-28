import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	MemoryRouter,
	useNavigate,
	type NavigateFunction,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "@/components/ScrollToTop";

// Tell React this file drives updates through act().
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let navigate: NavigateFunction;

const NavProbe = () => {
	const nav = useNavigate();
	useEffect(() => {
		navigate = nav;
	}, [nav]);
	return null;
};

/** Renders its target only after a delay — like a lazy route chunk. */
const LateTarget = () => {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setReady(true), 50);
		return () => clearTimeout(timer);
	}, []);
	return ready ? <div id="late">target</div> : null;
};

const scrollIntoView = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	Element.prototype.scrollIntoView = scrollIntoView;
	window.scrollTo = scrollTo as typeof window.scrollTo;
	// jsdom has no layout; treat every attached element as rendered.
	vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([
		{},
	] as unknown as DOMRectList);
	scrollIntoView.mockClear();
	scrollTo.mockClear();
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});

const render = (url: string, children?: React.ReactNode) => {
	act(() => {
		root = createRoot(container);
		root.render(
			<MemoryRouter initialEntries={[url]}>
				<NavProbe />
				<ScrollToTop />
				{children}
			</MemoryRouter>,
		);
	});
};

describe("ScrollToTop", () => {
	// A hash link into a lazy page: the target renders after the effect runs.
	it("waits for a hash target that renders late", async () => {
		render("/pricing#late", <LateTarget />);
		expect(scrollIntoView).not.toHaveBeenCalled();
		// act() commits the late render when it ends; the next frames find it.
		await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
		expect(scrollIntoView).toHaveBeenCalledTimes(1);
	});

	// Calculators rewrite the query with setSearchParams, which drops the hash.
	// That same-page URL change must not yank the reader back to the top.
	it("does not scroll to top when only the hash is dropped", () => {
		render("/pricing#late");
		scrollTo.mockClear();
		act(() => navigate("/pricing?pay=x", { replace: true }));
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("scrolls to top on a new page without a hash", () => {
		render("/");
		scrollTo.mockClear();
		act(() => navigate("/pricing"));
		expect(scrollTo).toHaveBeenCalledWith(0, 0);
	});
});
