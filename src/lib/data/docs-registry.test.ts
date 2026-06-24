import { describe, expect, it } from "vitest";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import {
	assertNoSlugCollisions,
	buildNavTree,
	type DocNode,
	endpointSlug,
	getAllDocNodes,
	getAllDocSlugs,
	docHrefForSlug,
	getDocBySlug,
	getDocumentedSpecs,
	productNavNodes,
	type NavBranch,
	type NavLeaf,
	type NavNode,
	RESERVED_SLUGS,
} from "@/lib/data/docs-registry";
import { API_SPECS } from "@/lib/data/api-specs";
import { GUIDES } from "@/content/docs/docs-guides";

describe("endpointSlug", () => {
	it("is the spec slug with no method prefix", () => {
		const spec = API_SPECS.find((s) => s.id === "pan-lite");
		expect(spec).toBeTruthy();
		expect(endpointSlug(spec!)).toBe(spec!.slug);
		expect(endpointSlug(spec!)).not.toMatch(/^(get|post|put|delete)-/);
	});
});

describe("documented specs", () => {
	it("includes every active-product -status spec (hidden only on marketing)", () => {
		const ids = new Set(getDocumentedSpecs().map((s) => s.id));
		const activeStatusSpecs = API_SPECS.filter(
			(s) =>
				s.id.endsWith("-status") && Boolean(ACTIVE_PRODUCTS_MAP[s.productId]),
		);
		expect(activeStatusSpecs.length).toBeGreaterThan(0);
		for (const s of activeStatusSpecs) expect(ids.has(s.id)).toBe(true);
	});

	it("only includes specs whose product is active (non-disabled)", () => {
		for (const spec of getDocumentedSpecs()) {
			expect(ACTIVE_PRODUCTS_MAP[spec.productId]).toBeTruthy();
		}
	});
});

describe("slug namespace", () => {
	it("has no duplicate or reserved slugs across guides + endpoints", () => {
		// Throws at module load already; this re-asserts on the built nodes.
		expect(() => assertNoSlugCollisions(getAllDocNodes())).not.toThrow();
		const slugs = getAllDocSlugs();
		const lower = slugs.map((s) => s.toLowerCase());
		expect(new Set(lower).size).toBe(slugs.length);
		for (const s of lower) expect(RESERVED_SLUGS.has(s)).toBe(false);
	});

	it("getDocBySlug round-trips every documented endpoint", () => {
		for (const spec of getDocumentedSpecs()) {
			const node = getDocBySlug(endpointSlug(spec));
			expect(node?.kind).toBe("endpoint");
			expect(node?.spec?.id).toBe(spec.id);
		}
	});

	it("returns undefined for unknown slugs", () => {
		expect(getDocBySlug("definitely-not-a-real-slug")).toBeUndefined();
	});
});

describe("assertNoSlugCollisions guard", () => {
	const node = (slug: string, title: string): DocNode => ({
		slug,
		kind: "guide",
		title,
	});

	it("throws on a case-insensitive duplicate", () => {
		expect(() =>
			assertNoSlugCollisions([node("Pan-Lite", "A"), node("pan-lite", "B")]),
		).toThrow(/duplicate slug/i);
	});

	it("throws on a reserved slug", () => {
		expect(() => assertNoSlugCollisions([node("openapi", "X")])).toThrow(
			/reserved/i,
		);
	});
});

/** All leaf nodes under a nav subtree, in order. */
const leaves = (nodes: NavNode[]): NavLeaf[] =>
	nodes.flatMap((n) => (n.type === "leaf" ? [n] : leaves(n.children)));

/** Direct child branches of a given `kind`. */
const childBranches = (
	nodes: NavNode[],
	kind: NavBranch["kind"],
): NavBranch[] =>
	nodes.filter((n): n is NavBranch => n.type === "branch" && n.kind === kind);

/** Find a branch anywhere in the tree by its label. */
const findBranch = (nodes: NavNode[], label: string): NavBranch | undefined => {
	for (const n of nodes) {
		if (n.type === "branch") {
			if (n.label === label) return n;
			const hit = findBranch(n.children, label);
			if (hit) return hit;
		}
	}
	return undefined;
};

