import type { Lifecycle } from "@/lib/auth/client";
import { ESIGN_PATH } from "@/lib/connect/esign";
import { deriveNextStep } from "@/lib/console/next-step";
import type { ActionCard, CardLink } from "./types";

/** What the palette knows about who is asking — no network of its own beyond the E-sign list. */
export type PaletteSession =
	| { kind: "anon" }
	| { kind: "signup" }
	| { kind: "admin" }
	| { kind: "developer"; state: Lifecycle; esignPending: boolean };

const FEE_LINK: CardLink = {
	label: "Pay the one-time integration fee",
	href: "/console/pay-activation-fee",
};

/**
 * `get_started`: the asker's own next step, not a search result. Visitors get
 * sign-up; developers get the step NextStepsCard spotlights (same
 * `deriveNextStep`), else credentials. The fee rides along for developers —
 * nothing upstream says it is paid, so the console shows it to everyone too.
 * ponytail: no KYC pack fetch here — without it the step is named from the
 * lifecycle state, and /console/documents shows the per-document status.
 * @param session - Who is asking.
 * @returns A card, or null for an admin (nothing to onboard).
 */
export function resolveGetStarted(session: PaletteSession): ActionCard | null {
	const base = {
		intent: "get_started" as const,
		badge: "Next step",
		alternatives: [],
	};
	switch (session.kind) {
		case "admin":
			return null;
		case "anon":
			return {
				...base,
				id: "action:get_started:signup",
				title: "Create your developer account",
				detail:
					"Sign up with your mobile number, then follow the console's next steps",
				primary: { label: "Sign up", href: "/signup" },
				secondary: [{ label: "Read the Get Started guide", href: "/docs" }],
			};
		case "signup":
			return {
				...base,
				id: "action:get_started:finish-signup",
				title: "Finish signing up",
				detail: "Pick up where you left off",
				primary: { label: "Continue", href: "/signup" },
				secondary: [],
			};
	}

	const next = deriveNextStep(session);
	if (next.kind === "esign") {
		return {
			...base,
			id: "action:get_started:esign",
			title: "Sign pending documents to activate your account",
			primary: { label: "Sign document", href: ESIGN_PATH },
			secondary: [FEE_LINK],
		};
	}
	if (next.kind === "kyc-upload") {
		return {
			...base,
			id: "action:get_started:kyc-upload",
			title: "Finish your KYC by uploading documents",
			primary: { label: next.action, href: "/console/documents" },
			secondary: [FEE_LINK],
		};
	}
	const live = session.state === "active";
	return {
		...base,
		id: "action:get_started:credentials",
		title: live
			? "Get your production credentials"
			: "Complete your integration using UAT credentials",
		primary: { label: "View credentials", href: "/console/credentials" },
		secondary: [FEE_LINK],
	};
}
