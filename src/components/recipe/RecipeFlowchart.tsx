import { Link } from "react-router-dom";
import {
	branchCondition,
	type Recipe,
	type RecipeStepFrequency,
	STEP_FREQUENCY_LABEL,
} from "@/lib/data/api-recipes";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	DONE_NODE,
	type ResolvedEdge,
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
 * Two jumps that overlap in the same lane are unreadable, so each arc is packed
 * into its own lane (see {@link assignLanes}) and tinted. Hovering an edge — or
 * a step node, which lights every edge leaving it — fades the rest. The hover is
 * pure CSS: the edge half in `index.css` under `.recipe-flow`, the node half
 * generated per recipe by {@link nodeHoverRules}.
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
/** Horizontal distance between two arc lanes, and the offset of the innermost
 * lane from the node's right edge. */
const LANE_GAP = 26;
const LANE_INSET = 18;
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

/**
 * Arc tints, cycled per arc so two curves sharing a stretch of gutter never
 * share a colour. Each needs its own `marker` — an SVG arrowhead does not
 * inherit the stroke of the path that carries it.
 */
const ARC_TINTS = [
	{
		line: "stroke-violet-500/80",
		head: "fill-violet-500/80",
		text: "fill-violet-700 dark:fill-violet-400",
		border: "stroke-violet-500/40",
	},
	{
		line: "stroke-amber-500/80",
		head: "fill-amber-500/80",
		text: "fill-amber-700 dark:fill-amber-400",
		border: "stroke-amber-500/40",
	},
	{
		line: "stroke-cyan-500/80",
		head: "fill-cyan-500/80",
		text: "fill-cyan-700 dark:fill-cyan-400",
		border: "stroke-cyan-500/40",
	},
	{
		line: "stroke-rose-500/80",
		head: "fill-rose-500/80",
		text: "fill-rose-700 dark:fill-rose-400",
		border: "stroke-rose-500/40",
	},
	{
		line: "stroke-blue-500/80",
		head: "fill-blue-500/80",
		text: "fill-blue-700 dark:fill-blue-400",
		border: "stroke-blue-500/40",
	},
];

/** The muted look a straight, non-arcing edge wears. */
const STRAIGHT_TINT = {
	line: "stroke-muted-foreground/50",
	text: "fill-muted-foreground",
	border: "stroke-border",
};

const nodeY = (index: number): number => index * PITCH;

/**
 * The edge's label.
 *
 * A branch names the field it fires on, so `308` (a `response_type_id`) can no
 * longer be mistaken for `0` (a `status`). A `status` of `0` is the success
 * case, so it reads as "on success" — the same words the unconditional edges
 * use. A fall-through says whether it is the only way onward, or the remaining
 * case once the step's own branches have been ruled out.
 */
const edgeLabel = (edge: ResolvedEdge, sourceHasBranches: boolean): string => {
	if (!edge.branch)
		return sourceHasBranches ? "otherwise, on success" : "on success";
	const { field, value } = branchCondition(edge.branch);
	if (field === "status")
		return value === 0 ? "on success" : `on status ${value}`;
	return `on type ${value}`;
};

/**
 * Pack arcs into non-overlapping lanes: an arc reuses the innermost lane whose
 * previous occupant already ended above where this one starts. Greedy, and
 * optimal for intervals — the classic interval-partitioning result — which is
 * all a recipe's handful of jumps needs.
 */
const assignLanes = (spans: Array<[number, number]>): number[] => {
	const laneLastRow: number[] = [];
	return spans.map(([from, to]) => {
		const lo = Math.min(from, to);
		const hi = Math.max(from, to);
		const reusable = laneLastRow.findIndex((last) => last < lo);
		const lane = reusable === -1 ? laneLastRow.length : reusable;
		laneLastRow[lane] = hi;
		return lane;
	});
};

/**
 * The hover rules that can only be written once the node ids are known:
 * hovering a step lights up every edge leaving it and fades the rest, exactly as
 * hovering one of those edges' labels does.
 *
 * CSS cannot match "the edges whose source is the node under the cursor" —
 * comparing two elements' attributes is beyond a selector — so one selector per
 * source node is emitted and the three declarations are shared across them.
 * Scoped to this chart's own id, so a page holding two flowcharts cannot have
 * one highlight the other. The edge-hover half of this lives in `index.css`,
 * where it needs no per-recipe knowledge.
 */