describe("buildNavTree", () => {
	it("orders categories bc → payment → verification and nests endpoints", () => {
		const { categories } = buildNavTree();
		expect(categories.map((c) => c.category)).toEqual(
			["bc", "payment", "verification"].filter((cat) =>
				categories.some((c) => c.category === cat),
			),
		);
		for (const cat of categories) {
			expect(cat.nodes.length).toBeGreaterThan(0);
			const catLeaves = leaves(cat.nodes);
			expect(catLeaves.length).toBeGreaterThan(0);
			for (const ep of catLeaves) {
				expect(ep.method).toBeTruthy();
				expect(getDocBySlug(ep.slug)?.kind).toBe("endpoint");
			}
		}
	});

	it("every branch id is unique and every leaf appears exactly once", () => {
		const { categories } = buildNavTree();
		const allNodes = categories.flatMap((c) => c.nodes);
		const branchIds: string[] = [];
		const walk = (nodes: NavNode[]) => {
			for (const n of nodes) {
				if (n.type === "branch") {
					branchIds.push(n.id);
					walk(n.children);
				}
			}
		};
		walk(allNodes);
		expect(new Set(branchIds).size).toBe(branchIds.length);
		const leafSlugs = leaves(allNodes).map((l) => l.slug);
		expect(new Set(leafSlugs).size).toBe(leafSlugs.length);
	});

	it("nests DMT into Fino/Levin providers with purpose-groups", () => {
		const { categories } = buildNavTree();
		const bc = categories.find((c) => c.category === "bc")!;
		const dmt = findBranch(bc.nodes, "Domestic Money Transfer (DMT)");
		expect(dmt).toBeTruthy();
		const providers = childBranches(dmt!.children, "provider").map(
			(b) => b.label,
		);
		// Provider labels carry a "<product> – <provider>" prefix (see api-specs-common.ts).
		expect(providers).toEqual(["DMT – Fino", "DMT – Levin"]); // first-appearance order
		const fino = findBranch(dmt!.children, "DMT – Fino")!;
		const finoGroups = childBranches(fino.children, "group").map(
			(b) => b.label,
		);
		expect(finoGroups).toEqual(["Sender", "Recipients", "Transaction"]);
	});

	it("merges PPI providers (DigiKhata/Levin) under one product", () => {
		const { categories } = buildNavTree();
		const bc = categories.find((c) => c.category === "bc")!;
		const ppi = findBranch(bc.nodes, "PPI Wallet");
		expect(ppi).toBeTruthy();
		const providers = childBranches(ppi!.children, "provider").map(
			(b) => b.label,
		);
		expect(new Set(providers)).toEqual(
			new Set(["PPI – Levin", "PPI – DigiKhata"]),
		);
	});
});

describe("route parity", () => {
	it("getAllDocSlugs is exactly guides + documented endpoints (no extras/dupes)", () => {
		const slugs = getAllDocSlugs();
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(slugs.length).toBe(GUIDES.length + getDocumentedSpecs().length);
		for (const g of GUIDES) expect(slugs).toContain(g.slug);
		for (const s of getDocumentedSpecs()) expect(slugs).toContain(s.slug);
	});

	it("every nav endpoint + guide link resolves to a routable slug", () => {
		const slugs = new Set(getAllDocSlugs());
		const nav = buildNavTree();
		for (const g of nav.guides) expect(slugs.has(g.slug)).toBe(true);
		for (const c of nav.categories)
			for (const ep of leaves(c.nodes)) expect(slugs.has(ep.slug)).toBe(true);
	});

	it("every nav endpoint resolves to an endpoint doc node", () => {
		const nav = buildNavTree();
		const navSlugs = nav.categories.flatMap((c) =>
			leaves(c.nodes).map((e) => e.slug),
		);
		expect(navSlugs.every((s) => getDocBySlug(s)?.kind === "endpoint")).toBe(
			true,
		);
	});

	it("surfaces active -status endpoints as routable docs pages + nav leaves", () => {
		// pan-bulk-status is an active-product status poller.
		expect(getDocBySlug("pan-bulk-status")?.kind).toBe("endpoint");
		expect(docHrefForSlug("pan-bulk-status")).toBe("/docs/pan-bulk-status");
		const navSlugs = new Set(
			buildNavTree().categories.flatMap((c) =>
				leaves(c.nodes).map((e) => e.slug),
			),
		);
		expect(navSlugs.has("pan-bulk-status")).toBe(true);
	});

	it("keeps -status specs out of the marketing product .md tree (productNavNodes)", () => {
		for (const productId of ["pan", "bank"]) {
			const treeSlugs = new Set(
				leaves(productNavNodes(productId)).map((l) => l.slug),
			);
			const statusSlugs = getDocumentedSpecs()
				.filter((s) => s.productId === productId && s.id.endsWith("-status"))
				.map((s) => s.slug);
			expect(statusSlugs.length).toBeGreaterThan(0);
			for (const slug of statusSlugs) expect(treeSlugs.has(slug)).toBe(false);
		}
	});
});
