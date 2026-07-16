import type { StepDefinition } from "./resolveSteps";
import { PanStep } from "./PanStep";
import { PinStep } from "./PinStep";

/**
 * Steps this app can render, keyed by their backend role code.
 *
 * Order here is not authoritative — the API's `onboarding_steps` decides the
 * sequence and the labels at runtime. This registry only answers "can we render
 * role N, with what, and how does it submit?".
 *
 * To add a step: write the component, then add an entry with its role code and
 * its submit. Nothing else in the app needs to change.
 */
export const SIGNUP_STEPS: readonly StepDefinition[] = [
	{
		role: 13000,
		name: "pan",
		label: "PAN Details",
		Component: PanStep,
		submit: (client, v) => client.submitPan(v.pan),
	},
	{
		role: 12600,
		name: "pin",
		label: "Set Secret PIN",
		Component: PinStep,
		submit: (client, v) => client.submitPin(v.pin1, v.pin2),
	},
];
