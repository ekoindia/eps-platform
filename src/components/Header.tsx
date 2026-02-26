import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EkoLogo } from "@/components/EkoLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";

const paymentApis = [
{ label: "DMT API", href: "/products/dmt-api" },
{ label: "AePS API", href: "/products/aeps-api" },
{ label: "BBPS API", href: "/products/bbps-api" },
{ label: "QR Payment API", href: "/products/qr-payment-api" },
{ label: "CMS API", href: "/products/cms-api" },
{ label: "Payout API", href: "/products/payment-api" },
{ label: "UPI Payout API", href: "/products/upi-payout-api" }];


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
{ label: "Reverse Geocoding", href: "/products/reverse-geocoding-api" }];


const companyLinks = [
{ label: "About Us", href: "/about-us", internal: true },
{ label: "Blog", href: "/blog", internal: true },
{ label: "Press", href: "/press", internal: true }];


const navLinks = [
{ label: "Products", href: "#products", hasDropdown: true },
{ label: "Use Cases", href: "#use-cases" },
{ label: "Developers", href: "https://developers.eko.in", external: true },
{ label: "Pricing", href: "#" },
{ label: "Company", href: "#", hasDropdown: true }];


export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const productsDropdownRef = useRef<HTMLDivElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const darkHeaderPages = ["/privacy-policy", "/terms-and-conditions", "/refund-policy", "/grievance", "/about-us", "/blog", "/press"];
  const isDarkHeader = darkHeaderPages.some((p) => location.pathname.startsWith(p));
  const useWhiteText = isDarkHeader && !isScrolled;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productsDropdownRef.current && !productsDropdownRef.current.contains(e.target as Node)) {
        setProductsDropdownOpen(false);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const openDialog = () => setGetStartedOpen(true);
    window.addEventListener("open-get-started", openDialog);
    return () => window.removeEventListener("open-get-started", openDialog);
  }, []);

  return (
    <>
      <header
        className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#144048]",

        isScrolled ?
        "bg-white/95 backdrop-blur-md shadow-sm py-3" :
        isDarkHeader ?
        "bg-[#00394b] py-5" :
        "bg-white py-5"
        )}>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <EkoLogo className="h-16 w-auto" isLight={useWhiteText} />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                if (link.label === "Products") {
                  return (
                    <div key={link.label} className="relative" ref={productsDropdownRef}>
                      <button
                        onClick={() => {setProductsDropdownOpen(!productsDropdownOpen);setCompanyDropdownOpen(false);}}
                        className={cn(
                          "text-sm font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}>

                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", productsDropdownOpen && "rotate-180")} />
                      </button>

                      {productsDropdownOpen &&
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[560px] bg-white rounded-2xl shadow-xl border border-border/50 p-6 grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-3">Payment APIs</h4>
                            <div className="space-y-1">
                              {paymentApis.map((item) =>
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setProductsDropdownOpen(false)}
                              className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer">

                                  {item.label}
                                </Link>
                            )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-3">Verification APIs</h4>
                            <div className="space-y-1">
                              {verificationApis.map((item) =>
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setProductsDropdownOpen(false)}
                              className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer">

                                  {item.label}
                                </Link>
                            )}
                            </div>
                          </div>
                          <div className="col-span-2 pt-4 border-t border-border">
                            <a href="#shield" onClick={() => setProductsDropdownOpen(false)} className="text-sm font-medium text-eko-navy hover:text-eko-gold transition-colors cursor-pointer">
                              Eko Shield →
                            </a>
                          </div>
                        </div>
                      }
                    </div>);

                }

                if (link.label === "Company") {
                  return (
                    <div key={link.label} className="relative" ref={companyDropdownRef}>
                      <button
                        onClick={() => {setCompanyDropdownOpen(!companyDropdownOpen);setProductsDropdownOpen(false);}}
                        className={cn(
                          "text-sm font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}>

                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", companyDropdownOpen && "rotate-180")} />
                      </button>

                      {companyDropdownOpen &&
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[200px] bg-white rounded-2xl shadow-xl border border-border/50 p-4">
                          <div className="space-y-1">
                            {companyLinks.map((item) =>
                          item.internal ?
                          <Link
                            key={item.label}
                            to={item.href}
                            onClick={() => setCompanyDropdownOpen(false)}
                            className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer">

                                  {item.label}
                                </Link> :

                          <a
                            key={item.label}
                            href={item.href}
                            onClick={() => setCompanyDropdownOpen(false)}
                            className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer">

                                  {item.label}
                                </a>

                          )}
                          </div>
                        </div>
                      }
                    </div>);

                }

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "text-sm font-medium transition-colors duration-200 cursor-pointer",
                      useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                    )}>

                    {link.label}
                  </a>);

              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <Button variant="gold" size="sm" onClick={() => setGetStartedOpen(true)} className="cursor-pointer">
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ?
              <X className={cn("w-6 h-6", useWhiteText ? "text-white" : "text-eko-navy")} /> :

              <Menu className={cn("w-6 h-6", useWhiteText ? "text-white" : "text-eko-navy")} />
              }
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen &&
          <div className="lg:hidden mt-4 pb-4 pt-4 bg-white/95 backdrop-blur-md rounded-xl px-4 -mx-4 shadow-lg">
              <nav className="flex flex-col gap-2">
                {/* Products Accordion */}
                <button
                onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer">

                  Products
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileProductsOpen && "rotate-180")} />
                </button>
                {mobileProductsOpen &&
              <div className="pl-4 space-y-1">
                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1">Payment APIs</p>
                    {paymentApis.map((item) =>
                <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                        {item.label}
                      </Link>
                )}
                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1 mt-2">Verification APIs</p>
                    {verificationApis.map((item) =>
                <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                        {item.label}
                      </Link>
                )}
                  </div>
              }

                {/* Company Accordion */}
                <button
                onClick={() => setMobileCompanyOpen(!mobileCompanyOpen)}
                className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer">

                  Company
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileCompanyOpen && "rotate-180")} />
                </button>
                {mobileCompanyOpen &&
              <div className="pl-4 space-y-1">
                    {companyLinks.map((item) =>
                item.internal ?
                <Link key={item.label} to={item.href} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                          {item.label}
                        </Link> :

                <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                          {item.label}
                        </a>

                )}
                  </div>
              }

                {/* Other Links */}
                {navLinks.filter((l) => !l.hasDropdown).map((link) =>
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-sm font-medium py-2 text-eko-slate cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}>

                    {link.label}
                  </a>
              )}
                <div className="flex flex-col gap-3 mt-4">
                  <Button variant="gold" size="sm" onClick={() => {setGetStartedOpen(true);setMobileMenuOpen(false);}} className="cursor-pointer">
                    Get Started
                  </Button>
                </div>
              </nav>
            </div>
          }
        </div>
      </header>

      {/* Get Started Dialog */}
      <Dialog open={getStartedOpen} onOpenChange={setGetStartedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Get Started with Eko Platform Services</DialogTitle>
            <DialogDescription>Fill in your details and our team will reach out within 24 hours.</DialogDescription>
          </DialogHeader>

          <iframe
            aria-label="New Eko.in API Signup"
            frameBorder="0"
            allow="geolocation;"
            style={{ height: "500px", width: "100%", border: "none" }}
            src="https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/JmSIq1OIg5-iNmPq-fcqHv9g9_QBNvM2VQ2DC3XetvQ" />

        </DialogContent>
      </Dialog>
    </>);

};