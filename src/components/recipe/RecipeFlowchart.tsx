import {
	branchCondition,
	type Recipe,
	type RecipeStepFrequency,
	STEP_FREQUENCY_LABEL,
} from "@/lib/data/api-recipes";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	DONE_NODE,
	type ResolvedRecipe,
	resolveRecipe,
} from "@/lib/data/recipe-graph";

/**
 * The recipe's flow as a hand-drawn SVG flowchart.
 *
 * Layout is computed from fixed geometry rather than by a graph engine: a recipe
 * is a vertical chain with occasional labelled jumps, so node positions are just
 * `index * PITCH`. Sequential edges are straight; any jump that skips or goes
 * backwards arcs through the right-hand gutter. That is the whole layout problem
 * — importing a general layout engine (~500kb) to solve it would be silly.
 *
 * Themed via Tailwind `fill-*`/`stroke-*` utilities bound to the same CSS
 * variables as the rest of the site, so light/dark need no JS.
 */

/** Floor width; the node grows past this to fit the longest title + pill so no
 * title is ever cropped. */
const MIN_NODE_W = 240;
const NODE_H = 46;
const V_GAP = 46;
const PITCH = NODE_H + V_GAP;
/** Right-hand lane that skip/back arcs bow out into. Only reserved when the
 * recipe actually has such an edge — otherwise it is dead space that shifts the
 * chain off-centre. */
const GUTTER = 76;
const DONE_W = 84;
/** Char-width estimates (SVG <text> can't be measured pre-render): the 11px
 * medium title, and the 8px semibold pill label. Both carry slack so real fonts
 * never overrun. */
const TITLE_CHAR_W = 6.6;
const PILL_CHAR_W = 5.4;
/** x where a node's title starts — after the method chip, or the left pad. */
const titleStartX = (hasMethod: boolean): number => (hasMethod ? 54 : 12);
/** Pill box width for a label (padding included). */
const pillWidth = (label: string): number => label.length * PILL_CHAR_W + 16;

const METHOD_FILL: Record<ApiSpec["method"], string> = {
	GET: "fill-emerald-500/15 stroke-emerald-500/30",
	POST: "fill-sky-500/15 stroke-sky-500/30",
	PUT: "fill-violet-500/15 stroke-violet-500/30",
	DELETE: "fill-rose-500/15 stroke-rose-500/30",
};

const METHOD_TEXT: Record<ApiSpec["method"], string> = {
	GET: "fill-emerald-700 dark:fill-emerald-400",
	POST: "fill-sky-700 dark:fill-sky-400",
	PUT: "fill-violet-700 dark:fill-violet-400",
	DELETE: "fill-rose-700 dark:fill-rose-400",
};

/** Frequency pill tints, the SVG twins of the stepper's `FREQUENCY_TINT` —
 * indigo for one-time, teal for daily, both off the method palette. */
const FREQUENCY_FILL: Record<RecipeStepFrequency, string> = {
	once: "fill-indigo-500/15 stroke-indigo-500/30",
	daily: "fill-teal-500/15 stroke-teal-500/30",
};

const FREQUENCY_TEXT: Record<RecipeStepFrequency, string> = {
	once: "fill-indigo-700 dark:fill-indigo-400",
	daily: "fill-teal-700 dark:fill-teal-400",
};

const nodeY = (index: number): number => index * PITCH;

