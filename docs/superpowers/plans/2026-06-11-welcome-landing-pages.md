# Welcome Landing Pages (/welcome, /welcome2, /welcome3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three standalone, noindexed, ultra-modern dark landing pages marketing EPS 2.0 — `/welcome` (Agent Demo scrollytelling), `/welcome2` (Layered Stack), `/welcome3` (Terminal as Canvas) — without touching the existing home page.

**Architecture:** Zero-dependency motion system (CSS 3D + IntersectionObserver + rAF hooks) shared from `src/components/welcome/motion/`; standalone dark chrome (`WelcomeNav`/`WelcomeFooter`) with the global `Header` suppressed on `/welcome*`; lazy routes prerendered by the existing SSG pipeline but excluded from the sitemap. Content source of truth: `docs/welcome-landing-storyboards.md`. Spec: `docs/superpowers/specs/2026-06-11-welcome-landing-design.md`.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS v4 (`@theme` tokens in `src/index.css`), react-router-dom 6, react-helmet-async, Vitest + Testing Library (jsdom), existing custom SSG (`ssg/`).

**Conventions (from user global CLAUDE.md):** tabs for indentation in new files, functional patterns, full typing, JSDoc on new functions, conventional commits, no Co-Authored-By line, run single tests not the whole suite.

---

## File Structure

```
src/components/welcome/
	motion/
		usePrefersReducedMotion.ts   # media-query hook, SSR-safe
		useReveal.ts                 # IntersectionObserver → `is-visible`
		useScrollProgress.ts         # rAF-throttled 0→1 progress of a tall section
		useMouseParallax.ts          # pointer → rotateX/rotateY transform
		motion.test.ts               # hook unit tests
	WelcomeNav.tsx                 # minimal dark nav (logo · Docs · GitHub · CTA)
	WelcomeFooter.tsx              # slim dark footer
	CodeTabs.tsx                   # MCP/SDK/CLI tab triplet (pages A§3, B§4)
	IgnitionCta.tsx                # gold-bloom final CTA (pages A§6, B§6)
	welcome.css                    # all welcome-specific styles (imported by pages)
src/pages/welcome/
	AgentDemoPage.tsx              # /welcome  (page A)
	AgentDemoPage.test.tsx
	LayeredStackPage.tsx           # /welcome2 (page B)
	LayeredStackPage.test.tsx
	TerminalCanvasPage.tsx         # /welcome3 (page C)
	TerminalCanvasPage.test.tsx
```

Modified files:

- `src/components/Header.tsx` — early-return `null` wrapper on `/welcome*` paths
- `src/components/Header.test.tsx` — new test file for the suppression
- `src/App.tsx` — three lazy routes
- `ssg/routes.ts` — `ROUTE_CHUNK_MAP` entries + `PRERENDER_ROUTES` entries
- `ssg/prerender.ts` — filter `/welcome*` out of the sitemap call

Notes for every page component:

- Pages import `@/components/welcome/welcome.css` (Vite handles CSS dedupe; all three pages share it).
- Every page sets `<Helmet>` with title, description, and `<meta name="robots" content="noindex" />` (pattern: `src/pages/NotFound.tsx:65-68`).
- Pages do NOT render the global `Footer`; they render `WelcomeFooter`.
- All decorative animation respects `usePrefersReducedMotion()`; base (no-JS / SSG) state must show all content.

---

### Task 1: Motion hooks

**Files:**
- Create: `src/components/welcome/motion/usePrefersReducedMotion.ts`
- Create: `src/components/welcome/motion/useReveal.ts`
- Create: `src/components/welcome/motion/useScrollProgress.ts`
- Create: `src/components/welcome/motion/useMouseParallax.ts`
- Test: `src/components/welcome/motion/motion.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/welcome/motion/motion.test.ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useReveal } from "./useReveal";
import { useScrollProgress } from "./useScrollProgress";

describe("usePrefersReducedMotion", () => {
	it("returns true when the media query matches", () => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(true);
		vi.unstubAllGlobals();
	});

	it("returns false when the media query does not match", () => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);
		vi.unstubAllGlobals();
	});
});

describe("useReveal", () => {
	it("reports visible immediately when IntersectionObserver is unavailable", () => {
		const original = globalThis.IntersectionObserver;
		// Simulate environments without IO (SSG node env): hook must not throw
		// and must report visible=true so content is never hidden.
		// @ts-expect-error - intentionally removing IO
		delete globalThis.IntersectionObserver;
		const { result } = renderHook(() => useReveal());
		expect(result.current.ref).toBeDefined();
		expect(result.current.isVisible).toBe(true);
		globalThis.IntersectionObserver = original;
	});

	it("observes the element when IntersectionObserver exists", () => {
		const observe = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn().mockImplementation(() => ({ observe, disconnect })),
		);
		const { result, unmount } = renderHook(() => useReveal());
		// Attach a fake element the way React would
		const el = document.createElement("div");
		(result.current.ref as React.MutableRefObject<HTMLElement | null>).current =
			el;
		// isVisible starts false when IO is available (JS will reveal)
		expect(result.current.isVisible).toBe(false);
		unmount();
		vi.unstubAllGlobals();
	});
});

describe("useScrollProgress", () => {
	it("returns 0 progress initially and a ref", () => {
		const { result } = renderHook(() => useScrollProgress());
		expect(result.current.ref).toBeDefined();
		expect(result.current.progress).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/welcome/motion/motion.test.ts`
Expected: FAIL — `Cannot find module './usePrefersReducedMotion'` (etc.)

- [ ] **Step 3: Implement the four hooks**

```ts
// src/components/welcome/motion/usePrefersReducedMotion.ts
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * SSR-safe hook reporting the user's reduced-motion preference.
 * Returns false during SSG/before hydration (base markup is static anyway).
 */
export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState<boolean>(() =>
		typeof window !== "undefined" && typeof window.matchMedia === "function"
			? window.matchMedia(QUERY).matches
			: false,
	);

	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const mql = window.matchMedia(QUERY);
		const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return reduced;
}
```

```ts
// src/components/welcome/motion/useReveal.ts
import { useEffect, useRef, useState } from "react";

interface RevealResult<T extends HTMLElement> {
	ref: React.RefObject<T>;
	/** True once the element has entered the viewport (or always, without IO). */
	isVisible: boolean;
}

/**
 * Reveal-on-scroll via IntersectionObserver. Fires once, then disconnects.
 * Without IntersectionObserver (SSG/old browsers) it reports visible=true
 * so content is never hidden.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
	threshold = 0.15,
): RevealResult<T> {
	const ref = useRef<T>(null);
	const ioAvailable =
		typeof window !== "undefined" &&
		typeof window.IntersectionObserver === "function";
	const [isVisible, setIsVisible] = useState(!ioAvailable);

	useEffect(() => {
		if (!ioAvailable || !ref.current) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ threshold },
		);
		observer.observe(ref.current);
		return () => observer.disconnect();
	}, [ioAvailable, threshold]);

	return { ref, isVisible };
}
```

```ts
// src/components/welcome/motion/useScrollProgress.ts
import { useEffect, useRef, useState } from "react";

interface ScrollProgressResult<T extends HTMLElement> {
	ref: React.RefObject<T>;
	/** 0 → 1 progress of the element scrolling through the viewport. */
	progress: number;
}

/**
 * rAF-throttled scroll progress of a tall element. Progress is 0 when the
 * element's top reaches the viewport top, 1 when its bottom reaches the
 * viewport bottom — i.e. the scrub range of a sticky-pinned section.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(): ScrollProgressResult<T> {
	const ref = useRef<T>(null);
	const [progress, setProgress] = useState(0);
	const ticking = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined" || !ref.current) return;

		const update = () => {
			ticking.current = false;
			const el = ref.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const scrollable = rect.height - window.innerHeight;
			if (scrollable <= 0) {
				setProgress(0);
				return;
			}
			const value = Math.min(1, Math.max(0, -rect.top / scrollable));
			setProgress(value);
		};

		const onScroll = () => {
			if (!ticking.current) {
				ticking.current = true;
				window.requestAnimationFrame(update);
			}
		};

		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, []);

	return { ref, progress };
}
```

