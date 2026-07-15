import { describe, it, expect } from "vitest";
import { accountIdentity, chatIdentity } from "./identity";
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
