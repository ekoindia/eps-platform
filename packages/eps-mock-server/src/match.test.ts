import { describe, expect, it } from "vitest";

import { matchResponse } from "./match.js";

const fixtures = [
	{
		slug: "dmt-get-sender",
		method: "GET",
		path: "/customer/profile/{customer_id}/dmt-fino",
		request: {},
		successResponse: {
			status: 0,
			response_status_id: 0,
			message: "Customer found",
		},
		errors: [
			{
				scenario: "Sender not found",
				responseStatusId: 463,
				example: {
					status: 1,
					response_status_id: 463,
					message: "User not found",
				},
			},
		],
	},
];

describe("matchResponse", () => {
	it("matches a GET path with a path param and returns the success response", () => {
		const res = matchResponse(
			fixtures,
			"GET",
			"/customer/profile/9123456789/dmt-fino",
			{},
		);
		expect(res?.body.response_status_id).toBe(0);
	});

	it("returns the error example when eps_scenario forces a status id", () => {
		const res = matchResponse(
			fixtures,
			"GET",
			"/customer/profile/9123456789/dmt-fino",
			{ eps_scenario: "463" },
		);
		expect(res?.body.response_status_id).toBe(463);
	});

	it("returns null for an unknown route", () => {
		expect(matchResponse(fixtures, "GET", "/nope", {})).toBeNull();
	});
});
