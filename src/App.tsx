import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { useCaptureTrackingParams } from "@/hooks/use-tracking-params";
import { Header } from "@/components/Header";
import { DefaultMeta } from "@/components/DefaultMeta";

// Route-based code splitting: each page is loaded on demand
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProductDetailPage = lazy(() => import("./pages/products/ProductDetailPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogsMediaPage = lazy(() => import("./pages/BlogsMediaPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage"));
const GrievancePage = lazy(() => import("./pages/GrievancePage"));
const EkoShieldPage = lazy(() => import("./pages/EkoShieldPage"));
const EkoShieldDocumentPage = lazy(() => import("./pages/EkoShieldDocumentPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const IndustryDetailPage = lazy(() => import("./pages/IndustryDetailPage"));
const SolutionDetailPage = lazy(() => import("./pages/SolutionDetailPage"));
const IndustriesPage = lazy(() => import("./pages/IndustriesPage"));
const SolutionsPage = lazy(() => import("./pages/SolutionsPage"));
const UseCasesHubPage = lazy(() => import("./pages/UseCasesHubPage"));

function TrackingParamCapture() {
  useCaptureTrackingParams();
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const App = ({ helmetContext }: { helmetContext?: any }) => (
  <HelmetProvider context={helmetContext}>
    <DefaultMeta />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TrackingParamCapture />
      <ScrollToTop />
      <Header />
      <AnimatedRoutes>
        <Suspense fallback={null}>
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
        </Suspense>
        </AnimatedRoutes>
      </TooltipProvider>
  </HelmetProvider>
);

export default App;
