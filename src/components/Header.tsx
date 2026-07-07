import { EkoLogo } from "@/components/EkoLogo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/UserMenu";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SHOW_USER_LOGIN } from "@/lib/config/features";
import { navLinks, type DropdownKey } from "@/lib/config/nav";
import { cn } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-chat";
import { ChevronDown, Globe, Menu, Search, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const HeaderDropdownPanels = lazy(() =>
	import("@/components/HeaderDropdownPanels").then((m) => ({
		default: m.HeaderDropdownPanels,
	})),
);

const CommandPalette = lazy(() =>
	import("@/components/CommandPalette").then((m) => ({
		default: m.CommandPalette,
	})),
);

const LanguageSelector = lazy(() =>
	import("@/components/LanguageSelector").then((m) => ({
		default: m.LanguageSelector,
	})),
);

/**
 * Static stand-in rendered during SSG and before the lazy LanguageSelector
 * chunk loads. Must visually match the real trigger button to avoid layout
 * shift on swap.
 */
const LanguageSelectorFallback = ({ isLight }: { isLight: boolean }) => (
	<button
		className={cn(
			"flex items-center text-sm font-medium transition-colors cursor-pointer rounded-md px-2 py-1.5 hover:bg-white/10",
			isLight
				? "text-white/90 hover:text-white"
				: "text-eko-slate hover:text-eko-navy",
		)}
		aria-label="Select language"
		title="Select language"
	>
		<Globe className="w-4 h-4" />
	</button>
);

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
			"text-sm font-medium tracking-tight transition-colors duration-200 flex items-center gap-1 cursor-pointer",
			useWhiteText
				? "text-white/90 hover:text-white"
				: "text-eko-slate hover:text-eko-navy",
			isActive && activeNavClasses,
		)}
	>
		{label}
		<ChevronDown
			className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
		/>
	</button>
);

