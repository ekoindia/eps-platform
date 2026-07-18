import { CornerDownRight, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import {
	branchCondition,
	type Recipe,
	type RecipeStepFrequency,
	STEP_FREQUENCY_LABEL,
} from "@/lib/data/api-recipes";
import {
	DONE_NODE,
	type ResolvedBranch,
	type ResolvedStep,
	resolveRecipe,
} from "@/lib/data/recipe-graph";

/**
 * A recipe's flow, drawn as a vertical stepper.
 *
 * Layout is hand-drawn rather than computed: a recipe is a short ordered list
 * with occasional labelled jumps, so a numbered gutter + connector line says
 * everything a graph-layout engine would, at no dependency cost. The flow comes
 * from `resolveRecipe`, shared with the markdown twin.
 */

/** Per-frequency pill tint. Deliberately off the method palette
 * (emerald/sky/violet/rose) and the branch-callout amber, so a frequency badge
 * never reads as a method or a branch. */
const FREQUENCY_TINT: Record<RecipeStepFrequency, string> = {
	once: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30",
	daily:
		"bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-400 dark:border-teal-500/30",
};

/** A frequency badge (one-time / daily), pinned to the right of the step header.
 * Mirrors the `HttpMethodTag` pill shape for a consistent header row. */
const FrequencyTag = ({
	frequency,
	className,
}: {
	frequency: RecipeStepFrequency;
	className?: string;
}) => (
	<span
		className={`inline-flex items-center rounded-[5px] border px-[7px] py-[3px] font-mono text-[0.625rem] font-semibold uppercase leading-none tracking-[0.04em] ${FREQUENCY_TINT[frequency]} ${className ?? ""}`}
	>
		{STEP_FREQUENCY_LABEL[frequency]}
	</span>
);

/** A conditional jump, shown inset under the step whose response triggers it. */
const BranchCallout = ({ branch }: { branch: ResolvedBranch }) => {
	const isDone = branch.goto === DONE_NODE;
	return (
		<div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
			{isDone ? (
				<Flag
					aria-hidden="true"
					className="mt-px size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
				/>
			) : (
				<CornerDownRight
					aria-hidden="true"
					className="mt-px size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
				/>
			)}
			<p className="min-w-0 text-amber-900 dark:text-amber-200">
				If{" "}
				<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.7rem] dark:bg-amber-500/20">
					{branchCondition(branch).field}
				</code>{" "}
				is{" "}
				<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.7rem] dark:bg-amber-500/20">
					{branchCondition(branch).value}
				</code>{" "}
				{isDone ? (
					<>— the flow is complete.</>
				) : (
					<>
						— skip to{" "}
						<span className="font-medium">
							{branch.targetStepNumber
								? `step ${branch.targetStepNumber}, ${branch.targetTitle}`
								: branch.targetTitle}
						</span>
						.
					</>
				)}
				{branch.note && <span className="opacity-80"> {branch.note}</span>}
			</p>
		</div>
	);
};

const StepCard = ({
	step,
	isLast,
}: {
	step: ResolvedStep;
	isLast: boolean;
}) => (
	<li className="relative flex gap-4 pb-6 last:pb-0">
		{/* Gutter: the connector line, drawn behind the number. */}
		{!isLast && (
			<span
				aria-hidden="true"
				className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
			/>
		)}
		<span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs font-semibold text-foreground">
			{step.number}
		</span>

		<div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4">
			<div className="flex items-start gap-2">
				{/* Method + title in their own group; the frequency badge is pushed to
				    the far right of the header by `ml-auto`. */}
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{step.method && <HttpMethodTag method={step.method} short />}
					{step.docHref ? (
						<Link
							to={step.docHref}
							className="font-medium text-foreground underline-offset-4 hover:underline"
						>
							{step.title}
						</Link>
					) : (
						<span className="font-medium text-foreground">{step.title}</span>
					)}
				</div>
				{step.frequency && (
					<FrequencyTag
						frequency={step.frequency}
						className="ml-auto shrink-0"
					/>
				)}
			</div>
			<p className="mt-1.5 text-sm text-muted-foreground">{step.purpose}</p>
			{step.branches.map((branch) => (
				<BranchCallout
					key={`${branchCondition(branch).value}-${branch.goto}`}
					branch={branch}
				/>
			))}
		</div>
	</li>
);

export const RecipeStepper = ({ recipe }: { recipe: Recipe }) => {
	const { steps } = resolveRecipe(recipe);
	return (
		<ol className="mt-6">
			{steps.map((step, index) => (
				<StepCard
					key={step.nodeId}
					step={step}
					isLast={index === steps.length - 1}
				/>
			))}
		</ol>
	);
};
