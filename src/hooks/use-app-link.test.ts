import { normalizeWidgetUrl } from "@/hooks/use-app-link";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://eko.in";

describe("normalizeWidgetUrl", () => {
	it("keeps a bare path internal", () => {
		expect(normalizeWidgetUrl("/console/credentials", ORIGIN)).toEqual({
			url: "/console/credentials",
			internal: true,
		});
	});

	it("adds the leading slash a relative path omits", () => {
		expect(normalizeWidgetUrl("console", ORIGIN)).toEqual({
			url: "/console",
			internal: true,
		});
	});

	it("strips our own origin when the widget echoes it back", () => {
		expect(normalizeWidgetUrl(`${ORIGIN}/console`, ORIGIN)).toEqual({
			url: "/console",
			internal: true,
		});
	});

	it("collapses the Connect deep-link scheme", () => {
		expect(normalizeWidgetUrl("ekoconnect://transaction/491", ORIGIN)).toEqual({
			url: "/transaction/491",
			internal: true,
		});
	});

	it("collapses a Connect web host", () => {
		expect(
			normalizeWidgetUrl("https://connect.eko.in/transaction/491", ORIGIN),
		).toEqual({ url: "/transaction/491", internal: true });
	});

	it("strips Polymer's hashbang", () => {
		expect(
			normalizeWidgetUrl("https://connect.eko.in/#!/transaction/491", ORIGIN),
		).toEqual({ url: "/transaction/491", internal: true });
	});

	it("treats a third-party https URL as external", () => {
		expect(normalizeWidgetUrl("https://example.com/x", ORIGIN)).toEqual({
			url: "https://example.com/x",
			internal: false,
		});
	});

	it("treats non-http schemes as external", () => {
		// tel:/upi:/mailto: must reach the OS handler, not the router.
		expect(normalizeWidgetUrl("upi://pay?pa=x", ORIGIN).internal).toBe(false);
		expect(normalizeWidgetUrl("tel:+911234567890", ORIGIN).internal).toBe(
			false,
		);
	});

	it("treats a bare hostname as external", () => {
		expect(normalizeWidgetUrl("www.example.com/x", ORIGIN).internal).toBe(
			false,
		);
	});
});
