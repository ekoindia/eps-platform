import type { IndustryData } from "@/lib/data/industries";
import { SITE_URL } from "@/lib/config/site";
import {
  bulletList,
  canonicalNotice,
  frontMatter,
  gettingStartedNotice,
  h1,
  h2,
  h3,
  joinBlocks,
  markdownTable,
} from "./shared";

const relevanceLabel: Record<"H" | "M" | "L", string> = {
  H: "High",
  M: "Medium",
  L: "Low",
};

export function renderIndustryMarkdown(data: IndustryData): string {
  const canonical = `${SITE_URL}/industries/${data.slug}`;

  const blocks: (string | false | undefined)[] = [
    frontMatter({
      type: "industry",
      title: data.seo.title,
      description: data.seo.description,
      keywords: data.seo.keywords,
      slug: data.slug,
      category: data.category,
      canonical,
    }),
    canonicalNotice(canonical),
    h1(data.h1 || data.name),
    data.heroSubtitle,
    gettingStartedNotice(),
  ];

  if (data.trustStrip && data.trustStrip.length > 0) {
    blocks.push(h2("Trust Signals"), bulletList(data.trustStrip));
  }

  if (data.challengeText) {
    blocks.push(h2("The Challenge"), data.challengeText);
  }

  if (data.recommendedPacks && data.recommendedPacks.length > 0) {
    blocks.push(h2("Recommended Solution Packs"));
    for (const pack of data.recommendedPacks) {
      blocks.push(
        `${h3(pack.name + (pack.featured ? " _(featured)_" : ""))}\n${pack.description}\n\n**Includes:** ${pack.apis.join(", ")}\n\n[View solution pack](${SITE_URL}/solutions/${pack.slug})`
      );
    }
  }

  if (data.apiGrid && data.apiGrid.length > 0) {
    blocks.push(
      h2("Recommended APIs"),
      markdownTable(
        ["API", "Description", "Relevance", "Link", "Markdown Link"],
        data.apiGrid.map((a) => [
          a.name,
          a.description,
          relevanceLabel[a.relevance] ?? a.relevance,
          `[Details](${SITE_URL}${a.href})`,
          `[Markdown](${SITE_URL}${a.href}.md)`,
        ]),
      ),
    );
  }

  if (data.useCaseVignettes && data.useCaseVignettes.length > 0) {
    blocks.push(h2("Use Case Scenarios"));
    for (const v of data.useCaseVignettes) {
      blocks.push(
        `${h3(v.title)}\n**Situation:** ${v.situation}\n\n**Integration:** ${v.integration}\n\n**Outcome:** ${v.outcome}`
      );
    }
  }

  if (data.whyEko && data.whyEko.length > 0) {
    blocks.push(h2("Why Eko"));
    for (const w of data.whyEko) {
      blocks.push(`${h3(w.title)}\n${w.description}`);
    }
  }

  if (data.integrationSteps && data.integrationSteps.length > 0) {
    blocks.push(
      h2("Integration Steps"),
      data.integrationSteps.map((s) => `${s.step}. **${s.title}** — ${s.description}`).join("\n")
    );
  }

  if (data.complianceItems && data.complianceItems.length > 0) {
    blocks.push(h2("Compliance"));
    for (const c of data.complianceItems) {
      blocks.push(`${h3(c.title)}\n${c.description}`);
    }
  }

  if (data.faqs && data.faqs.length > 0) {
    blocks.push(h2("FAQs"));
    for (const f of data.faqs) {
      blocks.push(`${h3(f.question)}\n${f.answer}`);
    }
  }

  if (data.relatedIndustries && data.relatedIndustries.length > 0) {
    blocks.push(
      h2("Related Industries"),
      data.relatedIndustries
        .map((r) => `- [${r.name}](${SITE_URL}/industries/${r.slug}) ([markdown](${SITE_URL}/industries/${r.slug}.md))`)
        .join("\n")
    );
  }

  return joinBlocks(blocks);
}
