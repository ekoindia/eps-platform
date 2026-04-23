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
 * Lightweight replacement for framer-motion's whileInView fade-up animation.
 * Uses IntersectionObserver + CSS class toggle — avoids forced reflows from inline style mutations.
 */
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
  }, [delay, onView]);

  return (
    <Tag
      ref={ref}
      className={cn("fade-in-hidden", className)}
      {...rest}
      style={{
        transitionDelay: delay ? `${delay}ms` : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
