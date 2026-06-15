import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
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
	const headers = resolveHeaders(spec);
	const requestParams = resolveRequestParams(spec);

	const pathParams = requestParams.filter((p) => p.in === "path");
	const queryParams = requestParams.filter((p) => p.in === "query");
	const bodyParams = requestParams.filter((p) => p.in === "body");

	return (
		<article>
			<header>
				<div className="flex items-center gap-2.5">
					<HttpMethodTag method={spec.method} className="text-xs" />
					<code className="break-all font-mono text-sm text-muted-foreground">
						{spec.path}
					</code>
				</div>
				<h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
					{spec.name}
				</h1>
				<p className="mt-2 text-base text-muted-foreground">{spec.summary}</p>
				<div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 font-mono text-xs text-muted-foreground">
					<span className="rounded bg-eko-gold-light px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-eko-navy dark:bg-eko-gold/15 dark:text-eko-gold">
						UAT
					</span>
					<span className="text-foreground/70">Base URL</span>
					<span className="break-all">{DEFAULT_BASE_URL}</span>
				</div>
			</header>

			{spec.description && (
				<p className="mt-6 text-[0.9375rem] leading-relaxed text-foreground/80">
					{spec.description}
				</p>
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
