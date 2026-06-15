import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Footer } from "@/components/Footer";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { SITE_URL } from "@/lib/config/site";
import { FadeIn } from "@/components/FadeIn";
import {
	getActiveProducts,
	productHref,
	type ApiProductRef,
} from "@/lib/data/api-products";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import {
	getStartingRate,
	getStartingUnitLabel,
	getVariantLabels,
	hasPopularApi,
} from "@/lib/data/api-pricing";
import { getEarningsHighlight } from "@/lib/data/payments-pricing";
import { formatINRRate } from "@/lib/utils";
import { pastelColors } from "@/components/DropdownGrid";
import { ArrowRight } from "lucide-react";
import { AiHint } from "@/components/AiHint";

interface CategoryGroup {
	key: string;
	label: string;
	description: string;
	variant: "default" | "muted";
	/** Tiny disclaimer rendered under the category's card grid */
	footnote: string;
}

const PRODUCT_CATEGORIES: CategoryGroup[] = [
	{
		key: "verification",
		label: "Verification APIs",
		description:
			"Real-time identity & document verification for onboarding and compliance",
		variant: "default",
		footnote: "All rates exclusive of GST @ 18%.",
	},
	{
		key: "payment",
		label: "Payment APIs",
		description: "Process payments, payouts, and collections at scale",
		variant: "muted",
		footnote:
			"Commissions exclusive of GST @ 18%; TDS @ 2% applies on payouts.",
	},
	{
		key: "bc",
		label: "BC Agent APIs",
		description:
			"Enable banking services at doorstep through Business Correspondent agents",
		variant: "default",
		footnote:
			"Commissions exclusive of GST @ 18%; TDS @ 2% applies on payouts.",
	},
];

/** Max number of API variant chips shown on a card before the "+N" overflow chip */
const MAX_VARIANT_TAGS = 3;

const groupProductsByCategory = (
	products: ApiProductRef[],
): Record<string, ApiProductRef[]> => {
	return products.reduce<Record<string, ApiProductRef[]>>((acc, product) => {
		const cat = product.category;
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(product);
		return acc;
	}, {});
};

/**
 * Pricing footer line for a product card: "From ₹X per verification" for
 * Verification APIs (a cost) or "Earn up to ₹X per transfer" for BC/payment
 * products (a commission). Null when the product has no pricing data.
 */
const CardPricingLine = ({ product }: { product: ApiProductRef }) => {
	if (product.category === "verification") {
		const startingRate = getStartingRate(product.id);
		if (startingRate === undefined) return null;
		return (
			<span className="text-[11px] text-muted-foreground">
				From{" "}
				<span className="text-xs font-semibold text-eko-gold">
					{formatINRRate(startingRate)}
				</span>{" "}
				{getStartingUnitLabel(product.id)}
			</span>
		);
	}

	const earnings = getEarningsHighlight(product.id);
	if (!earnings) return null;
	return (
		<span className="text-[11px] text-muted-foreground">
			Earn up to{" "}
			<span className="text-xs font-semibold text-eko-success">
				{earnings.maxLabel}
			</span>{" "}
			{earnings.unitLabel}
		</span>
	);
};

