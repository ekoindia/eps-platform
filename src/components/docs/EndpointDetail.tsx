import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	resolveHeaders,
	resolveRequestParams,
} from "@/lib/data/api-specs-common";
import { HttpMethodTag } from "./HttpMethodTag";
import { Params } from "./Params";
import { ResponseAccordion } from "./ResponseAccordion";

const DocsSection = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<section className="mt-10">
		<h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
			{title}
		</h2>
		{children}
	</section>
);

/**
 * Middle-pane renderer for an API endpoint. Everything is derived from the
 * shared resolvers over `api-specs.ts` — no data is duplicated here. Params are
 * shown as field lists split by location; responses as a collapsible accordion.
 * Pure / SSR-safe, so it prerenders fully.
 */
export const EndpointDetail = ({ spec }: { spec: ApiSpec }) => {
	const headers = resolveHeaders();
	const requestParams = resolveRequestParams(spec);

	const pathParams = requestParams.filter((p) => p.in === "path");
	const queryParams = requestParams.filter((p) => p.in === "query");
	const bodyParams = requestParams.filter((p) => p.in === "body");

	return (
		<article>
			<header>
				<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
					<HttpMethodTag
						method={spec.method}
						variant="solid"
						className="rounded-md px-2 py-1 text-sm"
					/>
					{spec.name}
				</h1>
				<p className="mt-2 text-base text-muted-foreground">{spec.summary}</p>
				<div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 font-mono text-xs text-muted-foreground">
					<HttpMethodTag method={spec.method} />
					<span className="break-all text-foreground/70">{spec.path}</span>
				</div>
			</header>

			{spec.description && (
				<div className="docs-inline-code-prose mt-6 text-[0.9375rem] leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-eko-navy [&_a]:underline dark:[&_a]:text-eko-gold [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						disallowedElements={["h1", "h2", "h3", "h4", "h5", "h6"]}
						unwrapDisallowed
					>
						{spec.description}
					</ReactMarkdown>
				</div>
			)}

			{pathParams.length > 0 && (
				<DocsSection title="Path parameters">
					<Params params={pathParams} />
				</DocsSection>
			)}

			{queryParams.length > 0 && (
				<DocsSection title="Query parameters">
					<Params params={queryParams} />
				</DocsSection>
			)}

			{bodyParams.length > 0 && (
				<DocsSection title="Body parameters">
					<Params params={bodyParams} />
				</DocsSection>
			)}

			<DocsSection title="Headers">
				<Params params={headers} />
			</DocsSection>

			<DocsSection title="Responses">
				<ResponseAccordion spec={spec} />
			</DocsSection>
		</article>
	);
};
