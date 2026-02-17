import { SectionContainer } from "@/components/SectionContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Clock, Send, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ApiField {
  label: string;
  value: string;
  icon?: LucideIcon;
}

interface ApiInputOutputPreviewProps {
  apiName: string;
  inputs: ApiField[];
  outputs: ApiField[];
  comingSoon?: boolean;
  docsUrl: string;
}

export const ApiInputOutputPreview = ({
  apiName,
  inputs,
  outputs,
  comingSoon = false,
  docsUrl,
}: ApiInputOutputPreviewProps) => {
  if (comingSoon) {
    return (
      <SectionContainer className="bg-muted/30">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {apiName} API Input & Output Preview
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Send simple inputs. Get rich, verified data in seconds.
          </p>
        </div>
        <div className="max-w-md mx-auto text-center py-16 bg-card border border-border/50 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="text-sm px-4 py-1.5 mb-3">Coming Soon</Badge>
          <p className="text-muted-foreground text-sm mt-2">
            This API preview will be available shortly.
          </p>
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer className="bg-muted/30">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {apiName} API Input & Output Preview
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Send simple inputs. Get rich, verified data in seconds.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Input Card */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-6 py-4 bg-eko-navy">
            <Send className="w-4 h-4 text-white/70" />
            <Badge className="bg-white/20 text-white border-0 text-xs font-semibold tracking-wider">
              REQUEST
            </Badge>
            <span className="text-white/60 text-xs ml-auto font-mono">POST /verify</span>
          </div>
          <div className="p-6 space-y-4">
            {inputs.map((field, i) => {
              const Icon = field.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <div className="flex-1 flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm text-muted-foreground">{field.label}</span>
                    <span className="text-sm font-mono font-medium text-foreground bg-muted/50 px-3 py-1 rounded-md">
                      {field.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Output Card */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-eko-success/90 to-eko-success">
            <Download className="w-4 h-4 text-white/70" />
            <Badge className="bg-white/20 text-white border-0 text-xs font-semibold tracking-wider">
              RESPONSE
            </Badge>
            <span className="text-white/60 text-xs ml-auto font-mono">200 OK</span>
          </div>
          <div className="p-6 space-y-3">
            {outputs.map((field, i) => {
              const Icon = field.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  {Icon ? (
                    <Icon className="w-4 h-4 text-eko-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-eko-success flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 flex items-start justify-between gap-4 py-1">
                    <span className="text-sm text-muted-foreground">{field.label}</span>
                    <span className="text-sm font-mono font-medium text-foreground text-right">
                      {field.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Row */}
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        <Button variant="outline" asChild>
          <a href={docsUrl} target="_blank" rel="noopener noreferrer">
            View Sample Response
            <ArrowRight className="w-4 h-4" />
          </a>
        </Button>
        <Button variant="gold" asChild>
          <a href={docsUrl} target="_blank" rel="noopener noreferrer">
            Try in Demo
            <ArrowRight className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </SectionContainer>
  );
};