const nodeHoverRules = (chartId: string, sources: string[]): string => {
	if (sources.length === 0) return "";
	const rule = (suffix: string, declaration: string): string =>
		`${sources
			.map(
				(id) => `#${chartId}:has(.rf-n-${id}:hover) ${suffix.replace("$", id)}`,
			)
			.join(",")}{${declaration}}`;
	return [
		rule(".recipe-edge:not(.rf-e-$)", "opacity:.15"),
		rule(".rf-e-$ :is(path,line)", "stroke-width:2.5"),
		rule(".rf-e-$ path", "stroke-dasharray:8 4"),
	].join("");
};

/** A label chip: an opaque pill so it stays legible over any line it crosses. */
const EdgeLabel = ({
	x,
	y,
	label,
	tint,
	anchorStart,
}: {
	x: number;
	y: number;
	label: string;
	tint: { text: string; border: string };
	anchorStart: boolean;
}) => {
	const w = pillWidth(label);
	return (
		<>
			<rect
				x={anchorStart ? x - 3 : x - w / 2}
				y={y - 8}
				width={w}
				height={16}
				rx={4}
				className={`fill-background ${tint.border}`}
				strokeWidth={1}
			/>
			<text
				x={anchorStart ? x + 5 : x}
				y={y + 3.5}
				textAnchor={anchorStart ? "start" : "middle"}
				className={`${tint.text} font-mono text-[9px] font-semibold`}
			>
				{label}
			</text>
		</>
	);
};

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

	/** Row index of a node — `done` sits one row past the last step. */
	const rowOf = (nodeId: string): number =>
		nodeId === DONE_NODE ? steps.length : indexOf(nodeId);

	/** Vertical centre of a node id, for arc anchoring. */
	const centreY = (nodeId: string): number =>
		rowOf(nodeId) * PITCH + NODE_H / 2;
	const bottomY = (nodeId: string): number => rowOf(nodeId) * PITCH + NODE_H;
	const topY = (nodeId: string): number => rowOf(nodeId) * PITCH;

	/** An edge is a straight drop when its target sits directly below its source. */
	const isSequential = (edge: ResolvedEdge): boolean =>
		rowOf(edge.to) === rowOf(edge.from) + 1;

	// Resolve every edge to what it takes to draw it — label, lane, tint — before
	// any geometry, so the gutter can be sized to exactly the lanes in use.
	const arcs = edges.filter((e) => !isSequential(e));
	const lanes = assignLanes(
		arcs.map((e) => [rowOf(e.from), rowOf(e.to)] as [number, number]),
	);
	const laneCount = lanes.length ? Math.max(...lanes) + 1 : 0;

	const drawn = edges.map((edge) => {
		const source = steps[rowOf(edge.from)];
		const label = edgeLabel(edge, (source?.branches.length ?? 0) > 0);
		const arcIndex = arcs.indexOf(edge);
		return {
			edge,
			label,
			arcIndex,
			lane: arcIndex === -1 ? -1 : lanes[arcIndex],
			tint:
				arcIndex === -1
					? STRAIGHT_TINT
					: ARC_TINTS[arcIndex % ARC_TINTS.length],
		};
	});

	// Arc labels start at their lane and run right, so the gutter has to hold the
	// widest of them; without arcs there is no gutter at all (no dead space).
	const widestArcLabel = Math.max(
		0,
		...drawn.filter((d) => d.lane !== -1).map((d) => pillWidth(d.label)),
	);
	const viewW =
		laneCount === 0
			? NODE_W
			: NODE_W + LANE_INSET + (laneCount - 1) * LANE_GAP + widestArcLabel + 10;

	const chartId = `rf-${recipe.slug}`;
	const nodeHoverCss = nodeHoverRules(chartId, [
		...new Set(drawn.map((d) => d.edge.from)),
	]);

	// Gloss only the notations this recipe actually draws — a linear recipe has no
	// `on type` edge, and a legend entry for one would be noise.
	const labels = drawn.map((d) => d.label);
	const legend = [
		{
			term: "on success",
			used: labels.some((l) => l.includes("on success")),
			gloss: (
				<>
					the call succeeded (<Mono>status</Mono> is <Mono>0</Mono>)
				</>
			),
		},
		{
			term: "on type N",
			used: labels.some((l) => l.startsWith("on type")),
			gloss: (
				<>
					the response's <Mono>response_type_id</Mono> is <Mono>N</Mono>
				</>
			),
		},
		{
			term: "on status N",
			used: labels.some((l) => l.startsWith("on status")),
			gloss: (
				<>
					the response's <Mono>response_status_id</Mono> is <Mono>N</Mono>
				</>
			),
		},
	].filter((entry) => entry.used);

	return (
		<figure className="mt-4">
			<svg
				id={chartId}
				viewBox={`0 0 ${viewW} ${height}`}
				className="recipe-flow mx-auto h-auto w-full"
				style={{ maxWidth: viewW + 28 }}
				role="img"
				aria-label={`Flowchart of the ${recipe.name} API recipe`}
			>
				{nodeHoverCss && <style>{nodeHoverCss}</style>}
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
					{ARC_TINTS.map((tint, index) => (
						<marker
							key={tint.head}
							id={`recipe-arrow-${index}`}
							viewBox="0 0 8 8"
							refX="7"
							refY="4"
							markerWidth="5"
							markerHeight="5"
							orient="auto-start-reverse"
						>
							<path d="M0,1 L7,4 L0,7 z" className={tint.head} />
						</marker>
					))}
				</defs>

				{/* Edges first, so nodes paint over the line ends. */}
				{drawn.map(({ edge, label, arcIndex, lane, tint }) => {
					const condition = edge.branch
						? branchCondition(edge.branch)
						: undefined;
					const key = `${edge.from}-${edge.to}-${condition?.value ?? ""}`;
					if (arcIndex === -1) {
						const y1 = bottomY(edge.from);
						const y2 = topY(edge.to);
						return (
							<g key={key} className={`recipe-edge rf-e-${edge.from}`}>
								<title>
									{condition ? `${condition.field} ${condition.value}` : label}
								</title>
								<line
									x1={CX}
									y1={y1}
									x2={CX}
									y2={y2}
									className={tint.line}
									strokeWidth={1.5}
									markerEnd="url(#recipe-arrow)"
								/>
								{/* Centred on the line: the opaque pill masks it, and the label
								    can never reach the gutter the arcs live in. */}
								<EdgeLabel
									x={CX}
									y={(y1 + y2) / 2}
									label={label}
									tint={tint}
									anchorStart={false}
								/>
							</g>
						);
					}
					// Skip/backward jump: bow out through this arc's own gutter lane.
					const yFrom = centreY(edge.from);
					const yTo = centreY(edge.to);
					const laneX = NODE_W + LANE_INSET + lane * LANE_GAP;
					return (
						<g key={key} className={`recipe-edge rf-e-${edge.from}`}>
							<title>
								{condition ? `${condition.field} ${condition.value}` : label}
							</title>
							<path
								d={`M ${NODE_W} ${yFrom} C ${laneX} ${yFrom}, ${laneX} ${yTo}, ${NODE_W} ${yTo}`}
								fill="none"
								className={tint.line}
								strokeWidth={1.5}
								strokeDasharray="4 3"
								markerEnd={`url(#recipe-arrow-${arcIndex % ARC_TINTS.length})`}
							/>
							<EdgeLabel
								x={laneX}
								y={(yFrom + yTo) / 2}
								label={label}
								tint={tint}
								anchorStart
							/>
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
					const body = (
						<>
							<title>{`${step.number}. ${step.method ?? ""} ${step.title}${freqLabel ? ` (${freqLabel})` : ""}`}</title>
							<rect
								x={0}
								y={nodeY(index)}
								width={NODE_W}
								height={NODE_H}
								rx={8}
								className="fill-card stroke-border group-hover:stroke-foreground/40"
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
								className="fill-foreground text-[11px] font-medium group-hover:underline"
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
						</>
					);
					// A step with no docs page stays inert rather than linking to a 404.
					return step.docHref ? (
						<Link
							key={step.nodeId}
							to={step.docHref}
							className={`group cursor-pointer rf-n-${step.nodeId}`}
						>
							{body}
						</Link>
					) : (
						<g key={step.nodeId} className={`rf-n-${step.nodeId}`}>
							{body}
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

			{legend.length > 0 && (
				<figcaption className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
					{legend.map((entry) => (
						<span key={entry.term}>
							<Mono>{entry.term}</Mono> — {entry.gloss}
						</span>
					))}
				</figcaption>
			)}
		</figure>
	);
};

/** Inline code voice for the legend, matching the stepper's branch callouts. */
function Mono({ children }: { children: React.ReactNode }) {
	return (
		<code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem] text-foreground">
			{children}
		</code>
	);
}
