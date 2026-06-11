import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Footer } from "@/components/Footer";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { SITE_URL } from "@/lib/config/site";
import { FadeIn } from "@/components/FadeIn";
import { getActiveProducts, type ApiProductRef } from "@/lib/data/api-products";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import { ArrowRight } from "lucide-react";
import { AiHint } from "@/components/AiHint";

interface CategoryGroup {
	key: string;
	label: string;
	description: string;
	variant: "default" | "muted";
}

const PRODUCT_CATEGORIES: CategoryGroup[] = [
	{
		key: "verification",
		label: "Verification APIs",
		description: "Real-time identity & document verification for onboarding and compliance",
		variant: "default",
	},
	{
		key: "payment",
		label: "Payment APIs",
		description: "Process payments, payouts, and collections at scale",
		variant: "muted",
	},
	{
		key: "bc",
		label: "BC Agent APIs",
		description: "Enable banking services at doorstep through Business Correspondent agents",
		variant: "default",
	},
];

const groupProductsByCategory = (products: ApiProductRef[]): Record<string, ApiProductRef[]> => {
	return products.reduce<Record<string, ApiProductRef[]>>((acc, product) => {
		const cat = product.category;
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(product);
		return acc;
	}, {});
};

const ApiProductCard = ({ product, delay }: { product: ApiProductRef; delay: number }) => {
	const pageData = API_PRODUCT_PAGES[product.id];
	const Icon = pageData?.icon;

	return (
		<FadeIn delay={delay}>
			<Link
				to={product.href}
				className="group block h-full p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-card-hover hover:border-eko-gold/30 transition-all duration-300"
			>
				{Icon && (
					<div className="w-10 h-10 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
						<Icon className="w-5 h-5 text-eko-gold" />
					</div>
				)}
				<h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-eko-gold transition-colors">
					{product.name}
				</h3>
				<p className="text-muted-foreground text-sm leading-relaxed mb-4">
					{product.shortDesc}
				</p>
				<span className="inline-flex items-center gap-1 text-sm font-medium text-eko-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
					Learn more <ArrowRight className="w-3.5 h-3.5" />
				</span>
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
			{ "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/products` },
		],
	};

	return (
		<>
			<Helmet>
				<title>APIs & Products | Eko Platform Services</title>
				<meta name="description" content="Explore Eko's full suite of fintech APIs — payments, verification, and BC agent services. Production-ready APIs built for India's digital economy." />
				<link rel="canonical" href={`${SITE_URL}/products`} />
				<meta property="og:title" content="APIs & Products | Eko Platform Services" />
				<meta property="og:description" content="Explore Eko's full suite of fintech APIs — payments, verification, and BC agent services." />
				<meta property="og:url" content={`${SITE_URL}/products`} />
				<link rel="alternate" type="text/markdown" href={`${SITE_URL}/products.md`} />
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
								<BreadcrumbNav crumbs={[
									{ label: "Home", href: "/" },
									{ label: "Products" },
								]} />
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
									Production-ready fintech APIs for payments, verification, and agent banking — built for India's digital economy.
								</p>
							</FadeIn>
						</div>
					</section>

					{/* Category Sections */}
					{PRODUCT_CATEGORIES.map((cat) => {
						const products = grouped[cat.key];
						if (!products || products.length === 0) return null;

						return (
							<SectionContainer key={cat.key} variant={cat.variant} id={cat.key}>
								<FadeIn><SectionHeader title={cat.label} subtitle={cat.description} /></FadeIn>
								<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
									{products.map((product, i) => (
										<ApiProductCard key={product.id} product={product} delay={i * 100} />
									))}
								</div>
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
