import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { DefaultMeta } from "@/components/DefaultMeta";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/AuthProvider";
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
const FaqPage = lazy(() => import("./pages/FaqPage"));
const AiPage = lazy(() => import("./pages/AiPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const DocsIndexPage = lazy(() => import("./pages/docs/DocsIndexPage"));
const DocDetailPage = lazy(() => import("./pages/docs/DocDetailPage"));
const RecipesIndexPage = lazy(() => import("./pages/recipe/RecipesIndexPage"));
const RecipeDetailPage = lazy(() => import("./pages/recipe/RecipeDetailPage"));
const ConsoleLayout = lazy(() => import("./components/console/ConsoleLayout"));
const ConsoleHome = lazy(() => import("./pages/console/ConsoleHome"));
const ConsoleCredentials = lazy(() => import("./pages/console/Credentials"));
const Admin = lazy(() => import("./pages/Admin"));

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
			<Sonner />
			<TrackingParamCapture />
			<ScrollToTop />
			<AuthProvider>
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
								<Route
									path="/solutions/:slug"
									element={<SolutionDetailPage />}
								/>

								{/* Pricing */}
								<Route path="/pricing" element={<PricingPage />} />

								{/* FAQ */}
								<Route path="/faq" element={<FaqPage />} />

								{/* AI Agents */}
								<Route path="/ai" element={<AiPage />} />
								{/* Transactional MCP for AI agents. Route is always registered;
								    it is nav-linked, prerendered, and indexed only when the
								    SHOW_TRANSACT_MCP flag is on (see ssg/routes.ts, nav.ts). */}
								<Route path="/agents" element={<AgentsPage />} />

								{/* Developer Docs */}
								<Route path="/docs" element={<DocsIndexPage />} />
								<Route path="/docs/:slug" element={<DocDetailPage />} />

								{/* API Recipes — multi-step workflows across endpoints */}
								<Route path="/recipe" element={<RecipesIndexPage />} />
								<Route path="/recipe/:slug" element={<RecipeDetailPage />} />

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

								{/* Auth — client-only (intentionally excluded from PRERENDER_ROUTES) */}
								<Route path="/console" element={<ConsoleLayout />}>
									<Route index element={<ConsoleHome />} />
									<Route path="credentials" element={<ConsoleCredentials />} />
								</Route>
								<Route path="/admin" element={<Admin />} />

								{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
								<Route path="*" element={<NotFound />} />
							</Routes>
						</Suspense>
					</AnimatedRoutes>
				</ErrorBoundary>
			</AuthProvider>
		</TooltipProvider>
	</HelmetProvider>
);

export default App;
