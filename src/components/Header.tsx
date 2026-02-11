import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EkoLogo } from "@/components/EkoLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle } from "lucide-react";

const paymentApis = [
  { label: "DMT API", href: "/products/dmt-api" },
  { label: "AePS API", href: "/products/aeps-api" },
  { label: "BBPS API", href: "/products/bbps-api" },
  { label: "QR Payment API", href: "/products/qr-payment-api" },
  { label: "CMS API", href: "/products/cms-api" },
  { label: "Payout API", href: "/products/payment-api" },
  { label: "UPI Payout API", href: "/products/upi-payout-api" },
];

const verificationApis = [
  { label: "PAN Verification", href: "/products/pan-verification-api" },
  { label: "Aadhaar Verification", href: "/products/aadhaar-verification-api" },
  { label: "Bank Verification", href: "/products/bank-verification-api" },
  { label: "GST Verification", href: "/products/gst-verification-api" },
  { label: "UPI Verification", href: "/products/upi-verification-api" },
  { label: "DL Verification", href: "/products/dl-verification-api" },
  { label: "RC Verification", href: "/products/rc-verification-api" },
  { label: "Vehicle Verification", href: "/products/vehicle-verification-api" },
  { label: "DigiLocker API", href: "/products/digilocker-api" },
  { label: "Employee Verification", href: "/products/employee-verification-api" },
  { label: "Reverse Geocoding", href: "/products/reverse-geocoding-api" },
];

const navLinks = [
  { label: "Products", href: "#products", hasDropdown: true },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Developers", href: "https://developers.eko.in", external: true },
  { label: "Pricing", href: "#" },
  { label: "Company", href: "#" },
];

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "" });
    setFormSubmitted(false);
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled ? "bg-white/95 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <EkoLogo className="h-8 w-auto" isLight={!isScrolled} />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) =>
                link.hasDropdown ? (
                  <div key={link.label} className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={cn(
                        "text-sm font-medium transition-colors duration-200 flex items-center gap-1",
                        isScrolled ? "text-eko-slate hover:text-eko-navy" : "text-white/90 hover:text-white"
                      )}
                    >
                      {link.label}
                      <ChevronDown className={cn("w-4 h-4 transition-transform", dropdownOpen && "rotate-180")} />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[560px] bg-white rounded-2xl shadow-xl border border-border/50 p-6 grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-3">Payment APIs</h4>
                          <div className="space-y-1">
                            {paymentApis.map((item) => (
                              <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setDropdownOpen(false)}
                                className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-3">Verification APIs</h4>
                          <div className="space-y-1">
                            {verificationApis.map((item) => (
                              <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setDropdownOpen(false)}
                                className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-2 pt-4 border-t border-border flex gap-4">
                          <a href="#ekonic" onClick={() => setDropdownOpen(false)} className="text-sm font-medium text-eko-navy hover:text-eko-gold transition-colors">
                            Ekonic Platform →
                          </a>
                          <a href="#shield" onClick={() => setDropdownOpen(false)} className="text-sm font-medium text-eko-navy hover:text-eko-gold transition-colors">
                            Eko Shield →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "text-sm font-medium transition-colors duration-200",
                      isScrolled ? "text-eko-slate hover:text-eko-navy" : "text-white/90 hover:text-white"
                    )}
                  >
                    {link.label}
                  </a>
                )
              )}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <Button variant="gold" size="sm" onClick={() => { resetForm(); setGetStartedOpen(true); }}>
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? (
                <X className={cn("w-6 h-6", isScrolled ? "text-eko-navy" : "text-white")} />
              ) : (
                <Menu className={cn("w-6 h-6", isScrolled ? "text-eko-navy" : "text-white")} />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 border-t border-white/10 pt-4">
              <nav className="flex flex-col gap-2">
                <button
                  onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                  className={cn("text-sm font-medium py-2 flex items-center justify-between", isScrolled ? "text-eko-slate" : "text-white/90")}
                >
                  Products
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileProductsOpen && "rotate-180")} />
                </button>
                {mobileProductsOpen && (
                  <div className="pl-4 space-y-1">
                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1">Payment APIs</p>
                    {paymentApis.map((item) => (
                      <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                        className={cn("block text-sm py-1.5", isScrolled ? "text-eko-slate" : "text-white/80")}>
                        {item.label}
                      </Link>
                    ))}
                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1 mt-2">Verification APIs</p>
                    {verificationApis.map((item) => (
                      <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                        className={cn("block text-sm py-1.5", isScrolled ? "text-eko-slate" : "text-white/80")}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}

                {navLinks.filter(l => !l.hasDropdown).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={cn("text-sm font-medium py-2", isScrolled ? "text-eko-slate" : "text-white/90")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="flex flex-col gap-3 mt-4">
                  <Button variant="gold" size="sm" onClick={() => { resetForm(); setGetStartedOpen(true); setMobileMenuOpen(false); }}>
                    Get Started
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Get Started Dialog */}
      <Dialog open={getStartedOpen} onOpenChange={setGetStartedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Get Started with Eko</DialogTitle>
            <DialogDescription>Fill in your details and our team will reach out within 24 hours.</DialogDescription>
          </DialogHeader>

          {formSubmitted ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-eko-gold/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-eko-gold" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Thank You!</h3>
              <p className="text-muted-foreground text-sm">Our team will reach out to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="gs-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="gs-name"
                  placeholder="Enter your name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="gs-phone" className="text-sm font-medium">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <div className="flex mt-1.5">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="gs-phone"
                    type="tel"
                    placeholder="Enter mobile number"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="rounded-l-none"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="gs-email" className="text-sm font-medium">
                  Email <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="gs-email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" variant="gold" size="lg" className="w-full">
                Request Free Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our Terms & Conditions.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
