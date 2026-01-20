import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { CodeBlock, examplePaymentCode, exampleIntegrationSteps } from "@/components/CodeBlock";
import { ArrowRight, Code, Key, Zap } from "lucide-react";

const stepIcons = [Code, Key, Zap];

export const DeveloperSection = () => {
  return (
    <SectionContainer variant="muted" id="developers">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Content */}
        <div>
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-eko-gold-light text-eko-navy">
            For Developers
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Build with Confidence
          </h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Comprehensive documentation, SDKs, and sandbox environments to help you 
            integrate Eko APIs in minutes, not weeks.
          </p>

          {/* Integration Steps */}
          <div className="space-y-6 mb-10">
            {exampleIntegrationSteps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <div key={step.step} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-eko-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-eko-gold">STEP {step.step}</span>
                      <span className="font-semibold text-foreground">{step.title}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="gold" size="lg" asChild>
            <a href="https://developers.eko.in" target="_blank" rel="noopener noreferrer">
              Go to Developer Docs
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {/* Right: Code Block */}
        <div className="relative">
          <div className="absolute -inset-4 bg-eko-gold/5 rounded-2xl blur-2xl" />
          <CodeBlock 
            code={examplePaymentCode} 
            fileName="transfer.js"
            className="relative"
          />
        </div>
      </div>
    </SectionContainer>
  );
};
