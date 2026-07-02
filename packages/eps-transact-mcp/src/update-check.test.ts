import { describe, expect, it, vi } from "vitest";

import {
	checkForUpdate,
	isNewer,
	notifyIfOutdated,
	updateNotice,
} from "./update-check.js";

/** A fetch mock returning a registry `latest` body with the given version. */
const fetchWithVersion = (version: unknown): typeof fetch =>
	(async () =>
		new Response(JSON.stringify({ version }), {
			status: 200,
			headers: { "content-type": "application/json" },
		})) as typeof fetch;

describe("isNewer (strict x.y.z)", () => {
	it("detects a newer patch/minor/major", () => {
		expect(isNewer("1.2.3", "1.2.4")).toBe(true);
		expect(isNewer("1.2.3", "1.3.0")).toBe(true);
		expect(isNewer("1.2.3", "2.0.0")).toBe(true);
	});
	it("is false for equal or older", () => {
		expect(isNewer("1.2.3", "1.2.3")).toBe(false);
		expect(isNewer("1.2.3", "1.2.2")).toBe(false);
		expect(isNewer("2.0.0", "1.9.9")).toBe(false);
	});
	it("is unknown (undefined) for non-strict versions", () => {
		expect(isNewer("1.2.3", "1.2.4-rc1")).toBeUndefined();
		expect(isNewer("1.2.3-beta", "1.2.4")).toBeUndefined();
		expect(isNewer("1.2", "1.2.4")).toBeUndefined();
		expect(isNewer("garbage", "1.2.4")).toBeUndefined();
	});
});

describe("checkForUpdate", () => {
	it("reports updateAvailable when the registry is ahead", async () => {
		const state = await checkForUpdate("0.1.0", {
			fetch: fetchWithVersion("0.2.0"),
		});
		expect(state).toEqual({
			current: "0.1.0",
			latest: "0.2.0",
			updateAvailable: true,
		});
	});
	it("reports updateAvailable=false when up to date (known, not unknown)", async () => {
		const state = await checkForUpdate("0.2.0", {
			fetch: fetchWithVersion("0.2.0"),
		});
		expect(state.updateAvailable).toBe(false);
		expect(state.latest).toBe("0.2.0");
	});
	it("has no updateAvailable when latest is a prerelease (unknown compare)", async () => {
		const state = await checkForUpdate("0.1.0", {
			fetch: fetchWithVersion("0.2.0-rc1"),
		});
		expect(state.updateAvailable).toBeUndefined();
	});
	it("is silent (no throw) when offline / fetch rejects", async () => {
		const failing = (async () => {
			throw new Error("ENOTFOUND registry.npmjs.org");
		}) as unknown as typeof fetch;
		const state = await checkForUpdate("0.1.0", { fetch: failing });
		expect(state).toEqual({ current: "0.1.0" });
	});
	it("is silent on a non-200 or bad body", async () => {
		const notFound = (async () =>
			new Response("nope", { status: 404 })) as typeof fetch;
		expect(await checkForUpdate("0.1.0", { fetch: notFound })).toEqual({
			current: "0.1.0",
		});
		const state = await checkForUpdate("0.1.0", {
			fetch: fetchWithVersion(42),
		});
		expect(state).toEqual({ current: "0.1.0" });
	});
});

describe("notifyIfOutdated", () => {
	it("warns once when a newer version exists", async () => {
		const warn = vi.fn();
		await notifyIfOutdated("0.1.0", {
			fetch: fetchWithVersion("0.2.0"),
			env: {},
			warn,
		});
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain("0.2.0 available");
		expect(warn.mock.calls[0][0]).toContain("@latest");
	});
	it("stays silent when up to date", async () => {
		const warn = vi.fn();
		await notifyIfOutdated("0.2.0", {
			fetch: fetchWithVersion("0.2.0"),
			env: {},
			warn,
		});
		expect(warn).not.toHaveBeenCalled();
	});
	it("respects EPS_NO_UPDATE_CHECK=1 (never even fetches)", async () => {
		const warn = vi.fn();
		const fetchSpy = vi.fn(fetchWithVersion("9.9.9"));
		await notifyIfOutdated("0.1.0", {
			fetch: fetchSpy as unknown as typeof fetch,
			env: { EPS_NO_UPDATE_CHECK: "1" },
			warn,
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
	});
});

describe("updateNotice", () => {
	it("names both versions and the @latest fix", () => {
		const msg = updateNotice({
			current: "0.1.0",
			latest: "0.2.0",
			updateAvailable: true,
		});
		expect(msg).toContain("0.1.0");
		expect(msg).toContain("0.2.0");
		expect(msg).toContain("npx -y @ekoindia/eps-transact-mcp@latest");
	});
});