```ts
// src/components/welcome/motion/useMouseParallax.ts
import { useEffect, useRef } from "react";

/**
 * Pointer-driven 3D tilt. Writes `--tilt-x`/`--tilt-y` custom properties
 * (degrees) onto the element; CSS applies the rotation. Desktop only
 * (no-op for coarse pointers) and inert under reduced motion — callers
 * simply don't apply the CSS transform in that case.
 */
export function useMouseParallax<T extends HTMLElement = HTMLDivElement>(
	maxDegrees = 8,
): React.RefObject<T> {
	const ref = useRef<T>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.matchMedia?.("(pointer: coarse)").matches) return;
		const el = ref.current;
		if (!el) return;

		const onMove = (event: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const relX = (event.clientX - rect.left) / rect.width - 0.5;
			const relY = (event.clientY - rect.top) / rect.height - 0.5;
			el.style.setProperty("--tilt-y", `${(relX * maxDegrees).toFixed(2)}deg`);
			el.style.setProperty("--tilt-x", `${(-relY * maxDegrees).toFixed(2)}deg`);
		};
		const onLeave = () => {
			el.style.setProperty("--tilt-x", "0deg");
			el.style.setProperty("--tilt-y", "0deg");
		};

		el.addEventListener("mousemove", onMove);
		el.addEventListener("mouseleave", onLeave);
		return () => {
			el.removeEventListener("mousemove", onMove);
			el.removeEventListener("mouseleave", onLeave);
		};
	}, [maxDegrees]);

	return ref;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/welcome/motion/motion.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/welcome/motion
git commit -m "feat(welcome): zero-dep motion hooks (reveal, scroll progress, parallax, reduced-motion)"
```

---

### Task 2: Welcome stylesheet + chrome (WelcomeNav, WelcomeFooter)

**Files:**
- Create: `src/components/welcome/welcome.css`
- Create: `src/components/welcome/WelcomeNav.tsx`
- Create: `src/components/welcome/WelcomeFooter.tsx`

No unit tests for pure presentation here — these are covered by the page render tests (Tasks 5, 9, 10). Steps are implement → typecheck → commit.

- [ ] **Step 1: Create `welcome.css`**

All welcome-specific styles in one file. Tailwind utilities handle layout; this file holds keyframes, 3D helpers, and reveal states that are awkward inline.

```css
/* src/components/welcome/welcome.css
   Styles shared by /welcome, /welcome2, /welcome3 (Obsidian Terminal direction).
   Only `transform` and `opacity` are animated. */

.welcome-page {
	background: #07090d;
	color: #e8eaf0;
	min-height: 100vh;
	overflow-x: clip;
}

/* Faint dot grid overlay */
.welcome-dotgrid {
	background-image: radial-gradient(rgba(232, 234, 240, 0.06) 1px, transparent 1px);
	background-size: 28px 28px;
}

/* Radial gold blooms (cheap — gradients, not blur filters) */
.welcome-bloom-tr {
	background: radial-gradient(ellipse 60% 45% at 75% -10%, rgba(247, 181, 30, 0.16), transparent 65%);
}
.welcome-bloom-bottom {
	background: radial-gradient(ellipse 70% 60% at 50% 110%, rgba(247, 181, 30, 0.22), transparent 70%);
}

/* 3D helpers */
.welcome-perspective {
	perspective: 1200px;
}
.welcome-tilt {
	transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
	transform-style: preserve-3d;
	transition: transform 0.15s ease-out;
	will-change: transform;
}

/* Reveal-on-scroll. Base state (SSG / no JS) is fully visible;
   `js-motion` (set by pages on mount, never during SSG) arms the hidden
   pre-state, and `is-visible` plays the entrance. */
.js-motion .welcome-reveal {
	opacity: 0;
	transform: translateY(24px);
	transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.js-motion .welcome-reveal.is-visible {
	opacity: 1;
	transform: translateY(0);
}
/* Staggered children: parent gets .welcome-stagger + .is-visible */
.js-motion .welcome-stagger > * {
	opacity: 0;
	transform: translateY(20px);
	transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.js-motion .welcome-stagger.is-visible > * {
	opacity: 1;
	transform: translateY(0);
}
.js-motion .welcome-stagger.is-visible > *:nth-child(2) { transition-delay: 80ms; }
.js-motion .welcome-stagger.is-visible > *:nth-child(3) { transition-delay: 160ms; }
.js-motion .welcome-stagger.is-visible > *:nth-child(4) { transition-delay: 240ms; }
.js-motion .welcome-stagger.is-visible > *:nth-child(5) { transition-delay: 320ms; }

/* Terminal caret */
.welcome-caret::after {
	content: "▋";
	animation: welcome-blink 1.1s steps(1) infinite;
	color: hsl(42 96% 54%);
}
@keyframes welcome-blink {
	50% { opacity: 0; }
}

/* Scroll-hint chevron */
@keyframes welcome-bounce {
	0%, 100% { transform: translateY(0); opacity: 0.7; }
	50% { transform: translateY(8px); opacity: 1; }
}
.welcome-scroll-hint {
	animation: welcome-bounce 1.8s ease-in-out infinite;
}

/* Orbit (page A §4): cards rotate around a gold core. Counter-rotation
   keeps card faces upright. Static ring under reduced motion. */
@keyframes welcome-orbit {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
@keyframes welcome-orbit-counter {
	from { transform: rotate(0deg); }
	to { transform: rotate(-360deg); }
}
.welcome-orbit-ring {
	animation: welcome-orbit 40s linear infinite;
}
.welcome-orbit-ring:hover {
	animation-play-state: paused;
}
.welcome-orbit-item {
	animation: welcome-orbit-counter 40s linear infinite;
}
.welcome-orbit-ring:hover .welcome-orbit-item {
	animation-play-state: paused;
}

/* Scanline shimmer (page C) */
@keyframes welcome-scanline {
	from { transform: translateY(-100%); }
	to { transform: translateY(100vh); }
}
.welcome-scanline::before {
	content: "";
	position: absolute;
	inset-inline: 0;
	height: 120px;
	background: linear-gradient(rgba(232, 234, 240, 0.04), transparent);
	animation: welcome-scanline 7s linear infinite;
	pointer-events: none;
}

/* Kill every welcome animation under reduced motion */
@media (prefers-reduced-motion: reduce) {
	.welcome-page *,
	.welcome-page *::before,
	.welcome-page *::after {
		animation: none !important;
		transition: none !important;
	}
	.js-motion .welcome-reveal,
	.js-motion .welcome-stagger > * {
		opacity: 1;
		transform: none;
	}
}
```

- [ ] **Step 2: Create `WelcomeNav.tsx`**

```tsx
// src/components/welcome/WelcomeNav.tsx
import { EkoLogo } from "@/components/EkoLogo";
import { Github } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Minimal dark navigation for the standalone /welcome* pages.
 * The global Header is suppressed on these routes (see Header.tsx).
 */
export const WelcomeNav = () => (
	<nav className="fixed top-0 inset-x-0 z-50 bg-[#07090d]/80 backdrop-blur-md border-b border-white/5">
		<div className="max-w-6xl mx-auto flex items-center gap-6 px-5 h-16">
			<Link to="/" aria-label="Eko home">
				<EkoLogo className="h-8 w-auto" isLight />
			</Link>
			<div className="ml-auto flex items-center gap-5 text-sm">
				<a
					href="https://developers.eko.in"
					target="_blank"
					rel="noopener noreferrer"
					className="text-white/70 hover:text-white transition-colors hidden sm:block"
				>
					Docs
				</a>
				<a
					href="https://github.com/ekoindia"
					target="_blank"
					rel="noopener noreferrer"
					className="text-white/70 hover:text-white transition-colors flex items-center gap-1.5"
				>
					<Github className="w-4 h-4" aria-hidden />
					<span className="hidden sm:inline">GitHub</span>
				</a>
				<Link
					to="/signup"
					className="bg-eko-gold hover:bg-eko-gold-hover text-eko-navy font-semibold rounded-lg px-4 py-2 transition-colors"
				>
					Get sandbox key
				</Link>
			</div>
		</div>
	</nav>
);
```

- [ ] **Step 3: Create `WelcomeFooter.tsx`**

```tsx
// src/components/welcome/WelcomeFooter.tsx
import { Link } from "react-router-dom";

/** Slim dark footer for the standalone /welcome* pages. */
export const WelcomeFooter = () => (
	<footer className="border-t border-white/5 bg-[#07090d]">
		<div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center gap-4 text-xs text-white/50">
			<p>© {new Date().getFullYear()} Eko India Financial Services Pvt. Ltd.</p>
			<nav className="sm:ml-auto flex items-center gap-5">
				<Link to="/tnc" className="hover:text-white/80 transition-colors">
					Terms
				</Link>
				<Link to="/privacy-policy" className="hover:text-white/80 transition-colors">
					Privacy
				</Link>
				<a
					href="https://developers.eko.in"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-white/80 transition-colors"
				>
					Docs
				</a>
			</nav>
		</div>
	</footer>
);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/welcome
git commit -m "feat(welcome): standalone dark chrome and shared welcome stylesheet"
```

---

### Task 3: Shared CodeTabs + IgnitionCta

**Files:**
- Create: `src/components/welcome/CodeTabs.tsx`
- Create: `src/components/welcome/IgnitionCta.tsx`

- [ ] **Step 1: Create `CodeTabs.tsx`**

MCP / SDK / CLI tab triplet used by page A §3 and page B §4. Auto-cycles every 4s until the user hovers or clicks; then stays manual.

```tsx
// src/components/welcome/CodeTabs.tsx
import { usePrefersReducedMotion } from "@/components/welcome/motion/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface CodeTab {
	key: string;
	label: string;
	code: string;
}

const TABS: CodeTab[] = [
	{
		key: "mcp",
		label: "MCP",
		code: `$ claude mcp add eko
