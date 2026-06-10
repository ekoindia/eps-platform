import { CodeBlock, exampleApiCode } from "@/components/CodeBlock";
import { FadeIn } from "@/components/FadeIn";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { Button } from "@/components/ui/button";
import { openZohoChat } from "@/lib/zoho-chat";
import { ArrowRight, ChevronDown } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-eko-navy hero-gradient" />

        {/* SVG background pattern — dot grid + API flow lines + network nodes */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            {/* Repeating dot grid */}
            <pattern
              id="hero-dots"
              x="0"
              y="0"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#fbb11b" opacity="0.10" />
            </pattern>
            {/* Fine square grid lines */}
            <pattern
              id="hero-grid"
              x="0"
              y="0"
              width="96"
              height="96"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 96 0 L 0 0 0 96"
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Dot grid layer */}
          <rect width="1440" height="900" fill="url(#hero-dots)" />
          {/* Grid lines layer */}
          <rect width="1440" height="900" fill="url(#hero-grid)" />

          {/* Diagonal API data-flow lines */}
          <g fill="none" stroke="#fbb11b">
            <path
              d="M -50 750 C 200 580 480 640 740 460 S 1090 260 1440 190"
              strokeWidth="1"
              opacity="0.07"
            />
            <path
              d="M -80 870 C 160 710 420 770 690 590 S 1040 390 1440 330"
              strokeWidth="0.75"
              opacity="0.05"
            />
            <path
              d="M  80 900 C 340 750 640 810 900 630 S 1210 430 1440 410"
              strokeWidth="0.5"
              opacity="0.04"
            />
            <path
              d="M-100 580 C 160 450 430 500 690 340 S 1010 160 1440 100"
              strokeWidth="1"
              opacity="0.06"
            />
          </g>
        </svg>
      </div>

      {/* Floating Elements */}
      <div className="hidden lg:block absolute top-1/4 left-10 w-64 h-64 bg-eko-gold/15 rounded-full blur-3xl animate-float" />
      <div className="hidden lg:block absolute bottom-1/4 right-10 w-96 h-96 bg-eko-gold/20 rounded-full blur-3xl animate-float animation-delay-200" />

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left">
            <FadeIn
              onView={false}
              delay={100}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-xs mb-6">
                <span className="w-2 h-2 rounded-full bg-eko-gold animate-pulse-soft" />
                <span className="text-white/80 text-sm font-medium">
                  Trusted by 50,000+ businesses
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
                APIs & Platform for MSMEs to Scale Their{" "}
                <span className="text-gradient-gold">Business</span> Everyday
              </h1>
            </FadeIn>

            <FadeIn onView={false} delay={200}>
              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                BC, Identity, Payment & Collection solutions & APIs for MSMEs to
                scale their business across Tier-2 and beyond.
              </p>
            </FadeIn>

            <FadeIn onView={false} delay={300}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  id="btn-explore-apis-section-hero"
                  variant="gold"
                  size="xl"
                  className="group"
                  onClick={() =>
                    document
                      .getElementById("products")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore APIs
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  id="btn-chat-section-hero"
                  variant="hero-outline"
                  size="xl"
                  onClick={() => openZohoChat()}
                >
                  Talk to Sales
                </Button>
              </div>
            </FadeIn>

            {/* Trust Badges */}
            <FadeIn onView={false} delay={400}>
              <TrustStrip
                className="mt-12 flex flex-wrap items-center gap-6 justify-center lg:justify-start"
                itemClassName="flex items-center gap-2 text-white/60 text-sm"
                items={[
                  {
                    label: "RBI compliant",
                    icon: (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M9 12l2 2 4-4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: "Reliable, high-volume workflows",
                    icon: (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 6v6l4 2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                  },
                ]}
              />
            </FadeIn>
          </div>

          {/* Right: Code Preview */}
          <FadeIn onView={false} delay={500} className="hidden lg:block">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-eko-gold/10 rounded-2xl blur-2xl" />

              <CodeBlock
                code={exampleApiCode}
                fileName="verify.js"
                className="relative"
              />

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -right-4 bg-card rounded-xl p-4 shadow-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-eko-gold-light flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-eko-gold"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Verified
                  </div>
                  <div className="text-xs text-eko-slate">PAN: ABCDE1234F</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Scroll Indicator */}
      <button
        className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex-col items-center cursor-pointer group"
        onClick={() =>
          window.scrollBy({ top: window.innerHeight, behavior: "smooth" })
        }
        aria-label="Scroll down"
      >
        <span className="text-white/30 text-[10px] font-medium tracking-widest uppercase mb-1 group-hover:text-white/50 transition-colors">
          Scroll
        </span>
        <ChevronDown className="w-5 h-5 text-white/40 animate-chevron-scroll group-hover:text-white/60 transition-colors" />
        <ChevronDown
          className="w-5 h-5 -mt-2 text-white/20 animate-chevron-scroll group-hover:text-white/40 transition-colors"
          style={{ animationDelay: "300ms" }}
        />
      </button>
    </section>
  );
};