export const Header = () => {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeDesktopDropdown, setActiveDesktopDropdown] =
		useState<DropdownKey | null>(null);
	const [activeMobileAccordion, setActiveMobileAccordion] =
		useState<DropdownKey | null>(null);
	// const [getStartedOpen, setGetStartedOpen] = useState(false);
	const [talkToSalesOpen, setTalkToSalesOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	/** Palette chunk is mounted on first open and kept mounted afterwards */
	const [searchMounted, setSearchMounted] = useState(false);
	/**
	 * Mounts the lazy header chunks (dropdown panels, language selector) only
	 * after they have loaded post-hydration, so SSG markup and first client
	 * render stay identical — rendering React.lazy under Suspense during
	 * renderToString causes hydration mismatches (React #418/#423).
	 */
	const [lazyChunksReady, setLazyChunksReady] = useState(false);
	const productsDropdownRef = useRef<HTMLDivElement>(null);
	const companyDropdownRef = useRef<HTMLDivElement>(null);
	const useCasesDropdownRef = useRef<HTMLDivElement>(null);
	const aiDropdownRef = useRef<HTMLDivElement>(null);
	const developersDropdownRef = useRef<HTMLDivElement>(null);
	/** Shared close timer — fires only when mouse leaves the entire header or a panel. */
	const closeTimerRef = useRef<number | undefined>(undefined);
	/** Per-trigger open timers (80ms open delay). */
	const openTimersRef = useRef<Record<string, number | undefined>>({});
	const location = useLocation();
	const { state: authState } = useAuth();
	// Once signed in, the avatar menu replaces the sales CTA in the header.
	const isAuthed = SHOW_USER_LOGIN && authState.status === "authed";

	const HOVER_OPEN_DELAY = 80;
	const HOVER_CLOSE_DELAY = 150;

	/** Cancel any pending close — called when mouse re-enters the header or a panel. */
	const cancelClose = () => {
		if (closeTimerRef.current !== undefined) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = undefined;
		}
	};

	/** Schedule closing all dropdowns — called when mouse leaves the header or a panel. */
	const scheduleClose = () => {
		cancelClose();
		closeTimerRef.current = window.setTimeout(() => {
			setActiveDesktopDropdown(null);
			closeTimerRef.current = undefined;
		}, HOVER_CLOSE_DELAY);
	};

	/**
	 * Returns an onMouseEnter handler for a trigger button.
	 * Cancels any pending close and schedules opening the given dropdown after a short delay.
	 */
	const getTriggerEnterHandler = (key: DropdownKey) => () => {
		cancelClose();
		if (openTimersRef.current[key] === undefined) {
			openTimersRef.current[key] = window.setTimeout(() => {
				setActiveDesktopDropdown(key);
				openTimersRef.current[key] = undefined;
			}, HOVER_OPEN_DELAY);
		}
	};

	/** Hover handlers spread on every dropdown panel — keeps the dropdown open while mouse is in the panel. */
	const panelHoverHandlers = {
		onMouseEnter: cancelClose,
		onMouseLeave: scheduleClose,
	};

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
			case "Pricing":
				return path === "/pricing";
			// "AI Tools" — a direct /ai link when the transact-MCP flag is off, a
			// dropdown (/ai + /agents) when on.
			case "AI Tools":
				return path === "/ai" || path === "/agents";
			case "Developers":
				return path === "/docs" || path.startsWith("/docs/") || path === "/faq";
			case "Company":
				return path === "/about-us" || path.startsWith("/about-us/");
			default:
				return false;
		}
	};

	const activeNavClasses =
		"font-semibold relative after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-0.5 after:bg-eko-gold after:rounded-full";

	const { direction: scrollDirection, y: scrollY } = useScrollDirection({
		threshold: 8,
	});
	const isScrolled = scrollY > 10;
	const anyDropdownOpen = activeDesktopDropdown !== null;
	const isHidden =
		scrollDirection === "down" &&
		scrollY > 100 &&
		!anyDropdownOpen &&
		!mobileMenuOpen;

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			const outsideAll =
				(!productsDropdownRef.current ||
					!productsDropdownRef.current.contains(target)) &&
				!document
					.querySelector('[data-dropdown="products"]')
					?.contains(target) &&
				(!useCasesDropdownRef.current ||
					!useCasesDropdownRef.current.contains(target)) &&
				!document
					.querySelector('[data-dropdown="usecases"]')
					?.contains(target) &&
				(!aiDropdownRef.current || !aiDropdownRef.current.contains(target)) &&
				!document.querySelector('[data-dropdown="ai"]')?.contains(target) &&
				(!developersDropdownRef.current ||
					!developersDropdownRef.current.contains(target)) &&
				!document
					.querySelector('[data-dropdown="developers"]')
					?.contains(target) &&
				(!companyDropdownRef.current ||
					!companyDropdownRef.current.contains(target)) &&
				!document.querySelector('[data-dropdown="company"]')?.contains(target);
			if (outsideAll) setActiveDesktopDropdown(null);
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== undefined)
				window.clearTimeout(closeTimerRef.current);
			Object.values(openTimersRef.current).forEach((t) => {
				if (t !== undefined) window.clearTimeout(t);
			});
		};
	}, []);

	// Keep a ref in sync so the global keydown handler can stay stable
	const searchOpenRef = useRef(false);
	useEffect(() => {
		searchOpenRef.current = searchOpen;
	}, [searchOpen]);

	/** Opens the command palette, mounting its lazy chunk on first use */
	const openSearch = () => {
		setSearchMounted(true);
		setSearchOpen(true);
	};

	// Global ⌘K / Ctrl+K shortcut — toggles the command palette
	useEffect(() => {
		const handleKeydown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
			// Ignore the shortcut while typing in a form field (only when the palette is closed)
			const target = e.target as HTMLElement | null;
			if (
				!searchOpenRef.current &&
				target?.closest("input, textarea, select, [contenteditable='true']")
			) {
				return;
			}
			e.preventDefault();
			setSearchMounted(true);
			setSearchOpen((o) => !o);
		};
		document.addEventListener("keydown", handleKeydown);
		return () => document.removeEventListener("keydown", handleKeydown);
	}, []);

	// Prefetch the dropdown panels chunk after hydration so it is ready before first hover
	useEffect(() => {
		const load = () =>
			Promise.all([
				import("@/components/HeaderDropdownPanels"),
				import("@/components/CommandPalette"),
				import("@/components/LanguageSelector"),
			]).then(() => setLazyChunksReady(true));
		if (typeof requestIdleCallback !== "undefined") {
			const handle = requestIdleCallback(load, { timeout: 2000 });
			return () => cancelIdleCallback(handle);
		} else {
			const timer = setTimeout(load, 200);
			return () => clearTimeout(timer);
		}
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

	// Trigger enter handlers — onMouseLeave is intentionally absent; closing is handled by
	// onMouseLeave on the <header> element so the dropdown stays open while the mouse moves
	// anywhere within the header bar.
	const productsEnterHandler = getTriggerEnterHandler("products");
	const useCasesEnterHandler = getTriggerEnterHandler("useCases");
	const aiEnterHandler = getTriggerEnterHandler("ai");
	const developersEnterHandler = getTriggerEnterHandler("developers");
	const companyEnterHandler = getTriggerEnterHandler("company");

	/**
	 * Runtime wiring per dropdown (container ref + hover-enter handler), keyed by
	 * the link's `dropdownKey`. Static config lives in `navLinks`; only these
	 * non-serializable values must be built inside the component.
	 */
	const dropdownWiring: Record<
		DropdownKey,
		{ ref: React.RefObject<HTMLDivElement | null>; enter: () => void }
	> = {
		products: { ref: productsDropdownRef, enter: productsEnterHandler },
		useCases: { ref: useCasesDropdownRef, enter: useCasesEnterHandler },
		ai: { ref: aiDropdownRef, enter: aiEnterHandler },
		developers: { ref: developersDropdownRef, enter: developersEnterHandler },
		company: { ref: companyDropdownRef, enter: companyEnterHandler },
	};

	return (
		<>
			<header
				onMouseEnter={cancelClose}
				onMouseLeave={scheduleClose}
				className={cn(
					"fixed top-0 left-0 right-0 z-50 transition-[transform,translate,background-color,padding,box-shadow] duration-300 ease-out will-change-[transform,translate]",
					isScrolled
						? "bg-[#00394bdd] backdrop-blur-md shadow-xs py-3"
						: "bg-[#00394b] py-5",
					isHidden ? "-translate-y-full" : "translate-y-0",
				)}
			>
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between">
						<Link to="/" className="flex items-center">
							<EkoLogo
								className={cn(
									"h-12 w-auto transition-transform duration-300 ease-out origin-left",
									isScrolled ? "scale-90" : "scale-100",
								)}
								isLight={useWhiteText && !isScrolled}
							/>
						</Link>

						{/*
              Desktop Navigation
            */}
						<nav className="hidden lg:flex items-center gap-8">
							{navLinks.map((link) => {
								if (link.dropdownKey) {
									const key = link.dropdownKey;
									const { ref, enter } = dropdownWiring[key];
									return (
										<div
											key={link.label}
											className={cn(
												"relative",
												key === "company" && "company-nav-trigger",
												key === "developers" && "developers-nav-trigger",
											)}
											ref={ref}
											onMouseEnter={enter}
										>
											<NavDropdownButton
												label={link.label}
												isOpen={activeDesktopDropdown === key}
												isActive={isNavActive(link.label)}
												useWhiteText={useWhiteText}
												activeNavClasses={activeNavClasses}
												onClick={() =>
													setActiveDesktopDropdown(
														activeDesktopDropdown === key ? null : key,
													)
												}
											/>
										</div>
									);
								}

								const plainLinkClasses = cn(
									"text-sm font-medium tracking-tight transition-colors duration-200 cursor-pointer",
									useWhiteText
										? "text-white/90 hover:text-white"
										: "text-eko-slate hover:text-eko-navy",
									isNavActive(link.label) && activeNavClasses,
								);
								// Internal links use <Link> for client-side routing; external open in a new tab
								return link.external ? (
									<a
										key={link.href ?? link.label}
										href={link.href}
										target="_blank"
										rel="noopener noreferrer"
										className={plainLinkClasses}
									>
										{link.label}
									</a>
								) : (
									<Link
										key={link.href ?? link.label}
										to={link.href ?? "#"}
										className={plainLinkClasses}
									>
										{link.label}
									</Link>
								);
							})}
						</nav>

						<div className="hidden lg:flex items-center gap-4">
							{/*
                MARK: Desktop Search
               */}
							<button
								id="btn-search-header-desktop"
								onClick={openSearch}
								aria-label="Search"
								aria-keyshortcuts="Meta+K Control+K"
								className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
							>
								<Search className="w-4 h-4" />
								<span className="max-[1060px]:hidden">Search</span>
								<span className="ml-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white/60">
									<span className="kbd-os-mac">⌘K</span>
									<span className="kbd-os-other">Ctrl K</span>
								</span>
							</button>

							{/*
                MARK: Language
               */}
							{lazyChunksReady ? (
								<Suspense
									fallback={<LanguageSelectorFallback isLight={useWhiteText} />}
								>
									<LanguageSelector isLight={useWhiteText} />
								</Suspense>
							) : (
								<LanguageSelectorFallback isLight={useWhiteText} />
							)}

							{/* <a
                id="lnk-sales-phone-header-desktop"
                href={`tel:+91${SALES_MOBILE}`}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer",
                  useWhiteText ? "text-white/90 hover:text-white" : "text-eko-slate hover:text-eko-navy"
                )}
              >
                <Phone className="w-4 h-4" />
                {formatMobile(SALES_MOBILE)}
              </a> */}

							{/*
                MARK: Account menu (authed users only) — replaces the CTA
              */}
							{SHOW_USER_LOGIN && <UserMenu />}

							{/*
                MARK: Desktop CTA — hidden once signed in
              */}
							{!isAuthed && (
								<Button
									id="btn-get-started-header-desktop"
									variant="gold"
									size="sm"
									onClick={() => openZohoChat()}
									className="cursor-pointer"
								>
									Get Started
								</Button>
							)}
						</div>

						<div className="lg:hidden flex items-center gap-1">
							{/*
                MARK: Mobile Search
              */}
							<button
								className="p-2 cursor-pointer"
								onClick={openSearch}
								aria-label="Search"
							>
								<Search
									className={cn(
										"w-6 h-6",
										useWhiteText ? "text-white" : "text-eko-navy",
									)}
								/>
							</button>

							{/*
                MARK: Mobile Menu
              */}
							<button
								className="p-2 cursor-pointer"
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
								aria-label="Toggle menu"
							>
								{mobileMenuOpen ? (
									<X
										className={cn(
											"w-6 h-6",
											useWhiteText ? "text-white" : "text-eko-navy",
										)}
									/>
								) : (
									<Menu
										className={cn(
											"w-6 h-6",
											useWhiteText ? "text-white" : "text-eko-navy",
										)}
									/>
								)}
							</button>
						</div>
					</div>
				</div>
			</header>

			{lazyChunksReady && (
				<Suspense fallback={null}>
					<HeaderDropdownPanels
						activeDesktopDropdown={activeDesktopDropdown}
						setActiveDesktopDropdown={setActiveDesktopDropdown}
						activeMobileAccordion={activeMobileAccordion}
						setActiveMobileAccordion={setActiveMobileAccordion}
						mobileMenuOpen={mobileMenuOpen}
						isScrolled={isScrolled}
						talkToSalesOpen={talkToSalesOpen}
						setMobileMenuOpen={setMobileMenuOpen}
						setTalkToSalesOpen={setTalkToSalesOpen}
						panelHoverHandlers={panelHoverHandlers}
					/>
				</Suspense>
			)}

			{searchMounted && (
				<Suspense fallback={null}>
					<CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
				</Suspense>
			)}
		</>
	);
};
