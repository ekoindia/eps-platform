import { describe, expect, it, vi } from "vitest";
import type { SignupState } from "@/lib/auth/client";
import { resolveSteps, type StepDefinition } from "./resolveSteps";

const Dummy = () => null;
const noSubmit = async () => ({}) as never;

const registry: StepDefinition[] = [
	{
		role: 13000,
		name: "pan",
		label: "PAN Details",
		Component: Dummy,
		submit: noSubmit,
	},
	{
		role: 12600,
		name: "pin",
		label: "Set Secret PIN",
		Component: Dummy,
		submit: noSubmit,
	},
];

function state(over: Partial<SignupState> = {}): SignupState {
	return {
		mobile: "9990000001",
		status: "in_progress",
		steps: [
			{ role: 13000, label: "PAN Details" },
			{ role: 12600, label: "Set Secret PIN" },
		],
		currentRole: 13000,
		...over,
	};
}

describe("resolveSteps", () => {
	it("marks the current step and leaves later steps pending", () => {
		expect(
			resolveSteps(state(), registry).map((s) => [s.name, s.status]),
		).toEqual([
			["pan", "current"],
			["pin", "pending"],
		]);
	});

	it("marks steps before the current one complete", () => {
		const resolved = resolveSteps(state({ currentRole: 12600 }), registry);
		expect(resolved.map((s) => [s.name, s.status])).toEqual([
			["pan", "complete"],
			["pin", "current"],
		]);
	});

	it("orders by the API, not the registry", () => {
		// API returns PIN first; the registry lists PAN first. API wins.
		const resolved = resolveSteps(
			state({
				steps: [
					{ role: 12600, label: "Set Secret PIN" },
					{ role: 13000, label: "PAN Details" },
				],
				currentRole: 12600,
			}),
			registry,
		);
		expect(resolved.map((s) => s.name)).toEqual(["pin", "pan"]);
	});

	it("prefers the API label over the registry label", () => {
		const resolved = resolveSteps(
			state({
				steps: [{ role: 13000, label: "PAN Card" }],
				currentRole: 13000,
			}),
			registry,
		);
		expect(resolved[0].label).toBe("PAN Card");
	});

	it("falls back to the registry label when the API sends none", () => {
		const resolved = resolveSteps(
			state({ steps: [{ role: 13000, label: "" }], currentRole: 13000 }),
			registry,
		);
		expect(resolved[0].label).toBe("PAN Details");
	});

	it("skips a role the registry does not know, without throwing, and logs it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const resolved = resolveSteps(
			state({
				steps: [
					{ role: 99999, label: "Future Step" },
					{ role: 13000, label: "PAN Details" },
				],
				currentRole: 13000,
			}),
			registry,
		);
		expect(resolved.map((s) => s.name)).toEqual(["pan"]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("99999"));
		warn.mockRestore();
	});

	it("marks every step complete when onboarding is done", () => {
		const resolved = resolveSteps(
			state({ status: "done", currentRole: null }),
			registry,
		);
		expect(resolved.every((s) => s.status === "complete")).toBe(true);
	});

	it("marks all steps complete when currentRole is null even while in_progress — callers must check state.status", () => {
		// When the backend has no actionable step (empty role_list), currentRole is null
		// but status is still "in_progress". This returns all-complete steps, but that
		// does NOT mean onboarding is finished — the caller must check state.status to know.
		const resolved = resolveSteps(state({ currentRole: null }), registry);
		expect(resolved.every((s) => s.status === "complete")).toBe(true);
		expect(resolved.length).toBeGreaterThan(0); // non-empty flow, not a false positive on empty state
	});

	it("returns an empty list when the API sends no steps", () => {
		expect(
			resolveSteps(state({ steps: [], currentRole: null }), registry),
		).toEqual([]);
	});

	it("resolves the Sign Agreement step (role 12800) from the real registry, not skipping it", async () => {
		const { SIGNUP_STEPS } = await import("./steps");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const resolved = resolveSteps(
			state({
				steps: [{ role: 12800, label: "Sign Agreement" }],
				currentRole: 12800,
			}),
			SIGNUP_STEPS,
		);
		expect(resolved.map((s) => [s.name, s.status])).toEqual([
			["agreement", "current"],
		]);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
