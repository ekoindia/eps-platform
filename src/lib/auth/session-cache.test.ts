import { beforeEach, describe, expect, it } from "vitest";
import type { MeView } from "@/lib/auth/client";
import {
	clearCachedSession,
	readCachedSession,
	writeCachedSession,
} from "@/lib/auth/session-cache";

const KEY = "eps.session.me";

/**
 * The envelope version this build writes. Spelled out rather than imported, for
 * the same reason `KEY` is: a test that reads the constant it is checking cannot
 * notice the constant changing. Used by the tests below that are about a view's
 * SHAPE — they need a current envelope, or they would pass because the version
 * was stale and never reach the check they exist for.
 */
const CURRENT_VERSION = 2;

const ME: MeView = {
	state: "active",
	mobile: "9990000079",
	profile: null,
	zohoId: null,
};

beforeEach(() => sessionStorage.clear());

describe("session cache round-trip", () => {
	it("reads back what it wrote", () => {
		writeCachedSession(ME);
		expect(readCachedSession()).toEqual(ME);
	});

	it("returns null when nothing was cached", () => {
		expect(readCachedSession()).toBeNull();
	});

	it("forgets the session on clear", () => {
		writeCachedSession(ME);
		clearCachedSession();
		expect(readCachedSession()).toBeNull();
	});

	it("caches an admin and a signup view too", () => {
		writeCachedSession({ role: "admin", login: "octocat", sub: "gh:1" });
		expect(readCachedSession()).toEqual({
			role: "admin",
			login: "octocat",
			sub: "gh:1",
		});
		writeCachedSession({ role: "signup", mobile: "9990000079" });
		expect(readCachedSession()).toEqual({
			role: "signup",
			mobile: "9990000079",
		});
	});
});

describe("session cache rejects what it cannot trust", () => {
	// The reason this validation exists: AuthProvider's `classify()` opens with
	// `"role" in me`, and `in` throws a TypeError on a primitive. A blob that
	// reached it would throw outside the caller's try/catch.
	it.each([
		["a number", "5"],
		["a string", '"hello"'],
		["null", "null"],
		["an array", "[]"],
		["a boolean", "true"],
	])("discards %s where a session view was expected", (_label, body) => {
		sessionStorage.setItem(KEY, `{"v":1,"me":${body}}`);
		expect(readCachedSession()).toBeNull();
	});

	it("discards corrupt JSON", () => {
		sessionStorage.setItem(KEY, "{not json");
		expect(readCachedSession()).toBeNull();
	});

	it("discards a blob written by an older build", () => {
		sessionStorage.setItem(KEY, JSON.stringify({ v: 0, me: ME }));
		expect(readCachedSession()).toBeNull();
	});

	it("discards an envelope with no version at all", () => {
		sessionStorage.setItem(KEY, JSON.stringify({ me: ME }));
		expect(readCachedSession()).toBeNull();
	});

	// Structurally recognizable but missing the fields the console renders — the
	// case that would otherwise paint a shell full of `undefined`.
	it("discards a developer view with no state or mobile", () => {
		sessionStorage.setItem(
			KEY,
			JSON.stringify({
				v: CURRENT_VERSION,
				me: { profile: null, zohoId: null },
			}),
		);
		expect(readCachedSession()).toBeNull();
	});

	it("discards an admin view with no subject", () => {
		sessionStorage.setItem(
			KEY,
			JSON.stringify({
				v: CURRENT_VERSION,
				me: { role: "admin", login: "octocat" },
			}),
		);
		expect(readCachedSession()).toBeNull();
	});
});
