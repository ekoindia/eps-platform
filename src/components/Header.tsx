import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { 
    label: "Products", 
    href: "#products",
    children: [
      { label: "Payment APIs", href: "#products" },
      { label: "Verification APIs", href: "#products" },
      { label: "Ekonic Platform", href: "#ekonic" },
      { label: "Eko Shield", href: "#shield" },
    ]
  },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Developers", href: "https://developers.eko.in", external: true },
  { label: "Pricing", href: "#" },
  { label: "Company", href: "#" },
];

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled 
          ? "bg-white/95 backdrop-blur-md shadow-sm py-3" 
          : "bg-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className={cn(
              "text-2xl font-bold transition-colors duration-300",
              isScrolled ? "text-eko-navy" : "text-white"
            )}>
              eko
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className={cn(
                  "text-sm font-medium transition-colors duration-200 flex items-center gap-1",
                  isScrolled 
                    ? "text-eko-slate hover:text-eko-navy" 
                    : "text-white/90 hover:text-white"
                )}
              >
                {link.label}
                {link.children && <ChevronDown className="w-4 h-4" />}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <Button 
              variant={isScrolled ? "ghost" : "hero-outline"} 
              size="sm"
              className={isScrolled ? "text-eko-navy" : ""}
            >
              Sign In
            </Button>
            <Button variant="gold" size="sm">
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
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
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className={cn(
                    "text-sm font-medium py-2",
                    isScrolled ? "text-eko-slate" : "text-white/90"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 mt-4">
                <Button variant={isScrolled ? "navy-outline" : "hero-outline"} size="sm">
                  Sign In
                </Button>
                <Button variant="gold" size="sm">
                  Get Started
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
