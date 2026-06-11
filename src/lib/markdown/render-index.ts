import type { ApiProductRef } from "@/lib/data/api-products";
import type { IndustryData } from "@/lib/data/industries";
import type { SolutionData } from "@/lib/data/solutions";
import { SITE_URL } from "@/lib/config/site";
import {
  canonicalNotice,
  frontMatter,
  gettingStartedNotice,
  h1,
  h2,
  joinBlocks,
  indexPageNotice,
} from "./shared";

/**
 * Render the `/use-cases.md` hub index — a flat, AI-agent-friendly listing of
 * all industries and solution packs, mirroring the hub page.
 * MARK: use-cases.md
 */
export function renderUseCasesHubMarkdown(
  industries: IndustryData[],
  solutions: SolutionData[]
): string {
  const canonical = `${SITE_URL}/use-cases`;
  const blocks: (string | undefined)[] = [
    frontMatter({
      type: "use-cases-hub",
      title: "Use Cases | Eko Platform Services",
      description:
        "Find the right Eko API stack for your business. Browse by industry or solution pack to see pre-bundled APIs for common workflows.",
      canonical,
    }),
    canonicalNotice(canonical),
    h1("Use Cases — Find the right Eko stack for your business"),
    "Browse by industry to see how teams like yours use Eko, or by solution pack to see pre-bundled APIs for common workflows.",
    gettingStartedNotice(),
    h2("Industries"),
    industries
      .map(
        (i) =>
          `- [${i.name}](${SITE_URL}/industries/${i.slug}) — ${i.navDescription} ([markdown](${SITE_URL}/industries/${i.slug}.md))`
      )
      .join("\n"),
    h2("Solution Packs"),
    solutions
      .map(
        (s) =>
          `- [${s.name}](${SITE_URL}/solutions/${s.slug}) — ${s.tagline} ([markdown](${SITE_URL}/solutions/${s.slug}.md))`
      )
      .join("\n"),
  ];
  return joinBlocks(blocks);
}

/**
 * Render the root `/index.md` — site sitemap in markdown form linking to every
 * content piece's markdown version.
 * MARK: index.md
 */
export function renderSiteIndexMarkdown(
  products: ApiProductRef[],
  industries: IndustryData[],
  solutions: SolutionData[]
): string {
  const canonical = `${SITE_URL}/`;
  const productsByCategory = {
    bc: products.filter((p) => p.category === "bc"),
    payment: products.filter((p) => p.category === "payment"),
    verification: products.filter((p) => p.category === "verification"),
  };

  const renderProductSection = (label: string, list: ApiProductRef[]) =>
    list.length === 0
      ? undefined
      : `### ${label}\n${list
          .map(
            (p) =>
              `- [${p.name}](${SITE_URL}${p.href}) — ${p.shortDesc} ([markdown](${SITE_URL}${p.href}.md))`
          )
          .join("\n")}`;

  const blocks: (string | undefined)[] = [
    frontMatter({
      type: "site-index",
      title: "Eko Platform Services (EPS) — Site Index",
      description:
        "Machine-readable site index for Eko Platform Services. Links to markdown versions of every product, industry, and solution page.",
      canonical,
    }),
    canonicalNotice(canonical),
    h1("Eko Platform Services — Site Index"),
    "Eko provides a single API platform for payments, banking correspondent services, and identity verification across India. This is a machine-readable index linking to markdown versions of every page.",
    gettingStartedNotice(),
    h2("Pricing"),
    `- [Verification API pricing — full rate card](${SITE_URL}/pricing) ([markdown](${SITE_URL}/pricing.md))`,
    h2("Products (APIs)"),
    `Browse all products: [Products listing](${SITE_URL}/products) ([markdown](${SITE_URL}/products.md))`,
    renderProductSection("Verification APIs", productsByCategory.verification),
    renderProductSection("Payment APIs", productsByCategory.payment),
    renderProductSection(
      "Banking Correspondent (BC) APIs",
      productsByCategory.bc,
    ),
    h2("Industries"),
    industries
      .map(
        (i) =>
          `- [${i.name}](${SITE_URL}/industries/${i.slug}) — ${i.navDescription} ([markdown](${SITE_URL}/industries/${i.slug}.md))`,
      )
      .join("\n"),
    h2("Solution Packs"),
    solutions
      .map(
        (s) =>
          `- [${s.name}](${SITE_URL}/solutions/${s.slug}) — ${s.tagline} ([markdown](${SITE_URL}/solutions/${s.slug}.md))`,
      )
      .join("\n"),
    h2("Use Cases Hub"),
    `- [Use Cases](${SITE_URL}/use-cases) ([markdown](${SITE_URL}/use-cases.md))`,
  ];

  return joinBlocks(blocks);
}

/**
 * Render `/llms.txt` per the llmstxt.org convention.
 * MARK: llms.txt
 */
export function renderLlmsTxt(
  products: ApiProductRef[],
  industries: IndustryData[],
  solutions: SolutionData[]
): string {
  const lines: string[] = [];
  lines.push("# Eko Platform Services");
  lines.push("");
  lines.push(
    "> EPS (Eko Platform Services) is an API platform for payments, banking correspondent services (AePS, DMT, BBPS), and identity verification (PAN, Aadhaar, bank, GST, DL, RC, etc.) in India. Markdown versions of every page are available at the URLs below."
  );
  lines.push("");
  lines.push(`- ${indexPageNotice()}`);
  lines.push(`- [All Products](${SITE_URL}/products.md): Full listing of all API products by category`);
  lines.push(`- [Pricing](${SITE_URL}/pricing.md): Full per-transaction rate card for all verification APIs`);
  // lines.push(`- [Use cases hub](${SITE_URL}/use-cases.md): Industries and solution packs`);
  lines.push("");

  lines.push("## Products");
  for (const p of products) {
    lines.push(`- [${p.name}](${SITE_URL}${p.href}.md): ${p.shortDesc}`);
  }
  lines.push("");

  lines.push("## Industries");
  for (const i of industries) {
    lines.push(`- [${i.name}](${SITE_URL}/industries/${i.slug}.md): ${i.navDescription}`);
  }
  lines.push("");

  lines.push("## Solutions");
  for (const s of solutions) {
    lines.push(`- [${s.name}](${SITE_URL}/solutions/${s.slug}.md): ${s.tagline}`);
  }
  lines.push("");

  return lines.join("\n");
}
