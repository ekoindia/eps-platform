import { describe, it, expect } from "vitest";
import {
	accountIdentity,
	chatIdentity,
	detailField,
	profileCompleteness,
} from "./identity";
import type { AuthState } from "@/lib/auth/AuthProvider";
import type { Profile } from "@/lib/auth/client";

/** Builds an authed-developer AuthState; profile fields beyond name/code are irrelevant here. */
function dev(mobile: string, name: string | null, code?: string): AuthState {
	return {
		status: "authed",
		role: "developer",
		me: {
			state: "active",
			mobile,
			profile: name === null ? null : ({ name, mobile, code } as Profile),
			zohoId: null,
		},
	};
}

describe("accountIdentity", () => {
	it("returns null when not authenticated", () => {
		expect(accountIdentity({ status: "loading" })).toBeNull();
		expect(accountIdentity({ status: "anon" })).toBeNull();
	});

	it("derives initials from a developer's name", () => {
		expect(accountIdentity(dev("9990000079", "Rahul Sharma", "20810"))).toEqual(
			{
				name: "Rahul Sharma",
				initials: "RS",
				detail: "EPS Admin",
				meta: "9990000079 · Code 20810",
			},
		);
	});

	it("omits the code from meta when the profile has none", () => {
		expect(accountIdentity(dev("9990000079", "Rahul Sharma"))?.meta).toBe(
			"9990000079",
		);
	});

	it("uses a single initial for a one-word name", () => {
		expect(accountIdentity(dev("9990000079", "Rahul"))?.initials).toBe("R");
	});

	it("falls back to mobile name + last-2-digit initials when nameless", () => {
		expect(accountIdentity(dev("9990000079", null))).toEqual({
			name: "9990000079",
			initials: "#79",
			detail: "EPS Admin",
			meta: undefined,
		});
	});

	it("uses the GitHub handle for an admin", () => {
		const state: AuthState = {
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octocat", sub: "gh:1" },
		};
		expect(accountIdentity(state)).toEqual({
			name: "octocat",
			initials: "OC",
			detail: "Admin",
		});
	});

	it("falls back to sub + 'A' when an admin has no handle", () => {
		const state: AuthState = {
			status: "authed",
			role: "admin",
			me: { role: "admin", login: null, sub: "gh:42" },
		};
		expect(accountIdentity(state)).toEqual({
			name: "gh:42",
			initials: "A",
			detail: "Admin",
		});
	});

	it("labels a signup session 'Finishing setup', not 'EPS Admin'", () => {
		const state: AuthState = {
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000079" },
		};
		expect(accountIdentity(state)).toEqual({
			name: "9990000079",
			initials: "#79",
			detail: "Finishing setup",
			meta: undefined,
		});
	});
});

/** Builds an authed-developer AuthState with an arbitrary profile shape. */
function devWithProfile(
	mobile: string,
	profile: Partial<Profile> | null,
): AuthState {
	return {
		status: "authed",
		role: "developer",
		me: {
			state: "active",
			mobile,
			profile: profile === null ? null : (profile as Profile),
			zohoId: null,
		},
	};
}

describe("chatIdentity", () => {
	it("returns null when not authenticated", () => {
		expect(chatIdentity({ status: "loading" })).toBeNull();
		expect(chatIdentity({ status: "anon" })).toBeNull();
	});

	it("returns null for an admin — internal staff, not a sales contact", () => {
		const state: AuthState = {
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octocat", sub: "gh:1" },
		};
		expect(chatIdentity(state)).toBeNull();
	});

	it("carries name, email, and mobile for a developer", () => {
		const state = devWithProfile("9990000079", {
			name: "Rahul Sharma",
			email: "rahul@example.in",
			mobile: "9990000079",
		});
		expect(chatIdentity(state)).toEqual({
			name: "Rahul Sharma",
			email: "rahul@example.in",
			contactNumber: "9990000079",
		});
	});

	it("drops blank fields rather than sending empty strings", () => {
		// The backend profile mapper defaults absent values to "".
		const state = devWithProfile("9990000079", {
			name: "Rahul Sharma",
			email: "",
			mobile: "9990000079",
		});
		expect(chatIdentity(state)).toEqual({
			name: "Rahul Sharma",
			contactNumber: "9990000079",
		});
	});

	it("falls back to the session mobile when the profile is missing", () => {
		// Reachable: /me can return profile: null for a session minted earlier.
		expect(chatIdentity(devWithProfile("9990000079", null))).toEqual({
			contactNumber: "9990000079",
		});
	});

	it("falls back to the session mobile when the profile mobile is blank", () => {
		const state = devWithProfile("9990000079", { name: "Rahul", mobile: "" });
		expect(chatIdentity(state)?.contactNumber).toBe("9990000079");
	});
});

