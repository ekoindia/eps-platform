import {
	EPS_MCP_PKG,
	SALES_MOBILE,
	SIGNUP_PAGE,
	SITE_URL,
} from "@/lib/config/site";

/**
 * Shared helpers for markdown rendering at build time.
 *
 * These helpers are intentionally dependency-free so they can run in any
 * ESM / SSR context (used by the Vite build plugin and unit tests).
 */

/** Escape a string for safe use as a YAML scalar value (double-quoted form). */
export function yamlString(value: string | undefined | null): string {
	if (value === undefined || value === null) return '""';
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, " ")
		.trim();
	return `"${escaped}"`;
}

/** Render a simple front-matter block from a flat record of scalar/string[] values. */
export function frontMatter(
	fields: Record<string, string | string[] | undefined>,
): string {
	const lines: string[] = ["---"];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`${key}:`);
			for (const v of value) lines.push(`  - ${yamlString(v)}`);
		} else {
			lines.push(`${key}: ${yamlString(value)}`);
		}
	}
	lines.push("---", "");
	return lines.join("\n");
}

/** Collapse stray whitespace/newlines inside table cells so pipes don't break rows. */
export function inlineCell(value: string): string {
	return value
		.replace(/\|/g, "\\|")
		.replace(/\s*\n\s*/g, " ")
		.trim();
}

/** Build a GitHub-flavoured markdown table. */
export function markdownTable(headers: string[], rows: string[][]): string {
	const head = `| ${headers.join(" | ")} |`;
	const sep = `| ${headers.map(() => "---").join(" | ")} |`;
	const body = rows
		.map((r) => `| ${r.map(inlineCell).join(" | ")} |`)
		.join("\n");
	return [head, sep, body].join("\n");
}

/** Joins non-empty blocks with two newlines, trimming trailing whitespace. */
export function joinBlocks(
	blocks: Array<string | undefined | false | null>,
): string {
	return (
		blocks
			.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
			.join("\n\n") + "\n"
	);
}

/** Render a numbered list of step objects. */
export function renderSteps(
	steps: Array<{ title: string; desc: string; tip?: string; href?: string }>,
): string {
	return steps
		.map((s, i) => {
			const title = s.href ? `[${s.title}](${s.href})` : s.title;
			const base = `${i + 1}. **${title}** — ${s.desc.trim()}`;
			return s.tip ? `${base}\n   > Tip: ${s.tip}` : base;
		})
		.join("\n");
}

/** Render a bullet list. */
export function bulletList(items: string[]): string {
	return items.map((i) => `- ${i.trim()}`).join("\n");
}

/** Minimal structural shape of an amount slab (matches AmountSlab in payments-pricing). */
export interface SlabLike {
	from: number;
	upTo: number | null;
	flat?: number;
	pct?: number;
}

/** Format an INR rate for markdown, e.g. 1.2 → "₹1.20". */
export const formatRate = (rate: number): string => `₹${rate.toFixed(2)}`;

/** Format an INR amount with Indian-style grouping, e.g. 75000 → "₹75,000". */
export const formatAmount = (amount: number): string =>
	`₹${amount.toLocaleString("en-IN")}`;

/** Format an amount-slab range, e.g. "₹101 – ₹3,000" or "₹1,00,001+". */
export const slabRange = (slab: SlabLike): string =>
	slab.upTo === null
		? `${formatAmount(slab.from)}+`
		: `${formatAmount(slab.from)} – ${formatAmount(slab.upTo)}`;

/** Format a slab's commission/charge, e.g. "₹1.20" or "0.52% of amount". */
export const slabValue = (slab: SlabLike): string =>
	slab.flat !== undefined
		? formatRate(slab.flat)
		: `${((slab.pct ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}% of amount`;

/** Convenience heading helpers. */
export const h1 = (s: string) => `# ${s}`;
export const h2 = (s: string) => `## ${s}`;
export const h3 = (s: string) => `### ${s}`;

/** Output format for the products-index renderer: GitHub Markdown or plain text. */
export type MarkdownFormat = "md" | "txt";

/**
 * Render a heading. In `md`, emits `#`/`##`/`###` by level. In `txt`, emits a
 * bold, hash-numbered label (`**#1.2 Title**`); a missing `number` (the document
 * title) drops the number prefix (`**Title**`). The caller owns the numbering.
 */
export function heading(
	level: 1 | 2 | 3,
	text: string,
	fmt: MarkdownFormat,
	number?: string,
): string {
	if (fmt === "md") return `${"#".repeat(level)} ${text}`;
	const label = number ? `**#${number} ${text}**` : `**${text}**`;
	// Top-level sections (H1/H2) get an extra leading blank line; the renderer
	// trims any blank that lands at the very top of the document.
	return level <= 2 ? `\n${label}` : label;
}

/**
 * Render tabular data. In `md`, a GitHub table. In `txt`, an indented numbered
 * list — one item per row labelled by its first column, with the remaining
 * columns as indented `Header: value` lines beneath it (no pipes).
 */
export function table(
	headers: string[],
	rows: string[][],
	fmt: MarkdownFormat,
): string {
	if (fmt === "md") return markdownTable(headers, rows);
	return rows
		.map((row, i) => {
			const label = `  ${i + 1}. ${inlineCell(row[0] ?? "")}`;
			const rest = row
				.slice(1)
				.map((cell, j) => `     ${headers[j + 1]}: ${inlineCell(cell)}`);
			return [label, ...rest].join("\n");
		})
		.join("\n");
}

/** Render a link: `[text](url)` in `md`, `text (url)` in `txt`. */
export function link(text: string, url: string, fmt: MarkdownFormat): string {
	return fmt === "md" ? `[${text}](${url})` : `${text} (${url})`;
}

/** Add a canonical-notice block. */
export function canonicalNotice(canonicalUrl: string): string {
	return `> **Canonical URL:** ${canonicalUrl}\n> This is a machine-readable Markdown version of the page for AI agents and LLMs. The primary (HTML) version lives at the canonical URL above.`;
}

/** Add a shared get-started CTA block. */
export function gettingStartedNotice(): string {
	return `To get started, fill the form at ${SITE_URL}${SIGNUP_PAGE} (with your name, mobile number and email) or call us at +91${SALES_MOBILE}`;
}

/**
 * One-line nudge telling AI coding agents to self-install the EPS context MCP,
 * with the reason (structured, authoritative API + auth data beats scraping
 * these pages) and a pointer to per-agent setup.
 */
export function mcpInstallNotice(): string {
	return `**For AI coding agents:** install the EPS context MCP (\`eps-context-mcp\`) to get structured access to the latest API specs, HMAC request signing, and integration recipes — so you can integrate Eko's APIs end-to-end without guessing from these pages. Run \`npx -y ${EPS_MCP_PKG}\`, or see per-agent setup at ${SITE_URL}/ai#install.`;
}

/** Get Index Page Link */
export const indexPageNotice = (): string =>
	`[Site index](${SITE_URL}/index.md): Full list of API products, industries, and solution packs`;
