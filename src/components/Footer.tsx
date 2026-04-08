import { Link } from "react-router-dom";
import {
  ChevronRight,
  Facebook,
  Linkedin,
  Youtube,
  Instagram,
  Mail,
  MapPin,
  Phone
} from "lucide-react";
import { EkoLogo } from "@/components/EkoLogo";

const footerLinks = {
  products: [
    { label: "BC APIs", href: "#products" },
    { label: "Payments APIs", href: "#products" },
    // { label: "Collection APIs", href: "#products" },
    { label: "Verification APIs", href: "#products" },
    { label: "Eko Shield", href: "/products/eko-shield", internal: true },
  ],
  developers: [
    { label: "Documentation", href: "https://developers.eko.in", external: true },
    { label: "Guides", href: "https://developers.eko.in/docs", external: true },
    { label: "API Reference", href: "https://developers.eko.in/reference", external: true },
    // { label: "SDKs & Libraries", href: "https://developers.eko.in", external: true },
    // { label: "Sandbox", href: "https://developers.eko.in", external: true },
  ],
  company: [
    { label: "About Us", href: "/about-us", internal: true },
    { label: "Grievance", href: "/grievance", internal: true },
    // { label: "Blogs & Media", href: "/blogs-media", internal: true },
    { label: "Signup", href: "/signup", internal: true },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy", internal: true },
    { label: "Terms & Conditions", href: "/tnc", internal: true },
    { label: "Refund Policy", href: "/refund-policy", internal: true },
    { label: "Compliance", href: "#compliance" },
  ],
  industries: [
    { label: "Lending & NBFCs", href: "/industries/lending-nbfc", internal: true },
    { label: "Microfinance", href: "/industries/microfinance", internal: true },
    { label: "Insurance", href: "/industries/insurance", internal: true },
    { label: "Agent Networks", href: "/industries/agent-networks-csp", internal: true },
    { label: "All Industries", href: "/industries", internal: true },
  ],
  solutions: [
    { label: "Assisted Banking Pack", href: "/solutions/assisted-banking-agent-pack", internal: true },
    { label: "Lending KYC Pack", href: "/solutions/lending-kyc-pack", internal: true },
    { label: "Merchant Onboarding", href: "/solutions/merchant-onboarding-pack", internal: true },
    { label: "MFI Operations", href: "/solutions/mfi-field-operations-pack", internal: true },
    { label: "All Solutions", href: "/solutions", internal: true },
  ],
};

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const socialLinks = [
  { icon: Linkedin, href: "https://www.linkedin.com/company/eko-bharat-ventures/", label: "LinkedIn" },
  { icon: Instagram, href: "https://www.instagram.com/eko__India", label: "Instagram" },
  { icon: Facebook, href: "https://www.facebook.com/EkoEPS", label: "Facebook" },
  { icon: Youtube, href: "https://www.youtube.com/@eko_india", label: "YouTube" },
  { icon: XIcon, href: "https://x.com/ekospeaks", label: "X" },
];

export const Footer = () => {
  return (
    <footer className="bg-eko-navy text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 lg:gap-6">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="mb-3">
              <EkoLogo className="h-16 w-auto" />
            </div>
            <p className="text-white/70 mb-1 max-w-sm leading-relaxed text-sm text-justify">
              By <a href="https://eko.in" className="font-bold hover:underline" target="_blank">Eko Bharat Ventures Private Limited</a>
            </p>
            <p className="text-white/70 mb-6 max-w-sm leading-relaxed text-sm text-justify italic">
              “Grow every entrepreneur daily”
            </p>
            <div className="space-y-3 text-sm">
              <a href="mailto:eps@eko.in" className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Mail className="w-4 h-4 text-eko-gold" />
                <span>eps@eko.in</span>
              </a>
              <a href="tel:+919513181707" className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Phone className="w-4 h-4 text-eko-gold" />
                <span>+91 951 318 1707</span>
              </a>
              <a href="https://share.google/WoimNHTmqaNqJnKxs" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <MapPin className="w-4 h-4 text-eko-gold mt-0.5" />
                <span>68, Phase IV, Udyog Vihar, Sector 18, Gurugram, Haryana 122015</span>
              </a>
            </div>
            {/* Social Links */}
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-eko-gold hover:text-eko-navy transition-all duration-300 cursor-pointer"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold text-white mb-4">Products</h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.label}>
                  {'internal' in link && link.internal ? (
                    <Link
                      to={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="font-semibold text-white mb-4">Industries</h4>
            <ul className="space-y-3">
              {footerLinks.industries.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="font-semibold text-white mb-4">Solutions</h4>
            <ul className="space-y-3">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="font-semibold text-white mb-4">Developers</h4>
            <ul className="space-y-3">
              {footerLinks.developers.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  {'internal' in link && link.internal ? (
                    <Link
                      to={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  {'internal' in link && link.internal ? (
                    <Link
                      to={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-white/60 text-sm text-center">
            © {new Date().getFullYear()} Eko Bharat Ventures Private Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
