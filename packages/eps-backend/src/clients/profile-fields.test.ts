import { describe, it, expect } from "vitest";
import { stripSensitive, toStateId } from "./profile-fields";

describe("stripSensitive", () => {
	it("keeps ordinary profile fields", () => {
		expect(
			stripSensitive({
				name: "Dev",
				pancardnumber: "ABCDE1234F",
				current_plan: "Gold",
				account_state_id: 48,
			}),
		).toEqual({
			name: "Dev",
			pancardnumber: "ABCDE1234F",
			current_plan: "Gold",
			account_state_id: 48,
		});
	});

	it("drops credential-shaped keys", () => {
		expect(
			stripSensitive({
				name: "Dev",
				access_token: "eyJ...",
				refresh_token: "r",
				secret_key: "s",
				access_key: "a",
				password: "p",
				otp: "123456",
				pin: "1234",
				mpin: "1234",
			}),
		).toEqual({ name: "Dev" });
	});

	// The whole reason the filter recurses. A one-level version would forward
	// this untouched, and upstream owns the shape — nothing here can promise the
	// object stays flat.
	it("drops credential-shaped keys nested inside objects and arrays", () => {
		expect(
			stripSensitive({
				primary_mobile_meta: { verified: true, otp: "999999" },
				user_contacts: [
					{ label: "home", value: "9990000001" },
					{ label: "device", auth_token: "t" },
				],
			}),
		).toEqual({
			primary_mobile_meta: { verified: true },
			user_contacts: [
				{ label: "home", value: "9990000001" },
				{ label: "device" },
			],
		});
	});

	// Near-misses that must survive: a postal code is not a PIN, and
	// `is_pin_not_set` is a boolean flag connect-api forwards to its own frontend.
	it("keeps postal codes and the pin-not-set flag", () => {
		expect(
			stripSensitive({
				pincode: "110001",
				pin_code: "110001",
				is_pin_not_set: 1,
			}),
		).toEqual({ pincode: "110001", pin_code: "110001", is_pin_not_set: 1 });
	});

	it("does not mutate its input", () => {
		const input = { name: "Dev", pin: "1234" };
		stripSensitive(input);
		expect(input.pin).toBe("1234");
	});
});

describe("toStateId", () => {
	it("reads a number", () => {
		expect(toStateId(48)).toBe(48);
	});

	it("reads a numeric string", () => {
		expect(toStateId("16")).toBe(16);
	});

	// The case a bare `Number(...)` gets wrong: both of these coerce to 0, which
	// would be indistinguishable from a real state id of 0.
	it("rejects blank and whitespace strings rather than reading them as 0", () => {
		expect(toStateId("")).toBeNull();
		expect(toStateId(" ")).toBeNull();
	});

	it("rejects absent, non-numeric and non-integer values", () => {
		expect(toStateId(undefined)).toBeNull();
		expect(toStateId(null)).toBeNull();
		expect(toStateId("abc")).toBeNull();
		expect(toStateId(Number.NaN)).toBeNull();
		expect(toStateId(Number.POSITIVE_INFINITY)).toBeNull();
		expect(toStateId(16.5)).toBeNull();
		expect(toStateId({})).toBeNull();
	});
});
