import { Link } from "react-router-dom";
import {
  Mail,
  MapPin,
  Phone
} from "lucide-react";
import { EkoLogo } from "@/components/EkoLogo";
import { SALES_MOBILE, SOCIAL_LINKS } from "@/lib/config/site";
import { formatMobile } from "@/lib/utils";
import { FaFacebookF, FaLinkedinIn, FaInstagram, FaYoutube } from "react-icons/fa";
import { XIcon } from "@/components/icons/XIcon";

/**
 * MARK: Links Data
 */
const footerLinks = {
  products: [
    { label: "Verification APIs", href: "/products#verification", internal: true },
    { label: "Payments APIs", href: "/products#payment", internal: true },
    // { label: "Collection APIs", href: "/products" },
    { label: "BC APIs", href: "/products#bc", internal: true },
    // { label: "Eko Shield", href: "/products/eko-shield", internal: true },
    { label: "All APIs", href: "/products", internal: true },
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

/**
 * Discriminated union covering internal (React Router), external (new tab), and plain anchor link variants.
 */
type FooterLinkItem =
  | { label: string; href: string; internal: true }
  | { label: string; href: string; external: true }
  | { label: string; href: string };

/**
 * Renders the correct anchor variant (`<Link>`, `<a target="_blank">`, or plain `<a>`) with a subtle hover nudge.
 */
const FooterLink = ({ link }: { link: FooterLinkItem }) => {
  const className =
    "text-white/70 hover:text-eko-gold text-sm inline-block hover:translate-x-1 transition-all duration-200 cursor-pointer";

  if ("internal" in link && link.internal) {
    return (
      <Link to={link.href} className={className}>
        {link.label}
      </Link>
    );
  }

  return (
    <a
      href={link.href}
      target={"external" in link && link.external ? "_blank" : undefined}
      rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
      className={className}
    >
      {link.label}
    </a>
  );
};

/**
 * Titled `<h4>` + `<ul>` column that maps a list of {@link FooterLinkItem} entries through {@link FooterLink}.
 */
const FooterColumn = ({ title, links }: { title: string; links: FooterLinkItem[] }) => (
  <div>
    <h4 className="font-semibold text-white mb-4">{title}</h4>
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={link.label}>
          <FooterLink link={link} />
        </li>
      ))}
    </ul>
  </div>
);

const socialLinks = [
  { icon: FaLinkedinIn, href: SOCIAL_LINKS.linkedin, label: "LinkedIn" },
  { icon: FaFacebookF, href: SOCIAL_LINKS.facebook, label: "Facebook" },
  { icon: FaInstagram, href: SOCIAL_LINKS.instagram, label: "Instagram" },
  { icon: FaYoutube, href: SOCIAL_LINKS.youtube, label: "YouTube" },
  { icon: XIcon, href: SOCIAL_LINKS.x, label: "X" },
];

export const Footer = () => {
  return (
    <footer className="bg-eko-navy text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 lg:gap-6">

          {/*
            MARK: About Eko
          */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="mb-3">
              <EkoLogo className="h-16 w-auto" />
            </div>
            <p className="text-white/70 mb-1 max-w-sm leading-relaxed text-sm text-justify">
              By <a href="https://eko.in" className="font-bold hover:underline" target="_blank">Eko Bharat Ventures Pvt. Ltd.</a>
            </p>
            <p className="text-white/70 mb-6 max-w-sm leading-relaxed text-sm text-justify italic">
              “Grow every entrepreneur daily”
            </p>
            <div className="space-y-3 text-sm">
              <a href="mailto:eps@eko.in" className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Mail className="w-4 h-4 text-eko-gold" />
                <span>eps@eko.in</span>
              </a>
              <a id="lnk-sales-phone-footer" href={`tel:+91${SALES_MOBILE}`} className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Phone className="w-4 h-4 text-eko-gold" />
                <span>{formatMobile(SALES_MOBILE)}</span>
              </a>
              <a href="https://share.google/WoimNHTmqaNqJnKxs" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <MapPin className="w-4 min-w-4 h-4 text-eko-gold mt-0.5" />
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

          {/*
            MARK: Columns
          */}
          <FooterColumn title="Products" links={footerLinks.products} />

          <FooterColumn title="Solutions" links={footerLinks.solutions} />

          <FooterColumn title="Industries" links={footerLinks.industries} />

          <FooterColumn title="Developers" links={footerLinks.developers} />

          <FooterColumn title="Legal" links={footerLinks.legal} />

          <FooterColumn title="Company" links={footerLinks.company} />

        </div>
      </div>

      {/*
        MARK: Bottom Bar
      */}
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
