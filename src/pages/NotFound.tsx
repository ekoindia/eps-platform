import { useLocation, Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { SearchX, Home, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { FadeIn } from "@/components/FadeIn";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { SolutionCard } from "@/components/SolutionCard";
import { IndustryCard } from "@/components/IndustryCard";
import { CTASection } from "@/components/sections/CTASection";
import { Button } from "@/components/ui/button";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";
import { ACTIVE_INDUSTRIES_LIST } from "@/lib/data/industries";

interface PathContext {
	message: string;
	browseLabel: string;
	browseHref: string;
}

const PATH_CONTEXTS: Record<string, PathContext> = {
	"/products/": {
		message: "The product you're looking for is currently not available.",
		browseLabel: "Browse All Products",
		browseHref: "/",
	},
	"/solutions/": {
		message: "The solution pack you're looking for is currently not available.",
		browseLabel: "Browse All Solutions",
		browseHref: "/solutions",
	},
	"/industries/": {
		message: "The industry page you're looking for is currently not available.",
		browseLabel: "Browse All Industries",
		browseHref: "/industries",
	},
};

const DEFAULT_CONTEXT: PathContext = {
	message: "The page you're looking for doesn't exist or has been moved.",
	browseLabel: "Browse Solutions",
	browseHref: "/solutions",
};

function getPathContext(pathname: string): PathContext {
	for (const [prefix, ctx] of Object.entries(PATH_CONTEXTS)) {
		if (pathname.startsWith(prefix)) return ctx;
	}
	return DEFAULT_CONTEXT;
}

const NotFound = () => {
	const location = useLocation();

	const ctx = useMemo(() => getPathContext(location.pathname), [location.pathname]);
	const featuredSolutions = useMemo(() => ACTIVE_SOLUTIONS_LIST.slice(0, 3), []);
	const featuredIndustries = useMemo(() => ACTIVE_INDUSTRIES_LIST.slice(0, 3), []);

	useEffect(() => {
		console.error("404 Error: User attempted to access non-existent route:", location.pathname);
	}, [location.pathname]);

	return (
		<>
			<Helmet>
				<title>Page Not Found | Eko</title>
				<meta name="robots" content="noindex, nofollow" />
			</Helmet>

			{/* Hero Section */}
			<SectionContainer variant="muted" className="pt-32 lg:pt-40 pb-16 lg:pb-20">
				<FadeIn className="text-center max-w-2xl mx-auto">
					<div className="w-20 h-20 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-8">
						<SearchX className="w-10 h-10 text-eko-gold" />
					</div>
					<h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
						Oops!
					</h1>
					<p className="text-lg lg:text-xl text-muted-foreground mb-10 leading-relaxed">
						{ctx.message}
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Button variant="gold" size="lg" asChild>
							<Link to="/">
								<Home className="w-4 h-4" />
								Return to Home
							</Link>
						</Button>
						<Button variant="outline" size="lg" asChild>
							<Link to={ctx.browseHref}>
								{ctx.browseLabel}
								<ArrowRight className="w-4 h-4" />
							</Link>
						</Button>
					</div>
				</FadeIn>
			</SectionContainer>

			{/* Solutions Section */}
			<SectionContainer>
				<SectionHeader
					title="Popular Solution Packs"
					subtitle="Pre-built API bundles designed for common business workflows"
					badge="Solutions"
				/>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{featuredSolutions.map((solution, i) => (
						<SolutionCard
							key={solution.slug}
							solution={solution}
							featured={i === 0}
							delay={i * 100}
						/>
					))}
				</div>
				<FadeIn className="text-center mt-10">
					<Button variant="outline" size="lg" asChild>
						<Link to="/solutions">
							View All Solutions
							<ArrowRight className="w-4 h-4" />
						</Link>
					</Button>
				</FadeIn>
			</SectionContainer>

			{/* Industries Section */}
			<SectionContainer variant="muted">
				<SectionHeader
					title="Explore Industries"
					subtitle="See how businesses in your industry use Eko's APIs"
					badge="Industries"
				/>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{featuredIndustries.map((industry, i) => (
						<IndustryCard
							key={industry.slug}
							industry={industry}
							delay={i * 100}
						/>
					))}
				</div>
				<FadeIn className="text-center mt-10">
					<Button variant="outline" size="lg" asChild>
						<Link to="/industries">
							View All Industries
							<ArrowRight className="w-4 h-4" />
						</Link>
					</Button>
				</FadeIn>
			</SectionContainer>

			{/* CTA Section */}
			<CTASection />

			<Footer />
		</>
	);
};

export default NotFound;
