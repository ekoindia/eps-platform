import {
	useEffect,
	useRef,
	type ReactNode,
	type CSSProperties,
	type ElementType,
	type HTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

interface FadeInProps extends Omit<HTMLAttributes<HTMLElement>, "style"> {
	children: ReactNode;
	as?: ElementType;
	className?: string;
	style?: CSSProperties;
	delay?: number;
	/** Animate on scroll into view (default: true). Set false for animate-on-mount. */
	onView?: boolean;
}

/**
 * Progressive enhancement with a fail-visible contract:
 *
 * - `onView` with no delay renders `.fade-in-css`. In browsers with CSS
 *   scroll-driven animations (`animation-timeline: view()`) the reveal runs
 *   entirely in CSS — no IntersectionObserver, no hydration dependency. In
 *   other browsers the same class gets the hidden initial state from CSS and
 *   the IntersectionObserver below toggles `.fade-in-visible`.
 * - A delay or `onView={false}` renders `.fade-in-hidden` and always uses the
 *   JS path (timer or IntersectionObserver).
 *
 * The class choice depends only on props, never on environment detection, so
 * SSG prerenders and client hydration always agree (React skips attribute
 * patching during hydration; an environment-dependent class left stale
 * `fade-in-hidden` classes locking content at opacity 0 — see
 * src/test/fade-in-hydration.test.tsx and docs/ssg-hydration.md).
 *
 * TODO: Once `animation-timeline: view()` reaches baseline support across
 * Chrome, Firefox, and Safari (track at https://caniuse.com/css-animation-timeline),
 * remove the IntersectionObserver fallback path and simplify this component to
 * render only the `.fade-in-css` class. The `supportsScrollDriven` check,
 * `useEffect`, and `useRef` can all be deleted at that point.
 */
const supportsScrollDriven =
	typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");

export function FadeIn({
	children,
	as: Tag = "div",
	className,
	style,
	delay = 0,
	onView = true,
	...rest
}: FadeInProps) {
	const ref = useRef<HTMLElement>(null);
	const cssCapable = onView && delay === 0;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		// CSS scroll-driven animation handles the reveal (even before
		// hydration). JS only pins the revealed state once the animation has
		// COMPLETED: scroll-driven opacity tracks scroll position, so without
		// the pin, scrolling back up re-hides content and full-page
		// screenshot tools capture below-fold elements at their hidden
		// `from` state. Pinning any earlier (e.g. on viewport entry) cuts the
		// entrance animation short — removing the animation snaps opacity to
		// the base value without a transition.
		if (supportsScrollDriven && cssCapable) {
			const pin = () => el.classList.add("fade-in-done");

			// Already scrubbed past the animation range (e.g. the user
			// scrolled by before hydration): past-range scroll-driven
			// animations report "idle"/"finished", never "running".
			const anim = (el.getAnimations?.() ?? []).find(
				(a) =>
					"animationName" in a &&
					(a as CSSAnimation).animationName === "fade-in-view",
			);
			if (
				anim &&
				(anim.playState === "finished" || anim.playState === "idle")
			) {
				pin();
				return;
			}

			const onEnd = (event: AnimationEvent) => {
				if (event.target === el && event.animationName === "fade-in-view") {
					pin();
					el.removeEventListener("animationend", onEnd);
				}
			};
			el.addEventListener("animationend", onEnd);
			return () => el.removeEventListener("animationend", onEnd);
		}

		const apply = () => {
			el.classList.add("fade-in-visible");
		};

		if (!onView) {
			const id = setTimeout(apply, delay);
			return () => clearTimeout(id);
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					if (delay) {
						setTimeout(apply, delay);
					} else {
						apply();
					}
					observer.disconnect();
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [delay, onView, cssCapable]);

	return (
		<Tag
			ref={ref}
			className={cn(cssCapable ? "fade-in-css" : "fade-in-hidden", className)}
			{...rest}
			style={{
				...(delay ? { transitionDelay: `${delay}ms` } : {}),
				...style,
			}}
		>
			{children}
		</Tag>
	);
}
