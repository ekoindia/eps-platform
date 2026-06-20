import type { ApiParam } from "@/lib/data/api-specs-common";
import { cn } from "@/lib/utils";
import { InlineCode } from "./InlineCode";

/**
 * Scalar-style parameter list: each field on its own row — `name  type
 * Required  example` — with the description beneath and a hairline divider
 * between rows. Replaces dense tables for a calmer, more scannable read.
 * Pure / SSR-safe.
 */
export const FieldList = ({ params }: { params: ApiParam[] }) => (
	<div className="divide-y divide-border/60 rounded-xl border border-border/60">
		{params.map((p) => (
			<div key={`${p.in}-${p.name}`} className="px-4 py-3">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<InlineCode className="text-sm font-semibold text-foreground">
						{p.name}
					</InlineCode>
					<span className="font-mono text-xs text-muted-foreground">
						{p.type}
					</span>
					<span
						className={cn(
							"text-xs font-medium",
							p.required
								? "text-amber-600 dark:text-amber-400"
								: "text-muted-foreground",
						)}
					>
						{p.required ? "Required" : "optional"}
					</span>
					{p.label && (
						<span className="text-xs text-muted-foreground">· {p.label}</span>
					)}
				</div>
				{p.description && (
					<p className="mt-2 ml-1 text-xs text-muted-foreground">
						{p.description}
					</p>
				)}
				{p.example !== undefined && (
					<p className="mt-1 ml-1 font-mono text-xs text-foreground/60">
						example: {String(p.example)}
					</p>
				)}
			</div>
		))}
	</div>
);
