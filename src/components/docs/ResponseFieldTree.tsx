import { cn } from "@/lib/utils";
import type { ResponseField } from "@/lib/data/api-specs-common";

/**
 * Recursively renders a (possibly nested) response-field tree as an indented
 * list. Fields flagged `imp` (the "what can you verify?" data) are subtly
 * highlighted. Pure / SSR-safe.
 */
export const ResponseFieldTree = ({
	fields,
	depth = 0,
}: {
	fields: ResponseField[];
	depth?: number;
}) => (
	<ul
		className={cn(
			"space-y-2",
			depth > 0 && "mt-2 border-l border-border/60 pl-4",
		)}
	>
		{fields.map((field) => (
			<li key={field.name}>
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<code
						className={cn(
							"font-mono text-sm",
							field.imp
								? "font-semibold text-foreground"
								: "text-foreground/90",
						)}
					>
						{field.name}
					</code>
					<span className="font-mono text-xs text-muted-foreground">
						{field.type}
					</span>
					{field.imp && (
						<span className="rounded-full bg-eko-gold-light px-2 py-0.5 text-[0.625rem] font-medium text-eko-navy dark:bg-eko-gold/15 dark:text-eko-gold">
							verifiable
						</span>
					)}
				</div>
				{(field.label || field.description) && (
					<p className="mt-0.5 text-sm text-muted-foreground">
						{field.description ?? field.label}
					</p>
				)}
				{field.children && field.children.length > 0 && (
					<ResponseFieldTree fields={field.children} depth={depth + 1} />
				)}
			</li>
		))}
	</ul>
);
