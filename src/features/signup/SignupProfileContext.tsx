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
	 * Holder-type letter from the PAN the user just submitted, when this session
	 * collected it. Only the letter travels, never the PAN — later steps need the
	 * category, not the number, so there is no reason to carry the PII further.
	 * Absent after a page reload, since signup state is server-held and the
	 * server does not return the PAN.
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
