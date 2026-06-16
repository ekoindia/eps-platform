import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { DefaultMeta } from "@/components/DefaultMeta";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCaptureTrackingParams } from "@/hooks/use-tracking-params";
import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Navigate, Route, Routes } from "react-router-dom";

// Route-based code splitting: each page is loaded on demand
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProductDetailPage = lazy(
	() => import("./pages/products/ProductDetailPage"),
);
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogsMediaPage = lazy(() => import("./pages/BlogsMediaPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage"));
const GrievancePage = lazy(() => import("./pages/GrievancePage"));
// const EkoShieldPage = lazy(() => import("./pages/EkoShieldPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const IndustryDetailPage = lazy(() => import("./pages/IndustryDetailPage"));
const SolutionDetailPage = lazy(() => import("./pages/SolutionDetailPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const IndustriesPage = lazy(() => import("./pages/IndustriesPage"));
const SolutionsPage = lazy(() => import("./pages/SolutionsPage"));
const UseCasesHubPage = lazy(() => import("./pages/UseCasesHubPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const DocsIndexPage = lazy(() => import("./pages/docs/DocsIndexPage"));
const DocDetailPage = lazy(() => import("./pages/docs/DocDetailPage"));

function TrackingParamCapture() {
	useCaptureTrackingParams();
	return null;
}

const App = ({
	helmetContext,
}: {
	helmetContext?: Record<string, unknown>;
}) => (
	<HelmetProvider context={helmetContext}>
		<DefaultMeta />
		<TooltipProvider>
			<Toaster />
			<Sonner />
			<TrackingParamCapture />
			<ScrollToTop />
			<Header />
			<ErrorBoundary>
				<AnimatedRoutes>
					<Suspense fallback={null}>
						<Routes>
							<Route path="/" element={<Index />} />

							{/* Eko Shield (specific routes before :slug wildcard) */}
							{/* <Route path="/products/eko-shield" element={<EkoShieldPage />} /> */}

							{/* Product API Pages */}
							<Route path="/products" element={<ProductsPage />} />
							<Route path="/products/:slug" element={<ProductDetailPage />} />

							{/* Industry & Solution Pages */}
							<Route path="/use-cases" element={<UseCasesHubPage />} />
							<Route path="/industries" element={<IndustriesPage />} />
							<Route
								path="/industries/:slug"
								element={<IndustryDetailPage />}
							/>
							<Route path="/solutions" element={<SolutionsPage />} />
							<Route path="/solutions/:slug" element={<SolutionDetailPage />} />

							{/* Pricing */}
							<Route path="/pricing" element={<PricingPage />} />

							{/* AI Agents */}
							<Route path="/agents" element={<AgentsPage />} />

							{/* Developer Docs */}
							<Route path="/docs" element={<DocsIndexPage />} />
							<Route path="/docs/:slug" element={<DocDetailPage />} />

							{/* Company & Legal Pages */}
							<Route path="/about-us" element={<AboutPage />} />
							<Route path="/blogs-media" element={<BlogsMediaPage />} />
							{/* Redirects for old routes */}
							<Route
								path="/blog"
								element={<Navigate to="/blogs-media" replace />}
							/>
							<Route
								path="/press"
								element={<Navigate to="/blogs-media" replace />}
							/>
							<Route path="/tnc" element={<TermsPage />} />
							<Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
							<Route path="/refund-policy" element={<RefundPolicyPage />} />
							<Route path="/grievance" element={<GrievancePage />} />
							<Route path="/signup" element={<SignupPage />} />

							{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
							<Route path="*" element={<NotFound />} />
						</Routes>
					</Suspense>
				</AnimatedRoutes>
			</ErrorBoundary>
		</TooltipProvider>
	</HelmetProvider>
);

export default App;
