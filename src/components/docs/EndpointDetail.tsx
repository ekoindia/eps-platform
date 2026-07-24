import { useState } from "react";
import { Link } from "react-router-dom";
import { API_AUTH_DOCS_URL } from "@/lib/data/api-auth";
import { recipeHref, recipesForSpec } from "@/lib/data/api-recipes";
import type { ApiParam, ApiSpec } from "@/lib/data/api-specs-common";
import {
	resolveHeaders,
	resolveRequestParams,
} from "@/lib/data/api-specs-common";
import { resolveDescription } from "@/lib/data/endpoint-descriptions";
import { cn } from "@/lib/utils";
import { Callout } from "./Callout";
import { HttpMethodTag } from "./HttpMethodTag";
import { MarkdownProse } from "./MarkdownProse";
import { NextSteps } from "./NextSteps";
import { Params } from "./Params";
import { ResponseAccordion } from "./ResponseAccordion";
import { ResponseTypes } from "./ResponseTypes";

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

/** A group of request params rendered under its own sub-heading. */
const ParamGroup = ({
	title,
	params,
}: {
	title: string;
	params: ApiParam[];
}) =>
	params.length > 0 ? (
		<div className="mt-6 first:mt-0">
			<h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
			<Params params={params} />
		</div>
	) : null;

/**
 * "Request" section: a Parameters / Headers segmented toggle over the endpoint's
 * request shape. Both panels are always in the DOM (inactive one `hidden`) so the
 * full content prerenders into the static HTML — the toggle only controls
 * visibility, nothing is dropped for no-JS clients, crawlers or agents.
 */
const RequestSection = ({
	pathParams,
	queryParams,
	bodyParams,
	headers,
}: {
	pathParams: ApiParam[];
	queryParams: ApiParam[];
	bodyParams: ApiParam[];
	headers: ApiParam[];
}) => {
	const [tab, setTab] = useState<"parameters" | "headers">("parameters");
	const hasParams =
		pathParams.length > 0 || queryParams.length > 0 || bodyParams.length > 0;

	const pill = (active: boolean) =>
		cn(
			"cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
			active
				? "bg-primary text-primary-foreground shadow-sm"
				: "text-muted-foreground hover:text-foreground",
		);

	return (
		<section className="mt-12 border-t border-border/60 pt-8">
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="text-lg font-semibold tracking-tight text-foreground">
					Request
				</h2>

				<div
					className="inline-flex self-start rounded-full border border-border bg-muted/50 p-1 sm:self-auto"
					aria-label="Request details"
				>
					<button
						type="button"
						aria-pressed={tab === "parameters"}
						onClick={() => setTab("parameters")}
						className={pill(tab === "parameters")}
					>
						Parameters
					</button>
					<button
						type="button"
						aria-pressed={tab === "headers"}
						onClick={() => setTab("headers")}
						className={pill(tab === "headers")}
					>
						Headers
					</button>
				</div>
			</div>

			<div hidden={tab !== "parameters"}>
				{hasParams ? (
					<>
						<ParamGroup title="Path parameters" params={pathParams} />
						<ParamGroup title="Query parameters" params={queryParams} />
						<ParamGroup title="Body parameters" params={bodyParams} />
					</>
				) : (
					<p className="text-sm text-muted-foreground">
						This endpoint takes no request parameters.
					</p>
				)}
			</div>

			<div hidden={tab !== "headers"}>
				<p className="mb-4 text-sm text-muted-foreground">
					These headers authenticate and sign every request. See{" "}
					<Link
						to={API_AUTH_DOCS_URL}
						className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
					>
						How Auth Works
					</Link>{" "}
					for details.
				</p>
				{headers.length > 0 ? (
					<Params params={headers} />
				) : (
					<p className="text-sm text-muted-foreground">
						No additional headers for this endpoint.
					</p>
				)}
			</div>
		</section>
	);
};

/**
 * Middle-pane renderer for an API endpoint. Everything is derived from the
 * shared resolvers over `api-specs.ts` — no data is duplicated here. Request
 * params and headers sit under a Parameters/Headers toggle (both panels are in
 * the DOM, so it still prerenders fully); responses render as a collapsible
 * accordion.
 */
export const EndpointDetail = ({ spec }: { spec: ApiSpec }) => {
	const headers = resolveHeaders(spec);
	const requestParams = resolveRequestParams(spec);
	const description = resolveDescription(spec);
	const recipes = recipesForSpec(spec);

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

			{description && (
				<div data-toc="Description" data-toc-level="2">
					<MarkdownProse content={description} className="mt-6" />
				</div>
			)}

			{recipes.length > 0 && (
				<div className="mt-6">
					<Callout type="tip">
						{recipes.length === 1
							? "This endpoint is one step in a complete workflow:"
							: "This endpoint is used in these workflows:"}
						<ul className="mt-2 space-y-1">
							{recipes.map((recipe) => (
								<li key={recipe.slug}>
									<Link
										to={recipeHref(recipe.slug)}
										className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
									>
										{recipe.name}
									</Link>{" "}
									<span className="text-muted-foreground">
										— {recipe.summary}
									</span>
								</li>
							))}
						</ul>
					</Callout>
				</div>
			)}

			<RequestSection
				pathParams={pathParams}
				queryParams={queryParams}
				bodyParams={bodyParams}
				headers={headers}
			/>

			{spec.responseTypes?.length ? (
				<DocsSection title="Response types">
					<ResponseTypes spec={spec} />
				</DocsSection>
			) : null}

			<DocsSection title="Responses">
				<ResponseAccordion spec={spec} />
			</DocsSection>

			<NextSteps spec={spec} />
		</article>
	);
};
