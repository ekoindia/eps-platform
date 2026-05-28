import { useEffect, useState } from "react";
import { FadeIn } from "@/components/FadeIn";
import { SectionContainer } from "@/components/SectionContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle, ArrowRight, Clock, Send, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, normalizeApiLabel } from "@/lib/utils";
import { ApiProductRelevance } from "@/lib/data/api-products";
import { API_DEFAULT_VERSION } from "@/lib/config/site";

export interface ApiField {
  label: string;
  value: string;
  icon?: LucideIcon;
}

export interface ApiSampleJson {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  apiVersion?: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface ApiPreviewItem {
  apiName: string;
  description?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  endpoint?: string;
  inputs?: ApiField[];
  outputs?: ApiField[];
  comingSoon?: boolean;
  docsUrl?: string;
  relevance?: ApiProductRelevance;
  bestFor?: string;
  sampleJson?: ApiSampleJson;
}

// MARK: API Type
interface ApiInputOutputPreviewProps {
  apiName: string;
  inputs?: ApiField[];
  outputs?: ApiField[];
  comingSoon?: boolean;
  docsUrl?: string;
  previews?: ApiPreviewItem[];
  activeApiName?: string;
  sampleJson?: ApiSampleJson;
}

const JsonHighlight = ({ json }: { json: Record<string, unknown> }) => {
  const indent = (depth: number) => "  ".repeat(depth);

  const renderValue = (value: unknown, depth: number): JSX.Element => {
    if (value === null) return <span className="text-sky-400">null</span>;
    if (typeof value === "string") return <span className="text-emerald-400">"{value}"</span>;
    if (typeof value === "boolean") return <span className="text-sky-400">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-amber-400">{value}</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-white/60">[]</span>;
      return (
        <>
          <span className="text-white/60">[</span>{"\n"}
          {value.map((item, i) => (
            <span key={i}>
              {indent(depth + 1)}{renderValue(item, depth + 1)}
              {i < value.length - 1 && <span className="text-white/60">,</span>}
              {"\n"}
            </span>
          ))}
          {indent(depth)}<span className="text-white/60">]</span>
        </>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span className="text-white/60">{"{}"}</span>;
      return (
        <>
          <span className="text-white/60">{"{"}</span>{"\n"}
          {entries.map(([key, val], i) => (
            <span key={key}>
              {indent(depth + 1)}<span className="text-purple-400">"{key}"</span>
              <span className="text-white/60">: </span>
              {renderValue(val, depth + 1)}
              {i < entries.length - 1 && <span className="text-white/60">,</span>}
              {"\n"}
            </span>
          ))}
          {indent(depth)}<span className="text-white/60">{"}"}</span>
        </>
      );
    }

    return <span className="text-white">{String(value)}</span>;
  };

  return (
    <pre className="text-sm leading-relaxed font-mono p-5 overflow-x-auto">
      {renderValue(json, 0)}
    </pre>
  );
};

const TerminalHeader = ({ label, badgeText }: { label: string; badgeText: string }) => (
  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
    <div className="flex gap-1.5">
      <span className="w-3 h-3 rounded-full bg-red-500/80" />
      <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
      <span className="w-3 h-3 rounded-full bg-green-500/80" />
    </div>
    <Badge className="bg-white/10 text-white/70 border-0 text-[10px] font-mono ml-auto">{badgeText}</Badge>
    <span className="text-white/40 text-xs font-mono">{label}</span>
  </div>
);



/**
 * Section heading
 * MARK: Header
 * @param {string} apiName - The name of the API for which the preview is coming soon, e.g. "GST Verification". Used in the message to users.
 * @returns
 */
const SectionHeader = ({ title, description, className = "mb-10" }: { title: string; description?: string; className?: string }) => {
  const label = normalizeApiLabel(title) + " Flow – Sample Request and Response";

  return (
    <FadeIn className={`text-center ${className}`}>
      <span className={cn(
        "inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4",
        "bg-primary/20 text-amber-700"
      )}>
        Simplified API Preview
      </span>
      <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 max-w-[650px] text-center mx-auto">
        {label}
      </h2>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        Send simple inputs. Get rich, verified data in seconds.
      </p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-2">{description}</p>
      )}
    </FadeIn>
  );
};

/**
 * Placeholder component to show when an API preview is not yet available. Displays a "Coming Soon" message with the API name.
 * MARK: Coming Soon
 * @param {string} apiName - The name of the API for which the preview is coming soon, e.g. "GST Verification". Used in the message to users.
 * @returns {JSX.Element} The rendered component.
 */
const ComingSoonBlock = ({ apiName }: { apiName: string }) => (
  <div className="max-w-md mx-auto text-center py-16 bg-card border border-border/50 rounded-2xl">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
      <Clock className="w-8 h-8 text-muted-foreground" />
    </div>
    <Badge variant="secondary" className="text-sm px-4 py-1.5 mb-3">Coming Soon</Badge>
    <p className="text-muted-foreground text-sm mt-2">
      {apiName} preview will be available shortly.
    </p>
  </div>
);

