import type { ReactNode } from "react";

interface PageTransitionProps {
	children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
	return <div className="animate-page-fade-in">{children}</div>;
}
