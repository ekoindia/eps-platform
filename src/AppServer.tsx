/**
 * Server-side App with eager imports for SSG pre-rendering.
 *
 * React.lazy is not supported in renderToString, so this variant
 * keeps all page imports static. The client-side App.tsx uses lazy
 * imports for route-based code splitting.
 */
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { DefaultMeta } from "@/components/DefaultMeta";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { useCaptureTrackingParams } from "@/hooks/use-tracking-params";
import { Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Navigate, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Product API Pages (single dynamic component)
import ProductDetailPage from "./pages/products/ProductDetailPage";

// Company & Legal Pages
import AboutPage from "./pages/AboutPage";
import BlogsMediaPage from "./pages/BlogsMediaPage";
import GrievancePage from "./pages/GrievancePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import TermsPage from "./pages/TermsPage";
// import EkoShieldPage from "./pages/EkoShieldPage";
import SignupPage from "./pages/SignupPage";

// Products listing page
import ProductsPage from "./pages/ProductsPage";

// Industry & Solution Pages
import IndustriesPage from "./pages/IndustriesPage";
import IndustryDetailPage from "./pages/IndustryDetailPage";
import SolutionDetailPage from "./pages/SolutionDetailPage";
import SolutionsPage from "./pages/SolutionsPage";
import UseCasesHubPage from "./pages/UseCasesHubPage";

// Pricing
import PricingPage from "./pages/PricingPage";

// FAQ
import FaqPage from "./pages/FaqPage";

// AI Agents
import AiPage from "./pages/AiPage";
import AgentsPage from "./pages/AgentsPage";

// Developer Docs
import DocsIndexPage from "./pages/docs/DocsIndexPage";
import DocDetailPage from "./pages/docs/DocDetailPage";
import Console from "./pages/Console";
import Admin from "./pages/Admin";

function TrackingParamCapture() {
	useCaptureTrackingParams();
	return null;
}

const AppServer = ({
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
						{/* Mirrors the <Suspense> in App.tsx so server and client trees
              match during hydration. Pages are eager here, so this boundary
              never actually suspends during renderToString. */}
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
								{/* Transactional MCP for AI agents — see App.tsx note. */}
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

								{/* Auth — client-only (intentionally excluded from PRERENDER_ROUTES) */}
								<Route path="/console" element={<Console />} />
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

export default AppServer;
