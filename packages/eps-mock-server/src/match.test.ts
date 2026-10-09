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
				status: 463,
				responseTypeId: 308,
				example: {
					status: 463,
					response_status_id: 1,
					response_type_id: 308,
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
		expect(res?.body.status).toBe(0);
	});

	it("returns the error example when eps_scenario forces a status code", () => {
		const res = matchResponse(
			fixtures,
			"GET",
			"/customer/profile/9123456789/dmt-fino",
			{ eps_scenario: "463" },
		);
		expect(res?.body.status).toBe(463);
	});

	it("also selects a scenario by its response_type_id (what recipes branch on)", () => {
		const res = matchResponse(
			fixtures,
			"GET",
			"/customer/profile/9123456789/dmt-fino",
			{ eps_scenario: "308" },
		);
		expect(res?.body.response_type_id).toBe(308);
	});

	it("returns null for an unknown route", () => {
		expect(matchResponse(fixtures, "GET", "/nope", {})).toBeNull();
	});
});
