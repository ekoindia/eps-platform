import { CheckCircle2 } from "lucide-react";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, signupClient, type SignupState } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { withRetries } from "@/lib/retry";
import { panCategory } from "./panCategory";
import { resolveSteps } from "./resolveSteps";
import { SignupProfileProvider } from "./SignupProfileContext";
import { StepRail } from "./StepRail";
import { SIGNUP_STEPS } from "./steps";

/**
 * Page chrome for every wizard state: the heading, and the width the content is
 * allowed to occupy.
 *
 * The wizard owns this rather than the page because only the wizard knows the
 * resolved step, and therefore whether the current step brings an aside that
 * needs the extra room. The heading moved in with it so the title and the card
 * below it always share one measure — left behind on the page, the h1 would sit
 * at the far edge of a wide container while a narrow step stayed centred.
 *
 * @param props.wide - True when the current step renders an aside.
 * @param props.children - The wizard body for this state.
 */
function Shell({ wide, children }: { wide?: boolean; children: ReactNode }) {
	return (
		<div className={cn("mx-auto w-full", wide ? "max-w-6xl" : "max-w-3xl")}>
			<h1 className="mb-6 text-2xl font-semibold tracking-tight">
				Complete your setup
			</h1>
			{children}
		</div>
	);
}

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
	// The PAN this session submitted, kept as a FALLBACK for `state.pan`: the
	// server forwards the PAN only once upstream back-fills it on the profile,
	// which is not guaranteed and never survives into a brand-new session. A
	// reload therefore clears this and leaves the Business step relying on the
	// server's copy — or, if that is absent too, rendering without a PAN.
	const [panFromSession, setPanFromSession] = useState<string | undefined>(
		undefined,
	);

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
				let next = await withRetries(() => signupClient.state());
				if (next.status === "new") {
					// Deliberately NOT wrapped in `withRetries`: this POST creates a
					// partial account upstream, which is the very thing `started` above
					// exists to stop happening twice.
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
			setState(await withRetries(submit));
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
			<Shell>
				<Card>
					<CardContent className="pt-6">
						<p role="alert" className="text-sm text-destructive">
							{fatal}
						</p>
					</CardContent>
				</Card>
			</Shell>
		);
	}

	if (!state) {
		return (
			<Shell>
				<Card>
					<CardContent className="flex flex-col gap-3 pt-6">
						<p className="text-muted-foreground">Setting up your account…</p>
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-2/3" />
					</CardContent>
				</Card>
			</Shell>
		);
	}

	if (state.status === "done") {
		return (
			<Shell>
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-6 text-center">
						<CheckCircle2 className="h-12 w-12 text-primary" />
						<h2 className="text-xl font-semibold">You're all set</h2>
						<p className="text-muted-foreground">
							Your account is ready. Taking you to your console…
						</p>
					</CardContent>
				</Card>
			</Shell>
		);
	}

	const steps = resolveSteps(state, SIGNUP_STEPS);
	const current = steps.find((s) => s.status === "current");

	if (!current) {
		return (
			<Shell>
				<Card>
					<CardContent className="pt-6">
						<p role="alert" className="text-sm text-destructive">
							This signup step isn't supported here yet. Please contact support.
						</p>
					</CardContent>
				</Card>
			</Shell>
		);
	}

	// Each step owns its submit, so the wizard never learns step names or call
	// signatures — adding a step touches only the registry and its component.
	const { Component, submit, Aside, ownsHeading } = current;

	// Server first: it survives reloads and new devices, where the in-session
	// capture does not. Both can be absent, and steps render without one.
	const pan = state.pan ?? panFromSession;

	// The rail sits outside the card, so the wizard owns the card rather than the
	// page: only the wizard knows the resolved steps.
	return (
		<Shell wide={Boolean(Aside)}>
			<div
				className={cn(
					"grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10",
					// The third column waits for `wide` (1100px, defined in index.css).
					// At plain `lg` (1024) the rail, the aside and two 2.5rem gaps
					// would leave the form under 300px of inner width; below 1100 the
					// aside instead sits under the card, in the content column.
					Aside && "wide:grid-cols-[200px_minmax(0,1fr)_20rem]",
				)}
			>
				<StepRail steps={steps} />
				<Card>
					{!ownsHeading && (
						<CardHeader>
							<CardTitle className="text-xl">{current.label}</CardTitle>
						</CardHeader>
					)}
					{/* CardContent is `p-6 pt-0`, which assumes a header above it. */}
					<CardContent className={cn(ownsHeading && "pt-6")}>
						<SignupProfileProvider
							profile={{
								mobile: state.mobile,
								name: state.name,
								email: state.email,
								pan,
								// Always derived, never stored beside the PAN: two fields
								// holding the same fact are two fields that can disagree.
								panCategory: pan ? (panCategory(pan) ?? undefined) : undefined,
							}}
						>
							<Component
								onSubmit={(values) => {
									// Captured here rather than off the resolved promise simply
									// because it is the one place that sees the submitted values
									// synchronously. (React batches this with `runStep`'s own
									// `setState`, so a post-await capture happens to work too —
									// this way just doesn't depend on that.)
									if (values.pan) {
										setPanFromSession(values.pan);
									}
									return runStep(() => submit(signupClient, values));
								}}
								busy={busy}
								error={error}
							/>
						</SignupProfileProvider>
					</CardContent>
				</Card>
				{/* Third DOM child, so it stacks last on narrow screens for free.
				    `lg:col-start-2` keeps it under the card rather than under the
				    rail once the rail column exists. */}
				{Aside && (
					<aside
						aria-label="Why we ask"
						className="min-w-0 lg:col-start-2 wide:col-start-3 wide:row-start-1"
					>
						<Aside />
					</aside>
				)}
			</div>
		</Shell>
	);
}
