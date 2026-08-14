import { SignInSplit } from "@/components/auth/SignInSplit";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignupWizard } from "@/features/signup/SignupWizard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { readNextParam } from "@/lib/auth/next-param";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Self-serve signup.
 *
 * A switch on auth state: anonymous users log in with mobile + OTP, signup
 * sessions run the onboarding wizard, and already-onboarded users are sent to
 * their console.
 */
const SignupPage = () => {
	const { state } = useAuth();
	const navigate = useNavigate();
	const { search } = useLocation();

	// A fully onboarded user has no business here. A `?next=` on the link is
	// honoured at exactly this point — the wizard is done, the backend has
	// swapped in a developer session, and the console is what would render
	// next. Only for a developer: an admin has no console pages to deep-link
	// into.
	useEffect(() => {
		if (state.status === "authed" && state.role !== "signup") {
			const next = state.role === "developer" ? readNextParam(search) : null;
			navigate(next ?? "/console", { replace: true });
		}
	}, [state, search, navigate]);

	// The wizard needs room for its step rail beside the form; the login form
	// does not. The wizard also brings its own card, since only it knows the
	// resolved steps the rail renders.
	const isWizard = state.status === "authed" && state.role === "signup";

	return (
		<div className="min-h-screen bg-background">
			<Helmet>
				<title>Create your account | Eko</title>
				<meta
					name="description"
					content="Create your Eko Platform Services account and start integrating."
				/>
			</Helmet>

			{/* Anonymous visitors get the same full-bleed sign-in pitch as `/console`,
			    so the two entry points into one OTP flow look like one product. It
			    needs the whole width and the whole height: no container, and no top
			    padding to clear the fixed header — `SignInSplit` clears it internally
			    so its two-tone columns paint behind it. */}
			<main className={state.status === "anon" ? undefined : "pt-24 lg:pt-28"}>
				{state.status === "anon" ? (
					<SignInSplit />
				) : (
					<section className="py-4 md:py-6">
						<div className="container mx-auto px-4 sm:px-6 lg:px-8">
							<div
								className={`mx-auto w-full ${isWizard ? "max-w-3xl" : "max-w-md"}`}
							>
								{isWizard ? (
									<>
										<h1 className="mb-6 text-2xl font-semibold tracking-tight">
											Complete your setup
										</h1>
										<SignupWizard />
									</>
								) : (
									<Card>
										<CardContent className="pt-6">
											<div
												data-testid="signup-loading"
												className="flex flex-col gap-3"
											>
												<Skeleton className="h-8 w-full" />
												<Skeleton className="h-8 w-2/3" />
											</div>
										</CardContent>
									</Card>
								)}
							</div>
						</div>
					</section>
				)}
			</main>

			<Footer />
		</div>
	);
};

export default SignupPage;
