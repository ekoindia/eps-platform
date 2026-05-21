import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Phone, ArrowRight, Sparkles, Shield, Briefcase, Search, CreditCard, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMobile } from "@/lib/utils";
import { SALES_MOBILE, SOCIAL_LINKS } from "@/lib/config/site";
import { FaFacebookF, FaLinkedinIn, FaInstagram, FaYoutube } from "react-icons/fa";
import { XIcon } from "@/components/icons/XIcon";
import { openZohoChat } from "@/lib/zoho-chat";
import { EkoLogo } from "@/components/EkoLogo";
import { DropdownGrid, DropdownColumnHeader } from "@/components/DropdownGrid";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
  { label: "About Eko", href: "/about-us", internal: true },
  // { label: "Grievance", href: "/grievance", internal: true },
  // { label: "Blogs & Media", href: "/blogs-media", internal: true },
];

const companySocialLinks = [
  { icon: FaLinkedinIn, href: SOCIAL_LINKS.linkedin, label: "LinkedIn", iconBg: "bg-[#0A66C2]/15", iconColor: "text-[#0A66C2]" },
  { icon: FaFacebookF, href: SOCIAL_LINKS.facebook, label: "Facebook", iconBg: "bg-[#1877F2]/15", iconColor: "text-[#1877F2]" },
  { icon: FaInstagram, href: SOCIAL_LINKS.instagram, label: "Instagram", iconBg: "bg-[#E4405F]/15", iconColor: "text-[#E4405F]" },
  { icon: FaYoutube, href: SOCIAL_LINKS.youtube, label: "YouTube", iconBg: "bg-[#FF0000]/15", iconColor: "text-[#FF0000]" },
  { icon: XIcon, href: SOCIAL_LINKS.x, label: "X (Twitter)", iconBg: "bg-[#1D1D1D]/10", iconColor: "text-[#1D1D1D]" },
];

const navLinks = [
  { label: "Products", href: "/products", hasDropdown: true },
  { label: "Use Cases", href: "/use-cases", hasDropdown: true },
  { label: "Developers", href: "https://developers.eko.in", external: true },
  { label: "Company", href: "#", hasDropdown: true },
];

const NAV_MAX_ITEMS = 8;
const navIndustries = ACTIVE_INDUSTRIES_LIST.filter((i) => i.priority === 1).slice(0, NAV_MAX_ITEMS);
const navSolutions = ACTIVE_SOLUTIONS_LIST.filter((s) => s.priority === 1).slice(0, NAV_MAX_ITEMS);

/**
 * Desktop navigation dropdown trigger button with a chevron indicator.
 */
const NavDropdownButton = ({
  label,
  isOpen,
  isActive,
  useWhiteText,
  activeNavClasses,
  onClick,
}: {
  label: string;
  isOpen: boolean;
  isActive: boolean;
  useWhiteText: boolean;
  activeNavClasses: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "text-base font-medium tracking-tight transition-colors duration-200 flex items-center gap-1 cursor-pointer",
      useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy",
      isActive && activeNavClasses
    )}
  >
    {label}
    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
  </button>
);

/**
 * Full-width dropdown panel pinned below the fixed header.
 * Adjusts its top offset based on whether the header is in its compact (scrolled) state.
 */
const FullWidthDropdownPanel = ({
  isScrolled,
  children,
}: {
  isScrolled: boolean;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "fixed left-0 right-0 w-full bg-white shadow-lg border-b border-border/30 overflow-hidden z-50 animate-menu-fullwidth-reveal",
      isScrolled ? "top-[60px]" : "top-[82px]"
    )}
  >
    {children}
  </div>
);

/**
 * Mobile navigation accordion toggle button with a chevron indicator.
 */