export const ApiInputOutputPreview = ({
  apiName,
  inputs,
  outputs,
  comingSoon = false,
  docsUrl,
  previews,
  activeApiName,
  sampleJson,
}: ApiInputOutputPreviewProps) => {
  // Multi-API mode: render with sub-API selector
  if (previews && previews.length > 0) {
    // If only one preview, render it directly without selector
    if (previews.length === 1) {
      const p = previews[0];
      return (
        <SingleApiPreview
          apiName={p.apiName}
          description={p.description}
          inputs={p.inputs}
          outputs={p.outputs}
          comingSoon={p.comingSoon}
          docsUrl={p.docsUrl || docsUrl}
          sectionTitle={apiName}
          sampleJson={p.sampleJson}
        />
      );
    }

    return <MultiApiPreview previews={previews} sectionTitle={apiName} fallbackDocsUrl={docsUrl} activeApiName={activeApiName} />;
  }

  // Legacy single-API mode
  return (
    <SingleApiPreview
      apiName={apiName}
      inputs={inputs}
      outputs={outputs}
      comingSoon={comingSoon}
      docsUrl={docsUrl}
      sectionTitle={apiName}
      sampleJson={sampleJson}
    />
  );
};

/**
 * Component to display input/output previews for multiple related APIs under a single section. Renders a selector if more than 1 API is provided.
 * MARK: Multi-APIs
 * @param {Array} previews - List of API preview items to display, each with its own name, description, inputs, outputs, and docs URL.
 * @param {string} sectionTitle - The main title for the section, e.g. "KYC Verification". Individual APIs will be listed under this umbrella.
 * @param {string} fallbackDocsUrl - Optional URL to use for "View Sample Response" and "Try in Demo" buttons if an individual API doesn't provide its own docsUrl.
 * @returns {JSX.Element} The rendered component.
 */
const MultiApiPreview = ({
  previews,
  sectionTitle,
  fallbackDocsUrl,
  activeApiName,
}: {
  previews: ApiPreviewItem[];
  sectionTitle: string;
  fallbackDocsUrl?: string;
  activeApiName?: string;
}) => {
  const [activeApi, setActiveApi] = useState(previews[0].apiName);
  const activePreview = previews.find(p => p.apiName === activeApi) || previews[0];

  useEffect(() => {
    if (activeApiName && previews.some(p => p.apiName === activeApiName)) {
      setActiveApi(activeApiName);
    }
  }, [activeApiName, previews]);

  return (
    <SectionContainer className="bg-muted/30">
      <SectionHeader title={sectionTitle} className="mb-8" />

      {/* Sub-API Selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex flex-wrap justify-center gap-2 p-1.5 bg-card border border-border/90 rounded-xl">
          {previews.map(p => (
            <button
              key={p.apiName}
              onClick={() => setActiveApi(p.apiName)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeApi === p.apiName
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {normalizeApiLabel(p.apiName)}
            </button>
          ))}
        </div>
      </div>

      {/* Active API description */}
      {activePreview.description && (
        <FadeIn key={activePreview.apiName + "-desc"} className="text-center mb-6">
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">{activePreview.description}</p>
        </FadeIn>
      )}

      {/* Render active preview content */}
      {activePreview.comingSoon ? (
        <ComingSoonBlock apiName={activePreview.apiName} />
      ) : activePreview.outputs && activePreview.outputs.length ? (
        <PreviewContent
          key={activePreview.apiName}
          inputs={activePreview.inputs}
          outputs={activePreview.outputs}
          docsUrl={activePreview.docsUrl || fallbackDocsUrl}
          endpoint={activePreview.endpoint}
          sampleJson={activePreview.sampleJson}
        />
      ) : null}
    </SectionContainer>
  );
};

/**
 * Component to display input/output preview for a single API. If comingSoon is true, shows a placeholder instead. Otherwise, shows tabs for visual and JSON views of the request/response.
 * MARK: Single API
 * @param {string} apiName - The name of the API, e.g. "GST Verification". Used in the section title and docs links.
 * @param {string} description - Optional description to show under the section title.
 * @param {Array} inputs - List of input fields to display in the request preview, each with a label, value, and optional icon.
 * @param {Array} outputs - List of output fields to display in the response preview, each with a label, value, and optional icon.
 * @param {boolean} comingSoon - If true, shows a "Coming Soon" placeholder instead of the preview content.
 * @param {string} docsUrl - Optional URL for the "View Sample Response" and "Try in Demo" buttons. If not provided, buttons won't be shown.
 * @param {string} sectionTitle - The main title for the section, e.g. "GST Verification". Displayed above the preview content.
 * @returns {JSX.Element} The rendered component.
 */
