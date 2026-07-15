import type { ComponentType } from "react";
import type { signupClient, SignupState } from "@/lib/auth/client";

/** Props every step component receives from the wizard. */
export interface StepProps {
	/**
	 * Submits this step's collected values. Each step decides what its values
	 * mean; the wizard just forwards them to the step's own `submit`.
	 */
	onSubmit: (values: string[]) => Promise<void>;
	/** True while a submit is in flight; disable inputs and the button. */
	busy: boolean;
	/** Server-side error for this step, or null. */
	error: string | null;
}

/** Sends one step's values to the backend and returns the refreshed state. */
export type StepSubmit = (
	client: typeof signupClient,
	values: string[],
) => Promise<SignupState>;

/**
 * A step this app knows how to render.
 *
 * To add a step: append an entry with its role code, component, and submit. To
 * remove one: delete the entry. Order and labels come from the API at runtime,
 * so neither is authoritative in this file.
 *
 * Each entry owns its `submit` so the wizard never needs to know step names or
 * call signatures — that is what keeps adding a step to one entry plus one
 * component.
 */
export interface StepDefinition {
	/** The backend role code identifying this step. */
	role: number;
	name: string;
	/** Fallback label; the API's label wins when present. */
	label: string;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}

export type StepStatus = "complete" | "current" | "pending";

export interface ResolvedStep {
	role: number;
	name: string;
	label: string;
	status: StepStatus;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}

/**
 * Resolves the server's onboarding steps against the local registry.
 *
 * The API is authoritative for which steps exist, their order, and their
 * labels. A role the registry does not know is skipped rather than thrown on,
 * so the backend can introduce a step before this app ships its UI.
 *
 * @param state - Server-authoritative signup state.
 * @param registry - Steps this app can render.
 * @returns Steps in API order, each tagged with its status.
 */
export function resolveSteps(
	state: SignupState,
	registry: readonly StepDefinition[],
): ResolvedStep[] {
	const byRole = new Map(registry.map((s) => [s.role, s]));
	const known = state.steps.filter((s) => byRole.has(s.role));
	const currentIndex = known.findIndex((s) => s.role === state.currentRole);

	return known.map((apiStep, index) => {
		const def = byRole.get(apiStep.role) as StepDefinition;
		return {
			role: def.role,
			name: def.name,
			label: apiStep.label || def.label,
			// currentIndex === -1 means nothing is pending (onboarding finished),
			// so every step is complete.
			status:
				currentIndex === -1
					? "complete"
					: index < currentIndex
						? "complete"
						: index === currentIndex
							? "current"
							: "pending",
			Component: def.Component,
			submit: def.submit,
		};
	});
}
