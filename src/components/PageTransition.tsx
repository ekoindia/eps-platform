import { ReactNode, useEffect, useRef } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Trigger fade-in on mount
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{ opacity: 0.8, transition: "opacity 0.1s ease-in-out" }}
    >
      {children}
    </div>
  );
}
