import type { ApiProductRef } from "@/lib/data/api-products";
import { SITE_URL } from "@/lib/config/site";
import {
	canonicalNotice,
	frontMatter,
	gettingStartedNotice,
	h1,
	h2,
	joinBlocks,
} from "./shared";

/**
 * Render `/products.md` — a listing of all active API products grouped by
 * category, mirroring the HTML `/products` page.
 */
export function renderProductsIndexMarkdown(products: ApiProductRef[]): string {
	const canonical = `${SITE_URL}/products`;

	const productsByCategory = {
		verification: products.filter((p) => p.category === "verification"),
		payment: products.filter((p) => p.category === "payment"),
		bc: products.filter((p) => p.category === "bc"),
	};

	const renderCategory = (label: string, list: ApiProductRef[]): string | undefined =>
		list.length === 0
			? undefined
			: `${h2(label)}\n${list
				.map(
					(p) =>
						`- [${p.name}](${SITE_URL}${p.href}) — ${p.shortDesc} ([markdown](${SITE_URL}${p.href}.md))`
				)
				.join("\n")}`;

	const blocks: (string | undefined)[] = [
		frontMatter({
			type: "products-index",
			title: "APIs & Products | Eko Platform Services",
			description:
				"Explore Eko's full suite of fintech APIs — payments, verification, and BC agent services. Production-ready APIs built for India's digital economy.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("Our APIs & Products"),
		"Production-ready fintech APIs for payments, verification, and agent banking — built for India's digital economy.",
		gettingStartedNotice(),
		renderCategory("Verification APIs", productsByCategory.verification),
		renderCategory("Payment APIs", productsByCategory.payment),
		renderCategory("BC Agent APIs", productsByCategory.bc),
	];

	return joinBlocks(blocks);
}
