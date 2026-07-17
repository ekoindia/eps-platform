import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	resolveResponseFields,
	responseTypeFor,
} from "@/lib/data/api-specs-common";
import { ResponseFieldTree } from "./ResponseFieldTree";
import { ResponseTypeNote } from "./ResponseTypes";

interface Row {
	code: string;
	label: string;
	body: ReactNode;
	/** The example payload this row shows, used to look up its response type.
	 * The success row renders a field tree rather than the payload, so the
	 * payload is carried here instead of being read back out of `body`. */
	payload: Record<string, unknown>;
}

/** Status-code colour, matching common REST conventions. */
const codeColor = (code: string): string => {
	const n = Number(code);
	if (n >= 500) return "text-rose-600 dark:text-rose-400";
	if (n >= 400) return "text-amber-600 dark:text-amber-400";
	if (n >= 300) return "text-sky-600 dark:text-sky-400";
	return "text-emerald-600 dark:text-emerald-400";
};

const JsonBody = ({ value }: { value: unknown }) => (
	<pre className="code-block docs-scroll mt-2 overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
		<code>{JSON.stringify(value, null, 2)}</code>
	</pre>
);

/**
 * Collapsible list of responses (success + documented error scenarios), in the
 * Scalar style: a clickable status row that expands to the response body — the
 * resolved field tree for success, the example payload for errors. The first
 * row (success) is open by default.
 */
export const ResponseAccordion = ({ spec }: { spec: ApiSpec }) => {
	const rows: Row[] = [
		{
			code: "200",
			label: "Successful response",
			body: <ResponseFieldTree fields={resolveResponseFields(spec)} />,
			payload: spec.sampleSuccessResponse,
		},
		...(spec.errorScenarios ?? []).map((scenario) => ({
			code: String(scenario.statusCode ?? 200),
			label: scenario.scenario,
			body: <JsonBody value={scenario.example} />,
			payload: scenario.example,
		})),
	];

	const [open, setOpen] = useState<Set<number>>(new Set([0]));
	const toggle = (i: number) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (next.has(i)) next.delete(i);
			else next.add(i);
			return next;
		});

	return (
		<div className="divide-y divide-border/60 rounded-xl border border-border/60">
			{rows.map((row, i) => {
				const isOpen = open.has(i);
				const responseType = responseTypeFor(spec, row.payload);
				return (
					<div key={i}>
						<button
							type="button"
							onClick={() => toggle(i)}
							aria-expanded={isOpen}
							className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
						>
							<ChevronRight
								className={cn(
									"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
									isOpen && "rotate-90",
								)}
							/>
							<span
								className={cn(
									"font-mono text-sm font-semibold",
									codeColor(row.code),
								)}
							>
								{row.code}
							</span>
							<span className="text-sm text-muted-foreground">{row.label}</span>
						</button>
						{isOpen && (
							<div className="px-4 pb-4 pl-11">
								{responseType && (
									<p className="mb-3">
										<ResponseTypeNote responseType={responseType} />
									</p>
								)}
								{row.body}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};
