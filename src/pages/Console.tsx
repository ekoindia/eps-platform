import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/auth/LoginForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import { uatCredentials } from "@/lib/uat-credentials";
import { CopyButton } from "@/pages/ai/CommandBlock";
import { Helmet } from "react-helmet-async";
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

/** One `label / value / copy` row of the UAT credentials block. */
function CredentialRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
				{label}
			</span>
			<code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
				{value}
			</code>
			<CopyButton text={value} label={`Copy ${label}`} />
		</div>
	);
}

/**
 * UAT keypair block. Shown to every signed-in developer regardless of lifecycle
 * state: the same keypair is already published anonymously in llms.txt, so
 * gating it here would protect nothing (see `uatCredentials`). Falls back to the
 * "not issued yet" note when the build env has no keypair configured.
 */
function ApiCredentials() {
	const credentials = uatCredentials();
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">
					{credentials ? "UAT API credentials" : "API credentials"}
				</p>
				<p className="text-sm text-muted-foreground">
					{credentials
						? "Shared keys for the UAT (test) environment — everyone gets the same pair, so keep test data disposable. Your production keys are issued separately."
						: "Your UAT and production API keys will appear here once issued. Contact your account manager to expedite access."}
				</p>
			</div>
			{credentials ? (
				<div className="flex flex-col gap-2">
					<CredentialRow
						label="developer_key"
						value={credentials.developerKey}
					/>
					<CredentialRow label="access_key" value={credentials.accessKey} />
				</div>
			) : null}
		</div>
	);
}

/** Renders the authenticated developer dashboard card based on lifecycle state. */
function DeveloperConsole({ me }: { me: MeView }) {
	const copy = STATE_COPY[me.state];
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-3">
					<CardTitle>{copy.title}</CardTitle>
					<Badge variant="secondary">{copy.badge}</Badge>
				</div>
				<CardDescription>{copy.body}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{me.profile ? (
					<p className="text-sm text-muted-foreground">
						Signed in as {me.profile.name || me.mobile}
					</p>
				) : (
					<p className="text-sm text-muted-foreground">
						Signed in as {me.mobile}
					</p>
				)}
				{copy.cta ? (
					<Button asChild className="self-start">
						<Link to={copy.cta.href}>{copy.cta.label}</Link>
					</Button>
				) : null}
				<ApiCredentials />
			</CardContent>
		</Card>
	);
}

/** Top-level Console page: routes to login, loading skeleton, or role-appropriate dashboard. */
export default function Console() {
	const { state } = useAuth();
	return (
		<>
			<Helmet>
				<title>Developer Console — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 min-h-[60vh]">
				<h1 className="text-2xl font-bold text-eko-navy mb-8">
					Developer Console
				</h1>
				{state.status === "loading" ? (
					<div data-testid="console-loading" className="max-w-2xl">
						<Card>
							<CardHeader>
								<Skeleton className="h-5 w-40" />
								<Skeleton className="mt-2 h-4 w-64" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-9 w-28" />
							</CardContent>
						</Card>
					</div>
				) : null}
				{state.status === "anon" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Log in</CardTitle>
							<CardDescription>
								Sign in with your mobile number to access your EPS console.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LoginForm />
						</CardContent>
					</Card>
				) : null}
				{state.status === "authed" && state.role === "developer" ? (
					<div className="max-w-2xl">
						<DeveloperConsole me={state.me} />
					</div>
				) : null}
				{state.status === "authed" && state.role === "admin" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Admin</CardTitle>
							<CardDescription>
								Signed in as {state.me.login ?? state.me.sub}.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="self-start">
								<Link to="/admin">Open Admin Console</Link>
							</Button>
						</CardContent>
					</Card>
				) : null}
			</main>
			<Footer />
		</>
	);
}
