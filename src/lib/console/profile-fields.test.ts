import type { Profile } from "@/lib/auth/client";
import {
	checkAnswer,
	fieldOptions,
	profileFields,
	profileStrength,
	questionOrder,
} from "@/lib/console/profile-fields";
import { describe, expect, it } from "vitest";

/** A profile carrying only what the field list reads. */
function profileOf(companyType: string | null, extra: Partial<Profile> = {}) {
	return {
		name: "Acme Payments Private Limited",
		email: "ops@acme.test",
		userDetail: companyType ? { company_type: companyType } : {},
		...extra,
	} as Profile;
}

const PRIVATE_LTD = profileOf("1");

const keys = (profile: Profile | null) =>
	profileFields(profile).map((field) => field.key);

const field = (key: string, profile: Profile | null = PRIVATE_LTD) =>
	profileFields(profile).find((f) => f.key === key)!;

describe("profileFields", () => {
	it("lists every field in page order for a company", () => {
		expect(keys(PRIVATE_LTD)).toEqual([
			"company_type",
			"Industry",
			"Annual_Turnover",
			"Number_of_Employees",
			"Number_of_Clients",
			"GST_No",
			"Count_of_Directors",
			"Authorized_Signatory_Full_name",
			"email",
			"Website",
			"Mobile_App_Name",
		]);
	});

	it("drops the director count for a sole proprietor", () => {
		expect(keys(profileOf("3"))).not.toContain("Count_of_Directors");
	});

	it("settles the director count for an OPC, without asking", () => {
		const opc = profileOf("1", { name: "Acme (OPC) Private Limited" });
		const directors = field("Count_of_Directors", opc);
		expect(directors.question).toBeUndefined();
		expect(directors.read?.(opc)).toBe("1 (One Person Company)");
	});

	it("asks a private company within its legal range", () => {
		const directors = field("Count_of_Directors");
		expect(directors.question).toBe(
			"How many directors does your business have?",
		);
		expect(directors.options?.[0]).toBe("2");
		expect(directors.options?.at(-1)).toBe("15");
	});

	it("configures a question, a priority and a store for every editable field", () => {
		for (const f of profileFields(PRIVATE_LTD).filter((f) => f.saveTo)) {
			expect(f.question, f.key).toMatch(/\?$/);
			expect([0, 1, 2]).toContain(f.priority);
			expect(f.saveTo?.crm, f.key).toBe(f.key);
		}
	});
});

describe("profileStrength", () => {
	it("counts filled fields, profile and CRM alike", () => {
		const fields = profileFields(PRIVATE_LTD);
		// Company type + email from the profile, plus two CRM fields.
		expect(
			profileStrength(fields, PRIVATE_LTD, {
				Industry: "Logistics",
				Count_of_Directors: 3,
				GST_No: "  ",
			}),
		).toEqual({ filled: 4, total: 11, percent: 36 });
	});

	it("is 0 with nothing at all", () => {
		expect(profileStrength([], null, null).percent).toBe(0);
	});
});

describe("questionOrder", () => {
	const fields = profileFields(PRIVATE_LTD);
	const priorityOf = (key: string) => field(key).priority;

	it("asks every higher priority before any lower one", () => {
		const order = questionOrder(fields);
		const priorities = order.map(priorityOf);
		expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
	});

	it("never queues a read-only field", () => {
		const order = questionOrder(fields);
		expect(order).not.toContain("email");
		expect(order).not.toContain("company_type");
		expect(order).toHaveLength(9);
	});

	it("shuffles within a priority", () => {
		const high = (random: () => number) =>
			questionOrder(fields, random).slice(0, 3);
		expect(high(() => 0)).not.toEqual(high(() => 0.99));
		expect([...high(() => 0)].sort()).toEqual([
			"Annual_Turnover",
			"GST_No",
			"Industry",
		]);
	});
});

describe("checkAnswer", () => {
	it("refuses a blank answer", () => {
		expect(checkAnswer(field("Website"), "  ", undefined)).toEqual({
			ok: false,
			error: "Add an answer, or skip this one.",
		});
	});

	it("upper-cases a GSTIN and checks its shape", () => {
		expect(checkAnswer(field("GST_No"), "07aaaca1234a1z5", undefined)).toEqual({
			ok: true,
			payload: "07AAACA1234A1Z5",
		});
		expect(checkAnswer(field("GST_No"), "07AAACA", undefined).ok).toBe(false);
	});

	it("wants a full web address", () => {
		expect(checkAnswer(field("Website"), "acme.test", undefined).ok).toBe(
			false,
		);
	});

	it("holds a director count to the type's range and sends a number", () => {
		const directors = field("Count_of_Directors");
		const options = fieldOptions(directors, {});
		expect(checkAnswer(directors, "1", options).ok).toBe(false);
		expect(checkAnswer(directors, "4", options)).toEqual({
			ok: true,
			payload: 4,
		});
	});

	it("takes only an offered picklist choice", () => {
		const industry = field("Industry");
		const options = fieldOptions(industry, { Industry: ["Logistics"] });
		expect(checkAnswer(industry, "Fintech", options).ok).toBe(false);
		expect(checkAnswer(industry, "Logistics", options).ok).toBe(true);
	});
});
