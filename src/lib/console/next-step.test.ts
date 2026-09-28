import { describe, expect, it } from "vitest";
import { deriveNextStep } from "./next-step";

describe("deriveNextStep", () => {
	it("puts an owed signature first", () => {
		expect(
			deriveNextStep({ state: "kyc-pending", esignPending: true }),
		).toEqual({ kind: "esign" });
	});

	it("asks for the KYC pack while it is owed", () => {
		expect(
			deriveNextStep({ state: "kyc-pending", esignPending: false }),
		).toEqual({ kind: "kyc-upload", action: "Upload" });
		expect(
			deriveNextStep({ state: "kyc-rejected", esignPending: false }),
		).toEqual({ kind: "kyc-upload", action: "Re-upload" });
	});

	it("prefers the counted pack's wording when it has arrived", () => {
		expect(
			deriveNextStep({
				state: "kyc-pending",
				esignPending: false,
				packCta: "Re-upload",
			}),
		).toEqual({ kind: "kyc-upload", action: "Re-upload" });
	});

	// packCta null = the pack has nothing to upload (all approved or in review).
	it("has no blocker when the pack owes nothing", () => {
		expect(
			deriveNextStep({
				state: "kyc-pending",
				esignPending: false,
				packCta: null,
			}),
		).toEqual({ kind: "none" });
	});

	it("has no blocker for an active account", () => {
		expect(deriveNextStep({ state: "active", esignPending: false })).toEqual({
			kind: "none",
		});
	});
});
