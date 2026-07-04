import { afterEach, describe, expect, it, vi } from "vitest";

import {
	checkForUpdate,
	compareVersions,
	type VersionState,
} from "./update-check.js";

describe("compareVersions", () => {
	it("orders strict semver", () => {
		expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
		expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
		expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
		expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
	});

	it("returns null for non-strict versions", () => {
		expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBeNull();
		expect(compareVersions("1.0", "1.0.0")).toBeNull();
		expect(compareVersions("latest", "1.0.0")).toBeNull();
	});
});

describe("checkForUpdate", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.EPS_NO_UPDATE_CHECK;
	});

	const stubFetch = (version: unknown, ok = true) =>
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok, json: async () => ({ version }) })),
		);

	it("flags an available update", async () => {
		stubFetch("0.2.0");
		const state: VersionState = { current: "0.1.0" };
		await checkForUpdate(state);
		expect(state).toEqual({
			current: "0.1.0",
			latest: "0.2.0",
			updateAvailable: true,
		});
	});

	it("reports no update when current is latest", async () => {
		stubFetch("0.1.0");
		const state: VersionState = { current: "0.1.0" };
		await checkForUpdate(state);
		expect(state.updateAvailable).toBe(false);
		expect(state.latest).toBe("0.1.0");
	});

	it("skips the network entirely when EPS_NO_UPDATE_CHECK is set", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		process.env.EPS_NO_UPDATE_CHECK = "1";
		const state: VersionState = { current: "0.1.0" };
		await checkForUpdate(state);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(state.latest).toBeUndefined();
	});

	it("stays silent on fetch failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("offline");
			}),
		);
		const state: VersionState = { current: "0.1.0" };
		await expect(checkForUpdate(state)).resolves.toBeUndefined();
		expect(state.updateAvailable).toBeUndefined();
	});
});
