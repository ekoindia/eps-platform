import { useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ekoshieldMockup from "@/assets/ekoshield/ekoshield-imac-mockup-640x701.png";

/* ─── Types ─── */

export interface HeadlinePair {
  headline: string;
  subtext: string;
}

export interface EkoShieldAdBannerProps {
  /** Array of headline/subtext pairs — one is chosen at random on mount */
  headlines?: HeadlinePair[];
  cta?: {
    text?: string;
    /** Internal route path — uses React Router <Link> */
    href?: string;
    /** Callback if you prefer imperative navigation */
    onClick?: () => void;
  };
  className?: string;
}

/* ─── Default Content ─── */

export const DEFAULT_EKOSHIELD_HEADLINES: HeadlinePair[] = [
  {
    headline: "Need a Ready-Made Verification App?",
    subtext:
      "Skip building. Eko Shield gives you a complete KYC & compliance system out of the box.",
  },
  {
    headline: "Don’t Build Verification. Use It.",
    subtext:
      "Eko Shield is a fully-built app for KYC, compliance & onboarding workflows.",
  },
  {
    headline: "One App for All Your Verification Needs",
    subtext:
      "KYC, KYB, compliance & workflows — already built, ready to use.",
  },
  {
	headline: "Launch Verification Without Building It",
	subtext: "Eko Shield gives you a ready-to-use app with workflows, dashboards & compliance built in."
  }
];

/* ─── Component ─── */

const EkoShieldAdBanner = ({
  headlines = DEFAULT_EKOSHIELD_HEADLINES,
  cta,
  className,
}: EkoShieldAdBannerProps) => {
  const { headline, subtext } = useMemo(
    () => headlines[Math.floor(Math.random() * headlines.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const _cta = { text: "Explore Eko Shield", href: "/products/eko-shield", ...cta };

  const ctaElement = _cta.onClick ? (
    <Button id="btn-eko-shield-banner-cta" variant="gold" size="lg" className="group" onClick={_cta.onClick}>
      {_cta.text}
      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
    </Button>
  ) : (
	<Button id="btn-eko-shield-banner-cta" variant="gold" size="lg" className="group" asChild>
		<Link to={_cta.href}>
			{_cta.text}
			<ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
		</Link>
    </Button>
  );

  return (
    <section
      ref={sectionRef}
      style={{ opacity: 0, transform: "translateY(20px)", transition: "opacity 0.5s ease-out, transform 0.5s ease-out" }}
      className={cn(
        "relative w-full overflow-hidden py-14 md:py-20",
        "bg-[linear-gradient(135deg,#672458_0%,#1a1240_50%,#0d1b3e_100%)]",
        className
      )}
    >
      {/* ── Subtle tile / grid pattern overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(255,255,255,0.5) 28px,rgba(255,255,255,0.5) 29px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 28px,rgba(255,255,255,0.5) 28px,rgba(255,255,255,0.5) 29px)",
        }}
      />

      {/* ── Ambient glows ── */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* ── Content ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center md:pr-[340px] lg:pr-[420px]">
          <div className="flex flex-col gap-5 max-w-xl">
            {/* Icon badge */}
            <div className="w-13 h-13 w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <Shield className="w-7 h-7 text-eko-gold" />
            </div>

            {/* Text */}
            <div className="space-y-2.5">
              <h3 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                {headline}
              </h3>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                {subtext}
              </p>
            </div>

            {/* CTA */}
            <div>{ctaElement}</div>
          </div>
        </div>
      </div>

      {/* ── Mockup image (desktop only) ── */}
      {/* CSS mask fades left edge & bottom — no opaque overlay needed since PNG is transparent */}
      <div
        className="hidden md:block absolute inset-y-0 right-0 w-[55%] pointer-events-none select-none"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 28%), linear-gradient(to top, transparent 0%, black 28%)",
          maskComposite: "intersect",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 28%), linear-gradient(to top, transparent 0%, black 28%)",
          WebkitMaskComposite: "source-in",
        }}
      >
        <img
          src={ekoshieldMockup}
          alt="Eko Shield dashboard mockup"
          width={640}
          height={701}
          className="absolute bottom-0 right-0 h-[130%] w-auto object-contain object-right-bottom"
          loading="lazy"
        />
      </div>
    </section>
  );
};

export default EkoShieldAdBanner;
