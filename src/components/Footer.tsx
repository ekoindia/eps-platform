import { Link } from "react-router-dom";
import { 
  ChevronRight, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Youtube,
  Mail,
  MapPin,
  Phone
} from "lucide-react";
import { EkoLogo } from "@/components/EkoLogo";

const footerLinks = {
  products: [
    { label: "Payment APIs", href: "#products" },
    { label: "Verification APIs", href: "#products" },
    { label: "Eko Shield", href: "#shield" },
  ],
  developers: [
    { label: "Documentation", href: "https://developers.eko.in", external: true },
    { label: "API Reference", href: "https://developers.eko.in", external: true },
    { label: "SDKs & Libraries", href: "https://developers.eko.in", external: true },
    { label: "Sandbox", href: "https://developers.eko.in", external: true },
  ],
  company: [
    { label: "About Us", href: "/about-us", internal: true },
    { label: "Grievance", href: "/grievance", internal: true },
    { label: "Blog", href: "#" },
    { label: "Press", href: "#" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy", internal: true },
    { label: "Terms & Conditions", href: "/tnc", internal: true },
    { label: "Refund Policy", href: "/refund-policy", internal: true },
    { label: "Compliance", href: "#compliance" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

export const Footer = () => {
  return (
    <footer className="bg-eko-navy text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <div className="mb-6">
              <EkoLogo className="h-8 w-auto" isLight />
            </div>
            <p className="text-white/70 mb-6 max-w-sm leading-relaxed">
              Powering India's financial infrastructure with secure, 
              scalable APIs for payments, identity, and verification.
            </p>
            <div className="space-y-3 text-sm">
              <a href="mailto:support@eko.in" className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Mail className="w-4 h-4 text-eko-gold" />
                <span>support@eko.in</span>
              </a>
              <a href="tel:+911144444444" className="flex items-center gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <Phone className="w-4 h-4 text-eko-gold" />
                <span>+91 11 4444 4444</span>
              </a>
              <a href="https://maps.google.com/?q=New+Delhi+India" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-white/70 hover:text-eko-gold transition-colors cursor-pointer">
                <MapPin className="w-4 h-4 text-eko-gold mt-0.5" />
                <span>New Delhi, India</span>
              </a>
            </div>
            {/* Social Links */}
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
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
                  <a 
                    href={link.href}
                    className="text-white/70 hover:text-eko-gold transition-colors text-sm flex items-center gap-1 group cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.label}
                  </a>
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