const ApiProductCard = ({
	product,
	index,
}: {
	product: ApiProductRef;
	index: number;
}) => {
	const pageData = API_PRODUCT_PAGES[product.id];
	const Icon = pageData?.icon;
	// Variant chips only make sense when a product spans multiple priced APIs
	const variantLabels = getVariantLabels(product.id);
	const visibleTags =
		variantLabels.length >= 2 ? variantLabels.slice(0, MAX_VARIANT_TAGS) : [];
	const overflowCount = variantLabels.length - visibleTags.length;
	const tagClassName =
		"inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-border/50 bg-muted/50 text-muted-foreground";

	return (
		<FadeIn className="h-full">
			<Link
				to={productHref(product.slug)}
				className="group relative flex flex-col h-full p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-card-hover hover:border-eko-gold/30 transition-all duration-300"
			>
				{hasPopularApi(product.id) && (
					<span className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-eko-gold/15 text-eko-gold">
						Popular
					</span>
				)}
				{Icon && (
					<div
						className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${pastelColors[index % pastelColors.length]}`}
					>
						<Icon className="w-5 h-5" />
					</div>
				)}
				<h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-eko-gold transition-colors">
					{product.name}
				</h3>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{product.shortDesc}
				</p>
				{visibleTags.length > 0 && (
					// Static spans only — the whole card is a Link; nested anchors are invalid
					<div className="flex flex-wrap gap-1.5 mt-4">
						{visibleTags.map((label) => (
							<span key={label} className={tagClassName}>
								{label}
							</span>
						))}
						{overflowCount > 0 && (
							<span className={tagClassName}>+{overflowCount}</span>
						)}
					</div>
				)}
				<div className="flex items-center justify-between gap-2 mt-auto pt-4">
					<CardPricingLine product={product} />
					<span className="inline-flex items-center gap-1 text-sm font-medium text-eko-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-auto">
						Learn more <ArrowRight className="w-3.5 h-3.5" />
					</span>
				</div>
			</Link>
		</FadeIn>
	);
};

const ProductsPage = () => {
	const activeProducts = getActiveProducts();
	const grouped = groupProductsByCategory(activeProducts);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
			{
				"@type": "ListItem",
				position: 2,
				name: "Products",
				item: `${SITE_URL}/products`,
			},
		],
	};

	return (
		<>
			<Helmet>
				<title>APIs & Products | Eko Platform Services</title>
				<meta
					name="description"
					content="Explore Eko's full suite of fintech APIs — payments, verification, and BC agent services. Production-ready APIs built for India's digital economy."
				/>
				<link rel="canonical" href={`${SITE_URL}/products`} />
				<meta
					property="og:title"
					content="APIs & Products | Eko Platform Services"
				/>
				<meta
					property="og:description"
					content="Explore Eko's full suite of fintech APIs — payments, verification, and BC agent services."
				/>
				<meta property="og:url" content={`${SITE_URL}/products`} />
				<link
					rel="alternate"
					type="text/markdown"
					href={`${SITE_URL}/products.md`}
				/>
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			</Helmet>
			<div className="min-h-screen bg-background">
				<AiHint mdPath="/products.md" />
				<main>
					{/* Hero Section */}
					<section className="relative pt-32 pb-16 bg-eko-navy overflow-hidden">
						<div className="absolute inset-0 bg-linear-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
						<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
							<div className="text-left">
								<BreadcrumbNav
									crumbs={[{ label: "Home", href: "/" }, { label: "Products" }]}
								/>
							</div>
							<FadeIn onView={false} delay={100} className="text-center">
								<span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-white/10 text-white/90">
									APIs & Products
								</span>
								<h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
									Our APIs & Products
								</h1>
							</FadeIn>
							<FadeIn onView={false} delay={200} className="text-center">
								<p className="text-xl text-white/70 max-w-2xl mx-auto">
									Production-ready fintech APIs for payments, verification, and
									agent banking — built for India's digital economy.
								</p>
							</FadeIn>
						</div>
					</section>

					{/* Category Sections */}
					{PRODUCT_CATEGORIES.map((cat) => {
						const products = grouped[cat.key];
						if (!products || products.length === 0) return null;

						return (
							<SectionContainer
								key={cat.key}
								variant={cat.variant}
								id={cat.key}
							>
								<FadeIn>
									<SectionHeader title={cat.label} subtitle={cat.description} />
								</FadeIn>
								<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
									{products.map((product, i) => (
										<ApiProductCard
											key={product.id}
											product={product}
											index={i}
										/>
									))}
								</div>
								<FadeIn>
									<p className="text-xs text-muted-foreground text-center mt-6">
										{cat.footnote}
									</p>
								</FadeIn>
							</SectionContainer>
						);
					})}
				</main>
				<Footer />
			</div>
		</>
	);
};

export default ProductsPage;
