/**
 * Head-tag plumbing for the static pre-render (see `src/entry-server.tsx`).
 *
 * React 19 + react-helmet-async v3: `<Helmet>` emits real `<title>`/`<meta>`/
 * `<link>` elements and React hoists them — helmet's server context stays empty.
 * `renderToString` of a tree without `<html>` has no `<head>` to hoist into, so
 * React emits them as one contiguous block at the very start of the markup,
 * i.e. inside `<div id="root">`. Crawlers ignore `rel=canonical` / meta in
 * `<body>`, so the pre-render moves that block into `<head>`.
 *
 * React 19 also does NOT dedupe these tags across `<Helmet>` instances, so the
 * guard below fails the build when a page ends up with two titles, an empty
 * title (array children like `<title>{a} | b</title>`) or duplicate metas.
 */

/** One hoistable tag: `<title>…</title>`, `<meta …>` or `<link …>` (quoted `>` safe). */
const HOISTABLE_TAG =
	/^\s*(?:<title\b[^>]*>[\s\S]*?<\/title>|<(?:meta|link)\b(?:"[^"]*"|'[^']*'|[^'">])*>)/;

/**
 * Splits the leading run of hoisted head tags off React's rendered markup.
 *
 * @param markup HTML returned by `renderToString`
 * @returns `head` = the hoisted tags, `html` = the remaining body markup
 */
export function splitHoistedHead(markup: string): {
	head: string;
	html: string;
} {
	const tags: string[] = [];
	let rest = markup;
	for (
		let match = HOISTABLE_TAG.exec(rest);
		match;
		match = HOISTABLE_TAG.exec(rest)
	) {
		tags.push(match[0].trim());
		rest = rest.slice(match[0].length);
	}
	return { head: tags.join("\n"), html: rest };
}

/** `name=`/`property=` key of each `<meta>` in `html`. */
const metaKeys = (html: string): string[] =>
	[...html.matchAll(/<meta\b[^>]*?\b(?:name|property)="([^"]+)"/g)].map(
		(match) => match[1],
	);

/**
 * Lists SEO head problems for one pre-rendered page; empty array = valid.
 *
 * @param head hoisted head tags (from `splitHoistedHead`)
 * @param html remaining body markup — must not still contain head metadata
 */
export function findHeadProblems(head: string, html: string): string[] {
	const problems: string[] = [];

	const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/g)].map(
		(match) => match[1].trim(),
	);
	if (titles.length !== 1) {
		problems.push(`expected 1 <title>, found ${titles.length}`);
	} else if (!titles[0]) {
		problems.push("empty <title> — pass a single string, not JSX like {a} | b");
	}

	const keys = metaKeys(head);
	const duplicates = [
		...new Set(keys.filter((key, index) => keys.indexOf(key) !== index)),
	];
	if (duplicates.length) {
		problems.push(`duplicate <meta>: ${duplicates.join(", ")}`);
	}
	if (!keys.includes("description")) {
		problems.push('missing <meta name="description">');
	}

	if (/<meta\b|<link\b[^>]*\brel="canonical"/.test(html)) {
		problems.push("head metadata left in <body> (not hoisted)");
	}

	return problems;
}
