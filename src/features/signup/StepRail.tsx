import { Check } from "lucide-react";
import type { ResolvedStep, StepStatus } from "./resolveSteps";

/**
 * Onboarding progress, drawn as a stepper.
 *
 * One renderer, two layouts: a compact row of circles on small screens, a
 * left-hand rail with step titles from `lg` up. The orientation swap is pure
 * CSS — no breakpoint hook, no second render branch — so the DOM and the
 * accessibility tree stay identical at every width.
 *
 * Status comes from `resolveSteps`, which is server-authoritative for which
 * steps exist, their order, and their labels. Nothing here may assume a step
 * count.
 */

/** What each status announces to a screen reader, since colour alone can't. */
const STATUS_LABEL: Record<StepStatus, string> = {
	complete: "completed",
	current: "current step",
	pending: "not started",
};

const Circle = ({ status, number }: { status: StepStatus; number: number }) => {
	const base =
		"relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs";
	if (status === "complete") {
		return (
			<span
				aria-hidden="true"
				className={`${base} border border-primary bg-primary text-white font-semibold`}
			>
				<Check className="size-4" strokeWidth={3} />
			</span>
		);
	}
	if (status === "current") {
		return (
			<span
				aria-hidden="true"
				className={`${base} border-2 border-primary bg-background text-primary font-bold`}
			>
				{number}
			</span>
		);
	}
	return (
		<span
			aria-hidden="true"
			className={`${base} border border-border bg-muted text-muted-foreground`}
		>
			{number}
		</span>
	);
};

export function StepRail({ steps }: { steps: ResolvedStep[] }) {
	// Not a parent invariant to lean on: a registry/API mismatch can filter every
	// step out (see resolveSteps), and "Step 0 of 0" is worse than no rail.
	if (steps.length === 0) return null;

	const currentIndex = steps.findIndex((s) => s.status === "current");
	// No current step means every step is complete, so the whole rail is filled.
	// This mirrors resolveSteps' own currentIndex === -1 rule; it does *not*
	// imply onboarding finished — that's the wizard's call, not the rail's.
	const doneThrough = currentIndex === -1 ? steps.length : currentIndex;
	const position = currentIndex === -1 ? steps.length : currentIndex + 1;

	return (
		<nav aria-label="Signup progress" className="flex flex-col gap-2">
			<ol className="flex flex-row items-center lg:flex-col lg:items-stretch">
				{steps.map((step, index) => (
					<li
						key={`${step.role}-${index}`}
						className="relative flex flex-1 items-center gap-0 last:flex-none lg:flex-none lg:items-start lg:gap-3 lg:pb-6 lg:last:pb-0"
					>
						<Circle status={step.status} number={index + 1} />

						{/* One element, two layouts: a horizontal rule between circles on
						    mobile, the vertical gutter line behind them on desktop. */}
						{index < steps.length - 1 && (
							<span
								aria-hidden="true"
								className={`h-px flex-1 lg:absolute lg:left-[15px] lg:top-8 lg:bottom-0 lg:h-auto lg:w-px lg:flex-none ${
									index < doneThrough ? "bg-primary" : "bg-border"
								}`}
							/>
						)}

						{/* The visible label is desktop-only, so the sr-only twin carries
						    the full announcement at every width. */}
						<span className="sr-only">
							{step.label}, {STATUS_LABEL[step.status]}
						</span>
						<span
							aria-hidden="true"
							className={`hidden pt-1.5 text-sm lg:block ${
								step.status === "current"
									? "font-semibold text-foreground"
									: "text-muted-foreground"
							}`}
						>
							{step.label}
						</span>
					</li>
				))}
			</ol>

			{/* Desktop reads the count off the titles; mobile has only circles. */}
			<p aria-hidden="true" className="text-sm text-muted-foreground lg:hidden">
				Step {position} of {steps.length}
			</p>
		</nav>
	);
}
