import { LoginForm } from "@/components/auth/LoginForm";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignupWizard } from "@/features/signup/SignupWizard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

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

	// A fully onboarded user has no business here.
	useEffect(() => {
		if (state.status === "authed" && state.role !== "signup") {
			navigate("/console", { replace: true });
		}
	}, [state, navigate]);

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

			<main className="pt-24 lg:pt-28">
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
									<CardHeader>
										<CardTitle>
											{state.status === "anon" ? "Create your account" : ""}
										</CardTitle>
									</CardHeader>
									<CardContent>
										{state.status !== "anon" && (
											<div
												data-testid="signup-loading"
												className="flex flex-col gap-3"
											>
												<Skeleton className="h-8 w-full" />
												<Skeleton className="h-8 w-2/3" />
											</div>
										)}
										{state.status === "anon" && <LoginForm />}
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default SignupPage;
