import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, signupClient, type SignupState } from "@/lib/auth/client";
import { resolveSteps } from "./resolveSteps";
import { SignupProfileProvider } from "./SignupProfileContext";
import { StepRail } from "./StepRail";
import { SIGNUP_STEPS } from "./steps";

/**
 * Drives the onboarding steps for a signup session.
 *
 * Progress is never inferred locally: every step call returns fresh
 * server-authoritative state, which decides what renders next. That makes
 * resume-after-drop-off and retry-after-failure the same code path.
 */
export function SignupWizard() {
	const { refresh } = useAuth();
	const [state, setState] = useState<SignupState | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fatal, setFatal] = useState<string | null>(null);

	// Guards against a second run of the mount effect below (e.g. a
	// <StrictMode> double-mount). `createProfile()` is a non-idempotent POST
	// that creates a partial account upstream, so firing it twice would create
	// two partial accounts — that's the bug this guards against. There is
	// deliberately no `cancelled` flag alongside it: in React 18+, `setState`
	// on an unmounted component is a harmless no-op, so a `cancelled` closure
	// protects nothing real. Worse, under StrictMode a `cancelled` flag set by
	// run 1's cleanup would suppress run 1's own `setState` even though run 2
	// reuses the same fiber and never starts its own fetch (blocked by
	// `started`) — the component would then be stuck loading forever. `started`
	// alone makes the async body run at most once per mounted component while
	// still letting whichever run's promise resolves land its `setState`.
	const started = useRef(false);

	// Load initial state, creating the partial account if it does not exist yet.
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void (async () => {
			try {
				let next = await signupClient.state();
				if (next.status === "new") {
					next = await signupClient.createProfile();
				}
				setState(next);
			} catch (e) {
				setFatal(
					e instanceof ApiError
						? e.message
						: "Couldn't start signup. Please try again.",
				);
			}
		})();
	}, []);

	// When onboarding completes the backend swaps in a developer session; pulling
	// /me makes the app notice and route on to the console.
	useEffect(() => {
		if (state?.status === "done") void refresh();
	}, [state?.status, refresh]);

	/** Runs a step submit, mapping failures to an inline error on the same step. */
	const runStep = useCallback(async (submit: () => Promise<SignupState>) => {
		setBusy(true);
		setError(null);
		try {
			setState(await submit());
		} catch (e) {
			setError(
				e instanceof ApiError
					? e.message
					: "Something went wrong. Please try again.",
			);
		} finally {
			setBusy(false);
		}
	}, []);

	if (fatal) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p role="alert" className="text-sm text-destructive">
						{fatal}
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!state) {
		return (
			<Card>
				<CardContent className="flex flex-col gap-3 pt-6">
					<p className="text-muted-foreground">Setting up your account…</p>
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-2/3" />
				</CardContent>
			</Card>
		);
	}

	if (state.status === "done") {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-3 py-6 text-center">
					<CheckCircle2 className="h-12 w-12 text-primary" />
					<h2 className="text-xl font-semibold">You're all set</h2>
					<p className="text-muted-foreground">
						Your account is ready. Taking you to your console…
					</p>
				</CardContent>
			</Card>
		);
	}

	const steps = resolveSteps(state, SIGNUP_STEPS);
	const current = steps.find((s) => s.status === "current");

	if (!current) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p role="alert" className="text-sm text-destructive">
						This signup step isn't supported here yet. Please contact support.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Each step owns its submit, so the wizard never learns step names or call
	// signatures — adding a step touches only the registry and its component.
	const { Component, submit } = current;

	// The rail sits outside the card, so the wizard owns the card rather than the
	// page: only the wizard knows the resolved steps.
	return (
		<div className="grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
			<StepRail steps={steps} />
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">{current.label}</CardTitle>
				</CardHeader>
				<CardContent>
					<SignupProfileProvider
						profile={{
							mobile: state.mobile,
							name: state.name,
							email: state.email,
						}}
					>
						<Component
							onSubmit={(values) => runStep(() => submit(signupClient, values))}
							busy={busy}
							error={error}
						/>
					</SignupProfileProvider>
				</CardContent>
			</Card>
		</div>
	);
}
