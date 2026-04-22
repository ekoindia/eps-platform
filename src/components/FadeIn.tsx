import { useEffect, useRef, type ReactNode, type CSSProperties, type ElementType, type HTMLAttributes } from "react";

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
 * Uses IntersectionObserver — zero JS library overhead.
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
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
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
      className={className}
      {...rest}
      style={{
        opacity: 0,
        transform: "translateY(20px)",
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
