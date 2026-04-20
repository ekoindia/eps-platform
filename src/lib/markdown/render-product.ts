import type { ProductPageLayoutProps } from "@/components/ProductPageLayout";
import type { ApiProductRef } from "@/lib/data/api-products";
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
  renderSteps,
} from "./shared";

export interface ProductPageSeoShape {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface ProductPageDataShape extends ProductPageLayoutProps {
  seo: ProductPageSeoShape;
}

/**
 * Render a Markdown document for a single product page.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export function renderProductMarkdown(
  product: ApiProductRef,
  page: ProductPageDataShape,
  relatedProducts: ApiProductRef[] = []
): string {
  const canonical = `${SITE_URL}/products/${product.slug}`;

  const blocks: (string | false | undefined)[] = [
    frontMatter({
      type: "product",
      title: page.seo.title,
      description: page.seo.description,
      keywords: page.seo.keywords,
      slug: product.slug,
      category: page.category,
      canonical,
      docs_url: page.docsUrl,
    }),
    canonicalNotice(canonical),
    h1(page.heroTitle || page.title),
    page.heroSubtitle,
    page.desc && page.desc !== page.heroSubtitle ? `_${page.desc}_` : undefined,
    gettingStartedNotice(),
  ];

  if (page.overview) {
    blocks.push(h2("Overview"), page.overview);
  }

  if (page.keyBenefits && page.keyBenefits.length > 0) {
    blocks.push(h2("Key Benefits"), bulletList(page.keyBenefits));
  }

  if (page.features && page.features.length > 0) {
    blocks.push(h2("Features"));
    for (const f of page.features) {
      blocks.push(`${h3(f.title)}\n${f.desc}`);
    }
  }

  if (page.benefits && page.benefits.length > 0) {
    blocks.push(h2("Benefits"));
    for (const b of page.benefits) {
      blocks.push(`${h3(b.title)}\n${b.desc}`);
    }
  }

  if (page.types && page.types.length > 0) {
    blocks.push(h2("Supported Types"), bulletList(page.types.map((t) => t.label)));
  }

  if (page.whoShouldUse && page.whoShouldUse.length > 0) {
    blocks.push(h2("Who Should Use This"), bulletList(page.whoShouldUse));
  }

  if (page.useCases && page.useCases.length > 0) {
    blocks.push(h2("Use Cases"), bulletList(page.useCases));
  }

  if (page.inputOutputPreview && !page.inputOutputPreview.comingSoon) {
    const iop = page.inputOutputPreview;
    blocks.push(h2(`API Preview — ${iop.apiName}`));
    if (iop.inputs && iop.inputs.length > 0) {
      blocks.push(
        h3("Example inputs"),
        markdownTable(
          ["Field", "Value"],
          iop.inputs.map((f) => [f.label, f.value])
        )
      );
    }
    if (iop.outputs && iop.outputs.length > 0) {
      blocks.push(
        h3("Example outputs"),
        markdownTable(
          ["Field", "Value"],
          iop.outputs.map((f) => [f.label, f.value])
        )
      );
    }
  }

  if (page.integrationSteps && page.integrationSteps.length > 0) {
    blocks.push(h2("Integration Steps"), renderSteps(page.integrationSteps));
  }

  if (page.trustAndCompliance && page.trustAndCompliance.length > 0) {
    blocks.push(h2("Trust & Compliance"), bulletList(page.trustAndCompliance));
  }

  if (page.faqs && page.faqs.length > 0) {
    blocks.push(h2("FAQs"));
    for (const f of page.faqs) {
      blocks.push(`${h3(f.q)}\n${f.a}`);
    }
  }

  blocks.push(h2("API Documentation"), `- [Full developer docs](${page.docsUrl})`);

  if (relatedProducts.length > 0) {
    blocks.push(
      h2("Related Products"),
      relatedProducts
        .map(
          (p) =>
            `- [${p.name}](${SITE_URL}${p.href}) — ${p.shortDesc} ([markdown](${SITE_URL}${p.href}.md))`
        )
        .join("\n")
    );
  }

  return joinBlocks(blocks);
}
