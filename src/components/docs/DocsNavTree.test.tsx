// Covers the sole-branch-child auto-expand: a branch whose only child is another
// branch would otherwise reveal just one more chevron when opened.
import { buildNavTree, type NavBranch } from "@/lib/data/docs-registry";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DocsNavTree, soleBranchChain } from "./DocsNavTree";

const branch = (id: string, children: NavBranch["children"]): NavBranch => ({
	type: "branch",
	id,
	label: id,
	kind: "product",
	children,
});

const leaf = (slug: string) =>
	({ type: "leaf", slug, title: slug, method: "GET" }) as const;

/** First branch in the real nav whose only child is a branch, if any. */
const findSoleChildBranch = (
	nodes: NavBranch["children"],
): NavBranch | null => {
	for (const node of nodes) {
		if (node.type !== "branch") continue;
		if (soleBranchChain(node).length > 0) return node;
		const nested = findSoleChildBranch(node.children);
		if (nested) return nested;
	}
	return null;
};

describe("soleBranchChain", () => {
	it("returns the sole branch child", () => {
		const child = branch("child", [leaf("a"), leaf("b")]);
		expect(soleBranchChain(branch("parent", [child]))).toEqual(["child"]);
	});

	it("follows a chain of sole branch children, outermost first", () => {
		const grandchild = branch("grandchild", [leaf("a"), leaf("b")]);
		const child = branch("child", [grandchild]);
		expect(soleBranchChain(branch("parent", [child]))).toEqual([
			"child",
			"grandchild",
		]);
	});

	it("returns nothing when the sole child is a leaf", () => {
		expect(soleBranchChain(branch("parent", [leaf("a")]))).toEqual([]);
	});

	it("returns nothing when there are several children", () => {
		const child = branch("child", [leaf("a")]);
		expect(soleBranchChain(branch("parent", [child, leaf("b")]))).toEqual([]);
	});
});

describe("DocsNavTree", () => {
	it("opens the sole branch child when a branch is expanded", () => {
		const nav = buildNavTree();
		const parent = nav.categories
			.map((c) => findSoleChildBranch(c.nodes))
			.find(Boolean);
		// Guard: the fixture-free assertion below only means something while the
		// real nav still contains such a branch (e.g. DMT with one provider).
		expect(parent, "no sole-branch-child branch in the nav tree").toBeTruthy();
		const child = parent!.children[0] as NavBranch;

		render(
			<MemoryRouter>
				<DocsNavTree />
			</MemoryRouter>,
		);
		// Re-query after each render: the row components are declared inside
		// DocsNavTree, so every state change remounts them into fresh DOM nodes.
		const row = (label: string) => screen.getByRole("button", { name: label });
		expect(row(parent!.label)).toHaveAttribute("aria-expanded", "false");

		fireEvent.click(row(parent!.label));

		expect(row(parent!.label)).toHaveAttribute("aria-expanded", "true");
		const childRow = row(child.label);
		expect(childRow).toHaveAttribute("aria-expanded", "true");
		// ...and its own children (group rows or endpoint links) are on screen.
		const subtree = childRow.parentElement as HTMLElement;
		const rows = subtree.querySelectorAll("button, a");
		expect(rows.length - 1).toBe(child.children.length);
	});
});
