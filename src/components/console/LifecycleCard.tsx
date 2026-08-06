import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import { Link } from "react-router-dom";

const STATE_COPY: Record<
	Lifecycle,
	{
		badge: string;
		title: string;
		body: string;
		cta?: { label: string; href: string };
	}
> = {
	lead: {
		badge: "Lead",
		title: "Ready to onboard?",
		body: "Complete onboarding to activate your EPS account and unlock API access.",
		cta: { label: "Start onboarding", href: "/signup" },
	},
	onboarded: {
		badge: "Onboarded",
		title: "Finish setup",
		body: "Your account is created. Finish the remaining steps to go live.",
		cta: { label: "Continue setup", href: "/docs" },
	},
	active: {
		badge: "Active",
		title: "Integration overview",
		body: "Your account is active. Explore the docs and APIs to integrate.",
		cta: { label: "Browse API docs", href: "/docs" },
	},
	inactive: {
		badge: "Inactive",
		title: "Account inactive",
		body: "Your account is currently inactive. Please contact support to reactivate.",
		cta: { label: "Contact support", href: "/grievance" },
	},
	unknown: {
		badge: "Pending",
		title: "Welcome",
		body: "We could not find an EPS profile for this number yet. Onboard to get started.",
		cta: { label: "Start onboarding", href: "/signup" },
	},
};

/**
 * The short label for a lifecycle state. The rail caption badge and this card
 * read the same copy; a state this build doesn't know reads as "Pending".
 * @param state - The session's lifecycle state.
 * @returns The badge label.
 */
export const lifecycleBadge = (state: Lifecycle): string =>
	(STATE_COPY[state] ?? STATE_COPY.unknown).badge;

/**
 * The signed-in developer's lifecycle state.
 *
 * Two shapes, because the state matters at very different volumes. For an
 * account that still has something to do — a lead, a half-finished onboarding,
 * a deactivation — it renders as the full card with its call to action. For an
 * active account it is a one-line strip: still there, no longer the headline.
 *
 * Neither shape carries the page heading; Home owns its own `<h2>`, the way
 * every other console page does.
 * @param me - The session view.
 * @param variant - `card` for the full state block, `banner` for the strip.
 */
export default function LifecycleCard({
	me,
	variant = "card",
}: {
	me: MeView;
	variant?: "card" | "banner";
}) {
	// A lifecycle this build doesn't know — a new one added upstream — reads as
	// "unknown" rather than white-screening the console on `copy.title`.
	const copy = STATE_COPY[me.state] ?? STATE_COPY.unknown;
	const who = me.profile?.name || me.mobile || "your account";

	if (variant === "banner") {
		return (
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<Badge variant="secondary">{copy.badge}</Badge>
				<p className="text-muted-foreground">Signed in as {who}</p>
			</div>
		);
	}

	return (
		<Card className="max-w-2xl">
			<CardHeader>
				<div className="flex items-center gap-3">
					<CardTitle>{copy.title}</CardTitle>
					<Badge variant="secondary">{copy.badge}</Badge>
				</div>
				<CardDescription>{copy.body}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">Signed in as {who}</p>
				{copy.cta ? (
					<Button asChild className="self-start">
						<Link to={copy.cta.href}>{copy.cta.label}</Link>
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
