import { ArrowRight } from "lucide-react";

import { FadeIn } from "@/components/FadeIn";
import type { IntegrationStep } from "@/components/ProductPageLayout";
import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";

interface IntegrationStepperSectionProps {
  integrationSteps: IntegrationStep[];
  docsUrl: string;
}

/**
 * "How to Integrate" stepper. Renders a single, SEO-friendly DOM structure
 * (each step's text appears once) that adapts via CSS: a vertical stepper on
 * mobile (number left, content right) and a horizontal stepper on desktop
 * (number above content). The connector line flips axis with `flex-1`, growing
 * vertically inside the mobile `flex-col` track and horizontally inside the
 * desktop `md:flex-row` track.
 */
export const IntegrationStepperSection = ({
  integrationSteps,
  docsUrl,
}: IntegrationStepperSectionProps) => {
  return (
    <SectionContainer className="bg-eko-navy">
      <FadeIn className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          How to Integrate
        </h2>
        <p className="text-white/70 max-w-2xl mx-auto">
          Get started in minutes with our simple integration process
        </p>
      </FadeIn>

      <ol className="flex flex-col md:flex-row md:items-start md:justify-center max-w-sm md:max-w-4xl mx-auto">
        {integrationSteps.map((step, i) => {
          const isLast = i === integrationSteps.length - 1;
          return (
            <FadeIn
              key={i}
              as="li"
              delay={i * 150}
              className="flex flex-1 gap-4 md:flex-col md:items-center md:text-center"
            >
              {/* Marker + connector track: vertical on mobile, horizontal on desktop */}
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <div className="flex h-10 w-10 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-eko-gold font-bold text-eko-navy text-sm md:text-lg">
                  {i + 1}
                </div>
                {!isLast && (
                  <div className="bg-white/20 w-0.5 flex-1 mt-2 md:mt-0 md:ml-2 md:h-0.5 md:w-auto" />
                )}
              </div>

              {/* Content — rendered once */}
              <div className="pb-6 md:pb-0 md:mt-3 md:max-w-[140px]">
                <h3 className="text-sm font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-white/70 text-xs mt-1">{step.desc}</p>
                {step.tip && (
                  <p className="text-eko-gold/80 text-xs mt-1 italic">
                    {step.tip}
                  </p>
                )}
              </div>
            </FadeIn>
          );
        })}
      </ol>

      <div className="text-center mt-10">
        <Button variant="gold" size="lg" asChild>
          <a href={docsUrl} target="_blank" rel="noopener noreferrer">
            View Documentation
            <ArrowRight className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </SectionContainer>
  );
};
