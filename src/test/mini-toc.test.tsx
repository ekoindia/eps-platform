// Guards MiniToc's heading scan: level mapping (H1–H3 + [data-toc] anchors),
// the maxLevel cutoff, and the "render nothing below 2 headings" rule.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MiniToc } from "@/components/MiniToc";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

/** Render a <main> with the given headings plus <MiniToc>, then flush effects. */
const renderWith = async (main: React.ReactNode, props = {}) => {
	root = createRoot(container);
	await act(async () => {
		root.render(
			<>
				<main>{main}</main>
				<MiniToc {...props} />
			</>,
		);
	});
	// The popup lists one <button> per entry.
	return Array.from(container.querySelectorAll("nav button")).map(
		(b) => b.textContent,
	);
};

describe("MiniToc heading scan", () => {
	it("lists H2–H3 in document order, excluding the page H1", async () => {
		const labels = await renderWith(
			<>
				<h1>Title</h1>
				<h2>Section A</h2>
				<h3>Sub A1</h3>
				<h2>Section B</h2>
			</>,
		);
		expect(labels).toEqual(["Section A", "Sub A1", "Section B"]);
	});

	it("drops H3 when maxLevel is 2", async () => {
		const labels = await renderWith(
			<>
				<h1>Title</h1>
				<h2>Section A</h2>
				<h2>Section B</h2>
				<h3>Card title (noise)</h3>
			</>,
			{ maxLevel: 2 },
		);
		expect(labels).toEqual(["Section A", "Section B"]);
	});

	it("includes headingless [data-toc] anchors using the attribute label", async () => {
		const labels = await renderWith(
			<>
				<div data-toc="Description" data-toc-level="2">
					prose
				</div>
				<h2>Request</h2>
			</>,
		);
		expect(labels).toEqual(["Description", "Request"]);
	});

	it("renders nothing with fewer than 2 headings", async () => {
		const labels = await renderWith(<h1>Lonely</h1>);
		expect(labels).toEqual([]);
		expect(container.querySelector("nav")).toBeNull();
	});
});