const MobileAccordionButton = ({
  label,
  isOpen,
  onClick,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer"
  >
    {label}
    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
  </button>
);

/**
 * Renders a company navigation link as an internal `<Link>` or external `<a>`,
 * based on the `item.internal` flag.
 */
const CompanyLinkItem = ({
  item,
  onClick,
  className,
}: {
  item: { label: string; href: string; internal?: boolean };
  onClick?: () => void;
  className: string;
}) =>
  item.internal ? (
    <Link to={item.href} onClick={onClick} className={className}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} onClick={onClick} className={className}>
      {item.label}
    </a>
  );

export const Header = () => {
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
  const hoverTimersRef = useRef<Record<string, { open?: number; close?: number }>>({});
  const location = useLocation();

  const HOVER_OPEN_DELAY = 80;
  const HOVER_CLOSE_DELAY = 150;

  const getHoverHandlers = (
    key: "products" | "useCases" | "company",
    setOpen: (b: boolean) => void,
    closeOthers: () => void
  ) => ({
    onMouseEnter: () => {
      const t = (hoverTimersRef.current[key] ||= {});
      if (t.close !== undefined) {
        window.clearTimeout(t.close);
        t.close = undefined;
      }
      if (t.open === undefined) {
        t.open = window.setTimeout(() => {
          closeOthers();
          setOpen(true);
          t.open = undefined;
        }, HOVER_OPEN_DELAY);
      }
    },
    onMouseLeave: () => {
      const t = (hoverTimersRef.current[key] ||= {});
      if (t.open !== undefined) {
        window.clearTimeout(t.open);
        t.open = undefined;
      }
      t.close = window.setTimeout(() => {
        setOpen(false);
        t.close = undefined;
      }, HOVER_CLOSE_DELAY);
    },
  });

  const useWhiteText = true;

  const isNavActive = (label: string): boolean => {
    const path = location.pathname;
    switch (label) {
      case "Products":
        return path.startsWith("/products/");
      case "Use Cases":
        return (
          path === "/use-cases" ||
          path.startsWith("/use-cases/") ||
          path.startsWith("/industries") ||
          path.startsWith("/solutions")
        );
      case "Company":
        return companyLinks.some((l) => l.href === path || path.startsWith(l.href + "/"));
      default:
        return false;
    }
  };

  const activeNavClasses =
    "font-semibold relative after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-0.5 after:bg-eko-gold after:rounded-full";

  const { direction: scrollDirection, y: scrollY } = useScrollDirection({ threshold: 8 });
  const isScrolled = scrollY > 10;
  const anyDropdownOpen = productsDropdownOpen || useCasesDropdownOpen || companyDropdownOpen;
  const isHidden = scrollDirection === "down" && scrollY > 100 && !anyDropdownOpen && !mobileMenuOpen;

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
    return () => {
      Object.values(hoverTimersRef.current).forEach((t) => {
        if (t.open !== undefined) window.clearTimeout(t.open);
        if (t.close !== undefined) window.clearTimeout(t.close);
      });
    };
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
    { title: "Verification APIs", icon: Search, items: verificationApis, maxItems: 6, moreLink: { label: "More...", href: "/products" } },
    { title: "Payment APIs", icon: CreditCard, items: paymentApis },
    // { title: "Collection APIs", items: collectionApis },
    { title: "BC APIs", icon: Building2, items: bcApis },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-[transform,background-color,padding,box-shadow] duration-300 ease-out will-change-transform",
          isScrolled
            ? "bg-[#00394bdd] backdrop-blur-md shadow-sm py-3"
            : "bg-[#00394b] py-5",
          isHidden ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <EkoLogo
                className={cn(
                  "h-12 w-auto transition-transform duration-300 ease-out origin-left",
                  isScrolled ? "scale-90" : "scale-100"
                )}
                isLight={useWhiteText && !isScrolled}
              />
            </Link>

            {/*
              Desktop Navigation
              MARK: Products
            */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                if (link.label === "Products") {
                  return (
                    <div
                      key={link.label}
                      className="relative"
                      ref={productsDropdownRef}
                      {...getHoverHandlers("products", setProductsDropdownOpen, () => {
                        setCompanyDropdownOpen(false);
                        setUseCasesDropdownOpen(false);
                      })}
                    >
                      <NavDropdownButton
                        label={link.label}
                        isOpen={productsDropdownOpen}
                        isActive={isNavActive(link.label)}
                        useWhiteText={useWhiteText}
                        activeNavClasses={activeNavClasses}
                        onClick={() => { setProductsDropdownOpen(!productsDropdownOpen); setCompanyDropdownOpen(false); setUseCasesDropdownOpen(false); }}
                      />

                      {productsDropdownOpen && (
                        <FullWidthDropdownPanel isScrolled={isScrolled}>
                          <DropdownGrid
                            columns={apiColumns.map((col) => ({
                              title: col.title,
                              items: (col.maxItems ? col.items.slice(0, col.maxItems) : col.items).map((item) => ({
                                to: item.href,
                                icon: item.icon,
                                label: item.label,
                                description: item.shortDesc,
                              })),
                              seeAllLink: col.maxItems && col.items.length > col.maxItems && col.moreLink
                                ? { label: "See all →", to: col.moreLink.href }
                                : undefined,
                            }))}
                            onItemClick={() => setProductsDropdownOpen(false)}
                          />
                        </FullWidthDropdownPanel>
                      )}
                    </div>
                  );
                }

                // MARK: Use Cases
                if (link.label === "Use Cases") {
                  return (
                    <div
                      key={link.label}
                      className="relative"
                      ref={useCasesDropdownRef}
                      {...getHoverHandlers("useCases", setUseCasesDropdownOpen, () => {
                        setProductsDropdownOpen(false);
                        setCompanyDropdownOpen(false);
                      })}
                    >
                      <NavDropdownButton
                        label={link.label}
                        isOpen={useCasesDropdownOpen}
                        isActive={isNavActive(link.label)}
                        useWhiteText={useWhiteText}
                        activeNavClasses={activeNavClasses}
                        onClick={() => { setUseCasesDropdownOpen(!useCasesDropdownOpen); setProductsDropdownOpen(false); setCompanyDropdownOpen(false); }}
                      />

                      {useCasesDropdownOpen && (
                        <FullWidthDropdownPanel isScrolled={isScrolled}>
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

                          <DropdownGrid
                            columns={[
                              {
                                title: "Industries",
                                items: navIndustries.map((item) => ({
                                  to: `/industries/${item.slug}`,
                                  icon: item.icon,
                                  label: item.name,
                                  description: item.tagline,
                                })),
                                seeAllLink: { label: "See all →", to: "/industries" },
                              },
                              {
                                title: "Solution Packs",
                                items: navSolutions.map((item) => ({
                                  to: `/solutions/${item.slug}`,
                                  icon: item.icon,
                                  label: item.name,
                                  description: item.tagline,
                                })),
                                seeAllLink: { label: "See all →", to: "/solutions" },
                              },
                            ]}
                            onItemClick={() => setUseCasesDropdownOpen(false)}
                          />
                        </FullWidthDropdownPanel>
                      )}
                    </div>
                  );
                }

                // MARK: Company
                if (link.label === "Company") {
                  return (
                    <div
                      key={link.label}
                      className="relative"
                      ref={companyDropdownRef}
                      {...getHoverHandlers("company", setCompanyDropdownOpen, () => {
                        setProductsDropdownOpen(false);
                        setUseCasesDropdownOpen(false);
                      })}
                    >
                      <NavDropdownButton
                        label={link.label}
                        isOpen={companyDropdownOpen}
                        isActive={isNavActive(link.label)}
                        useWhiteText={useWhiteText}
                        activeNavClasses={activeNavClasses}
                        onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setProductsDropdownOpen(false); setUseCasesDropdownOpen(false); }}
                      />

                      {companyDropdownOpen && (
                        <div className="fixed top-24 left-1/2 -translate-x-1/2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-border/50 z-50 animate-menu-slide-down-in overflow-hidden">
                          <div className="grid grid-cols-2">
                            {/* Left column: company links */}
                            <div className="p-4 space-y-1">
                              <DropdownColumnHeader title="Company" />
                              {companyLinks.map((item) => (
                                <CompanyLinkItem
                                  key={item.label}
                                  item={item}
                                  onClick={() => setCompanyDropdownOpen(false)}
                                  className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                />
                              ))}
                            </div>

                            {/* Right column: social links */}
                            <div className="p-4 space-y-1">
                              <DropdownColumnHeader title="Follow Us" />
                              {companySocialLinks.map((social) => (
                                <a
                                  key={social.label}
                                  href={social.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                >
                                  <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", social.iconBg)}>
                                    <social.icon className={cn("w-3 h-3", social.iconColor)} />
                                  </span>
                                  {social.label}
                                </a>
                              ))}
                            </div>
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
                      "text-base font-medium tracking-tight transition-colors duration-200 cursor-pointer",
                      useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy",
                      isNavActive(link.label) && activeNavClasses
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

        </div>
      </header>

      {/*
          MARK: Mobile Menu (Side Drawer)
      */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-[88vw] sm:max-w-sm sm:w-[400px] p-0 flex flex-col gap-0 lg:hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-eko-navy/10 shrink-0">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center">
              <EkoLogo className="h-9 w-auto" />
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
            {/* Products Accordion */}
            <MobileAccordionButton
              label="Products"
              isOpen={mobileProductsOpen}
              onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
            />
            {mobileProductsOpen && (
              <div className="pl-4 space-y-1">
                {apiColumns.map((col) => {
                  const displayItems = col.maxItems ? col.items.slice(0, col.maxItems) : col.items;
                  const showMoreLink = col.maxItems && col.items.length > col.maxItems && col.moreLink;
                  return (
                    <div key={col.title}>
                      <p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1 mt-2">{col.title}</p>
                      {displayItems.map((item) => (
                        <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}
                          className="block text-sm py-1.5 text-eko-slate cursor-pointer">
                          {item.label}
                        </Link>
                      ))}
                      {showMoreLink && (
                        <a href={col.moreLink.href} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}
                          className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer">
                          {col.moreLink.label}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Company Accordion */}
            <MobileAccordionButton
              label="Company"
              isOpen={mobileCompanyOpen}
              onClick={() => setMobileCompanyOpen(!mobileCompanyOpen)}
            />
            {mobileCompanyOpen && (
              <div className="pl-4 space-y-1">
                {companyLinks.map((item) => (
                  <CompanyLinkItem
                    key={item.label}
                    item={item}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm py-1.5 text-eko-slate cursor-pointer"
                  />
                ))}
              </div>
            )}

            {/* Use Cases Accordion */}
            <MobileAccordionButton
              label="Use Cases"
              isOpen={mobileUseCasesOpen}
              onClick={() => setMobileUseCasesOpen(!mobileUseCasesOpen)}
            />
            {mobileUseCasesOpen && (
              <div className="pl-4 space-y-1">
                <p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1">Industries</p>
                {navIndustries.map((item) => (
                  <Link key={item.slug} to={`/industries/${item.slug}`} onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer">
                    <item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
                    {item.name}
                  </Link>
                ))}
                <Link to="/industries" onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer">
                  See all industries →
                </Link>

                <p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1 mt-2">Solution Packs</p>
                {navSolutions.map((item) => (
                  <Link key={item.slug} to={`/solutions/${item.slug}`} onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer">
                    <item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
                    {item.name}
                  </Link>
                ))}
                <Link to="/solutions" onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer">
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
          </nav>

          <div className="flex flex-col gap-3 px-5 py-4 border-t border-eko-navy/10 shrink-0">
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
        </SheetContent>
      </Sheet>

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
