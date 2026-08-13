import { Button, type ButtonProps } from "@/components/ui/button";
import { SHOW_USER_LOGIN } from "@/lib/config/features";
import { openZohoChat } from "@/lib/zoho-chat";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface GetStartedButtonProps extends Omit<ButtonProps, "asChild"> {
	/** Label used when SHOW_USER_LOGIN is on. Falls back to `children`. */
	consoleLabel?: ReactNode;
}

/**
 * Primary acquisition CTA.
 *
 * With `VITE_SHOW_USER_LOGIN` on it links to `/console`, where a returning
 * developer logs in and a new one starts onboarding. With the flag off it keeps
 * the previous behaviour and opens the Zoho SalesIQ chat, so a build without the
 * console still routes the same click to sales.
 *
 * `onClick` runs in both branches — Radix `Slot` forwards it to the `<Link>` —
 * so callers can still close a mobile sheet or a dropdown before navigation.
 */
export const GetStartedButton = ({
	consoleLabel,
	onClick,
	children,
	...props
}: GetStartedButtonProps) =>
	SHOW_USER_LOGIN ? (
		<Button asChild onClick={onClick} {...props}>
			<Link to="/console">{consoleLabel ?? children}</Link>
		</Button>
	) : (
		<Button
			onClick={(event) => {
				onClick?.(event);
				openZohoChat();
			}}
			{...props}
		>
			{children}
		</Button>
	);
