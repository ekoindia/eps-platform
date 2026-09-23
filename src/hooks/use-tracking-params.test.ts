import {
	captureTrackingParams,
	getStoredTrackingParams,
	TRACKING_TTL_MS,
} from "@/hooks/use-tracking-params";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "eps_tracking_params";
const T0 = new Date("2026-09-01T00:00:00Z").getTime();

describe("tracking params storage", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(T0);
	});
	afterEach(() => vi.useRealTimers());

	it("captures only tracking params into a localStorage envelope", () => {
		captureTrackingParams("?gclid=abc&utm_source=google&foo=bar&fbclid=");
		expect(getStoredTrackingParams()).toEqual({
			gclid: "abc",
			utm_source: "google",
		});
		expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
			params: { gclid: "abc", utm_source: "google" },
			capturedAt: T0,
		});
	});

	it("is first-touch: stored values win and the clock does not restart", () => {
		captureTrackingParams("?gclid=first");
		vi.setSystemTime(T0 + 1000);
		captureTrackingParams("?gclid=second&utm_medium=cpc");
		expect(getStoredTrackingParams()).toEqual({
			gclid: "first",
			utm_medium: "cpc",
		});
		expect(JSON.parse(localStorage.getItem(KEY) ?? "").capturedAt).toBe(T0);
	});

	it("expires after the TTL and clears the key", () => {
		captureTrackingParams("?gclid=abc");
		vi.setSystemTime(T0 + TRACKING_TTL_MS + 1);
		expect(getStoredTrackingParams()).toEqual({});
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it("drops a malformed envelope", () => {
		localStorage.setItem(KEY, "{nope");
		expect(getStoredTrackingParams()).toEqual({});
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it("migrates a legacy sessionStorage record once", () => {
		sessionStorage.setItem(KEY, JSON.stringify({ gclid: "legacy" }));
		expect(getStoredTrackingParams()).toEqual({ gclid: "legacy" });
		expect(sessionStorage.getItem(KEY)).toBeNull();
		expect(JSON.parse(localStorage.getItem(KEY) ?? "").capturedAt).toBe(T0);
	});
});
