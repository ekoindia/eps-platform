/**
 * Lazy-loaded dropdown panels and mobile menu for the Header.
 * Kept separate from the header shell so this larger chunk (react-icons, data
 * arrays, DropdownGrid, Sheet) is deferred until after hydration.
 */
import { lazy, Suspense, type ReactNode, type HTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase } from "lucide-react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMobile } from "@/lib/utils";
import { SALES_MOBILE, SOCIAL_LINKS } from "@/lib/config/site";
import { FaFacebookF, FaLinkedinIn, FaInstagram, FaYoutube } from "react-icons/fa";
import { XIcon } from "@/components/icons/XIcon";
import { openZohoChat } from "@/lib/zoho-chat";
import { EkoLogo } from "@/components/EkoLogo";
import { DropdownGrid, DropdownColumnHeader } from "@/components/DropdownGrid";
import { ProductsMegaPanel } from "@/components/ProductsMegaPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LanguageSelector } from "@/components/LanguageSelector";
import { getActiveProducts } from "@/lib/data/api-products";
import { ACTIVE_INDUSTRIES_LIST } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";

const TalkToSalesDialog = lazy(() =>
	import("@/components/TalkToSalesDialog").then((m) => ({ default: m.TalkToSalesDialog }))
);

/* ------------------------------------------------------------------ */
/*  Module-level data (moved from Header.tsx)                          */
/* ------------------------------------------------------------------ */

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

const NAV_MAX_ITEMS = 8;
const navIndustries = ACTIVE_INDUSTRIES_LIST.filter((i) => i.priority === 1).slice(0, NAV_MAX_ITEMS);
const navSolutions = ACTIVE_SOLUTIONS_LIST.filter((s) => s.priority === 1).slice(0, NAV_MAX_ITEMS);

/** Mobile-accordion product sections; the desktop panel renders ProductsMegaPanel directly. */
const apiColumns: Array<{
	title: string;
	items: typeof verificationApis;
	seeAllLink?: { label: string; href: string };
}> = [
	{ title: "Verification APIs", items: verificationApis, seeAllLink: { label: "See all products →", href: "/products" } },
	{ title: "Payment APIs", items: paymentApis },
	{ title: "BC APIs", items: bcApis },
];

/* ------------------------------------------------------------------ */
/*  Sub-components (moved from Header.tsx)                             */
/* ------------------------------------------------------------------ */

type HoverHandlers = { onMouseEnter: () => void; onMouseLeave: () => void };
export type DropdownKey = 'products' | 'useCases' | 'company';

/**
 * Full-width dropdown panel pinned below the fixed header.
 * Adjusts its top offset based on whether the header is in its compact (scrolled) state.
 * Forwards all extra HTML div props (data-dropdown, hover handlers, etc.).
 */
const FullWidthDropdownPanel = ({
	isScrolled,
	children,
	...props
}: {
	isScrolled: boolean;
	children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) => (
	<div
		{...props}
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
}) => {
	// Inline ChevronDown to avoid an extra import from lucide-react in this chunk
	return (
		<button
			onClick={onClick}
			className="text-sm font-medium py-2 flex items-center justify-between text-eko-slate cursor-pointer w-full"
		>
			{label}
			<svg
				className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
	);
};

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

/* ------------------------------------------------------------------ */
/*  Props interface                                                     */
/* ------------------------------------------------------------------ */

