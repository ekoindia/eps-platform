import { createContext, useContext, type ReactNode } from "react";

/**
 * The user's profile as known during onboarding. `name`/`email` are absent
 * until an upstream record supplies them (usually empty for a fresh signup).
 */
export interface SignupProfile {
	mobile: string;
	name?: string;
	email?: string;
	/**
	 * The verified PAN, from the server's profile when it carries one and
	 * otherwise from this session's own PAN step.
	 *
	 * Displayed by the Business step to name where its prefilled details came
	 * from. Both sources can be absent at once — a reload past the PAN step,
	 * with upstream not echoing `pancardnumber` — so every consumer must render
	 * without it.
	 */
	pan?: string;
	/**
	 * Holder-type letter of `pan` (its 4th character), derived rather than
	 * stored so the two can never disagree. Narrows the Business Type options
	 * and, for the categories that determine one, supplies the answer outright.
	 */
	panCategory?: string;
}

const SignupProfileContext = createContext<SignupProfile | null>(null);

/**
 * Provides profile data to every onboarding step.
 * @param props.profile - The profile derived from the current SignupState.
 */
export function SignupProfileProvider({
	profile,
	children,
}: {
	profile: SignupProfile;
	children: ReactNode;
}) {
	return (
		<SignupProfileContext.Provider value={profile}>
			{children}
		</SignupProfileContext.Provider>
	);
}

/**
 * Reads the onboarding profile.
 * @returns The current `SignupProfile`.
 * @throws If used outside a `SignupProfileProvider`.
 */
export function useSignupProfile(): SignupProfile {
	const ctx = useContext(SignupProfileContext);
	if (!ctx) {
		throw new Error(
			"useSignupProfile must be used within a SignupProfileProvider",
		);
	}
	return ctx;
}