export const RecipeFlowchart = ({ recipe }: { recipe: Recipe }) => {
	const resolved: ResolvedRecipe = resolveRecipe(recipe);
	const { steps, edges, hasDone } = resolved;

	// Per-step frequency label (also drives node width), computed once.
	const freqLabels = steps.map((s) =>
		s.frequency ? STEP_FREQUENCY_LABEL[s.frequency] : undefined,
	);
	// Node width grows to fit the widest (title + optional pill) so no title is
	// ever cropped; a single width keeps the chain aligned. `CX` follows.
	const NODE_W = Math.max(
		MIN_NODE_W,
		...steps.map((s, i) => {
			const label = freqLabels[i];
			return (
				titleStartX(Boolean(s.method)) +
				s.title.length * TITLE_CHAR_W +
				(label ? 10 + pillWidth(label) : 0) +
				12
			);
		}),
	);
	const CX = NODE_W / 2;

	const indexOf = (nodeId: string): number =>
		steps.findIndex((s) => s.nodeId === nodeId);
	const doneY = nodeY(steps.length);
	const height = doneY + (hasDone ? NODE_H : 0);

	/** Vertical centre of a node id, for arc anchoring. */
	const centreY = (nodeId: string): number => {
		if (nodeId === DONE_NODE) return doneY + NODE_H / 2;
		return nodeY(indexOf(nodeId)) + NODE_H / 2;
	};
	const bottomY = (nodeId: string): number =>
		nodeId === DONE_NODE ? doneY + NODE_H : nodeY(indexOf(nodeId)) + NODE_H;
	const topY = (nodeId: string): number =>
		nodeId === DONE_NODE ? doneY : nodeY(indexOf(nodeId));

	/** An edge is a straight drop when its target sits directly below its source. */
	const isSequential = (from: string, to: string): boolean => {
		const fromIdx = indexOf(from);
		if (to === DONE_NODE) return fromIdx === steps.length - 1;
		return indexOf(to) === fromIdx + 1;
	};

	const hasArc = edges.some((e) => !isSequential(e.from, e.to));
	const viewW = NODE_W + (hasArc ? GUTTER : 0);

	return (
		<figure className="mt-4">
			<svg
				viewBox={`0 0 ${viewW} ${height}`}
				className="mx-auto h-auto w-full"
				style={{ maxWidth: viewW + 28 }}
				role="img"
				aria-label={`Flowchart of the ${recipe.name} API recipe`}
			>
				<defs>
					<marker
						id="recipe-arrow"
						viewBox="0 0 8 8"
						refX="7"
						refY="4"
						markerWidth="5"
						markerHeight="5"
						orient="auto-start-reverse"
					>
						<path d="M0,1 L7,4 L0,7 z" className="fill-muted-foreground" />
					</marker>
				</defs>

				{/* Edges first, so nodes paint over the line ends. */}
				{edges.map((edge) => {
					const condition = edge.branch
						? branchCondition(edge.branch)
						: undefined;
					const key = `${edge.from}-${edge.to}-${condition?.value ?? ""}`;
					// The diagram is a glance view: label the condition with just its
					// value. Which field it came from is in the <title>, and the full
					// note lives in the stepper callout above.
					const label = condition ? String(condition.value) : undefined;
					if (isSequential(edge.from, edge.to)) {
						const y1 = bottomY(edge.from);
						const y2 = topY(edge.to);
						return (
							<g key={key}>
								{condition && (
									<title>{`${condition.field} ${condition.value}`}</title>
								)}
								<line
									x1={CX}
									y1={y1}
									x2={CX}
									y2={y2}
									className="stroke-muted-foreground/50"
									strokeWidth={1.5}
									markerEnd="url(#recipe-arrow)"
								/>
								{label && (
									<text
										x={CX + 8}
										y={(y1 + y2) / 2 + 3}
										className="fill-muted-foreground font-mono text-[9px]"
									>
										{label}
									</text>
								)}
							</g>
						);
					}
					// Skip/backward jump: bow out through the right gutter.
					const yFrom = centreY(edge.from);
					const yTo = centreY(edge.to);
					const lane = NODE_W + GUTTER - 14;
					return (
						<g key={key}>
							{condition && (
								<title>{`${condition.field} ${condition.value}`}</title>
							)}
							<path
								d={`M ${NODE_W} ${yFrom} C ${lane} ${yFrom}, ${lane} ${yTo}, ${NODE_W} ${yTo}`}
								fill="none"
								className="stroke-muted-foreground/50"
								strokeWidth={1.5}
								strokeDasharray="3 3"
								markerEnd="url(#recipe-arrow)"
							/>
							{label && (
								<text
									x={lane}
									y={(yFrom + yTo) / 2 + 3}
									textAnchor="end"
									className="fill-muted-foreground font-mono text-[9px]"
								>
									{label}
								</text>
							)}
						</g>
					);
				})}

				{steps.map((step, index) => {
					const freqLabel = freqLabels[index];
					const pillW = freqLabel ? pillWidth(freqLabel) : 0;
					// Node was sized to fit this title + gap + pill, so the pill sits at
					// the far right and the (untruncated) title always clears it.
					const pillX = NODE_W - pillW - 10;
					const titleX = titleStartX(Boolean(step.method));
					return (
						<g key={step.nodeId}>
							<title>{`${step.number}. ${step.method ?? ""} ${step.title}${freqLabel ? ` (${freqLabel})` : ""}`}</title>
							<rect
								x={0}
								y={nodeY(index)}
								width={NODE_W}
								height={NODE_H}
								rx={8}
								className="fill-card stroke-border"
								strokeWidth={1}
							/>
							{step.method && (
								<>
									<rect
										x={12}
										y={nodeY(index) + 15}
										width={34}
										height={16}
										rx={4}
										className={METHOD_FILL[step.method]}
										strokeWidth={1}
									/>
									<text
										x={29}
										y={nodeY(index) + 26}
										textAnchor="middle"
										className={`${METHOD_TEXT[step.method]} font-mono text-[8px] font-semibold`}
									>
										{step.method}
									</text>
								</>
							)}
							<text
								x={titleX}
								y={nodeY(index) + 27}
								className="fill-foreground text-[11px] font-medium"
							>
								{step.title}
							</text>
							{step.frequency && freqLabel && (
								<>
									<rect
										x={pillX}
										y={nodeY(index) + 15}
										width={pillW}
										height={16}
										rx={4}
										className={FREQUENCY_FILL[step.frequency]}
										strokeWidth={1}
									/>
									<text
										x={pillX + pillW / 2}
										y={nodeY(index) + 26}
										textAnchor="middle"
										className={`${FREQUENCY_TEXT[step.frequency]} font-mono text-[8px] font-semibold`}
									>
										{freqLabel}
									</text>
								</>
							)}
						</g>
					);
				})}

				{hasDone && (
					<g>
						<rect
							x={CX - DONE_W / 2}
							y={doneY}
							width={DONE_W}
							height={NODE_H}
							rx={NODE_H / 2}
							className="fill-muted stroke-border"
							strokeWidth={1}
						/>
						<text
							x={CX}
							y={doneY + 27}
							textAnchor="middle"
							className="fill-muted-foreground text-[11px] font-medium"
						>
							done
						</text>
					</g>
				)}
			</svg>
		</figure>
	);
};
