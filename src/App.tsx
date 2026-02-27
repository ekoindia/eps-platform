import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Payment API Pages
import DmtApiPage from "./pages/products/DmtApiPage";
import AepsApiPage from "./pages/products/AepsApiPage";
import BbpsApiPage from "./pages/products/BbpsApiPage";
import QrPaymentApiPage from "./pages/products/QrPaymentApiPage";
import CmsApiPage from "./pages/products/CmsApiPage";
import PaymentApiPage from "./pages/products/PaymentApiPage";
import UpiPayoutApiPage from "./pages/products/UpiPayoutApiPage";

// Verification API Pages
import PanVerificationPage from "./pages/products/PanVerificationPage";
import AadhaarVerificationPage from "./pages/products/AadhaarVerificationPage";
import BankVerificationPage from "./pages/products/BankVerificationPage";
import GstVerificationPage from "./pages/products/GstVerificationPage";
import VehicleVerificationPage from "./pages/products/VehicleVerificationPage";
import UpiVerificationPage from "./pages/products/UpiVerificationPage";
import ReverseGeocodingPage from "./pages/products/ReverseGeocodingPage";
import DigilockerApiPage from "./pages/products/DigilockerApiPage";
import EmployeeVerificationPage from "./pages/products/EmployeeVerificationPage";
import DlVerificationPage from "./pages/products/DlVerificationPage";
import RcVerificationPage from "./pages/products/RcVerificationPage";

// Company & Legal Pages
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import PressPage from "./pages/PressPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import GrievancePage from "./pages/GrievancePage";
import EkoShieldPage from "./pages/EkoShieldPage";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Payment API Pages */}
            <Route path="/products/dmt-api" element={<DmtApiPage />} />
            <Route path="/products/aeps-api" element={<AepsApiPage />} />
            <Route path="/products/bbps-api" element={<BbpsApiPage />} />
            <Route path="/products/qr-payment-api" element={<QrPaymentApiPage />} />
            <Route path="/products/cms-api" element={<CmsApiPage />} />
            <Route path="/products/payment-api" element={<PaymentApiPage />} />
            <Route path="/products/upi-payout-api" element={<UpiPayoutApiPage />} />
            
            {/* Verification API Pages */}
            <Route path="/products/pan-verification-api" element={<PanVerificationPage />} />
            <Route path="/products/aadhaar-verification-api" element={<AadhaarVerificationPage />} />
            <Route path="/products/bank-verification-api" element={<BankVerificationPage />} />
            <Route path="/products/gst-verification-api" element={<GstVerificationPage />} />
            <Route path="/products/vehicle-verification-api" element={<VehicleVerificationPage />} />
            <Route path="/products/upi-verification-api" element={<UpiVerificationPage />} />
            <Route path="/products/reverse-geocoding-api" element={<ReverseGeocodingPage />} />
            <Route path="/products/digilocker-api" element={<DigilockerApiPage />} />
            <Route path="/products/employee-verification-api" element={<EmployeeVerificationPage />} />
            <Route path="/products/dl-verification-api" element={<DlVerificationPage />} />
            <Route path="/products/rc-verification-api" element={<RcVerificationPage />} />
            
            {/* Eko Shield */}
            <Route path="/products/eko-shield" element={<EkoShieldPage />} />
            
            {/* Company & Legal Pages */}
            <Route path="/about-us" element={<AboutPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/press" element={<PressPage />} />
            <Route path="/tnc" element={<TermsPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/grievance" element={<GrievancePage />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;