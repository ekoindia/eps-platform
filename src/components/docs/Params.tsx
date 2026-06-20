import type { ApiParam } from "@/lib/data/api-specs-common";
import { FieldList } from "./FieldList";
import { InlineCode } from "./InlineCode";

/** Dense 4-column table — used on wide (xl) screens where there's room. */
const ParamTable = ({ params }: { params: ApiParam[] }) => (
	<div className="overflow-hidden rounded-xl border border-border/60">
		<table className="w-full text-left text-sm">
			<thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th className="px-6 py-2.5 font-medium">Field</th>
					<th className="px-4 py-2.5 font-medium">Type</th>
					<th className="px-4 py-2.5 font-medium">Required</th>
					<th className="px-4 py-2.5 font-medium">Description</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-border/60">
				{params.map((p) => (
					<tr key={`${p.in}-${p.name}`} className="align-top">
						<td className="px-4 py-2.5">
							<InlineCode className="text-[0.8125rem] text-foreground font-semibold">
								{p.name}
							</InlineCode>
							{p.label && (
								<span className="block text-xs text-muted-foreground">
									{p.label}
								</span>
							)}
						</td>
						<td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
							{p.type}
						</td>
						<td className="px-4 py-2.5">
							{p.required ? (
								<span className="text-xs font-medium text-amber-600 dark:text-amber-400">
									required
								</span>
							) : (
								<span className="text-xs text-muted-foreground">optional</span>
							)}
						</td>
						<td className="px-4 py-2.5 text-muted-foreground">
							{p.description}
							{p.example !== undefined && (
								<span className="mt-1 block font-mono text-xs text-foreground/70">
									e.g. {String(p.example)}
								</span>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/**
 * Parameter list that adapts to width: the dense table on wide (xl+) screens,
 * the calmer stacked field-list on narrower ones where a 4-column table cramps.
 */
export const Params = ({ params }: { params: ApiParam[] }) => (
	<>
		<div className="hidden xl:block">
			<ParamTable params={params} />
		</div>
		<div className="xl:hidden">
			<FieldList params={params} />
		</div>
	</>
);
