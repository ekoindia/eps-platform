import { SALES_MOBILE, SITE_URL, SIGNUP_PAGE } from "@/lib/config/site";

/**
 * Shared helpers for markdown rendering at build time.
 *
 * These helpers are intentionally dependency-free so they can run in any
 * ESM / SSR context (used by the Vite build plugin and unit tests).
 */

/** Escape a string for safe use as a YAML scalar value (double-quoted form). */
export function yamlString(value: string | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim();
  return `"${escaped}"`;
}

/** Render a simple front-matter block from a flat record of scalar/string[] values. */
export function frontMatter(fields: Record<string, string | string[] | undefined>): string {
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
  return value.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/** Build a GitHub-flavoured markdown table. */
export function markdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(inlineCell).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/** Joins non-empty blocks with two newlines, trimming trailing whitespace. */
export function joinBlocks(blocks: Array<string | undefined | false | null>): string {
  return blocks.filter((b): b is string => typeof b === "string" && b.trim().length > 0).join("\n\n") + "\n";
}

/** Render a numbered list of step objects. */
export function renderSteps(steps: Array<{ title: string; desc: string; tip?: string }>): string {
  return steps
    .map((s, i) => {
      const base = `${i + 1}. **${s.title}** — ${s.desc.trim()}`;
      return s.tip ? `${base}\n   > Tip: ${s.tip}` : base;
    })
    .join("\n");
}

/** Render a bullet list. */
export function bulletList(items: string[]): string {
  return items.map((i) => `- ${i.trim()}`).join("\n");
}

/** Convenience heading helpers. */
export const h1 = (s: string) => `# ${s}`;
export const h2 = (s: string) => `## ${s}`;
export const h3 = (s: string) => `### ${s}`;

/** Add a canonical-notice block. */
export function canonicalNotice(canonicalUrl: string): string {
  return `> **Canonical URL:** ${canonicalUrl}\n> _This is a machine-readable Markdown version of the page for AI agents and LLMs. The primary (HTML) version lives at the canonical URL above._`;
}

/** Add a shared get-started CTA block. */
export function gettingStartedNotice(): string {
  return `To get started, fill the form at ${SITE_URL}${SIGNUP_PAGE} (with your name and mobile number) or call us at +91${SALES_MOBILE}`;
}

/** Get Index Page Link */
export const indexPageNotice = (): string =>
  `[Site index](${SITE_URL}/index.md): Full list of API products, industries, and solution packs`;
