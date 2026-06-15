import { useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { PageTransition } from "./PageTransition";

interface AnimatedRoutesProps {
	children: ReactNode;
}

export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
	const location = useLocation();

	return <PageTransition key={location.pathname}>{children}</PageTransition>;
}
