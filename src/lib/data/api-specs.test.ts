import { describe, expect, it } from "vitest";
import { API_SPECS } from "./api-specs";

describe("API_SPECS internal codes", () => {
	it("sets trxnTypeId and epsProductCode together, as positive integers", () => {
		const bad = API_SPECS.filter((spec) => {
			const { trxnTypeId, epsProductCode } = spec;
			if (trxnTypeId === undefined && epsProductCode === undefined)
				return false;
			return ![trxnTypeId, epsProductCode].every(
				(code) => Number.isInteger(code) && (code as number) > 0,
			);
		}).map((spec) => spec.id);
		expect(bad).toEqual([]);
	});
});