const SingleApiPreview = ({
  apiName,
  description,
  inputs,
  outputs,
  comingSoon = false,
  docsUrl,
  sectionTitle,
  sampleJson,
}: {
  apiName: string;
  description?: string;
  inputs?: ApiField[];
  outputs?: ApiField[];
  comingSoon?: boolean;
  docsUrl?: string;
  sectionTitle: string;
  sampleJson?: ApiSampleJson;
}) => {
  if (comingSoon) {
    return (
      <SectionContainer className="bg-muted/30">
        <SectionHeader title={sectionTitle} className="mb-8" />
        <ComingSoonBlock apiName={apiName} />
      </SectionContainer>
    );
  }

  if (!outputs || outputs.length < 1) return null;

  return (
    <SectionContainer className="bg-muted/30">
      <SectionHeader title={sectionTitle} description={description} />
      <PreviewContent inputs={inputs} outputs={outputs} docsUrl={docsUrl} sampleJson={sampleJson} />
    </SectionContainer>
  );
};

/**
 * Component to render the visual and JSON previews of API inputs and outputs. Displays tabs to switch between the two views. The visual view shows a stylized request/response card with icons, while the JSON view shows the raw request/response in a syntax-highlighted format.
 * MARK: Content
 * @param {Array} inputs - List of input fields to display in the request preview, each with a label, value, and optional icon.
 * @param {Array} outputs - List of output fields to display in the response preview, each with a label, value, and optional icon.
 * @param {string} docsUrl - Optional URL for the "View Sample Response" and "Try in Demo" buttons. If not provided, buttons won't be shown.
 * @param {string} endpoint - Optional API endpoint to display in the request card header. E.g. "/verify". If not provided, the endpoint is not shown.
 * @returns {JSX.Element} The rendered component.
 */
const PreviewContent = ({
  inputs,
  outputs,
  docsUrl,
  endpoint,
  sampleJson,
}: {
  inputs?: ApiField[];
  outputs?: ApiField[];
  docsUrl?: string;
  endpoint?: string;
  sampleJson?: ApiSampleJson;
}) => {
  const showJsonTab = !!sampleJson;

  return (
    <>
      <Tabs defaultValue="visual" className="max-w-5xl mx-auto">
        {showJsonTab && (
          <div className="flex justify-end mb-4">
            <TabsList className="h-8 bg-card/80 border border-border/90 rounded-md p-0.5 shadow-xs">
              <TabsTrigger
                value="visual"
                className="h-7 px-2.5 text-xs text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs"
              >
                Visual
              </TabsTrigger>
              <TabsTrigger
                value="json"
                className="h-7 px-2.5 text-xs text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs"
              >
                JSON
              </TabsTrigger>
            </TabsList>
          </div>
        )}

        {/* Visual View */}
        <TabsContent value="visual">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* MARK: REQUEST */}
            <FadeIn delay={100} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xs">
              <div className="flex items-center gap-3 px-6 py-4 bg-eko-navy">
                <Send className="w-4 h-4 text-white/70" />
                <Badge className="bg-white/20 text-white border-0 text-xs font-semibold tracking-wider">REQUEST</Badge>
                <span className="text-white/60 text-xs ml-auto font-mono">{endpoint ? `POST ${endpoint}` : ""}</span>
              </div>
              <div className="p-6 flex flex-col gap-4">
                {inputs?.map((field, i) => {
                  const Icon = field.icon;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
                        <span className="text-sm text-muted-foreground">{field.label}</span>
                        <span className="text-sm font-mono font-medium text-foreground bg-muted/50 px-3 py-1 rounded-md">{field.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>

            {/* MARK: RESPONSE */}
            <FadeIn delay={200} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xs">
              <div className="flex items-center gap-3 px-6 py-4 bg-linear-to-r from-eko-success/90 to-eko-success">
                <Download className="w-4 h-4 text-white/70" />
                <Badge className="bg-white/20 text-white border-0 text-xs font-semibold tracking-wider">RESPONSE</Badge>
                <span className="text-white/60 text-xs ml-auto font-mono">200 OK</span>
              </div>
              <div className="p-6 flex flex-col gap-3">
                {outputs?.map((field, i) => {
                  const Icon = field.icon;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      {Icon ? (
                        <Icon className="w-4 h-4 text-eko-success shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-eko-success shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 flex items-center justify-between gap-4 py-1">
                        <span className="text-sm text-muted-foreground">{field.label}</span>
                        <span className="text-sm font-mono font-medium text-foreground text-right">{field.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>
          </div>
        </TabsContent>

        {/* JSON View — only rendered when authentic sampleJson is provided */}
        {showJsonTab && (
          <TabsContent value="json">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="code-block rounded-2xl overflow-hidden">
                <TerminalHeader label={`${sampleJson.method} /${sampleJson.apiVersion ?? API_DEFAULT_VERSION}${sampleJson.endpoint}`} badgeText="REQUEST" />
                <JsonHighlight json={sampleJson.request} />
              </div>
              <div className="code-block rounded-2xl overflow-hidden">
                <TerminalHeader label="200 OK" badgeText="RESPONSE" />
                <JsonHighlight json={sampleJson.response} />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* CTA Row */}
      {docsUrl && (
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
      )}
    </>
  );
};
