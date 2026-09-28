import {
	authContext,
	deviceClass,
	isSampled,
	normalizePagePath,
	type PaletteSearchReport,
	reportPaletteSearch,
} from "@/lib/palette-telemetry";
import type { MeView } from "@/lib/auth/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null)));

beforeEach(() => {
	window.dataLayer = [];
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	delete window.dataLayer;
	vi.unstubAllGlobals();
	fetchMock.mockClear();
});

const report: PaletteSearchReport = {
	query: "verify pan abcde1234f",
	scope: "all",
	resultCount: 3,
	outcome: "click",
	clickedCategory: "endpoint",
	clickedRank: 1,
	clickedId: "endpoint:pan-verification",
	clickedLabel: "PAN Verification",
	refinements: 2,
	durationMs: 4200,
	bodyIndexLoaded: true,
	page: "/products/kyc-api",
	auth: "developer",
	stage: "kyc-pending",
	trigger: "keyboard",
	device: "desktop",
};

const sent = (): Record<string, unknown> => {
	const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
	return JSON.parse(init.body as string);
};

describe("reportPaletteSearch", () => {
	// GA4 joins events to its own client ids: with a small user base, text,
	// page, stage or the clicked label there would identify a partner.
	it("pushes counts plus auth/trigger/device to GTM — nothing identifying", () => {
		reportPaletteSearch(report, false);

		expect(window.dataLayer).toEqual([
			{
				event: "palette_search",
				scope: "all",
				resultCount: 3,
				outcome: "click",
				clickedCategory: "endpoint",
				clickedRank: 1,
				queryLength: 21,
				auth: "developer",
				trigger: "keyboard",
				device: "desktop",
			},
		]);
		const pushed = JSON.stringify(window.dataLayer);
		for (const secret of [
			"verify",
			"kyc-pending",
			"/products",
			"PAN Verification",
		]) {
			expect(pushed).not.toContain(secret);
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sends the full redacted report, cookie-free, only when sampled", () => {
		reportPaletteSearch(report, true);

		const [, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(init.credentials).toBe("omit");
		expect(sent()).toEqual({
			scope: "all",
			resultCount: 3,
			outcome: "click",
			clickedCategory: "endpoint",
			clickedRank: 1,
			query: "verify pan …",
			page: "/products/kyc-api",
			auth: "developer",
			stage: "kyc-pending",
			trigger: "keyboard",
			device: "desktop",
			clickedId: "endpoint:pan-verification",
			clickedLabel: "PAN Verification",
			refinements: 2,
			durationMs: 4200,
			bodyIndexLoaded: true,
		});
	});

	// GTM persists dataLayer values across pushes; only an explicit undefined
	// clears the previous click (docs/features/palette-telemetry.md, Gotchas).
	it("sends click keys as explicit undefined on non-click outcomes", () => {
		reportPaletteSearch(
			{
				...report,
				outcome: "abandon",
				clickedCategory: undefined,
				clickedRank: undefined,
			},
			false,
		);

		const pushed = window.dataLayer?.[0] as Record<string, unknown>;
		expect(pushed).toHaveProperty("clickedCategory", undefined);
		expect(pushed).toHaveProperty("clickedRank", undefined);
	});

	it("ignores an empty query", () => {
		reportPaletteSearch({ ...report, query: "  " }, true);

		expect(window.dataLayer).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("normalizePagePath", () => {
	it("keeps page paths, collapses record ids", () => {
		expect(normalizePagePath("/docs/how-auth-works")).toBe(
			"/docs/how-auth-works",
		);
		expect(normalizePagePath("/console/transaction/48213")).toBe(
			"/console/transaction/:id",
		);
		expect(normalizePagePath("/x/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d/y")).toBe(
			"/x/:id/y",
		);
		expect(normalizePagePath("")).toBe("/");
	});
});

describe("authContext", () => {
	it("sends only role, and lifecycle for developers", () => {
		const me = { state: "kyc-rejected", mobile: "9990000001" } as MeView;

		expect(authContext({ status: "loading" })).toEqual({ auth: "unknown" });
		expect(authContext({ status: "anon" })).toEqual({ auth: "anon" });
		expect(authContext({ status: "authed", role: "developer", me })).toEqual({
			auth: "developer",
			stage: "kyc-rejected",
		});
		expect(
			authContext({
				status: "authed",
				role: "signup",
				me: { role: "signup", mobile: "9990000001" },
			}),
		).toEqual({ auth: "signup" });
	});
});

describe("deviceClass", () => {
	it("splits at the md breakpoint", () => {
		expect(deviceClass(767)).toBe("mobile");
		expect(deviceClass(768)).toBe("desktop");
	});
});

describe("isSampled", () => {
	it("never samples at rate 0, always below the rate", () => {
		expect(isSampled(0, () => 0)).toBe(false);
		expect(isSampled(0.1, () => 0.05)).toBe(true);
		expect(isSampled(0.1, () => 0.5)).toBe(false);
	});
});
