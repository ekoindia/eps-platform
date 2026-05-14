import type { SolutionData } from "@/lib/data/solutions";
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
  // markdownTable,
  indexPageNotice,
} from "./shared";

export function renderSolutionMarkdown(
  data: SolutionData,
  industryNames: Record<string, string> = {}
): string {
  const canonical = `${SITE_URL}/solutions/${data.slug}`;

  const blocks: (string | false | undefined)[] = [
    frontMatter({
      type: "solution pack",
      title: data.seo.title,
      description: data.seo.description,
      keywords: data.seo.keywords,
      slug: data.slug,
      category: data.category,
      canonical,
    }),
    canonicalNotice(canonical),
    h1(data.name),
    data.heroSubtitle,
    data.tagline ? `_${data.tagline}_` : undefined,
    gettingStartedNotice(),
  ];

  if (data.apiChips && data.apiChips.length > 0) {
    blocks.push(
      h2("APIs in this pack"),
      data.apiChips
        .map((c) =>
          c.href && c.href !== "#"
            ? `- [${c.name}](${SITE_URL}${c.href}) ([markdown](${SITE_URL}${c.href}.md))`
            : `- ${c.name}`,
        )
        .join("\n"),
    );
  }

  if (data.trustStrip && data.trustStrip.length > 0) {
    blocks.push(h2("Trust Signals"), bulletList(data.trustStrip));
  }

  if (data.jobStatement) {
    blocks.push(h2("What This Pack Does"), data.jobStatement);
  }

  if (data.packApis && data.packApis.length > 0) {
    blocks.push(h2("Included APIs"));
    for (const api of data.packApis) {
      const header =
        api.href && api.href !== "#"
          ? `[${api.name}](${SITE_URL}${api.href})`
          : api.name;
      blocks.push(
        `${h3(header)}\n**What it does:** ${api.what}\n\n**Why it matters:** ${api.why}`
      );
    }
  }

  if (data.howItWorksSteps && data.howItWorksSteps.length > 0) {
    blocks.push(
      h2("How It Works"),
      data.howItWorksSteps.map((s) => `${s.step}. ${s.label}`).join("\n")
    );
  }

  if (data.industriesUsingSlugs && data.industriesUsingSlugs.length > 0) {
    blocks.push(
      h2("Industries Using This Pack"),
      data.industriesUsingSlugs
        .map((slug) => {
          const name = industryNames[slug] ?? slug;
          return `- [${name}](${SITE_URL}/industries/${slug}) ([markdown](${SITE_URL}/industries/${slug}.md))`;
        })
        .join("\n")
    );
  }

//	TODO: Re-enable example code section once we have content for it. Will need to add syntax highlighting support in markdown renderer at that time as well.
//   if (data.exampleCode && data.exampleCode.length > 0) {
//     blocks.push(h2("Example Code"));
//     for (const ex of data.exampleCode) {
//       blocks.push(`${h3(ex.fileName)}\n\n\`\`\`${ex.language}\n${ex.code}\n\`\`\``);
//     }
//   }

//	TODO: Re-enable DIY vs Eko comparison section once we have content for it. Will need to add support for multi-line cells in markdownTable helper at that time as well.
//   if (data.comparisonRows && data.comparisonRows.length > 0) {
//     blocks.push(
//       h2("DIY vs Eko"),
//       markdownTable(
//         ["Aspect", "DIY", "With Eko"],
//         data.comparisonRows.map((r) => [r.aspect, r.diy, r.eko])
//       )
//     );
//   }

//	TODO: Re-enable pricing section once we have proper content for it.
//   if (data.pricingBlurb) {
//     blocks.push(h2("Pricing"), data.pricingBlurb);
//   }

  if (data.faqs && data.faqs.length > 0) {
    blocks.push(h2("FAQs"));
    for (const f of data.faqs) {
      blocks.push(`${h3(f.question)}\n${f.answer}`);
    }
  }

  if (data.relatedSolutions && data.relatedSolutions.length > 0) {
    blocks.push(
      h2("Related Solutions"),
      data.relatedSolutions
        .map(
          (r) =>
            `- [${r.name}](${SITE_URL}/solutions/${r.slug}) — ${r.tagline} ([markdown](${SITE_URL}/solutions/${r.slug}.md))`
        )
        .join("\n")
    );
  }

  blocks.push(`- ${indexPageNotice()}`);

  return joinBlocks(blocks);
}
