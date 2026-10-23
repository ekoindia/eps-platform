/**
 * Minimal emulation of Vercel `headers` rule matching, so tests and the build
 * can check what `vercel.json` sends for a path without deploying.
 *
 * Covers the path-to-regexp subset `vercel.json` uses: `:name`,
 * `:name(pattern)`, raw `( … )` groups and `\` escapes. Values interpolate
 * `:name`, as Vercel does (verified live for the `.md` canonical rule).
 */
// ponytail: subset of path-to-regexp only — no modifiers (`:name*`, `?`, `+`); add if a rule needs them.

export interface VercelHeaderRule {
	source: string;
	headers: Array<{ key: string; value: string }>;
}

/** Copy a balanced `( … )` group starting at `start`; returns its end index. */
const groupEnd = (source: string, start: number): number => {
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		if (source[i] === "\\") i++;
		else if (source[i] === "(") depth++;
		else if (source[i] === ")" && --depth === 0) return i + 1;
	}
	throw new Error(`Unbalanced group in header source: ${source}`);
};

/** Compile a rule `source` to an anchored RegExp with named groups. */
export const sourceToRegExp = (source: string): RegExp => {
	let re = "";
	for (let i = 0; i < source.length; ) {
		const ch = source[i];
		const name = ch === ":" && /^:(\w+)/.exec(source.slice(i));
		if (name) {
			i += name[0].length;
			if (source[i] === "(") {
				const end = groupEnd(source, i);
				re += `(?<${name[1]}>${source.slice(i + 1, end - 1)})`;
				i = end;
			} else re += `(?<${name[1]}>[^/]+)`;
		} else if (ch === "(") {
			const end = groupEnd(source, i);
			re += source.slice(i, end);
			i = end;
		} else if (ch === "\\") {
			re += source.slice(i, i + 2);
			i += 2;
		} else {
			re += ch.replace(/[.*+?^${}|[\]]/g, "\\$&");
			i++;
		}
	}
	return new RegExp(`^${re}$`);
};

/**
 * The value Vercel would send for header `key` on `pathname`, with `:name`
 * params filled in. The last matching rule wins, like Vercel's own ordering.
 */
export const headerValueFor = (
	rules: VercelHeaderRule[],
	pathname: string,
	key: string,
): string | undefined => {
	let value: string | undefined;
	for (const rule of rules) {
		const header = rule.headers.find((h) => h.key === key);
		const match = header && sourceToRegExp(rule.source).exec(pathname);
		if (!header || !match) continue;
		const params = match.groups ?? {};
		value = header.value.replace(/:(\w+)/g, (whole, param: string) =>
			param in params ? params[param] : whole,
		);
	}
	return value;
};

/** The `.md` path a `Link: <…>; rel="alternate"` header points at, if any. */
export const alternateTwinPath = (
	rules: VercelHeaderRule[],
	pathname: string,
): string | undefined => {
	const link = headerValueFor(rules, pathname, "Link");
	return link?.includes('rel="alternate"')
		? /^<([^>]+)>/.exec(link)?.[1]
		: undefined;
};