export interface HeaderDropdownPanelsProps {
	activeDesktopDropdown: DropdownKey | null;
	setActiveDesktopDropdown: (v: DropdownKey | null) => void;
	activeMobileAccordion: DropdownKey | null;
	setActiveMobileAccordion: (v: DropdownKey | null) => void;
	mobileMenuOpen: boolean;
	isScrolled: boolean;
	talkToSalesOpen: boolean;
	setMobileMenuOpen: (v: boolean) => void;
	setTalkToSalesOpen: (v: boolean) => void;
	/** Hover handlers spread on every panel root to keep the dropdown open while inside the panel. */
	panelHoverHandlers: HoverHandlers;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * All dropdown panels, the mobile side-drawer, the backdrop overlay, and the
 * TalkToSales dialog. Lazy-loaded by Header.tsx after hydration so none of this
 * code is in the critical main bundle.
 */
export const HeaderDropdownPanels = ({
	activeDesktopDropdown,
	setActiveDesktopDropdown,
	activeMobileAccordion,
	setActiveMobileAccordion,
	mobileMenuOpen,
	isScrolled,
	talkToSalesOpen,
	setMobileMenuOpen,
	setTalkToSalesOpen,
	panelHoverHandlers,
}: HeaderDropdownPanelsProps) => {
	return (
		<>
			{/* ── Desktop: Products dropdown ─────────────────────────────── */}
			{activeDesktopDropdown === 'products' && (
			<FullWidthDropdownPanel isScrolled={isScrolled} data-dropdown="products" {...panelHoverHandlers}>
					<ProductsMegaPanel
						verificationApis={verificationApis}
						paymentApis={paymentApis}
						bcApis={bcApis}
						onItemClick={() => setActiveDesktopDropdown(null)}
					/>
				</FullWidthDropdownPanel>
			)}

			{/* ── Desktop: Use Cases dropdown ────────────────────────────── */}
			{activeDesktopDropdown === 'useCases' && (
			<FullWidthDropdownPanel isScrolled={isScrolled} data-dropdown="usecases" {...panelHoverHandlers}>
					{/* Featured banner */}
					<div className="bg-linear-to-r from-[#00394b] to-[#005a6e]">
						<div className="container mx-auto px-4 sm:px-6 lg:px-8">
							<Link
								to="/use-cases"
							onClick={() => setActiveDesktopDropdown(null)}
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
						onItemClick={() => setActiveDesktopDropdown(null)}
					/>
				</FullWidthDropdownPanel>
			)}

			{/* ── Desktop: Company dropdown ──────────────────────────────── */}
			{activeDesktopDropdown === 'company' && (
				<div
					className="fixed top-24 left-1/2 -translate-x-1/2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-border/50 z-50 animate-menu-slide-down-in overflow-hidden"
					data-dropdown="company"
					{...panelHoverHandlers}
				>
					<div className="grid grid-cols-2">
						{/* Left column: company links */}
						<div className="p-4 flex flex-col gap-1">
							<DropdownColumnHeader title="Company" />
							{companyLinks.map((item) => (
								<CompanyLinkItem
									key={item.label}
									item={item}
									onClick={() => setActiveDesktopDropdown(null)}
									className="block px-3 py-2 text-sm text-eko-slate hover:text-eko-navy hover:bg-muted rounded-lg transition-colors cursor-pointer"
								/>
							))}
						</div>

						{/* Right column: social links */}
						<div className="p-4 flex flex-col gap-1">
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

			{/* ── Backdrop for full-width dropdowns ─────────────────────── */}
			{(activeDesktopDropdown === 'products' || activeDesktopDropdown === 'useCases') && (
				<div
					className={cn(
						"fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 animate-fade-in",
						isScrolled ? "top-[60px]" : "top-[82px]"
					)}
					onClick={() => setActiveDesktopDropdown(null)}
				/>
			)}

			{/* ── Mobile side drawer ─────────────────────────────────────── */}
			<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
				<SheetContent side="right" className="w-[88vw] sm:max-w-sm sm:w-[400px] p-0 flex flex-col gap-0 lg:hidden">
					<div className="flex items-center justify-between px-5 py-4 border-b border-eko-navy/10 shrink-0">
						<Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center">
							<EkoLogo className="h-9 w-auto" />
						</Link>
					</div>

					<nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
						{/* Products Accordion */}
						<MobileAccordionButton
							label="Products"
							isOpen={activeMobileAccordion === 'products'}
							onClick={() => setActiveMobileAccordion(activeMobileAccordion === 'products' ? null : 'products')}
						/>
						{activeMobileAccordion === 'products' && (
							<div className="pl-4 flex flex-col gap-1">
								{apiColumns.map((col) => (
									<div key={col.title}>
										<p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1 mt-2">
											{col.title}
										</p>
										{col.items.map((item) => (
											<Link
												key={item.href}
												to={item.href}
												onClick={() => setMobileMenuOpen(false)}
												className="block text-sm py-1.5 text-eko-slate cursor-pointer"
											>
												{item.label}
											</Link>
										))}
										{col.seeAllLink && (
											<Link
												to={col.seeAllLink.href}
												onClick={() => setMobileMenuOpen(false)}
												className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer"
											>
												{col.seeAllLink.label}
											</Link>
										)}
									</div>
								))}
							</div>
						)}

						{/* Company Accordion */}
						<MobileAccordionButton
							label="Company"
							isOpen={activeMobileAccordion === 'company'}
							onClick={() => setActiveMobileAccordion(activeMobileAccordion === 'company' ? null : 'company')}
						/>
						{activeMobileAccordion === 'company' && (
							<div className="pl-4 flex flex-col gap-1">
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
							isOpen={activeMobileAccordion === 'useCases'}
							onClick={() => setActiveMobileAccordion(activeMobileAccordion === 'useCases' ? null : 'useCases')}
						/>
						{activeMobileAccordion === 'useCases' && (
							<div className="pl-4 flex flex-col gap-1">
								<p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1">Industries</p>
								{navIndustries.map((item) => (
									<Link
										key={item.slug}
										to={`/industries/${item.slug}`}
										onClick={() => setMobileMenuOpen(false)}
										className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer"
									>
										<item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
										{item.name}
									</Link>
								))}
								<Link
									to="/industries"
									onClick={() => setMobileMenuOpen(false)}
									className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer"
								>
									See all industries →
								</Link>

								<p className="text-xs font-semibold text-eko-navy/70 uppercase tracking-wider py-1 mt-2">Solution Packs</p>
								{navSolutions.map((item) => (
									<Link
										key={item.slug}
										to={`/solutions/${item.slug}`}
										onClick={() => setMobileMenuOpen(false)}
										className="flex items-center gap-2 text-sm py-1.5 text-eko-slate cursor-pointer"
									>
										<item.icon className="w-3.5 h-3.5 text-eko-navy/50" />
										{item.name}
									</Link>
								))}
								<Link
									to="/solutions"
									onClick={() => setMobileMenuOpen(false)}
									className="block text-sm py-1.5 text-eko-navy/80 hover:text-eko-navy hover:underline font-medium cursor-pointer"
								>
									See all solutions →
								</Link>
							</div>
						)}

						{/* Pricing link */}
						<Link
							to="/pricing"
							onClick={() => setMobileMenuOpen(false)}
							className="text-sm font-medium py-2 text-eko-slate cursor-pointer"
						>
							Pricing
						</Link>

						{/* Developers link */}
						<a
							href="https://developers.eko.in"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm font-medium py-2 text-eko-slate cursor-pointer"
							onClick={() => setMobileMenuOpen(false)}
						>
							Developers
						</a>
					</nav>

					<div className="flex flex-col gap-3 px-5 py-4 border-t border-eko-navy/10 shrink-0">
						<div className="-ml-2">
							<LanguageSelector isLight={false} showLabel />
						</div>
						<a
							id="lnk-sales-phone-header-mobile"
							href={`tel:+91${SALES_MOBILE}`}
							className="flex items-center gap-1.5 text-sm font-medium text-eko-slate hover:text-eko-navy transition-colors cursor-pointer"
						>
							<Phone className="w-4 h-4" />
							{formatMobile(SALES_MOBILE)}
						</a>
						<Button
							id="btn-get-started-header-mobile"
							variant="gold"
							size="sm"
							onClick={() => {
								setMobileMenuOpen(false);
								openZohoChat();
							}}
							className="cursor-pointer self-start min-w-[140px]"
						>
							Get Started
						</Button>
					</div>
				</SheetContent>
			</Sheet>

			{/* ── TalkToSales dialog ─────────────────────────────────────── */}
			{talkToSalesOpen && (
				<Suspense fallback={null}>
					<TalkToSalesDialog open={talkToSalesOpen} onOpenChange={setTalkToSalesOpen} />
				</Suspense>
			)}
		</>
	);
};