describe("profileCompleteness", () => {
	/** A profile whose onboarding fields are the only ones that matter here. */
	function onboarding(
		onboarding: number,
		roleList: string[],
		steps: Array<{ role: number; label: string }>,
	): Profile {
		return {
			onboarding,
			roleList,
			onboardingSteps: steps,
		} as Profile;
	}

	const FOUR_STEPS = [
		{ role: 13000, label: "PAN Details" },
		{ role: 13100, label: "Business Details" },
		{ role: 12600, label: "Set Secret PIN" },
		{ role: 12800, label: "Sign Agreement" },
	];

	it("is 100 for a finished profile", () => {
		expect(profileCompleteness(onboarding(0, [], []))).toBe(100);
	});

	it("is 100 for a finished profile even if steps are still listed", () => {
		// `onboarding === 0` is the authoritative signal; upstream does not always
		// clear the step list with it.
		expect(profileCompleteness(onboarding(0, ["12800"], FOUR_STEPS))).toBe(100);
	});

	it("counts a step as done once its role stops being pending", () => {
		expect(
			profileCompleteness(onboarding(1, ["12600", "12800"], FOUR_STEPS)),
		).toBe(50);
	});

	it("is 0 when every step is still pending", () => {
		expect(
			profileCompleteness(
				onboarding(1, ["13000", "13100", "12600", "12800"], FOUR_STEPS),
			),
		).toBe(0);
	});

	it("is 0 for an unfinished profile with no step list", () => {
		// Nothing to measure against — claiming 100% here would be a lie, and
		// dividing by zero would show NaN%.
		expect(profileCompleteness(onboarding(1, [], []))).toBe(0);
	});

	it("compares roles numerically, since roleList arrives as strings", () => {
		expect(profileCompleteness(onboarding(1, ["13000"], FOUR_STEPS))).toBe(75);
	});
});

describe("detailField", () => {
	const BLOCKS = {
		personal_detail: { gender: "Male", dob: " 01-01-1990 ", pincode: 110001 },
	};

	it("reads a string field out of the block", () => {
		expect(detailField(BLOCKS, "personal", "gender")).toBe("Male");
	});

	it("trims the value", () => {
		expect(detailField(BLOCKS, "personal", "dob")).toBe("01-01-1990");
	});

	it("renders a numeric field as a string", () => {
		expect(detailField(BLOCKS, "personal", "pincode")).toBe("110001");
	});

	it("accepts the plural spelling of the block name", () => {
		// Upstream is inconsistent; the backend allowlists both.
		expect(
			detailField({ personal_details: { gender: "Female" } }, "personal", "gender"),
		).toBe("Female");
	});

	it("returns null for an absent block, field, or profile", () => {
		expect(detailField(undefined, "personal", "gender")).toBeNull();
		expect(detailField({}, "personal", "gender")).toBeNull();
		expect(detailField(BLOCKS, "shop", "shop_name")).toBeNull();
		expect(detailField(BLOCKS, "personal", "qualification")).toBeNull();
	});

	it("returns null rather than a value that cannot be displayed", () => {
		const blocks = {
			personal_detail: {
				gender: { en: "Male" },
				dob: ["01-01-1990"],
				qualification: null,
				marital_status: "   ",
			},
		};
		expect(detailField(blocks, "personal", "gender")).toBeNull();
		expect(detailField(blocks, "personal", "dob")).toBeNull();
		expect(detailField(blocks, "personal", "qualification")).toBeNull();
		expect(detailField(blocks, "personal", "marital_status")).toBeNull();
	});
});
