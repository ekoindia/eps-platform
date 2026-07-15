import { describe, it, expect, vi } from "vitest";
import { deriveStateFromProfile, buildMeView } from "./me";
import type { ProfileResult, EkoProfile } from "../types";

const profile: EkoProfile = {
	name: "Dev",
	email: "d@e.in",
	mobile: "9990000001",
	code: 1,
	userType: "merchant",
	ekoUserId: "EKO1",
	roleList: ["1"],
	orgId: 1,
	onboarding: 0,
	zohoId: "ZCRM_9",
};

describe("deriveStateFromProfile", () => {
	it("active when onboarding 0", () => {
		const r: ProfileResult = { kind: "found", responseTypeId: 369, profile };
		expect(deriveStateFromProfile(r)).toBe("active");
	});
	it("onboarded when onboarding 1", () => {
		const r: ProfileResult = {
			kind: "found",
			responseTypeId: 369,
			profile: { ...profile, onboarding: 1 },
		};
		expect(deriveStateFromProfile(r)).toBe("onboarded");
	});
	it("inactive", () => {
		expect(
			deriveStateFromProfile({ kind: "inactive", responseTypeId: 2123 }),
		).toBe("inactive");
	});
	it("lead for not_found", () => {
		expect(
			deriveStateFromProfile({ kind: "not_found", responseTypeId: 319 }),
		).toBe("lead");
	});
	it("unknown for not_allowed", () => {
		expect(
			deriveStateFromProfile({ kind: "not_allowed", responseTypeId: 369 }),
		).toBe("unknown");
	});
});

describe("buildMeView", () => {
	it("found → active view carries zohoId from profile", async () => {
		const v = await buildMeView("9990000001", {
			kind: "found",
			responseTypeId: 369,
			profile,
		});
		expect(v.state).toBe("active");
		expect(v.zohoId).toBe("ZCRM_9");
		expect(v.profile?.ekoUserId).toBe("EKO1");
	});

	it("not_allowed → unknown view with no profile and no lead lookup", async () => {
		const lookup = vi.fn(async () => true);
		const v = await buildMeView(
			"9990000001",
			{ kind: "not_allowed", responseTypeId: 369 },
			lookup,
		);
		expect(v.state).toBe("unknown");
		expect(v.profile).toBeNull();
		expect(v.zohoId).toBeNull();
		expect(lookup).not.toHaveBeenCalled();
	});

	it("not_found + lead lookup true → lead", async () => {
		const v = await buildMeView(
			"9990000001",
			{ kind: "not_found", responseTypeId: 319 },
			async () => true,
		);
		expect(v.state).toBe("lead");
		expect(v.profile).toBeNull();
	});

	it("not_found + lookup false → unknown", async () => {
		const v = await buildMeView(
			"9990000001",
			{ kind: "not_found", responseTypeId: 319 },
			async () => false,
		);
		expect(v.state).toBe("unknown");
	});

	it("not_found + lookup throws → unknown (non-fatal)", async () => {
		const v = await buildMeView(
			"9990000001",
			{ kind: "not_found", responseTypeId: 319 },
			async () => {
				throw new Error("zoho down");
			},
		);
		expect(v.state).toBe("unknown");
	});
});
