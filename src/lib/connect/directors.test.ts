import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/auth/client";
import {
	chosenDirectorCount,
	directorRule,
	effectiveDirectorCount,
	isOpcName,
} from "./directors";

const profile = (companyType: string | null, name = "Acme Private Limited") =>
	({
		name,
		userDetail: companyType === null ? {} : { company_type: companyType },
		detailBlocks: {},
	}) as unknown as Profile;

describe("directorRule", () => {
	it.each([
		["1", 2, 2, "directors"],
		["5", 3, 3, "directors"],
		["4", 2, 2, "designated partners"],
		["2", 2, 2, "partners"],
	])(
		"asks company type %s from %i, assuming %i %s",
		(code, min, floor, many) => {
			const rule = directorRule(profile(code));
			expect(rule).toMatchObject({ kind: "ask", min, max: 15, floor });
			expect(rule.kind === "ask" && rule.noun.many).toBe(many);
		},
	);

	it.each(["3", "7"])("hides the question for company type %s", (code) => {
		expect(directorRule(profile(code))).toEqual({ kind: "hidden" });
	});

	it("asks 1–15 with nothing assumed when the type is unknown or missing", () => {
		for (const rule of [
			directorRule(profile(null)),
			directorRule(profile("9")),
		]) {
			expect(rule).toMatchObject({ kind: "ask", min: 1, max: 15, floor: null });
		}
	});

	it("fixes an OPC at one director, by name", () => {
		const opc = profile("1", "Acme (OPC) Private Limited");
		expect(directorRule(opc)).toEqual({ kind: "fixed", count: 1 });
		expect(directorRule(profile(null, "Acme (OPC) Pvt Ltd"))).toEqual({
			kind: "fixed",
			count: 1,
		});
	});

	it("asks a Private Limited profile carrying a personal name 1–15, assuming nothing", () => {
		// A personal PAN verified by mistake: could be an OPC, could be not.
		for (const name of ["Asha Rao", "Asha (OPC) Rao"]) {
			expect(directorRule(profile("1", name))).toMatchObject({
				kind: "ask",
				min: 1,
				max: 15,
				floor: null,
			});
		}
		expect(directorRule(profile("1", "Acme Pvt. Ltd."))).toMatchObject({
			min: 2,
			floor: 2,
		});
	});

	it("ignores an (OPC) in the name of any other business type", () => {
		expect(directorRule(profile("2", "Acme (OPC) Pvt Ltd")).kind).toBe("ask");
		expect(directorRule(profile("3", "Acme (OPC)")).kind).toBe("hidden");
	});

	it("survives a missing profile", () => {
		expect(directorRule(null)).toMatchObject({ kind: "ask", floor: null });
	});
});

describe("isOpcName", () => {
	it.each([
		["Acme (OPC) Private Limited", true],
		["ACME ( opc ) PVT LTD", true],
		["Acme (OPC) Pvt. Ltd.", true],
		["Acme (OPC) Pvt.Ltd", true],
		["Acme OPC Private Limited", false],
		["Topcoat Private Limited", false],
		// No company suffix: a personal name, whatever it says.
		["Asha (OPC) Rao", false],
		["Acme (OPC)", false],
		["", false],
	])("%j → %s", (name, expected) => {
		expect(isOpcName(name)).toBe(expected);
	});
});

describe("chosenDirectorCount / effectiveDirectorCount", () => {
	const pvt = directorRule(profile("1"));

	it("takes an in-range answer, as a number or a string", () => {
		expect(chosenDirectorCount(pvt, 4)).toBe(4);
		expect(chosenDirectorCount(pvt, "4")).toBe(4);
		expect(effectiveDirectorCount(pvt, 15)).toBe(15);
	});

	it("reads an out-of-range or junk answer as none, and falls back to the floor", () => {
		for (const stored of [1, 16, 0, 2.5, "", "two", null, undefined]) {
			expect(chosenDirectorCount(pvt, stored)).toBeNull();
			expect(effectiveDirectorCount(pvt, stored)).toBe(2);
		}
	});

	it("has nothing to check against for an unanswered unknown type", () => {
		const unknown = directorRule(profile(null));
		expect(effectiveDirectorCount(unknown, null)).toBeNull();
		expect(effectiveDirectorCount(unknown, 1)).toBe(1);
	});

	it("is always one for an OPC and never anything for a sole proprietor", () => {
		const opc = directorRule(profile("1", "Acme (OPC) Pvt Ltd"));
		expect(effectiveDirectorCount(opc, 5)).toBe(1);
		expect(effectiveDirectorCount(directorRule(profile("3")), 5)).toBeNull();
	});
});
