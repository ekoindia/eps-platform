import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ApiSpec, ApiResponseType } from "@/lib/data/api-specs-common";
import { docHrefForSlug, getDocBySlug } from "@/lib/data/docs-registry";
import { InlineCode } from "./InlineCode";

/**
 * The endpoint a `response_type_id` routes to, as a link.
 *
 * Resolved through `docHrefForSlug`, so a slug without a page degrades to its
 * plain name rather than a 404 — the same guard `RelatedLink` uses.
 */
const NextStepLink = ({ slug }: { slug: string }) => {
	const href = docHrefForSlug(slug);
	const title = getDocBySlug(slug)?.title ?? slug;
	return href ? (
		<Link
			to={href}
			className="inline-flex items-center gap-1 font-medium text-eko-navy underline-offset-2 hover:text-eko-gold-hover hover:underline dark:text-foreground"
		>
			<ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
			{title}
		</Link>
	) : (
		<span className="text-muted-foreground">{title}</span>
	);
};

/**
 * A one-line annotation for a sample payload: what its `response_type_id`
 * means, and where to go next. Shown beside the examples so a reader never has
 * to match the number against the table by hand.
 */
export const ResponseTypeNote = ({
	responseType,
}: {
	responseType: ApiResponseType;
}) => (
	<span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
		<InlineCode className="text-[0.7rem]">{responseType.id}</InlineCode>
		<span>{responseType.meaning}</span>
		{responseType.next && (
			<>
				<span aria-hidden="true">·</span>
				<span>next:</span>
				<NextStepLink slug={responseType.next} />
			</>
		)}
	</span>
);

/**
 * The `response_type_id` values an endpoint can return: what each means, and
 * which endpoint to call next. Three narrow columns, so unlike `Params` this
 * needs no separate stacked rendering at small widths.
 */
export const ResponseTypes = ({ spec }: { spec: ApiSpec }) => (
	<div className="overflow-hidden rounded-xl border border-border/60">
		<table className="w-full text-left text-sm">
			<thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th className="px-4 py-2.5 font-medium">response_type_id</th>
					<th className="px-4 py-2.5 font-medium">Meaning</th>
					<th className="px-4 py-2.5 font-medium">Next step</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-border/60">
				{(spec.responseTypes ?? []).map((rt) => (
					<tr key={rt.id} className="align-top">
						<td className="px-4 py-2.5">
							<InlineCode className="text-[0.8125rem] font-semibold text-foreground">
								{rt.id}
							</InlineCode>
						</td>
						<td className="px-4 py-2.5 text-muted-foreground">{rt.meaning}</td>
						<td className="px-4 py-2.5">
							{rt.next ? (
								<NextStepLink slug={rt.next} />
							) : (
								<span className="text-xs text-muted-foreground">—</span>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