# or run it directly:
$ npx @eko-eps/mcp

✓ connected · 14 verification tools available`,
	},
	{
		key: "sdk",
		label: "TypeScript SDK",
		code: `import { Eko } from "@eko-eps/sdk";

const eko = new Eko({ key, secret, env: "sandbox" });
const result = await eko.verify.pan({ pan: "ABCDE1234F" });
// → { valid: true, name: "RAVI KUMAR", latencyMs: 240 }`,
	},
	{
		key: "cli",
		label: "CLI",
		code: `$ eko verify pan ABCDE1234F --json
{
  "valid": true,
  "name": "RAVI KUMAR",
  "latency_ms": 240
}`,
	},
];

/** Tabbed code panel showing the three integration surfaces (MCP/SDK/CLI). */
export const CodeTabs = () => {
	const reducedMotion = usePrefersReducedMotion();
	const [active, setActive] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		if (reducedMotion || paused) return;
		const id = window.setInterval(
			() => setActive((current) => (current + 1) % TABS.length),
			4000,
		);
		return () => window.clearInterval(id);
	}, [reducedMotion, paused]);

	return (
		<div
			className="welcome-perspective"
			onMouseEnter={() => setPaused(true)}
		>
			<div className="rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 overflow-hidden welcome-tilt">
				<div role="tablist" className="flex border-b border-white/10">
					{TABS.map((tab, index) => (
						<button
							key={tab.key}
							role="tab"
							aria-selected={active === index}
							onClick={() => {
								setPaused(true);
								setActive(index);
							}}
							className={cn(
								"px-4 py-2.5 text-xs font-mono transition-colors",
								active === index
									? "text-eko-gold border-b-2 border-eko-gold -mb-px"
									: "text-white/50 hover:text-white/80",
							)}
						>
							{tab.label}
						</button>
					))}
				</div>
				<pre className="p-5 text-[13px] leading-relaxed font-mono text-[#9aa4b2] min-h-44 whitespace-pre-wrap">
					{TABS[active].code}
				</pre>
			</div>
		</div>
	);
};
```

- [ ] **Step 2: Create `IgnitionCta.tsx`**

```tsx
// src/components/welcome/IgnitionCta.tsx
import { useReveal } from "@/components/welcome/motion/useReveal";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

