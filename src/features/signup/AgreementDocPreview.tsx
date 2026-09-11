/** Which picture of the document to draw. */
export type DocPreviewState = "loading" | "ready" | "error";

/**
 * The text lines drawn on the page mock, as fractions of the page width.
 *
 * `lead` marks the rows that turn gold once the document is ready — they stand
 * in for the fields we filled in (name, address, signatory), which is the whole
 * point of showing a preview rather than a spinner.
 */
const LINES: readonly { width: number; lead?: boolean }[] = [
	{ width: 0.62, lead: true },
	{ width: 0.82 },
	{ width: 0.74, lead: true },
	{ width: 0.86 },
	{ width: 0.55, lead: true },
	{ width: 0.8 },
	{ width: 0.66 },
];

const PAGE_WIDTH = 132;
const PAGE_HEIGHT = 176;
const MARGIN = 16;
const LINE_HEIGHT = 7;
const LINE_GAP = 15;
const FIRST_LINE_Y = 26;

/**
 * A miniature of the agreement being prepared, drawn as inline SVG.
 *
 * Three pictures of one document rather than three components: the page, its
 * margins and its line rhythm are identical in every state, and only the fills
 * and the animation change. Drawing it as SVG (not a stack of divs) keeps the
 * whole thing one element that scales with its container.
 *
 * While `loading`, the lines breathe on the shared `pulse-soft` keyframe with a
 * per-row delay, and a highlight band sweeps down the page. Both animate only
 * `opacity` and `transform`, and both opt out under `prefers-reduced-motion` —
 * the CSS failsafe in `index.css` is class-scoped and would not catch these.
 *
 * @param props.state - Which picture to draw.
 */
export function AgreementDocPreview({ state }: { state: DocPreviewState }) {
	const loading = state === "loading";
	const failed = state === "error";

	return (
		<svg
			viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
			className="h-auto w-28 shrink-0 sm:w-32"
			role="img"
			aria-label={
				failed
					? "The agreement document could not be prepared"
					: loading
						? "The agreement document is being prepared"
						: "A preview of your agreement document"
			}
		>
			<defs>
				{/* Soft-edged so the band reads as a sweep of light rather than a bar
				    with two hard borders crossing the text. */}
				<linearGradient id="doc-scan-band" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="currentColor" stopOpacity="0" />
					<stop offset="50%" stopColor="currentColor" stopOpacity="0.14" />
					<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
				</linearGradient>
				{/* The band is drawn full-page and slid past this window, so nothing
				    escapes the page's rounded corners. */}
				<clipPath id="doc-page-clip">
					<rect
						x="0.5"
						y="0.5"
						width={PAGE_WIDTH - 1}
						height={PAGE_HEIGHT - 1}
						rx="6"
					/>
				</clipPath>
			</defs>

			{/* The page itself. Dashed and red only in the error state — a solid
			    sheet there would read as a document that exists. */}
			<rect
				x="0.5"
				y="0.5"
				width={PAGE_WIDTH - 1}
				height={PAGE_HEIGHT - 1}
				rx="6"
				className={
					failed
						? "fill-transparent stroke-destructive/40"
						: "fill-background stroke-border"
				}
				strokeWidth="1"
				strokeDasharray={failed ? "4 4" : undefined}
			/>

			{failed ? (
				// One centred alert disc, no lines: there is no document to preview.
				<g className="text-destructive">
					<circle
						cx={PAGE_WIDTH / 2}
						cy={PAGE_HEIGHT / 2}
						r="16"
						className="fill-destructive/10"
					/>
					<text
						x={PAGE_WIDTH / 2}
						y={PAGE_HEIGHT / 2}
						textAnchor="middle"
						dominantBaseline="central"
						className="fill-destructive text-[20px] font-bold"
					>
						!
					</text>
				</g>
			) : (
				<>
					{LINES.map(({ width, lead }, index) => (
						<rect
							key={`${width}-${index}`}
							x={MARGIN}
							y={FIRST_LINE_Y + index * LINE_GAP}
							width={(PAGE_WIDTH - MARGIN * 2) * width}
							height={LINE_HEIGHT}
							rx="3"
							// The gold rows arrive only when the document is ready, and
							// they fade rather than snap — the panel around them is
							// swapping content at the same moment.
							className={`transition-[fill] duration-500 ${
								loading
									? "fill-muted animate-pulse-soft motion-reduce:animate-none"
									: lead
										? "fill-eko-gold/45"
										: "fill-muted"
							}`}
							// Staggered so the page ripples top-to-bottom instead of
							// blinking as one block. Inline because the delay is derived
							// from the row's index; there is no utility for "nth × 160ms".
							style={
								loading ? { animationDelay: `${index * 160}ms` } : undefined
							}
						/>
					))}

					{loading && (
						<g clipPath="url(#doc-page-clip)" className="text-eko-navy">
							<rect
								x="0"
								y="0"
								width={PAGE_WIDTH}
								height="18"
								fill="url(#doc-scan-band)"
								className="animate-doc-scan motion-reduce:hidden"
							/>
						</g>
					)}
				</>
			)}
		</svg>
	);
}
