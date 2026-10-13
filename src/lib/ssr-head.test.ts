import { describe, expect, it } from "vitest";
import { findHeadProblems, splitHoistedHead } from "./ssr-head";

const HEAD = [
	'<link rel="preload" as="image" href="/logo.svg">',
	"<title>DigiLocker API | Eko</title>",
	'<meta name="description" content="a > b">',
	'<link rel="canonical" href="https://eps.eko.in/x">',
].join("");
const BODY =
	'<section><svg><title>Step 1</title></svg></section><script type="application/ld+json">{}</script>';

describe("splitHoistedHead", () => {
	it("moves the leading hoisted block to head and leaves the body intact", () => {
		const { head, html } = splitHoistedHead(HEAD + BODY);
		expect(head.split("\n")).toHaveLength(4);
		expect(head).toContain('content="a > b"');
		expect(html).toBe(BODY);
		expect(findHeadProblems(head, html)).toEqual([]);
	});

	it("stops at the first non-hoistable node, comments included", () => {
		const { head, html } = splitHoistedHead(`<!--$--><title>x</title>${BODY}`);
		expect(head).toBe("");
		expect(html).toContain("<title>x</title>");
	});
});

describe("findHeadProblems", () => {
	const description = '<meta name="description" content="d">';

	it("flags an empty title (array children)", () => {
		expect(findHeadProblems(`<title></title>${description}`, "")).toEqual([
			expect.stringContaining("empty <title>"),
		]);
	});

	it("flags two titles and duplicate metas", () => {
		const head = `<title>a</title><title>b</title>${description}${description}`;
		expect(findHeadProblems(head, "")).toEqual([
			"expected 1 <title>, found 2",
			"duplicate <meta>: description",
		]);
	});

	it("flags a missing description and metadata left in the body", () => {
		expect(
			findHeadProblems("<title>a</title>", '<link rel="canonical" href="/">'),
		).toEqual([
			'missing <meta name="description">',
			"head metadata left in <body> (not hoisted)",
		]);
	});
});
