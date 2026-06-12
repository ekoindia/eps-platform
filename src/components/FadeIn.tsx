import { useEffect, useRef, type ReactNode, type CSSProperties, type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FadeInProps extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  /** Animate on scroll into view (default: true). Set false for animate-on-mount. */
  onView?: boolean;
}

/**
 * Progressive enhancement: when the browser supports CSS scroll-driven
 * animations (`animation-timeline: view()`), the fade-in runs entirely in CSS
 * via the `.fade-in-css` class defined in index.css — no IntersectionObserver,
 * no JS at all. Unsupported browsers (Firefox, Safari as of May 2025) fall back
 * to the original IntersectionObserver + `.fade-in-hidden`/`.fade-in-visible`
 * class-toggle approach.
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
  const useCssOnly = supportsScrollDriven && onView && delay === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (useCssOnly) {
      // SSG hydration fix: the server can't detect scroll-driven animation
      // support (no CSS API), so prerendered HTML carries `fade-in-hidden`.
      // React skips attribute patching during hydration, leaving the stale
      // class in the DOM and the element stuck at opacity 0. Sync it here.
      if (el.classList.contains("fade-in-hidden")) {
        el.classList.remove("fade-in-hidden");
        el.classList.add("fade-in-css");
      }
      return;
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
  }, [delay, onView, useCssOnly]);

  return (
    <Tag
      ref={ref}
      className={cn(useCssOnly ? "fade-in-css" : "fade-in-hidden", className)}
      {...rest}
      style={{
        ...(!useCssOnly && delay ? { transitionDelay: `${delay}ms` } : {}),
        ...(useCssOnly && delay ? { animationDelay: `${delay}ms` } : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
