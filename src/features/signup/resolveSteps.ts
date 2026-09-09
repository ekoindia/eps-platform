import type { ComponentType } from "react";
import type { signupClient, SignupState } from "@/lib/auth/client";

/** Props every step component receives from the wizard. */
export interface StepProps {
	/**
	 * Submits this step's collected values, keyed by field name. Each step
	 * decides what its keys mean; the wizard just forwards them to the step's
	 * own `submit`.
	 */
	onSubmit: (values: Record<string, string>) => Promise<void>;
	/** True while a submit is in flight; disable inputs and the button. */
	busy: boolean;
	/** Server-side error for this step, or null. */
	error: string | null;
}

/** Sends one step's values to the backend and returns the refreshed state. */
export type StepSubmit = (
	client: typeof signupClient,
	values: Record<string, string>,
) => Promise<SignupState>;

/**
 * A step this app knows how to render.
 *
 * To add a step: append an entry with its role code, component, and submit. To
 * remove one: delete the entry. Order comes from the API at runtime, so it is
 * not authoritative in this file — but the label here IS, for any role we can
 * render (see `resolveSteps`).
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
	/**
	 * Display label. Authoritative for a role we can render — the API's label is
	 * used only when this one is blank. See `resolveSteps` for why.
	 */
	label: string;
	/** React component that renders this step's UI. */
	Component: ComponentType<StepProps>;
	/** Submits this step's values and returns refreshed signup state. */
	submit: StepSubmit;
	/**
	 * Supporting content rendered beside the step's card, stacking below it on
	 * narrow screens. Opt-in: a step without one renders exactly as before, at
	 * the wizard's normal width.
	 */
	Aside?: ComponentType;
	/**
	 * When true the step renders its own heading and the wizard omits its card
	 * header. Independent of `Aside` — a step may want either without the other.
	 * The rail still shows `label` regardless, since that is wayfinding.
	 */
	ownsHeading?: boolean;
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
	/** Supporting content beside the card; see {@link StepDefinition.Aside}. */
	Aside?: ComponentType;
	/** Step renders its own heading; see {@link StepDefinition.ownsHeading}. */
	ownsHeading?: boolean;
}

/**
 * Resolves the server's onboarding steps against the local registry.
 *
 * The API is authoritative for which steps exist and their order. It is NOT
 * authoritative for the label of a step we render: the wording belongs with the
 * UI that implements it, and upstream's own labels lag ours (it still calls the
 * Business Details step "Company Details", which reads as Pvt-Ltd-only and
 * excludes the sole proprietors and individuals the step is built to serve).
 * The API label is still used as the fallback when the registry entry has none.
 *
 * A role the registry does not know is skipped rather than thrown on, so the
 * backend can introduce a step before this app ships its UI.
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
	const known = state.steps.filter((s) => {
		if (byRole.has(s.role)) return true;
		// The backend can ship a new step before this app has UI for it. Skipping
		// is intentional (see the module doc), but it must not be silent — warn
		// so a step nobody can complete shows up in a log, not just as a user
		// hitting the unsupported-step message with no trace anywhere.
		console.warn(
			`resolveSteps: unknown step role ${s.role} ("${s.label}") — skipping`,
		);
		return false;
	});
	const currentIndex = known.findIndex((s) => s.role === state.currentRole);

	return known.map((apiStep, index) => {
		const def = byRole.get(apiStep.role) as StepDefinition;
		return {
			role: def.role,
			name: def.name,
			// Local label wins — see the module doc. The API label backstops a
			// registry entry that forgot one.
			label: def.label || apiStep.label,
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
			Aside: def.Aside,
			ownsHeading: def.ownsHeading,
		};
	});
}
