import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Phone, Shield, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-form";
import { EkoLogo } from "@/components/EkoLogo";
import { TalkToSalesDialog } from "@/components/TalkToSalesDialog";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const bcApis = [
  { label: "DMT", href: "/products/dmt-api" },
  { label: "AePS", href: "/products/aeps-api" },
];

const paymentApis = [
  { label: "Payout", href: "/products/payment-api" },
  { label: "UPI Payout", href: "/products/upi-payout-api" },
];

const collectionApis = [
  { label: "BBPS", href: "/products/bbps-api" },
  { label: "CMS", href: "/products/cms-api" },
  { label: "QR", href: "/products/qr-payment-api" },
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

const companyLinks = [
  { label: "About Us", href: "/about-us", internal: true },
  // { label: "Blogs & Media", href: "/blogs-media", internal: true },
];

const navLinks = [
  { label: "Products", href: "#products", hasDropdown: true },
  { label: "Use Cases", href: "/#use-cases" },
  { label: "Developers", href: "https://developers.eko.in", external: true },
  { label: "Company", href: "#", hasDropdown: true },
];

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [talkToSalesOpen, setTalkToSalesOpen] = useState(false);
  const productsDropdownRef = useRef<HTMLDivElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isHomePage = location.pathname === "/";
  const isDarkHeader = !isHomePage;
  const useWhiteText = true;

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
    const openSales = () => setTalkToSalesOpen(true);
    window.addEventListener("open-get-started", openDialog);
    window.addEventListener("open-talk-to-sales", openSales);
    return () => {
      window.removeEventListener("open-get-started", openDialog);
      window.removeEventListener("open-talk-to-sales", openSales);
    };
  }, []);

  const apiColumns = [
    { title: "BC APIs", items: bcApis },
    { title: "Payment APIs", items: paymentApis },
    { title: "Collection APIs", items: collectionApis },
    { title: "Verification APIs", items: verificationApis, maxItems: 6, moreLink: { label: "More...", href: "https://developers.eko.in/v3/reference/bank-account-verification-sync" } },
  ];

  return (
    <>
      <header
        className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-[#00394bdd] backdrop-blur-md shadow-sm py-3"
            : isHomePage
              ? "bg-transparent py-5"
              : isDarkHeader
                ? "bg-[#00394b] py-5"
                : "bg-white py-5"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <EkoLogo className="h-12 w-auto" isLight={useWhiteText && !isScrolled} />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                if (link.label === "Products") {
                  return (
                    <div key={link.label} className="relative" ref={productsDropdownRef}>
                      <button
                        onClick={() => { setProductsDropdownOpen(!productsDropdownOpen); setCompanyDropdownOpen(false); }}
                        className={cn(
                          "text-lg font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}
                      >
                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", productsDropdownOpen && "rotate-180")} />
                      </button>

                      {productsDropdownOpen && (
                        <div className="fixed top-24 left-1/2 w-[90vw] lg:w-[780px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden z-50 animate-menu-slide-down-in">
                          {/* Eko Shield Hero Banner */}
                          <Link
                            to="/products/eko-shield"
                            onClick={() => setProductsDropdownOpen(false)}
                            className="block bg-gradient-to-r from-[#00394b] to-[#005a6e] p-5 group cursor-pointer hover:from-[#004a5e] hover:to-[#006b82] transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-eko-gold/20 flex items-center justify-center shrink-0">
                                <Shield className="w-6 h-6 text-eko-gold" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base font-bold text-white">Eko Shield</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-eko-gold/20 text-eko-gold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Featured
                                  </span>
                                </div>
                                <p className="text-sm text-white/70">Unified verification platform — PAN, Aadhaar, Bank, GST, DL, RC in one dashboard</p>
                              </div>
                              <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-eko-gold group-hover:translate-x-1 transition-all shrink-0" />
                            </div>
                          </Link>

                          {/* API Columns - 4 categories */}
                          <div className="p-6 grid grid-cols-4 gap-6">
                            {apiColumns.map((col) => {
                              const displayItems = col.maxItems ? col.items.slice(0, col.maxItems) : col.items;
                              const showMoreLink = col.maxItems && col.items.length > col.maxItems && col.moreLink;
                              return (
                                <div key={col.title}>
                                  <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-3">{col.title}</h4>
                                  <div className="space-y-1">
                                    {displayItems.map((item) => (
                                      <Link
                                        key={item.href}
                                        to={item.href}
                                        onClick={() => setProductsDropdownOpen(false)}
                                        className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                      >
                                        {item.label}
                                      </Link>
                                    ))}
                                    {showMoreLink && (
                                      <a
                                        href={col.moreLink.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setProductsDropdownOpen(false)}
                                        className="block px-3 py-2 text-sm text-eko-gold hover:text-eko-gold/80 font-medium transition-colors cursor-pointer"
                                      >
                                        {col.moreLink.label}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (link.label === "Company") {
                  return (
                    <div key={link.label} className="relative" ref={companyDropdownRef}>
                      <button
                        onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setProductsDropdownOpen(false); }}
                        className={cn(
                          "text-lg font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}
                      >
                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", companyDropdownOpen && "rotate-180")} />
                      </button>

                      {companyDropdownOpen && (
                        <div className="fixed top-24 left-1/2 w-[200px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-border/50 p-4 z-50 animate-menu-slide-down-in">
                          <div className="space-y-1">
                            {companyLinks.map((item) =>
                              item.internal ? (
                                <Link
                                  key={item.label}
                                  to={item.href}
                                  onClick={() => setCompanyDropdownOpen(false)}
                                  className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                >
                                  {item.label}
                                </Link>
                              ) : (
                                <a
                                  key={item.label}
                                  href={item.href}
                                  onClick={() => setCompanyDropdownOpen(false)}
                                  className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                >
                                  {item.label}
                                </a>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "text-lg font-medium transition-colors duration-200 cursor-pointer",
                      useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSelector isLight={useWhiteText} />
              <a
                href="tel:+919513181707"
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer",
                  useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                )}
              >
                <Phone className="w-4 h-4" />
                +91 9513181707
              </a>
              <Button variant="gold" size="sm" onClick={() => openZohoChat()} className="cursor-pointer">
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2 cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? (
                <X className={cn("w-6 h-6", useWhiteText ? "text-white" : "text-eko-navy")} />
              ) : (
                <Menu className={cn("w-6 h-6", useWhiteText ? "text-white" : "text-eko-navy")} />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 pt-4 bg-white/95 backdrop-blur-md rounded-xl px-4 -mx-4 shadow-lg">
              <nav className="flex flex-col gap-2 max-h-[calc(95vh-90px)] max-h-[80vh] overflow-y-auto">
                {/* Products Accordion */}
                <button
                  onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                  className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer"
                >
                  Products
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileProductsOpen && "rotate-180")} />
                </button>
                {mobileProductsOpen && (
                  <div className="pl-4 space-y-1">
                    {/* Eko Shield highlight */}
                    <Link to="/products/eko-shield" onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 py-2.5 px-3 -mx-3 bg-gradient-to-r from-[#00394b] to-[#005a6e] rounded-lg my-1 cursor-pointer max-w-full">
                      <Shield className="w-5 h-5 text-eko-gold shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-white">Eko Shield</span>
                        <span className="text-[10px] ml-2 uppercase tracking-wider bg-eko-gold/20 text-eko-gold px-1.5 py-0.5 rounded-full">Featured</span>
                      </div>
                    </Link>
                    {apiColumns.map((col) => {
                      const displayItems = col.maxItems ? col.items.slice(0, col.maxItems) : col.items;
                      const showMoreLink = col.maxItems && col.items.length > col.maxItems && col.moreLink;
                      return (
                        <div key={col.title}>
                          <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1 mt-2">{col.title}</p>
                          {displayItems.map((item) => (
                            <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                              className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                              {item.label}
                            </Link>
                          ))}
                          {showMoreLink && (
                            <a href={col.moreLink.href} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}
                              className="block text-sm py-1.5 text-eko-gold font-medium cursor-pointer">
                              {col.moreLink.label}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Company Accordion */}
                <button
                  onClick={() => setMobileCompanyOpen(!mobileCompanyOpen)}
                  className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer"
                >
                  Company
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileCompanyOpen && "rotate-180")} />
                </button>
                {mobileCompanyOpen && (
                  <div className="pl-4 space-y-1">
                    {companyLinks.map((item) =>
                      item.internal ? (
                        <Link key={item.label} to={item.href} onClick={() => setMobileMenuOpen(false)}
                          className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                          {item.label}
                        </Link>
                      ) : (
                        <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)}
                          className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                          {item.label}
                        </a>
                      )
                    )}
                  </div>
                )}

                {/* Other Links */}
                {navLinks.filter((l) => !l.hasDropdown).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm font-medium py-2 text-eko-slate cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="flex flex-col gap-3 mt-4">
                  <LanguageSelector isLight={false} />
                  <a
                    href="tel:+919513181707"
                    className="flex items-center gap-1.5 text-sm font-medium text-eko-slate hover:text-eko-navy transition-colors cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    +91 9513181707
                  </a>
                  <Button variant="gold" size="sm" onClick={() => {
                    setMobileMenuOpen(false);
                    openZohoChat();
                  }} className="cursor-pointer">
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
            <DialogTitle className="text-xl font-bold">Get Started with Eko Platform Services</DialogTitle>
            <DialogDescription>Fill in your details and our team will reach out within 24 hours.</DialogDescription>
          </DialogHeader>

          <iframe
            aria-label="New Eko.in API Signup"
            frameBorder="0"
            allow="geolocation;"
            style={{ height: "500px", width: "100%", border: "none" }}
            src="https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/JmSIq1OIg5-iNmPq-fcqHv9g9_QBNvM2VQ2DC3XetvQ"
          />
        </DialogContent>
      </Dialog>
      <TalkToSalesDialog open={talkToSalesOpen} onOpenChange={setTalkToSalesOpen} />
    </>
  );
};
