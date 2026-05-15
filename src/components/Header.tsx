import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Phone, ArrowRight, Sparkles, Shield, Briefcase, Search, CreditCard, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMobile } from "@/lib/utils";
import { SALES_MOBILE } from "@/lib/config/site";
import { openZohoChat } from "@/lib/zoho-chat";
import { EkoLogo } from "@/components/EkoLogo";
const TalkToSalesDialog = lazy(() => import("@/components/TalkToSalesDialog").then(m => ({ default: m.TalkToSalesDialog })));
import { LanguageSelector } from "@/components/LanguageSelector";
import { getActiveProducts } from "@/lib/data/api-products";
import { ACTIVE_INDUSTRIES_LIST } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";

const activeProducts = getActiveProducts();
const bcApis = activeProducts
  .filter((p) => p.category === "bc")
  .map((p) => ({ label: p.name, href: p.href, shortDesc: p.shortDesc, icon: API_PRODUCT_PAGES[p.id].icon }));

const paymentApis = activeProducts
  .filter((p) => p.category === "payment")
  .map((p) => ({ label: p.name, href: p.href, shortDesc: p.shortDesc, icon: API_PRODUCT_PAGES[p.id].icon }));

const verificationApis = activeProducts
  .filter((p) => p.category === "verification")
  .map((p) => ({ label: p.name, href: p.href, shortDesc: p.shortDesc, icon: API_PRODUCT_PAGES[p.id].icon }));

const companyLinks = [
  { label: "About Us", href: "/about-us", internal: true },
  // { label: "Blogs & Media", href: "/blogs-media", internal: true },
];

const navLinks = [
  { label: "Products", href: "#products", hasDropdown: true },
  { label: "Use Cases", href: "/use-cases", hasDropdown: true },
  { label: "Developers", href: "https://developers.eko.in", external: true },
  { label: "Company", href: "#", hasDropdown: true },
];

const NAV_MAX_ITEMS = 8;
const navIndustries = ACTIVE_INDUSTRIES_LIST.filter((i) => i.priority === 1).slice(0, NAV_MAX_ITEMS);
const navSolutions = ACTIVE_SOLUTIONS_LIST.filter((s) => s.priority === 1).slice(0, NAV_MAX_ITEMS);

const pastelColors = [
  'bg-blue-100 text-blue-400',
  'bg-purple-100 text-purple-400',
  'bg-pink-100 text-pink-400',
  'bg-emerald-100 text-emerald-400',
  'bg-amber-100 text-amber-400',
  'bg-indigo-100 text-indigo-400',
  'bg-teal-100 text-teal-400',
  'bg-fuchsia-100 text-fuchsia-400',
  'bg-rose-100 text-rose-400',
];

interface MenuItemLinkProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  index: number;
  onClick: () => void;
}

