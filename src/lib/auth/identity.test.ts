import { describe, it, expect } from "vitest";
import { accountIdentity } from "./identity";
import type { AuthState } from "@/lib/auth/AuthProvider";
import type { Profile } from "@/lib/auth/client";

/** Builds an authed-developer AuthState; profile fields beyond name are irrelevant here. */
function dev(mobile: string, name: string | null): AuthState {
	return {
		status: "authed",
		role: "developer",
		me: {
			state: "active",
			mobile,
			profile: name === null ? null : ({ name, mobile } as Profile),
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
		expect(accountIdentity(dev("9990000079", "Rahul Sharma"))).toEqual({
			name: "Rahul Sharma",
			initials: "RS",
			detail: "Developer",
		});
	});

	it("uses a single initial for a one-word name", () => {
		expect(accountIdentity(dev("9990000079", "Rahul"))?.initials).toBe("R");
	});

	it("falls back to mobile name + last-2-digit initials when nameless", () => {
		expect(accountIdentity(dev("9990000079", null))).toEqual({
			name: "9990000079",
			initials: "#79",
			detail: "Developer",
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
});
