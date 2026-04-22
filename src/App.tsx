import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { useCaptureTrackingParams } from "@/hooks/use-tracking-params";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Product API Pages (single dynamic component)
import ProductDetailPage from "./pages/products/ProductDetailPage";

// Company & Legal Pages
import AboutPage from "./pages/AboutPage";
import BlogsMediaPage from "./pages/BlogsMediaPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import GrievancePage from "./pages/GrievancePage";
import EkoShieldPage from "./pages/EkoShieldPage";
import EkoShieldDocumentPage from "./pages/EkoShieldDocumentPage";
import SignupPage from "./pages/SignupPage";

// Industry & Solution Pages
import IndustryDetailPage from "./pages/IndustryDetailPage";
import SolutionDetailPage from "./pages/SolutionDetailPage";
import IndustriesPage from "./pages/IndustriesPage";
import SolutionsPage from "./pages/SolutionsPage";
import UseCasesHubPage from "./pages/UseCasesHubPage";

function TrackingParamCapture() {
  useCaptureTrackingParams();
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const App = ({ helmetContext }: { helmetContext?: any }) => (
  <HelmetProvider context={helmetContext}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TrackingParamCapture />
      <ScrollToTop />
      <AnimatedRoutes>
          <Routes>
            <Route path="/" element={<Index />} />

            {/* Eko Shield (specific routes before :slug wildcard) */}
            <Route path="/products/eko-shield" element={<EkoShieldPage />} />
            <Route path="/products/eko-shield/document" element={<EkoShieldDocumentPage />} />

            {/* Product API Pages */}
            <Route path="/products/:slug" element={<ProductDetailPage />} />

            {/* Industry & Solution Pages */}
            <Route path="/use-cases" element={<UseCasesHubPage />} />
            <Route path="/industries" element={<IndustriesPage />} />
            <Route path="/industries/:slug" element={<IndustryDetailPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/solutions/:slug" element={<SolutionDetailPage />} />

            {/* Company & Legal Pages */}
            <Route path="/about-us" element={<AboutPage />} />
            <Route path="/blogs-media" element={<BlogsMediaPage />} />
            {/* Redirects for old routes */}
            <Route path="/blog" element={<Navigate to="/blogs-media" replace />} />
            <Route path="/press" element={<Navigate to="/blogs-media" replace />} />
            <Route path="/tnc" element={<TermsPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/grievance" element={<GrievancePage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatedRoutes>
      </TooltipProvider>
  </HelmetProvider>
);

export default App;
