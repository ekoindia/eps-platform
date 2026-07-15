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
	/** Unique identifier for this step within the app. */
	name: string;
	/** Fallback label; the API's label wins when present. */
	label: string;
	/** React component that renders this step's UI. */
	Component: ComponentType<StepProps>;
	/** Submits this step's values and returns refreshed signup state. */
	submit: StepSubmit;
}

/** Status of a step in the onboarding flow. "complete" = already finished or no actionable step. "current" = user is here now. "pending" = not yet reached. */
export type StepStatus = "complete" | "current" | "pending";

/** A step from the API, enriched with UI metadata and status. */
export interface ResolvedStep {
	/** The backend role code identifying this step. */
	role: number;
	/** Unique identifier for this step within the app. */
	name: string;
	/** Display label for this step. */
	label: string;
	/** Current position of this step relative to the user's progress. */
	status: StepStatus;
	/** React component that renders this step's UI. */
	Component: ComponentType<StepProps>;
	/** Submits this step's values and returns refreshed signup state. */
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
 * @remarks
 * When `currentRole` is null (either onboarding finished or no actionable step in an
 * in-progress flow), every step is marked "complete". Consumers must check `state.status`
 * to distinguish between these cases; an all-"complete" result alone does not prove
 * onboarding finished.
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
			// currentIndex === -1 means no step is currently actionable: either onboarding
			// is finished, or the user is in-progress but has no actionable step (empty
			// role_list from backend). Callers must check state.status to distinguish.
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
