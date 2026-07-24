import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

/** ~88px fixed site header; land scrolled headings just below it. */
const HEADER_OFFSET = 96;

interface TocEntry {
	el: HTMLElement;
	text: string;
	level: number;
}

export interface MiniTocProps {
	/** How deep to go. The page H1 is always excluded (it's the page title, not a
	 *  section). 2 = H2 only (avoids card-title H3 noise on marketing pages),
	 *  3 = H2–H3 (article/docs structure). */
	maxLevel?: 2 | 3;
	/** Element to scan for headings (and, when align="container", to measure). */
	scopeSelector?: string;
	/** "viewport" pins the strip near the window's right edge (Medium look on
	 *  wide pages); "container" pins it just inside the right edge of the
	 *  scanned box's enclosing pane (docs API pages — the code-samples pane
	 *  owns the true right edge). */
	align?: "viewport" | "container";
}

/** Gap between the strip and the edge it pins to (also the clamp). */
const EDGE_MARGIN = 8;

/**
 * Medium-style mini table-of-contents: a fixed vertical strip of tiny dashes
 * (one per heading) that expands into a heading list on hover/focus, with the
 * current section tracked as you scroll. Large screens only; purely an
 * enhancement layered onto already-rendered headings (renders nothing on the
 * server and until it has scanned ≥2 headings, so there is no hydration
 * mismatch).
 */
export const MiniToc = ({
	maxLevel = 3,
	scopeSelector = "main",
	align = "viewport",
}: MiniTocProps) => {
	const [entries, setEntries] = useState<TocEntry[]>([]);
	const [active, setActive] = useState(0);
	const [left, setLeft] = useState<number | null>(null);
	const stripRef = useRef<HTMLDivElement>(null);

	// Scan the scope for headings + [data-toc] anchors, rescanning when content
	// changes (MDX/route swaps under a persistent layout).
	useEffect(() => {
		const scope = document.querySelector<HTMLElement>(scopeSelector);
		if (!scope) return;

		let frame = 0;
		const scan = () => {
			const nodes = Array.from(
				scope.querySelectorAll<HTMLElement>("h1, h2, h3, [data-toc]"),
			);
			const seen = new Set<HTMLElement>();
			const next: TocEntry[] = [];
			for (const el of nodes) {
				if (seen.has(el)) continue;
				seen.add(el);
				const marker = el.getAttribute("data-toc");
				const tagLevel = { H1: 1, H2: 2, H3: 3 }[el.tagName];
				const level = marker
					? Number(el.getAttribute("data-toc-level")) || 2
					: tagLevel;
				// H1 is the page title, not a section — never list it.
				if (!level || level < 2 || level > maxLevel) continue;
				const text = (marker || el.textContent || "").trim();
				if (!text) continue;
				next.push({ el, text, level });
			}
			setEntries(next);
		};

		scan();
		const observer = new MutationObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(scan);
		});
		observer.observe(scope, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [scopeSelector, maxLevel]);

	// Horizontal placement, kept in sync with layout/viewport changes.
	useEffect(() => {
		if (entries.length < 2) return;
		const stripWidth = stripRef.current?.offsetWidth ?? 24;
		const place = () => {
			// clientWidth excludes a classic (non-overlay) scrollbar; innerWidth
			// includes it and would tuck the strip underneath.
			const viewWidth = document.documentElement.clientWidth;
			let x: number;
			if (align === "container") {
				// Pin inside the enclosing pane's right edge (not the narrower
				// centered content box) so the strip hugs the pane border.
				const scope = document.querySelector<HTMLElement>(scopeSelector);
				const pane = scope?.closest("main") ?? scope;
				const right = pane?.getBoundingClientRect().right ?? viewWidth;
				x = right - stripWidth - EDGE_MARGIN;
			} else {
				x = viewWidth - stripWidth - EDGE_MARGIN;
			}
			// Never let it run off-screen (wide container / near-breakpoint viewport).
			setLeft(Math.min(x, viewWidth - stripWidth - EDGE_MARGIN));
		};
		place();
		const scope = document.querySelector<HTMLElement>(scopeSelector);
		const ro = scope ? new ResizeObserver(place) : null;
		if (scope && ro) ro.observe(scope);
		window.addEventListener("resize", place);
		return () => {
			ro?.disconnect();
			window.removeEventListener("resize", place);
		};
	}, [entries.length, align, scopeSelector]);

	// Scroll-spy: active = last heading whose top has passed the header offset.
	useEffect(() => {
		if (entries.length < 2) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			let idx = 0;
			for (let i = 0; i < entries.length; i++) {
				if (
					entries[i].el.getBoundingClientRect().top - HEADER_OFFSET - 8 <=
					0
				) {
					idx = i;
				} else break;
			}
			setActive(idx);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
		};
	}, [entries]);

	const scrollTo = useCallback((el: HTMLElement) => {
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
		window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
	}, []);

	if (entries.length < 2) return null;

	return (
		<nav
			ref={stripRef}
			aria-label="On this page"
			className="group fixed z-40 hidden -translate-y-1/2 lg:block"
			style={{ left: left ?? -9999, top: "50%" }}
		>
			{/* Dash strip (decorative; the popup carries the real controls) */}
			<div aria-hidden="true" className="flex flex-col items-end gap-1.5 py-2">
				{entries.map((entry, i) => (
					<span
						key={i}
						className={cn(
							"h-0.5 rounded-full transition-all duration-200",
							i === active
								? "bg-foreground"
								: "bg-foreground/25 group-hover:bg-foreground/40",
							entry.level === 2 ? "w-3" : "w-2",
						)}
						style={{ marginRight: (entry.level - 2) * 3 }}
					/>
				))}
			</div>

			{/* Popup — opens on hover or keyboard focus. The gap to the strip is
			    bridged with padding (part of this element) rather than margin, so
			    the pointer never leaves the hover area while crossing over. */}
			<div
				className={cn(
					"pointer-events-none absolute right-full top-1/2 -translate-y-1/2 pr-2",
					"opacity-0 transition-opacity duration-150",
					"group-hover:pointer-events-auto group-hover:opacity-100",
					"group-focus-within:pointer-events-auto group-focus-within:opacity-100",
				)}
			>
				<div className="w-max max-w-xs rounded-xl border border-border bg-background p-2 shadow-xl">
					<p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
						Table of contents
					</p>
					<ul className="max-h-[70vh] overflow-y-auto">
						{entries.map((entry, i) => (
							<li key={i}>
								<button
									type="button"
									onClick={() => scrollTo(entry.el)}
									style={{ paddingLeft: 8 + (entry.level - 2) * 14 }}
									className={cn(
										"block w-full truncate rounded-md py-1.5 pr-3 text-left text-sm transition-colors",
										i === active
											? "font-medium text-primary"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									{entry.text}
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
		</nav>
	);
};
