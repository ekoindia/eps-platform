import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import {
  GST_RATE,
  HAS_VOLUME_DISCOUNTS,
  PRICING_FAQS,
  PRICING_GROUPS,
  SETUP_FEE_WAIVED,
  displayName,
  type PricedApi,
} from "@/lib/data/api-pricing";
import {
  bulletList,
  canonicalNotice,
  frontMatter,
  gettingStartedNotice,
  h1,
  h2,
  h3,
  indexPageNotice,
  joinBlocks,
  markdownTable,
} from "./shared";

/** Format an INR rate for markdown, e.g. 1.2 → "₹1.20". */
const formatRate = (rate: number): string => `₹${rate.toFixed(2)}`;

/** One rate-card table row: name (+ product link), rate, billing unit. */
const rateRow = (api: PricedApi): string[] => {
  const product = api.productId ? ACTIVE_PRODUCTS_MAP[api.productId] : undefined;
  const name = api.popular ? `**${displayName(api)}** (Popular)` : displayName(api);
  // Lowest rate across tiers — matches the rate card's headline figure.
  const rate = Math.min(...api.tiers.map((tier) => tier.rate));
  return [
    name,
    formatRate(rate),
    api.unitLabel ?? "per verification",
    product ? `[${product.shortName ?? product.name}](${SITE_URL}${product.href}.md)` : "—",
  ];
};

/**
 * Render `/pricing.md` — the full verification API rate card, mirroring the
 * HTML `/pricing` page. The interactive calculator is HTML-only, so this
 * document carries the complete rate card plus billing notes and FAQs.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export function renderPricingMarkdown(): string {
  const canonical = `${SITE_URL}/pricing`;

  const blocks: (string | false | undefined)[] = [
    frontMatter({
      type: "pricing",
      title: "Verification API Pricing & Rate Card | Eko Platform Services",
      description:
        "Transparent pay-per-use pricing for PAN, bank account, GST, UPI and 25+ verification APIs. Full per-transaction rate card, exclusive of GST @ 18%.",
      canonical,
    }),
    canonicalNotice(canonical),
    h1("Verification API Pricing — Full Rate Card"),
    SETUP_FEE_WAIVED
      ? "Transparent, pay-per-use API pricing. Setup fee waived for a limited time. No monthly minimums. Pay only for successful verifications."
      : "Transparent, pay-per-use API pricing. No monthly minimums. Pay only for successful verifications.",
    `An interactive pricing calculator (pick APIs, set monthly volumes, see your estimated cost) is available on the HTML page: ${canonical}`,
    gettingStartedNotice(),
    h2("Rate Card"),
    `All rates are in INR per transaction, **exclusive of GST @ ${Math.round(GST_RATE * 100)}%**.`,
  ];

  for (const group of PRICING_GROUPS) {
    blocks.push(
      h3(group.label),
      markdownTable(
        ["API", "Rate (INR, excl. GST)", "Billing unit", "Product page"],
        group.apis.map(rateRow),
      ),
    );
  }

  if (PRICING_GROUPS.some((group) => group.apis.some((api) => api.isBulk))) {
    blocks.push(
      "\\* Bulk APIs are billed per individual verification inside the bulk request, not per bulk call.",
    );
  }

  blocks.push(
    h2("Pricing Notes"),
    bulletList([
      `All listed rates exclude GST, charged at ${Math.round(GST_RATE * 100)}%.`,
      "Billing is per successful API call — failed or errored calls are not charged.",
      "No monthly minimums and no lock-in.",
      ...(SETUP_FEE_WAIVED
        ? ["Setup fees are currently waived as a limited-time offer (₹0 to activate)."]
        : []),
      ...(HAS_VOLUME_DISCOUNTS
        ? ["Volume discounts apply automatically — higher monthly volumes get lower per-transaction rates."]
        : []),
      "Commercials are subject to change based on service-provider terms; revisions are communicated in advance.",
    ]),
    h2("FAQs"),
  );

  for (const faq of PRICING_FAQS) {
    blocks.push(`${h3(faq.q)}\n${faq.a}`);
  }

  blocks.push(h2("More Information"), bulletList([indexPageNotice()]));

  return joinBlocks(blocks);
}
