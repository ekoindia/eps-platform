import { CornerDownRight, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import type { Recipe } from "@/lib/data/api-recipes";
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
					response_status_id
				</code>{" "}
				is{" "}
				<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.7rem] dark:bg-amber-500/20">
					{branch.onResponseStatusId}
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
			<div className="flex flex-wrap items-center gap-2">
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
			<p className="mt-1.5 text-sm text-muted-foreground">{step.purpose}</p>
			{step.branches.map((branch) => (
				<BranchCallout
					key={`${branch.onResponseStatusId}-${branch.goto}`}
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
