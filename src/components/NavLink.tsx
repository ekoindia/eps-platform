import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { appendTrackingParams } from "@/hooks/use-tracking-params";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
	className?: string;
	activeClassName?: string;
	pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
	({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
		const resolvedTo = typeof to === "string" ? appendTrackingParams(to) : to;
		return (
			<RouterNavLink
				ref={ref}
				to={resolvedTo}
				className={({ isActive, isPending }) =>
					cn(
						className,
						isActive && activeClassName,
						isPending && pendingClassName,
					)
				}
				{...props}
			/>
		);
	},
);

NavLink.displayName = "NavLink";

export { NavLink };