const MenuItemLink = ({ to, icon: Icon, label, description, index, onClick }: MenuItemLinkProps) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer group"
  >
    <Icon className={`w-7 h-7 mt-1.5 p-[6px] opacity-90 shrink-0 rounded-lg ${pastelColors[index % pastelColors.length]}`} />
    <div>
      <span className="text-sm font-medium text-eko-navy">{label}</span>
      {description && (
        <p className="text-xs text-eko-slate/60 leading-tight mt-0.5">{description}</p>
      )}
    </div>
  </Link>
);

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [useCasesDropdownOpen, setUseCasesDropdownOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
  const [mobileUseCasesOpen, setMobileUseCasesOpen] = useState(false);
  // const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [talkToSalesOpen, setTalkToSalesOpen] = useState(false);
  const productsDropdownRef = useRef<HTMLDivElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const useCasesDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const useWhiteText = true;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
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
      if (useCasesDropdownRef.current && !useCasesDropdownRef.current.contains(e.target as Node)) {
        setUseCasesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // const openDialog = () => setGetStartedOpen(true);
    const openSales = () => setTalkToSalesOpen(true);
    // window.addEventListener("open-get-started", openDialog);
    window.addEventListener("open-talk-to-sales", openSales);
    return () => {
      // window.removeEventListener("open-get-started", openDialog);
      window.removeEventListener("open-talk-to-sales", openSales);
    };
  }, []);

  const apiColumns = [
    { title: "Verification APIs", icon: Search, items: verificationApis, maxItems: 6, moreLink: { label: "More...", href: "https://developers.eko.in/v3/reference/bank-account-verification-sync" } },
    { title: "Payment APIs", icon: CreditCard, items: paymentApis },
    // { title: "Collection APIs", items: collectionApis },
    { title: "BC APIs", icon: Building2, items: bcApis },
  ];

  return (
    <>
      <header
        className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-[#00394bdd] backdrop-blur-md shadow-sm py-3"
              : "bg-[#00394b] py-5"
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
                        onClick={() => { setProductsDropdownOpen(!productsDropdownOpen); setCompanyDropdownOpen(false); setUseCasesDropdownOpen(false); }}
                        className={cn(
                          "text-lg font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}
                      >
                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", productsDropdownOpen && "rotate-180")} />
                      </button>

                      {productsDropdownOpen && (
                        <div className={cn("fixed left-0 right-0 w-full bg-white shadow-lg border-b border-border/30 overflow-hidden z-50 animate-menu-fullwidth-reveal", isScrolled ? "top-[60px]" : "top-[82px]")}>
                          {/* API Columns - 3 categories */}
                          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-3 gap-10">
                            {apiColumns.map((col, colIndex) => {
                              const displayItems = col.maxItems ? col.items.slice(0, col.maxItems) : col.items;
                              const showMoreLink = col.maxItems && col.items.length > col.maxItems && col.moreLink;
                              return (
                                <div key={col.title}>
                                  <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider mb-2 pb-2 border-b border-eko-gold/40">{col.title}</h4>
                                  <div className="space-y-0.5">
                                    {displayItems.map((item, index) => (
                                      <MenuItemLink
                                        key={item.href}
                                        to={item.href}
                                        icon={item.icon}
                                        label={item.label}
                                        description={item.shortDesc}
                                        index={index + colIndex * 2}
                                        onClick={() => setProductsDropdownOpen(false)}
                                      />
                                    ))}
                                    {showMoreLink && (
                                      <a
                                        href={col.moreLink.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setProductsDropdownOpen(false)}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-eko-gold hover:text-eko-gold/80 font-medium transition-colors cursor-pointer"
                                      >
                                        {col.moreLink.label}
                                        <ArrowRight className="w-3.5 h-3.5" />
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

                if (link.label === "Use Cases") {
                  return (
                    <div key={link.label} className="relative" ref={useCasesDropdownRef}>
                      <button
                        onClick={() => { setUseCasesDropdownOpen(!useCasesDropdownOpen); setProductsDropdownOpen(false); setCompanyDropdownOpen(false); }}
                        className={cn(
                          "text-lg font-medium transition-colors duration-200 flex items-center gap-1 cursor-pointer",
                          useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                        )}
                      >
                        {link.label}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", useCasesDropdownOpen && "rotate-180")} />
                      </button>

                      {useCasesDropdownOpen && (
                        <div className={cn("fixed left-0 right-0 w-full bg-white shadow-lg border-b border-border/30 overflow-hidden z-50 animate-menu-fullwidth-reveal", isScrolled ? "top-[60px]" : "top-[82px]")}>
                          {/* Featured banner */}
                          <div className="bg-gradient-to-r from-[#00394b] to-[#005a6e]">
                            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                              <Link
                                to="/use-cases"
                                onClick={() => setUseCasesDropdownOpen(false)}
                                className="block py-3 group cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-eko-gold/20 flex items-center justify-center shrink-0">
                                    <Briefcase className="w-4 h-4 text-eko-gold" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-bold text-white">Explore All Use Cases</span>
                                    <p className="text-xs text-white/70">Discover how Eko APIs power businesses across industries</p>
                                  </div>
                                  <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-eko-gold group-hover:translate-x-1 transition-all shrink-0" />
                                </div>
                              </Link>
                            </div>
                          </div>

                          {/* Two-panel layout */}
                          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 gap-10">
                            {/* Industries panel */}
                            <div>
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-eko-gold/40">
                                <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider">Industries</h4>
                                <Link to="/industries" onClick={() => setUseCasesDropdownOpen(false)} className="text-xs text-eko-gold hover:text-eko-gold/80 font-medium">See all →</Link>
                              </div>
                              <div className="space-y-0.5">
                                {navIndustries.map((item, index) => (
                                  <MenuItemLink
                                    key={item.slug}
                                    to={`/industries/${item.slug}`}
                                    icon={item.icon}
                                    label={item.name}
                                    description={item.tagline}
                                    index={index}
                                    onClick={() => setUseCasesDropdownOpen(false)}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Solutions panel */}
                            <div>
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-eko-gold/40">
                                <h4 className="text-xs font-semibold text-eko-gold uppercase tracking-wider">Solution Packs</h4>
                                <Link to="/solutions" onClick={() => setUseCasesDropdownOpen(false)} className="text-xs text-eko-gold hover:text-eko-gold/80 font-medium">See all →</Link>
                              </div>
                              <div className="space-y-0.5">
                                {navSolutions.map((item, index) => (
                                  <MenuItemLink
                                    key={item.slug}
                                    to={`/solutions/${item.slug}`}
                                    icon={item.icon}
                                    label={item.name}
                                    description={item.tagline}
                                    index={index + 2}
                                    onClick={() => setUseCasesDropdownOpen(false)}
                                  />
                                ))}
                              </div>
                            </div>
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
                        onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setProductsDropdownOpen(false); setUseCasesDropdownOpen(false); }}
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
                id="lnk-sales-phone-header-desktop"
                href={`tel:+91${SALES_MOBILE}`}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer",
                  useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                )}
              >
                <Phone className="w-4 h-4" />
                {formatMobile(SALES_MOBILE)}
              </a>
              <Button id="btn-get-started-header-desktop" variant="gold" size="sm" onClick={() => openZohoChat()} className="cursor-pointer">
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

          {/*
              MARK: Mobile Menu
          */}
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
                    {/* <Link to="/products/eko-shield" onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 py-2.5 px-3 -mx-3 bg-gradient-to-r from-[#00394b] to-[#005a6e] rounded-lg my-1 cursor-pointer max-w-full">
                      <Shield className="w-5 h-5 text-eko-gold shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-white">Eko Shield</span>
                        <span className="text-[10px] ml-2 uppercase tracking-wider bg-eko-gold/20 text-eko-gold px-1.5 py-0.5 rounded-full">Featured</span>
                      </div>
                    </Link> */}
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

                {/* Use Cases Accordion */}
                <button
                  onClick={() => setMobileUseCasesOpen(!mobileUseCasesOpen)}
                  className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer"
                >
                  Use Cases
                  <ChevronDown className={cn("w-4 h-4 transition-transform", mobileUseCasesOpen && "rotate-180")} />
                </button>
                {mobileUseCasesOpen && (
                  <div className="pl-4 space-y-1">
                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1">Industries</p>
                    {navIndustries.map((item) => (
                      <Link key={item.slug} to={`/industries/${item.slug}`} onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer">
                        <item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
                        {item.name}
                      </Link>
                    ))}
                    <Link to="/industries" onClick={() => setMobileMenuOpen(false)}
                      className="block text-sm py-1.5 text-eko-gold font-medium cursor-pointer">
                      See all industries →
                    </Link>

                    <p className="text-xs font-semibold text-eko-gold uppercase tracking-wider py-1 mt-2">Solution Packs</p>
                    {navSolutions.map((item) => (
                      <Link key={item.slug} to={`/solutions/${item.slug}`} onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer">
                        <item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
                        {item.name}
                      </Link>
                    ))}
                    <Link to="/solutions" onClick={() => setMobileMenuOpen(false)}
                      className="block text-sm py-1.5 text-eko-gold font-medium cursor-pointer">
                      See all solutions →
                    </Link>
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
                    id="lnk-sales-phone-header-mobile"
                    href={`tel:+91${SALES_MOBILE}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-eko-slate hover:text-eko-navy transition-colors cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    {formatMobile(SALES_MOBILE)}
                  </a>
                  <Button id="btn-get-started-header-mobile" variant="gold" size="sm" onClick={() => {
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

      {/* Backdrop overlay for full-width dropdowns */}
      {(productsDropdownOpen || useCasesDropdownOpen) && (
        <div
          className={cn("fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 animate-fade-in", isScrolled ? "top-[60px]" : "top-[82px]")}
          onClick={() => { setProductsDropdownOpen(false); setUseCasesDropdownOpen(false); }}
        />
      )}

      {/* Get Started Dialog */}
      {/* Commented out: Redundant - 'open-get-started' event is never dispatched in the app */}
      {/* {getStartedOpen && (
        <Dialog open={getStartedOpen} onOpenChange={setGetStartedOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Get Started with Eko Platform Services</DialogTitle>
              <DialogDescription>Fill in your details and our team will reach out within 24 hours.</DialogDescription>
            </DialogHeader>

            <ZohoSignupForm />
          </DialogContent>
        </Dialog>
      )} */}
      {talkToSalesOpen && (
        <Suspense fallback={null}>
          <TalkToSalesDialog open={talkToSalesOpen} onOpenChange={setTalkToSalesOpen} />
        </Suspense>
      )}
    </>
  );
};