/** Full-bleed gold-bloom final CTA shared by pages A and B. */
export const IgnitionCta = ({ heading }: { heading: string }) => {
	const { ref, isVisible } = useReveal<HTMLDivElement>();

	return (
		<section
			ref={ref}
			className={cn(
				"relative py-32 text-center overflow-hidden welcome-bloom-bottom welcome-reveal",
				isVisible && "is-visible",
			)}
		>
			<div className="relative max-w-3xl mx-auto px-5">
				<h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
					{heading}
				</h2>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
					<Link
						to="/signup"
						className="bg-eko-gold hover:bg-eko-gold-hover text-eko-navy font-semibold rounded-lg px-7 py-3.5 text-lg transition-colors"
					>
						Get sandbox key
					</Link>
					<a
						href="https://developers.eko.in"
						target="_blank"
						rel="noopener noreferrer"
						className="border border-white/20 hover:border-white/50 text-white rounded-lg px-7 py-3.5 text-lg transition-colors"
					>
						Read the docs
					</a>
				</div>
				<p className="mt-8 font-mono text-xs text-white/40">
					llms-full.txt available · agents welcome
				</p>
			</div>
		</section>
	);
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/welcome
git commit -m "feat(welcome): shared CodeTabs and IgnitionCta components"
```

---

### Task 4: Suppress global Header on /welcome* routes

**Files:**
- Modify: `src/components/Header.tsx:92` (the `export const Header = () => {` line)
- Test: `src/components/Header.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Header.test.tsx
import { Header } from "@/components/Header";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

const renderAt = (path: string) =>
	render(
		<HelmetProvider>
			<MemoryRouter initialEntries={[path]}>
				<Header />
			</MemoryRouter>
		</HelmetProvider>,
	);

describe("Header route suppression", () => {
	it("renders nothing on /welcome", () => {
		const { container } = renderAt("/welcome");
		expect(container.innerHTML).toBe("");
	});

	it("renders nothing on /welcome2 and /welcome3", () => {
		expect(renderAt("/welcome2").container.innerHTML).toBe("");
		expect(renderAt("/welcome3").container.innerHTML).toBe("");
	});

	it("still renders the nav on other routes", () => {
		const { container } = renderAt("/pricing");
		expect(container.innerHTML).not.toBe("");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: FAIL — `/welcome` renders the full header markup

- [ ] **Step 3: Implement the suppression wrapper**

In `src/components/Header.tsx`, rename the existing component (line 92) from `Header` to `HeaderInner` (keep everything inside unchanged), and add a small exported wrapper ABOVE it. The wrapper avoids conditional-hook violations — `HeaderInner` keeps its many hooks, and the wrapper has exactly one.

```tsx
/**
 * Global site header. Suppressed entirely on the standalone immersive
 * /welcome* landing pages, which render their own WelcomeNav.
 */
export const Header = () => {
	const location = useLocation();
	if (location.pathname.startsWith("/welcome")) return null;
	return <HeaderInner />;
};

const HeaderInner = () => {
	// ...existing component body, unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Header.test.tsx
git commit -m "feat(welcome): suppress global header on standalone /welcome* routes"
```

---

### Task 5: Route registration + AgentDemoPage skeleton (hero, nav, footer)

**Files:**
- Create: `src/pages/welcome/AgentDemoPage.tsx`
- Test: `src/pages/welcome/AgentDemoPage.test.tsx`
- Modify: `src/App.tsx` (lazy imports ~line 34, routes before the `*` catch-all at line 98)
- Modify: `ssg/routes.ts` (`ROUTE_CHUNK_MAP` before the home entry at line 48; `PRERENDER_ROUTES` end of array)
- Modify: `ssg/prerender.ts:126` (sitemap exclusion)

- [ ] **Step 1: Write the failing page test**

```tsx
// src/pages/welcome/AgentDemoPage.test.tsx
import AgentDemoPage from "@/pages/welcome/AgentDemoPage";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

const renderPage = () =>
	render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/welcome"]}>
				<AgentDemoPage />
			</MemoryRouter>
		</HelmetProvider>,
	);

describe("AgentDemoPage", () => {
	it("renders the hero headline", () => {
		renderPage();
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: /fintech apis your ai agent can ship/i,
			}),
		).toBeInTheDocument();
	});

	it("links the primary CTA to /signup", () => {
		renderPage();
		const ctas = screen.getAllByRole("link", { name: /get sandbox key/i });
		expect(ctas.length).toBeGreaterThan(0);
		expect(ctas[0]).toHaveAttribute("href", "/signup");
	});

	it("sets a noindex robots meta", async () => {
		const helmetContext: { helmet?: { meta: { toString(): string } } } = {};
		render(
			<HelmetProvider context={helmetContext}>
				<MemoryRouter initialEntries={["/welcome"]}>
					<AgentDemoPage />
				</MemoryRouter>
			</HelmetProvider>,
		);
		expect(helmetContext.helmet?.meta.toString()).toContain("noindex");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx`
Expected: FAIL — `Cannot find module '@/pages/welcome/AgentDemoPage'`

- [ ] **Step 3: Create the page skeleton**

Storyboard reference: `docs/welcome-landing-storyboards.md` §A1, §A6. The hero terminal types its transcript line-by-line with a JS interval; under reduced motion (or before JS) the full transcript is rendered statically — the SSG markup always contains all four lines (typing only re-plays client-side after mount, which is hydration-safe because the base render matches SSG).

```tsx
// src/pages/welcome/AgentDemoPage.tsx
import { CodeTabs } from "@/components/welcome/CodeTabs";
import { IgnitionCta } from "@/components/welcome/IgnitionCta";
import { useMouseParallax } from "@/components/welcome/motion/useMouseParallax";
import { usePrefersReducedMotion } from "@/components/welcome/motion/usePrefersReducedMotion";
import { useReveal } from "@/components/welcome/motion/useReveal";
import { WelcomeFooter } from "@/components/welcome/WelcomeFooter";
import { WelcomeNav } from "@/components/welcome/WelcomeNav";
import "@/components/welcome/welcome.css";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const TERMINAL_LINES = [
	"$ claude mcp add eko",
	"✓ connected · 14 tools available",
	"> verify PAN ABCDE1234F for vendor onboarding",
	"✓ verified · 240ms",
] as const;

/** Hero terminal that re-types its transcript on the client; static for SSG/reduced-motion. */
const HeroTerminal = () => {
	const reducedMotion = usePrefersReducedMotion();
	const tiltRef = useMouseParallax<HTMLDivElement>(6);
	// SSG/base render shows everything; typing replays after mount.
	const [visibleLines, setVisibleLines] = useState(TERMINAL_LINES.length);

	useEffect(() => {
		if (reducedMotion) return;
		setVisibleLines(0);
		const id = window.setInterval(() => {
			setVisibleLines((count) => {
				if (count >= TERMINAL_LINES.length) {
					window.clearInterval(id);
					return count;
				}
				return count + 1;
			});
		}, 700);
		return () => window.clearInterval(id);
	}, [reducedMotion]);

	return (
		<div ref={tiltRef} className="welcome-perspective max-w-xl mx-auto">
			<div
				className="welcome-tilt rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60 p-5 font-mono text-sm text-left"
				aria-label="Example agent session"
			>
				<div className="flex gap-1.5 mb-4" aria-hidden>
					<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
					<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
					<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
				</div>
				{TERMINAL_LINES.map((line, index) => (
					<p
						key={line}
						className={cn(
							"leading-7",
							line.startsWith("✓") ? "text-green-400" : "text-[#9aa4b2]",
							index === visibleLines - 1 && "welcome-caret",
							index >= visibleLines && "invisible",
						)}
					>
						{line}
					</p>
				))}
			</div>
		</div>
	);
};

/** /welcome — Page A "The Agent Demo". Storyboard: docs/welcome-landing-storyboards.md §A. */
const AgentDemoPage = () => {
	// Arms CSS pre-states only after mount so SSG markup is never hidden.
	useEffect(() => {
		document.documentElement.classList.add("js-motion");
		return () => document.documentElement.classList.remove("js-motion");
	}, []);

	return (
		<div className="welcome-page">
			<Helmet>
				<title>Eko EPS 2.0 — Fintech APIs your AI agent can ship</title>
				<meta
					name="description"
					content="Open-source SDKs, an MCP server and verification APIs for Bharat — first API call in under 10 minutes."
				/>
				<meta name="robots" content="noindex" />
			</Helmet>
			<WelcomeNav />

			{/* §A1 — Hero: Live Agent Session */}
			<header className="relative welcome-dotgrid welcome-bloom-tr pt-36 pb-24 px-5 text-center overflow-hidden">
				<p className="font-mono text-xs tracking-[0.25em] text-eko-gold uppercase">
					Open-source · Agent-native · Built for Bharat
				</p>
				<h1 className="mt-6 text-5xl sm:text-7xl font-extrabold tracking-tighter max-w-4xl mx-auto">
					Fintech APIs your <span className="text-eko-gold">AI agent</span> can
					ship.
				</h1>
				<p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
					Verification, payouts and bill-pay for Bharat — open-source SDKs, an
					MCP server, and a first API call in under 10 minutes.
				</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
					<Link
						to="/signup"
						className="bg-eko-gold hover:bg-eko-gold-hover text-eko-navy font-semibold rounded-lg px-7 py-3.5 transition-colors"
					>
						Get sandbox key
					</Link>
					<a
						href="https://github.com/ekoindia"
						target="_blank"
						rel="noopener noreferrer"
						className="border border-white/20 hover:border-white/50 text-white rounded-lg px-7 py-3.5 transition-colors"
					>
						Star on GitHub
					</a>
				</div>
				<div className="mt-16">
					<HeroTerminal />
				</div>
				<p className="mt-14 text-xs text-white/40 flex flex-col items-center gap-2">
					scroll to watch the integration
					<ChevronDown className="w-4 h-4 welcome-scroll-hint" aria-hidden />
				</p>
			</header>

			{/* §A2 inserted by Task 6, §A3–A5 inserted by Task 7 */}

			{/* §A6 — Final CTA */}
			<IgnitionCta heading="Your agent is ready. Are you?" />
			<WelcomeFooter />
		</div>
	);
};

export default AgentDemoPage;
```

Note: `CodeTabs` and `useReveal` are imported now but first used in Task 7 — if the linter complains about unused imports, add them in Task 7 instead.

- [ ] **Step 4: Register routes**

`src/App.tsx` — after the `PricingPage` lazy import (line ~34):

```tsx
const AgentDemoPage = lazy(() => import("./pages/welcome/AgentDemoPage"));
const LayeredStackPage = lazy(() => import("./pages/welcome/LayeredStackPage"));
const TerminalCanvasPage = lazy(
	() => import("./pages/welcome/TerminalCanvasPage"),
);
```

Before the catch-all `<Route path="*" ...>` (line 98-99):

```tsx
{/* EPS 2.0 landing previews (standalone chrome, noindex) */}
<Route path="/welcome" element={<AgentDemoPage />} />
<Route path="/welcome2" element={<LayeredStackPage />} />
<Route path="/welcome3" element={<TerminalCanvasPage />} />
```

IMPORTANT: `LayeredStackPage`/`TerminalCanvasPage` don't exist until Task 9. To keep the build green in this task, create minimal placeholder files now:

```tsx
// src/pages/welcome/LayeredStackPage.tsx (placeholder — replaced in Task 9)
/** /welcome2 — Page B "Layered Stack". Storyboard: docs/welcome-landing-storyboards.md §B. */
const LayeredStackPage = () => null;
export default LayeredStackPage;
```

```tsx
// src/pages/welcome/TerminalCanvasPage.tsx (placeholder — replaced in Task 10)
/** /welcome3 — Page C "Terminal as Canvas". Storyboard: docs/welcome-landing-storyboards.md §C. */
const TerminalCanvasPage = () => null;
export default TerminalCanvasPage;
```

`ssg/routes.ts` — in `ROUTE_CHUNK_MAP` just above the home entry (line 48):

```ts
// EPS 2.0 landing previews
{ pattern: /^\/welcome$/, src: "src/pages/welcome/AgentDemoPage.tsx" },
{ pattern: /^\/welcome2$/, src: "src/pages/welcome/LayeredStackPage.tsx" },
{ pattern: /^\/welcome3$/, src: "src/pages/welcome/TerminalCanvasPage.tsx" },
```

In `PRERENDER_ROUTES`, after `"/signup"`:

```ts
// EPS 2.0 landing previews (noindex — excluded from sitemap in prerender.ts)
"/welcome",
"/welcome2",
"/welcome3",
```

`ssg/prerender.ts` line 126 — exclude noindex routes from the sitemap:

```ts
await generateSitemap(
	routes.filter((route) => !route.startsWith("/welcome")),
	outDir,
);
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (3 tests), no type errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/welcome src/App.tsx ssg/routes.ts ssg/prerender.ts
git commit -m "feat(welcome): /welcome agent-demo hero + route registration for landing previews"
```

---

### Task 6: Page A §A2 — pinned scrollytelling (the showpiece)

**Files:**
- Create: `src/pages/welcome/ScrollyIntegration.tsx`
- Modify: `src/pages/welcome/AgentDemoPage.tsx` (insert section at the `§A2 inserted by Task 6` marker)
- Test: `src/pages/welcome/AgentDemoPage.test.tsx` (add reduced-motion test)

Storyboard reference: `docs/welcome-landing-storyboards.md` §A2. Tall 400vh wrapper, sticky stage, `useScrollProgress` scrubs 4 steps. Mobile (<lg) and reduced-motion render a plain vertical step list instead — same content, no pin.

- [ ] **Step 1: Add the failing test**

Append to `src/pages/welcome/AgentDemoPage.test.tsx`:

```tsx
import { vi } from "vitest";

describe("AgentDemoPage scrollytelling", () => {
	it("renders all four integration steps in the DOM (static fallback)", () => {
		// jsdom has no real matchMedia: force reduced-motion path
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);
		renderPage();
		expect(screen.getByText(/eko_verify_pan/i)).toBeInTheDocument();
		expect(screen.getByText(/eko_verify_gst/i)).toBeInTheDocument();
		expect(screen.getByText(/eko_verify_bank/i)).toBeInTheDocument();
		expect(screen.getByText(/vendor cleared in 3 calls/i)).toBeInTheDocument();
		vi.unstubAllGlobals();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx`
Expected: FAIL — `eko_verify_pan` not found

- [ ] **Step 3: Create `ScrollyIntegration.tsx`**

```tsx
// src/pages/welcome/ScrollyIntegration.tsx
import { usePrefersReducedMotion } from "@/components/welcome/motion/usePrefersReducedMotion";
import { useScrollProgress } from "@/components/welcome/motion/useScrollProgress";
import { cn } from "@/lib/utils";

interface IntegrationStep {
	ask: string;
	tool: string;
	result: string;
	verdict?: boolean;
}

const STEPS: IntegrationStep[] = [
	{
		ask: "Verify this vendor before payout",
		tool: "eko_verify_pan",
		result: "✓ PAN valid · name match 0.97",
	},
	{
		ask: "Check their GST registration",
		tool: "eko_verify_gst",
		result: "✓ GSTIN active · bound to PAN",
	},
	{
		ask: "And the bank account",
		tool: "eko_verify_bank",
		result: "✓ penny-less verify · account live",
	},
	{
		ask: "Done?",
		tool: "verdict",
		result: "Vendor cleared in 3 calls · 0.9s · ₹7.40",
		verdict: true,
	},
];

/** One agent tool-call card in the 3D fan-stack. */
const StepCard = ({
	step,
	state,
	index,
}: {
	step: IntegrationStep;
	/** entering = flying in from z-space, settled = in the fan, hidden = not yet */
	state: "hidden" | "entering" | "settled";
	index: number;
}) => (
	<div
		className={cn(
			"absolute inset-x-0 rounded-xl border bg-[#0d1117] p-5 font-mono text-sm transition-all duration-500 ease-out",
			step.verdict
				? "border-eko-gold shadow-[0_0_40px_rgba(247,181,30,0.25)]"
				: "border-white/10 shadow-xl shadow-black/50",
			state === "hidden" && "opacity-0",
		)}
		style={{
			top: `${index * 56}px`,
			transform:
				state === "hidden"
					? "translateZ(-600px) rotateY(12deg)"
					: `translateZ(${-(STEPS.length - 1 - index) * 40}px)`,
		}}
	>
		{step.verdict ? (
			<p className="text-eko-gold font-semibold">{step.result}</p>
		) : (
			<>
				<p className="text-white/40 text-xs">{step.tool}</p>
				<p className="text-green-400 mt-1.5">{step.result}</p>
			</>
		)}
	</div>
);

/**
 * §A2 — "The 60-second integration": pinned scrollytelling.
 * Desktop: 400vh wrapper, sticky stage, scroll scrubs steps into a 3D fan.
 * Mobile / reduced-motion: plain vertical list with the same content.
 */
export const ScrollyIntegration = () => {
	const reducedMotion = usePrefersReducedMotion();
	const { ref, progress } = useScrollProgress<HTMLElement>();
	// Map 0→1 progress onto step count (step k completes at (k+1)/N progress)
	const activeSteps = Math.min(
		STEPS.length,
		Math.floor(progress * (STEPS.length + 0.999)),
	);

	const staticList = (
		<ol className="space-y-6 max-w-xl mx-auto px-5">
			{STEPS.map((step) => (
				<li
					key={step.tool}
					className={cn(
						"rounded-xl border bg-[#0d1117] p-5 font-mono text-sm",
						step.verdict ? "border-eko-gold" : "border-white/10",
					)}
				>
					<p className="text-white/70 font-sans mb-2">“{step.ask}”</p>
					{step.verdict ? (
						<p className="text-eko-gold font-semibold">{step.result}</p>
					) : (
						<>
							<p className="text-white/40 text-xs">{step.tool}</p>
							<p className="text-green-400 mt-1.5">{step.result}</p>
						</>
					)}
				</li>
			))}
		</ol>
	);

	return (
		<section aria-label="The 60-second integration">
			<div className="text-center px-5 pt-24 pb-12">
				<h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
					The 60-second integration
				</h2>
				<p className="mt-4 text-white/60">
					Watch an agent clear a vendor — live, as you scroll.
				</p>
			</div>

			{reducedMotion ? (
				<div className="pb-24">{staticList}</div>
			) : (
				<>
					{/* Mobile: static list */}
					<div className="lg:hidden pb-24">{staticList}</div>

					{/* Desktop: pinned scrub stage */}
					<div ref={ref} className="hidden lg:block h-[400vh] relative">
						<div className="sticky top-0 h-screen flex items-center">
							<div className="max-w-6xl mx-auto w-full grid grid-cols-2 gap-16 px-5 items-center">
								{/* Left: progress rail + asks */}
								<div className="relative pl-8">
									<div
										className="absolute left-0 top-1 bottom-1 w-px bg-white/10"
										aria-hidden
									/>
									{STEPS.map((step, index) => (
										<div key={step.tool} className="relative mb-10">
											<span
												className={cn(
													"absolute -left-8 top-1.5 w-2.5 h-2.5 rounded-full transition-colors duration-300 -translate-x-1/2",
													index < activeSteps
														? "bg-eko-gold"
														: "bg-white/15",
												)}
												aria-hidden
											/>
											<p
												className={cn(
													"text-xl font-semibold transition-opacity duration-300",
													index < activeSteps
														? "opacity-100"
														: "opacity-30",
												)}
											>
												“{step.ask}”
											</p>
										</div>
									))}
								</div>
								{/* Right: 3D fan-stack of tool-call cards */}
								<div
									className="welcome-perspective relative h-80"
									style={{ transformStyle: "preserve-3d" }}
								>
									{STEPS.map((step, index) => (
										<StepCard
											key={step.tool}
											step={step}
											index={index}
											state={
												index < activeSteps - 1
													? "settled"
													: index === activeSteps - 1
														? "entering"
														: "hidden"
											}
										/>
									))}
								</div>
							</div>
						</div>
					</div>
				</>
			)}
		</section>
	);
};
```

- [ ] **Step 4: Insert into `AgentDemoPage.tsx`**

Replace the marker comment `{/* §A2 inserted by Task 6, §A3–A5 inserted by Task 7 */}` with:

```tsx
{/* §A2 — The 60-Second Integration */}
<ScrollyIntegration />

{/* §A3–A5 inserted by Task 7 */}
```

And add the import: `import { ScrollyIntegration } from "@/pages/welcome/ScrollyIntegration";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/pages/welcome
git commit -m "feat(welcome): pinned scrollytelling integration demo on /welcome"
```

---

### Task 7: Page A §A3–A5 — surfaces, open-source orbit, Bharat strip

**Files:**
- Modify: `src/pages/welcome/AgentDemoPage.tsx` (replace the `§A3–A5 inserted by Task 7` marker)
- Test: `src/pages/welcome/AgentDemoPage.test.tsx` (add content assertions)

Storyboard reference: `docs/welcome-landing-storyboards.md` §A3–A5.

- [ ] **Step 1: Add the failing test**

Append to the main `describe` in `AgentDemoPage.test.tsx`:

```tsx
it("renders the surfaces, open-source and Bharat sections", () => {
	renderPage();
	expect(
		screen.getByRole("heading", { name: /one endpoint registry/i }),
	).toBeInTheDocument();
	expect(
		screen.getByRole("heading", {
			name: /everything we build is open/i,
		}),
	).toBeInTheDocument();
	expect(screen.getByText(/@eko-eps\/core/i)).toBeInTheDocument();
	expect(screen.getByText(/241/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx`
Expected: FAIL — heading "One endpoint registry" not found

- [ ] **Step 3: Implement the three sections**

Add these local components in `AgentDemoPage.tsx` (above the page component), then replace the `{/* §A3–A5 inserted by Task 7 */}` marker with `<SurfacesSection />`, `<OpenSourceSection />`, `<BharatStrip />` in order.

```tsx
const REPOS = [
	"@eko-eps/core",
	"@eko-eps/sdk",
	"@eko-eps/mcp",
	"@eko-eps/cli",
	"@eko-eps/llms-tools",
] as const;

/** §A3 — Three surfaces, one registry. */
const SurfacesSection = () => {
	const { ref, isVisible } = useReveal<HTMLElement>();
	return (
		<section
			ref={ref}
			className={cn(
				"py-24 px-5 max-w-4xl mx-auto text-center welcome-reveal",
				isVisible && "is-visible",
			)}
		>
			<h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
				One endpoint registry. Three doors in.
			</h2>
			<p className="mt-4 text-white/60 max-w-xl mx-auto">
				The same typed registry drives the MCP server, the SDK and the CLI.
				Pick a door — your agent already knows the way.
			</p>
			<div className="mt-12 text-left">
				<CodeTabs />
			</div>
		</section>
	);
};

/** §A4 — Open by default: repo cards orbiting the regulated gold core. */
const OpenSourceSection = () => {
	const { ref, isVisible } = useReveal<HTMLElement>();
	const reducedMotion = usePrefersReducedMotion();
	return (
		<section
			ref={ref}
			className={cn(
				"py-24 px-5 text-center welcome-reveal overflow-hidden",
				isVisible && "is-visible",
			)}
		>
			<h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto">
				Everything we build is open.{" "}
				<span className="text-eko-gold">The rails are regulated.</span>
			</h2>
			<p className="mt-4 text-white/60 max-w-xl mx-auto">
				MIT-licensed SDKs, MCP server, CLI and recipes — the only proprietary
				piece is the licensed bank/NPCI gateway they talk to.
			</p>

			{reducedMotion ? (
				/* Static ring fallback */
				<ul className="mt-14 flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
					{REPOS.map((repo) => (
						<li
							key={repo}
							className="rounded-lg border border-white/10 bg-[#0d1117] px-4 py-2 font-mono text-xs"
						>
							{repo} <span className="text-white/40">· MIT</span>
						</li>
					))}
				</ul>
			) : (
				<div className="relative mx-auto mt-14 h-80 w-80 sm:h-96 sm:w-96">
					{/* Gold core */}
					<div className="absolute inset-0 m-auto h-28 w-28 rounded-full bg-eko-gold/15 border border-eko-gold/50 flex items-center justify-center text-center">
						<p className="font-mono text-[10px] text-eko-gold leading-tight px-2">
							Licensed rails
							<br />
							RBI · NPCI
						</p>
					</div>
					{/* Orbit ring */}
					<div className="absolute inset-0 welcome-orbit-ring">
						{REPOS.map((repo, index) => {
							const angle = (index / REPOS.length) * 2 * Math.PI;
							const radius = 42; // % of container
							return (
								<div
									key={repo}
									className="absolute welcome-orbit-item"
									style={{
										left: `${50 + radius * Math.cos(angle)}%`,
										top: `${50 + radius * Math.sin(angle)}%`,
										translate: "-50% -50%",
									}}
								>
									<span className="block rounded-lg border border-white/10 bg-[#0d1117] px-3 py-1.5 font-mono text-[11px] whitespace-nowrap shadow-lg shadow-black/40">
										{repo} <span className="text-white/40">· MIT</span>
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			<ul className="mt-12 flex flex-wrap justify-center gap-3 text-xs text-white/50">
				<li className="rounded-full border border-white/10 px-3 py-1">DCO sign-off, no CLA</li>
				<li className="rounded-full border border-white/10 px-3 py-1">good-first-issues seeded</li>
				<li className="rounded-full border border-white/10 px-3 py-1">bounties paid in API credits</li>
			</ul>
		</section>
	);
};

const BHARAT_STATS = [
	{ value: 241, suffix: "B+", label: "UPI transactions a year" },
	{ value: 17, suffix: "M+", label: "developers in India" },
	{ value: 50, suffix: "K+", label: "Eko micro-entrepreneurs" },
	{ value: 10, prefix: "<", suffix: " min", label: "to your first API call" },
] as const;

/** §A5 — Bharat scale strip with one-shot count-up. */
const BharatStrip = () => {
	const { ref, isVisible } = useReveal<HTMLElement>();
	const reducedMotion = usePrefersReducedMotion();
	// Starts at 1 so SSG markup and pre-animation renders show full values;
	// the effect rewinds to 0 and replays only when animating client-side.
	const [animated, setAnimated] = useState(1); // 0→1 eased fraction

	useEffect(() => {
		if (!isVisible || reducedMotion) {
			if (isVisible) setAnimated(1);
			return;
		}
		setAnimated(0);
		const start = performance.now();
		const DURATION = 1200;
		let frame = 0;
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / DURATION);
			setAnimated(1 - (1 - t) ** 3); // ease-out cubic
			if (t < 1) frame = window.requestAnimationFrame(tick);
		};
		frame = window.requestAnimationFrame(tick);
		return () => window.cancelAnimationFrame(frame);
	}, [isVisible, reducedMotion]);

	return (
		<section
			ref={ref}
			className="py-20 border-y border-eko-gold/15"
			aria-label="Bharat scale"
		>
			<dl className="max-w-5xl mx-auto px-5 grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
				{BHARAT_STATS.map((stat) => (
					<div key={stat.label}>
						<dt className="sr-only">{stat.label}</dt>
						<dd className="text-4xl sm:text-5xl font-extrabold text-eko-gold font-mono">
							{"prefix" in stat ? stat.prefix : ""}
							{Math.round(stat.value * animated)}
							{stat.suffix}
						</dd>
						<dd className="mt-2 text-sm text-white/50">{stat.label}</dd>
					</div>
				))}
			</dl>
		</section>
	);
};
```

Note on SSG: before hydration `isVisible` is `false` in the initial client render only when IO exists; the prerendered HTML (no IO in node) renders `isVisible=true` with full values — content never missing from static markup.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/pages/welcome/AgentDemoPage.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (5 tests), no type errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/welcome
git commit -m "feat(welcome): surfaces, open-source orbit and Bharat sections on /welcome"
```

---

### Task 8: Page A verification (build + browser)

**Files:** none created — verification only.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; output lists prerendered `/welcome/index.html` (plus `/welcome2`, `/welcome3` placeholders)

- [ ] **Step 2: Static-markup check**

Run: `grep -c "Fintech APIs your" dist/welcome/index.html && grep -c "noindex" dist/welcome/index.html`
Expected: both ≥ 1 (hero text and robots meta present in prerendered HTML)

- [ ] **Step 3: Preview smoke test**

Run: `npm run preview` (background), then open `http://localhost:4173/welcome/` — NOTE the trailing slash (vite preview serves the homepage for no-slash prerendered routes).
Verify: dark hero renders, terminal types, global site header absent, scrollytelling pins and scrubs on desktop width, CTA links to /signup.
For deeper checks use Chrome DevTools MCP: scroll-performance trace on the pinned section; check console for errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A src/ ssg/
git commit -m "fix(welcome): post-build polish on /welcome"
```
(Skip if nothing changed.)

---

### Task 9: Page B — /welcome2 "Layered Stack"

> Tasks 9 and 10 are independent of each other (both depend only on Tasks 1–5) and may be dispatched to parallel subagents.

**Files:**
- Modify: `src/pages/welcome/LayeredStackPage.tsx` (replace Task 5 placeholder)
- Test: `src/pages/welcome/LayeredStackPage.test.tsx`

Storyboard reference: `docs/welcome-landing-storyboards.md` §B (all six sections).

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/welcome/LayeredStackPage.test.tsx
import LayeredStackPage from "@/pages/welcome/LayeredStackPage";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

const renderPage = () =>
	render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/welcome2"]}>
				<LayeredStackPage />
			</MemoryRouter>
		</HelmetProvider>,
	);

describe("LayeredStackPage", () => {
	it("renders the hero headline", () => {
		renderPage();
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: /the open fintech stack for bharat/i,
			}),
		).toBeInTheDocument();
	});

	it("renders the four pillars", () => {
		renderPage();
		expect(screen.getByText(/minutes, not weeks/i)).toBeInTheDocument();
		expect(screen.getByText(/compliant by default/i)).toBeInTheDocument();
		expect(screen.getByText(/open by default/i)).toBeInTheDocument();
		expect(screen.getByText(/built for bharat's last mile/i)).toBeInTheDocument();
	});

	it("links the primary CTA to /signup and sets noindex", () => {
		const helmetContext: { helmet?: { meta: { toString(): string } } } = {};
		render(
			<HelmetProvider context={helmetContext}>
				<MemoryRouter initialEntries={["/welcome2"]}>
					<LayeredStackPage />
				</MemoryRouter>
			</HelmetProvider>,
		);
		expect(
			screen.getAllByRole("link", { name: /get sandbox key/i })[0],
		).toHaveAttribute("href", "/signup");
		expect(helmetContext.helmet?.meta.toString()).toContain("noindex");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/welcome/LayeredStackPage.test.tsx`
Expected: FAIL — placeholder renders null

- [ ] **Step 3: Implement the page**

```tsx
// src/pages/welcome/LayeredStackPage.tsx
import { CodeTabs } from "@/components/welcome/CodeTabs";
import { IgnitionCta } from "@/components/welcome/IgnitionCta";
import { useMouseParallax } from "@/components/welcome/motion/useMouseParallax";
import { useReveal } from "@/components/welcome/motion/useReveal";
import { WelcomeFooter } from "@/components/welcome/WelcomeFooter";
import { WelcomeNav } from "@/components/welcome/WelcomeNav";
import "@/components/welcome/welcome.css";
import { cn } from "@/lib/utils";
import { Github, Landmark, ShieldCheck, Timer } from "lucide-react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const STACK_LAYERS = [
	{ name: "Verify", chips: ["PAN", "GST", "Bank", "DigiLocker", "RC/DL"] },
	{ name: "Pay out", chips: ["IMPS", "UPI", "Bulk"] },
	{ name: "Collect", chips: ["BBPS", "UPI", "QR"] },
] as const;

/** §B1 hero centerpiece: three glass layers stacked in z-space with mouse parallax. */
const FloatingStack = () => {
	const tiltRef = useMouseParallax<HTMLDivElement>(7);
	return (
		<div ref={tiltRef} className="welcome-perspective mx-auto max-w-md">
			<div
				className="welcome-tilt relative h-72"
				style={{ transformStyle: "preserve-3d" }}
			>
				{STACK_LAYERS.map((layer, index) => (
					<div
						key={layer.name}
						className="absolute inset-x-0 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm p-5 shadow-2xl shadow-black/50"
						style={{
							top: `${index * 72}px`,
							transform: `translateZ(${-index * 80}px)`,
						}}
					>
						<p className="font-semibold text-lg">{layer.name}</p>
						<ul className="mt-2 flex flex-wrap gap-1.5">
							{layer.chips.map((chip) => (
								<li
									key={chip}
									className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] text-white/60"
								>
									{chip}
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</div>
	);
};

const PILLARS = [
	{
		icon: Timer,
		title: "Minutes, not weeks",
		body: "Instant sandbox key, one-command install, first API call in under 10 minutes.",
	},
	{
		icon: ShieldCheck,
		title: "Compliant by default",
		body: "RBI, NPCI and DPDP guardrails encoded into SDKs, recipes and onboarding.",
	},
	{
		icon: Github,
		title: "Open by default",
		body: "Everything we build is open source. The rails are regulated — that's the only closed bit.",
	},
	{
		icon: Landmark,
		title: "Built for Bharat's last mile",
		body: "Verification + money movement + agent-network APIs mapped to Tier-2/3 reality.",
	},
] as const;

const BENTO_TILES = [
	{
		title: "Onboard & Verify",
		body: "PAN · GST · Aadhaar · bank · DigiLocker · Name-Match",
		size: "lg" as const,
		snippet: 'await eko.verify.pan({ pan: "ABCDE1234F" })',
	},
	{ title: "Pay Out", body: "Payouts · UPI · DMT", size: "md" as const },
	{ title: "Collect", body: "BBPS · UPI · QR", size: "md" as const },
	{
		title: "Banking-at-the-Counter",
		body: "AePS + DMT + BBPS",
		size: "sm" as const,
	},
	{
		title: "Fleet & Workforce Verify",
		body: "RC · DL · Vehicle · EPFO",
		size: "sm" as const,
	},
] as const;

/** /welcome2 — Page B "Layered Stack". Storyboard: docs/welcome-landing-storyboards.md §B. */
const LayeredStackPage = () => {
	useEffect(() => {
		document.documentElement.classList.add("js-motion");
		return () => document.documentElement.classList.remove("js-motion");
	}, []);

	const pillars = useReveal<HTMLDivElement>();
	const bento = useReveal<HTMLDivElement>();
	const code = useReveal<HTMLElement>();

	return (
		<div className="welcome-page">
			<Helmet>
				<title>Eko EPS 2.0 — The open fintech stack for Bharat</title>
				<meta
					name="description"
					content="Open-source SDKs, MCP server and self-serve fintech APIs — verification, payouts and collections for Bharat."
				/>
				<meta name="robots" content="noindex" />
			</Helmet>
			<WelcomeNav />

			{/* §B1 — Hero: floating stack */}
			<header className="relative welcome-dotgrid welcome-bloom-tr pt-36 pb-28 px-5 text-center overflow-hidden">
				<h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter max-w-3xl mx-auto">
					The open fintech stack for{" "}
					<span className="text-eko-gold">Bharat.</span>
				</h1>
				<p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
					Ship KYC, payouts and bill-pay in minutes — with agents that build
					the integration for you.
				</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
					<Link
						to="/signup"
						className="bg-eko-gold hover:bg-eko-gold-hover text-eko-navy font-semibold rounded-lg px-7 py-3.5 transition-colors"
					>
						Get sandbox key
					</Link>
					<a
						href="https://github.com/ekoindia"
						target="_blank"
						rel="noopener noreferrer"
						className="border border-white/20 hover:border-white/50 text-white rounded-lg px-7 py-3.5 transition-colors"
					>
						Star on GitHub
					</a>
				</div>
				<div className="mt-20 pb-24">
					<FloatingStack />
				</div>
			</header>

			{/* §B2 — Four pillars */}
			<section className="py-24 px-5 max-w-6xl mx-auto">
				<div
					ref={pillars.ref}
					className={cn(
						"grid sm:grid-cols-2 lg:grid-cols-4 gap-5 welcome-stagger",
						pillars.isVisible && "is-visible",
					)}
				>
					{PILLARS.map((pillar) => (
						<div
							key={pillar.title}
							className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-transform duration-300 hover:-translate-y-1"
						>
							<pillar.icon className="w-6 h-6 text-eko-gold" aria-hidden />
							<h2 className="mt-4 font-semibold text-lg">{pillar.title}</h2>
							<p className="mt-2 text-sm text-white/55">{pillar.body}</p>
						</div>
					))}
				</div>
			</section>

			{/* §B3 — Products bento */}
			<section className="py-12 px-5 max-w-6xl mx-auto">
				<h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-center">
					APIs bundled by the job to be done
				</h2>
				<div
					ref={bento.ref}
					className={cn(
						"mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 welcome-stagger",
						bento.isVisible && "is-visible",
					)}
				>
					{BENTO_TILES.map((tile) => (
						<div
							key={tile.title}
							className={cn(
								"group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-eko-gold/50",
								tile.size === "lg" && "sm:col-span-2 lg:row-span-2",
								tile.size === "md" && "lg:col-span-2",
							)}
						>
							<h3 className="font-semibold text-lg">{tile.title}</h3>
							<p className="mt-2 text-sm text-white/55">{tile.body}</p>
							{"snippet" in tile && (
								<pre className="mt-6 rounded-lg bg-[#0d1117] border border-white/10 p-4 font-mono text-xs text-[#9aa4b2] overflow-x-auto">
									{tile.snippet}
								</pre>
							)}
						</div>
					))}
				</div>
			</section>

			{/* §B4 — Code / MCP: prose left, sticky code right */}
			<section
				ref={code.ref}
				className={cn(
					"py-24 px-5 max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 welcome-reveal",
					code.isVisible && "is-visible",
				)}
			>
				<div>
					<h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
						Your agent already knows this API.
					</h2>
					<p className="mt-6 text-white/60 leading-relaxed">
						One typed endpoint registry drives the MCP server, the TypeScript
						SDK and the CLI. llms-full.txt and markdown doc mirrors mean AI
						coding assistants integrate Eko without guesswork.
					</p>
					<p className="mt-4 text-white/60 leading-relaxed">
						Add the MCP server to Claude Code or Cursor and the integration
						writes itself — verification tools are read-only and
						agent-safe by design.
					</p>
				</div>
				<div className="lg:sticky lg:top-24 self-start">
					<CodeTabs />
				</div>
			</section>

			{/* §B5 — Open-source + metrics (condensed) */}
			<section className="py-20 border-y border-eko-gold/15 px-5 text-center">
				<h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
					Everything we build is open.{" "}
					<span className="text-eko-gold">The rails are regulated.</span>
				</h2>
				<ul className="mt-8 flex flex-wrap justify-center gap-3 font-mono text-xs">
					{["@eko-eps/core", "@eko-eps/sdk", "@eko-eps/mcp", "@eko-eps/cli"].map(
						(repo) => (
							<li
								key={repo}
								className="rounded-lg border border-white/10 bg-[#0d1117] px-4 py-2"
							>
								{repo} <span className="text-white/40">· MIT</span>
							</li>
						),
					)}
				</ul>
				<dl className="mt-12 max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
					{[
						["241B+", "UPI txns a year"],
						["17M+", "Indian developers"],
						["50K+", "micro-entrepreneurs"],
						["<10 min", "to first API call"],
					].map(([value, label]) => (
						<div key={label}>
							<dd className="text-3xl font-extrabold text-eko-gold font-mono">
								{value}
							</dd>
							<dd className="mt-1 text-xs text-white/50">{label}</dd>
						</div>
					))}
				</dl>
			</section>

			{/* §B6 — CTA finale */}
			<IgnitionCta heading="Build on the open stack." />
			<WelcomeFooter />
		</div>
	);
};

export default LayeredStackPage;
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/pages/welcome/LayeredStackPage.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (3 tests), no type errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/welcome/LayeredStackPage.tsx src/pages/welcome/LayeredStackPage.test.tsx
git commit -m "feat(welcome): /welcome2 layered-stack landing variant"
```

---

### Task 10: Page C — /welcome3 "Terminal as Canvas"

**Files:**
- Modify: `src/pages/welcome/TerminalCanvasPage.tsx` (replace Task 5 placeholder)
- Test: `src/pages/welcome/TerminalCanvasPage.test.tsx`

Storyboard reference: `docs/welcome-landing-storyboards.md` §C. The whole page is a terminal session; each section opens with a typed command and its "output" panel bursts out of the terminal plane on reveal. All text is real text; decorative prompt glyphs are `aria-hidden`; reduced motion pre-expands everything (the burst/typing effects are CSS-only on top of fully-present content, so the welcome.css reduced-motion kill-switch covers them).

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/welcome/TerminalCanvasPage.test.tsx
import TerminalCanvasPage from "@/pages/welcome/TerminalCanvasPage";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

const renderPage = () =>
	render(
		<HelmetProvider>
			<MemoryRouter initialEntries={["/welcome3"]}>
				<TerminalCanvasPage />
			</MemoryRouter>
		</HelmetProvider>,
	);

describe("TerminalCanvasPage", () => {
	it("renders the boot headline", () => {
		renderPage();
		expect(
			screen.getByRole("heading", { level: 1, name: /fintech apis for bharat/i }),
		).toBeInTheDocument();
	});

	it("renders the session commands", () => {
		renderPage();
		expect(screen.getByText(/eko verify pan ABCDE1234F/i)).toBeInTheDocument();
		expect(screen.getByText(/cat pillars\.md/i)).toBeInTheDocument();
		expect(screen.getByText(/git clone/i)).toBeInTheDocument();
		expect(screen.getByText(/eko stats --bharat/i)).toBeInTheDocument();
	});

	it("renders the signup keycap CTA linking to /signup and sets noindex", () => {
		const helmetContext: { helmet?: { meta: { toString(): string } } } = {};
		render(
			<HelmetProvider context={helmetContext}>
				<MemoryRouter initialEntries={["/welcome3"]}>
					<TerminalCanvasPage />
				</MemoryRouter>
			</HelmetProvider>,
		);
		expect(screen.getByRole("link", { name: /eko signup/i })).toHaveAttribute(
			"href",
			"/signup",
		);
		expect(helmetContext.helmet?.meta.toString()).toContain("noindex");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/welcome/TerminalCanvasPage.test.tsx`
Expected: FAIL — placeholder renders null

- [ ] **Step 3: Implement the page**

```tsx
// src/pages/welcome/TerminalCanvasPage.tsx
import { useReveal } from "@/components/welcome/motion/useReveal";
import { WelcomeFooter } from "@/components/welcome/WelcomeFooter";
import { WelcomeNav } from "@/components/welcome/WelcomeNav";
import "@/components/welcome/welcome.css";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

/** A typed command line + its output panel bursting out of the terminal plane. */
const SessionBlock = ({
	command,
	children,
}: {
	command: string;
	children: ReactNode;
}) => {
	const { ref, isVisible } = useReveal<HTMLDivElement>();
	return (
		<div ref={ref} className="welcome-perspective">
			<p className="font-mono text-sm sm:text-base text-white/80">
				<span className="text-eko-gold" aria-hidden>
					eko@bharat:~${" "}
				</span>
				{command}
			</p>
			<div
				className={cn(
					"mt-4 mb-16 origin-top transition-all duration-700 ease-out",
					isVisible
						? "opacity-100 [transform:rotateX(0)_translateZ(0)]"
						: "opacity-0 [transform:rotateX(12deg)_translateZ(-300px)]",
				)}
			>
				{children}
			</div>
		</div>
	);
};

const VERIFY_JSON = `{
  "tool": "eko_verify_pan",
  "valid": true,
  "name_match": 0.97,
  "latency_ms": 240,
  "cost": "₹2.50"
}`;

const PILLARS_MD = [
	["Minutes, not weeks", "instant sandbox key → first call in <10 min"],
	["Compliant by default", "RBI/NPCI/DPDP guardrails encoded in the SDK"],
	["Open by default", "everything we build is MIT; the rails are regulated"],
	["Built for Bharat", "verification + payouts + agent-network APIs"],
] as const;

const CLONE_REPOS = [
	["@eko-eps/core", 100],
	["@eko-eps/sdk", 100],
	["@eko-eps/mcp", 100],
	["@eko-eps/cli", 100],
] as const;

const BHARAT_ROWS = [
	["upi_txns_per_year", "241B+"],
	["indian_developers", "17M+"],
	["eko_micro_entrepreneurs", "50K+"],
	["time_to_first_call", "<10 min"],
] as const;

/** /welcome3 — Page C "Terminal as Canvas". Storyboard: docs/welcome-landing-storyboards.md §C. */
const TerminalCanvasPage = () => {
	useEffect(() => {
		document.documentElement.classList.add("js-motion");
		return () => document.documentElement.classList.remove("js-motion");
	}, []);

	return (
		<div className="welcome-page">
			<Helmet>
				<title>Eko EPS 2.0 — eko@bharat:~$ welcome</title>
				<meta
					name="description"
					content="An open-source, agent-native fintech API platform for Bharat — explored one command at a time."
				/>
				<meta name="robots" content="noindex" />
			</Helmet>
			<WelcomeNav />

			{/* §C1 — Boot */}
			<header className="relative welcome-scanline pt-36 pb-20 px-5 overflow-hidden">
				<div className="max-w-3xl mx-auto rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60 p-6 sm:p-10 font-mono">
					<div className="flex gap-1.5 mb-6" aria-hidden>
						<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
						<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
						<span className="w-2.5 h-2.5 rounded-full bg-white/15" />
					</div>
					<p className="text-sm text-white/60">
						<span className="text-eko-gold" aria-hidden>
							eko@bharat:~${" "}
						</span>
						welcome<span className="welcome-caret" aria-hidden />
					</p>
					<h1 className="mt-8 text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight font-sans">
						Fintech APIs for Bharat.
						<br />
						<span className="text-eko-gold">Open. Agent-native. Fast.</span>
					</h1>
					<p className="mt-6 text-sm text-white/50 font-sans">
						Scroll to run the session — or skip ahead:{" "}
						<Link to="/signup" className="text-eko-gold underline underline-offset-4">
							get a sandbox key
						</Link>
						.
					</p>
				</div>
			</header>

			{/* §C2 — Session log */}
			<main className="max-w-3xl mx-auto px-5 pt-12">
				<SessionBlock command="eko verify pan ABCDE1234F">
					<pre className="rounded-xl border border-white/10 bg-[#0d1117] p-5 font-mono text-xs sm:text-sm text-green-400 overflow-x-auto">
						{VERIFY_JSON}
					</pre>
					<p className="mt-3 text-sm text-white/50">
						14 verification tools — PAN, GST, bank, DigiLocker, RC/DL,
						Name-Match, UPI VPA — typed, agent-safe, sandbox-first.
					</p>
				</SessionBlock>

				<SessionBlock command="cat pillars.md">
					<dl className="grid sm:grid-cols-2 gap-4">
						{PILLARS_MD.map(([title, body]) => (
							<div
								key={title}
								className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
							>
								<dt className="font-semibold">{title}</dt>
								<dd className="mt-1.5 text-sm text-white/55">{body}</dd>
							</div>
						))}
					</dl>
				</SessionBlock>

				<SessionBlock command="git clone https://github.com/ekoindia/eko-eps">
					<div className="rounded-xl border border-white/10 bg-[#0d1117] p-5 font-mono text-xs sm:text-sm space-y-2">
						{CLONE_REPOS.map(([repo]) => (
							<p key={repo} className="text-white/60">
								<span className="text-green-400" aria-hidden>
									✓
								</span>{" "}
								{repo}{" "}
								<span className="text-white/30">
									████████████████████ 100% · MIT
								</span>
							</p>
						))}
						<p className="text-white/40 pt-2">
							Everything we build is open. The rails are regulated.
						</p>
					</div>
				</SessionBlock>

				<SessionBlock command="eko stats --bharat">
					<table className="w-full rounded-xl border border-white/10 bg-[#0d1117] font-mono text-xs sm:text-sm">
						<tbody>
							{BHARAT_ROWS.map(([key, value]) => (
								<tr key={key} className="border-b border-white/5 last:border-0">
									<td className="p-3.5 text-white/50">{key}</td>
									<td className="p-3.5 text-right text-eko-gold font-semibold">
										{value}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</SessionBlock>
			</main>

			{/* §C3 — $ eko signup */}
			<section className="py-28 px-5 text-center welcome-bloom-bottom">
				<p className="font-mono text-sm text-white/60">
					<span className="text-eko-gold" aria-hidden>
						eko@bharat:~${" "}
					</span>
					one command left.
				</p>
				<Link
					to="/signup"
					className="group mt-8 inline-block rounded-2xl border-2 border-eko-gold bg-eko-gold/10 px-12 py-7 font-mono text-xl sm:text-2xl text-eko-gold shadow-[0_8px_0_rgba(247,181,30,0.35)] transition-all hover:translate-y-1 hover:shadow-[0_4px_0_rgba(247,181,30,0.35)] active:translate-y-2 active:shadow-none"
				>
					$ eko signup ⏎
				</Link>
				<p className="mt-6 font-mono text-xs text-white/40">
					→ sandbox key issued in &lt;60s
				</p>
			</section>

			<WelcomeFooter />
		</div>
	);
};

export default TerminalCanvasPage;
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/pages/welcome/TerminalCanvasPage.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (3 tests), no type errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/welcome/TerminalCanvasPage.tsx src/pages/welcome/TerminalCanvasPage.test.tsx
git commit -m "feat(welcome): /welcome3 terminal-as-canvas landing variant"
```

---

### Task 11: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Run all welcome tests**

Run: `npx vitest run src/pages/welcome src/components/welcome src/components/Header.test.tsx`
Expected: all PASS

- [ ] **Step 2: Lint + production build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build prerenders `/welcome`, `/welcome2`, `/welcome3`

- [ ] **Step 3: Sitemap exclusion check**

Run: `grep -c "welcome" dist/sitemap.xml || echo "0 — correctly excluded"`
Expected: `0 — correctly excluded`

- [ ] **Step 4: Browser pass on all three pages**

`npm run preview`, visit `http://localhost:4173/welcome/`, `/welcome2/`, `/welcome3/` (trailing slashes). Verify per page: dark chrome only (no global header), motion plays, reduced-motion OS setting yields static pages, no console errors. Use Chrome DevTools MCP for a performance trace on `/welcome`'s pinned section.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A src/ ssg/
git commit -m "fix(welcome): final polish across landing variants"
```
(Skip if nothing changed.)
