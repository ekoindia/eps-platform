import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Product Pages
import DmtApiPage from "./pages/products/DmtApiPage";
import AepsApiPage from "./pages/products/AepsApiPage";
import BbpsApiPage from "./pages/products/BbpsApiPage";
import PanVerificationPage from "./pages/products/PanVerificationPage";
import AadhaarVerificationPage from "./pages/products/AadhaarVerificationPage";
import BankVerificationPage from "./pages/products/BankVerificationPage";
import GstVerificationPage from "./pages/products/GstVerificationPage";
import VehicleVerificationPage from "./pages/products/VehicleVerificationPage";

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
            
            {/* Verification API Pages */}
            <Route path="/products/pan-verification-api" element={<PanVerificationPage />} />
            <Route path="/products/aadhaar-verification-api" element={<AadhaarVerificationPage />} />
            <Route path="/products/bank-verification-api" element={<BankVerificationPage />} />
            <Route path="/products/gst-verification-api" element={<GstVerificationPage />} />
            <Route path="/products/vehicle-verification-api" element={<VehicleVerificationPage />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
