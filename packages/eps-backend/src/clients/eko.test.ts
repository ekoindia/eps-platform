import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { createEkoClient } from "./eko";

const ekoCfg = {
	scheme: "https",
	host: "sb.local",
	port: 8080,
	path: "/v1",
	developerKey: "devkey",
	initiatorId: "1234567891",
	userCode: "99029899",
	defaultOrgId: 1,
	logLevel: "off" as const,
};

function mockFetch(status: number, body: unknown) {
	return vi.fn(
		async () => new Response(JSON.stringify(body), { status }),
	) as unknown as typeof fetch;
}

describe("EkoClient.sendOtp", () => {
	it("posts interaction_type_id 515 with developer_key + form body", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.sendOtp({ mobile: "9990000001" });
		expect(res.ok).toBe(true);

		const [url, init] = (f as unknown as Mock).mock.calls[0];
		expect(url).toBe("https://sb.local:8080/v1");
		expect(init.method).toBe("POST");
		expect(init.headers["developer_key"]).toBe("devkey");
		expect(init.headers["Content-Type"]).toBe(
			"application/x-www-form-urlencoded",
		);
		const body = new URLSearchParams(init.body as string);
		expect(body.get("interaction_type_id")).toBe("515");
		expect(body.get("mobile")).toBe("9990000001");
		expect(body.get("initiator_id")).toBe("1234567891");
		expect(body.get("user_code")).toBe("99029899");
		expect(body.get("org_id")).toBe("1");
		// No X-Real-IP header when the caller did not supply one (omit, not empty).
		expect("X-Real-IP" in init.headers).toBe(false);
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.sendOtp({ mobile: "9990000001", xRealIp: "1.2.3.4" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("1.2.3.4");
	});
});

describe("EkoClient.verifyOtp", () => {
	it("returns ok on response_status_id 0 with id 518", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.verifyOtp({ mobile: "9990000001", otp: "123456" });
		expect(res.ok).toBe(true);
		const body = new URLSearchParams(
			(f as unknown as Mock).mock.calls[0][1].body,
		);
		expect(body.get("interaction_type_id")).toBe("518");
		expect(body.get("otp")).toBe("123456");
		expect(body.get("verification_type")).toBe("2");
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.verifyOtp({ mobile: "x", otp: "y", xRealIp: "9.9.9.9" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("9.9.9.9");
	});

	it("returns not-ok on non-zero status id", async () => {
		const f = mockFetch(200, { response_status_id: 1 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.verifyOtp({ mobile: "x", otp: "y" });
		expect(res.ok).toBe(false);
	});
});

describe("EkoClient upstream errors", () => {
	it("throws on non-2xx HTTP status", async () => {
		const f = mockFetch(500, { whatever: true });
		const eko = createEkoClient(ekoCfg, f);
		await expect(eko.sendOtp({ mobile: "x" })).rejects.toThrow();
	});
});

describe("EkoClient.getProfile", () => {
	it("maps 369 success to found with mapped fields", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: {
				user_detail: {
					name: "Dev",
					email: "d@e.in",
					mobile: "9990000001",
					code: 42,
					user_type: "23",
					eko_user_id: "EKO123",
					role_list: [1, 2],
					org_id: 1,
					onboarding: 0,
					crm_contact_id: "ZCRM_9",
				},
			},
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("found");
		if (r.kind === "found") {
			expect(r.profile.zohoId).toBe("ZCRM_9");
			expect(r.profile.ekoUserId).toBe("EKO123");
			expect(r.profile.onboarding).toBe(0);
			expect(r.profile.roleList).toEqual(["1", "2"]);
		}
	});

	it("maps not-found codes (319/1200/1867)", async () => {
		for (const code of [319, 1200, 1867]) {
			const f = mockFetch(200, { response_type_id: code });
			const eko = createEkoClient(ekoCfg, f);
			const r = await eko.getProfile({ mobile: "x" });
			expect(r.kind).toBe("not_found");
		}
	});

	it("maps 2123 to inactive", async () => {
		const f = mockFetch(200, { response_type_id: 2123 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("inactive");
	});

	it("treats 319 as not_found even with response_status_id 1 (its message is misleadingly 'Invalid Sender/Initiator')", async () => {
		const f = mockFetch(200, {
			response_status_id: 1,
			response_type_id: 319,
			message: "Invalid Sender/Initiator",
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("not_found");
	});

	it("maps 369 to found even though a found profile carries response_status_id -1", async () => {
		const f = mockFetch(200, {
			response_status_id: -1,
			response_type_id: 369,
			data: {
				user_detail: {
					mobile: "9990000001",
					role_list: [1],
					org_id: 1,
					user_type: "23",
				},
			},
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("found");
	});

	it("maps a 369 profile that is not an EPS business partner to not_allowed", async () => {
		// org_id != 1, user_type != 23, and a missing pair each fail the gate.
		const nonPartners = [
			{ org_id: 2, user_type: "23" },
			{ org_id: 1, user_type: "1" },
			{},
		];
		for (const detail of nonPartners) {
			const f = mockFetch(200, {
				response_type_id: 369,
				data: { user_detail: { mobile: "9990000001", ...detail } },
			});
			const eko = createEkoClient(ekoCfg, f);
			const r = await eko.getProfile({ mobile: "9990000001" });
			expect(r.kind).toBe("not_allowed");
		}
	});

	it("maps an unrecognized response_type_id to error", async () => {
		const f = mockFetch(200, { response_status_id: 0, response_type_id: 9999 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("error");
	});

	it("falls back to response_code when response_type_id is absent", async () => {
		const f = mockFetch(200, { response_code: 2123 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("inactive");
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_type_id: 319 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.getProfile({ mobile: "x", xRealIp: "5.6.7.8" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("5.6.7.8");
	});
});

describe("getProfile onboarding classification", () => {
	const baseDetail = {
		name: "Test User",
		mobile: "9990000001",
		code: "20810001",
		eko_user_id: "55501",
		org_id: 1,
		role_list: [13000, 12600],
	};

	it("returns kind onboarding when onboarding is 1, even with user_type 23", async () => {
		// user_type becomes 23 right after partial-account creation, so the
		// onboarding flag must win over the user_type gate.
		const f = mockFetch(200, {
			response_type_id: 369,
			data: { user_detail: { ...baseDetail, user_type: "23", onboarding: 1 } },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("onboarding");
		if (r.kind === "onboarding") {
			expect(r.profile.onboarding).toBe(1);
			expect(r.profile.ekoUserId).toBe("55501");
			expect(r.profile.code).toBe("20810001");
		}
	});

	it("returns kind onboarding when onboarding is 1 and user_type is not yet 23", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: { user_detail: { ...baseDetail, user_type: "0", onboarding: 1 } },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("onboarding");
	});

	it("still returns found for a completed EPS business profile", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: { user_detail: { ...baseDetail, user_type: "23", onboarding: 0 } },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("found");
	});

	it("still returns not_allowed for a completed non-EPS profile", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: { user_detail: { ...baseDetail, user_type: "2", onboarding: 0 } },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("not_allowed");
	});
});

describe("onboarding interactions", () => {
	const identity = { initiatorId: "55501", userCode: "20810001", orgId: 1 };

	/** Extracts the form-encoded body of a captured mock fetch call. */
	function bodyOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		return new URLSearchParams(init.body as string);
	}

	it("createPartialAccount sends 521 with the default initiator and EPS vertical", async () => {
		const f = mockFetch(200, { response_type_id: 1566 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.createPartialAccount({ mobile: "9990000001" });
		expect(r.ok).toBe(true);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("521");
		expect(body.get("applicant_type")).toBe("1");
		expect(body.get("business_vertical")).toBe("EPS");
		expect(body.get("user_identity")).toBe("9990000001");
		expect(body.get("user_identity_type")).toBe("mobile_number");
		// New users have no account yet: the DEFAULT initiator/user_code pair acts.
		expect(body.get("initiator_id")).toBe(ekoCfg.initiatorId);
		expect(body.get("user_code")).toBe(ekoCfg.userCode);
		// user_id must never be sent upstream.
		expect(body.get("user_id")).toBeNull();
	});

	it("createPartialAccount reports the upstream message on failure", async () => {
		const f = mockFetch(200, {
			response_type_id: 1500,
			message: "Account already exists",
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.createPartialAccount({ mobile: "9990000001" });
		expect(r).toEqual({
			ok: false,
			message: "Account already exists",
			responseTypeId: 1500,
		});
	});

	it("verifyPan sends 523 with the user's own identity and no file", async () => {
		const f = mockFetch(200, { response_type_id: 1569 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.verifyPan({ pan: "ABCDE1234F", identity });
		expect(r.ok).toBe(true);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("523");
		expect(body.get("doc_id")).toBe("ABCDE1234F");
		expect(body.get("doc_type")).toBe("2");
		expect(body.get("intent_id")).toBe("3");
		expect(body.get("source")).toBe("EPS");
		// Once the partial account exists, the user acts as their own initiator.
		expect(body.get("initiator_id")).toBe("55501");
		expect(body.get("user_code")).toBe("20810001");
	});

	it("getBooklet accepts only response_status_id 0 with type 1646", async () => {
		const f = mockFetch(200, {
			response_status_id: 0,
			response_type_id: 1646,
			data: { booklet_serial_number: "SN123", is_pintwin_user: 1 },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getBooklet({ identity })).toEqual({
			bookletSerialNumber: "SN123",
			isPintwinUser: 1,
		});
	});

	it("getBooklet returns null on an unexpected response type", async () => {
		const f = mockFetch(200, {
			response_status_id: 0,
			response_type_id: 999,
			data: { booklet_serial_number: "SN123", is_pintwin_user: 1 },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getBooklet({ identity })).toBeNull();
	});

	it("fetchPintwinKey returns the key and id", async () => {
		const f = mockFetch(200, {
			data: { pintwin_key: "1974856302", key_id: 39 },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(
			await eko.fetchPintwinKey({ mobile: "9990000001", identity }),
		).toEqual({ pintwinKey: "1974856302", keyId: 39 });
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("10005");
		expect(body.get("alternate_user_id")).toBe("9990000001");
	});

	it("fetchPintwinKey returns null when the key is missing", async () => {
		const f = mockFetch(200, { data: {} });
		const eko = createEkoClient(ekoCfg, f);
		expect(
			await eko.fetchPintwinKey({ mobile: "9990000001", identity }),
		).toBeNull();
	});

	it("setSecretPin sends 5 with both okekeys and the booklet fields verbatim", async () => {
		const f = mockFetch(200, { response_type_id: 9 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.setSecretPin({
			firstOkekey: "9748|39",
			secondOkekey: "9748|41",
			booklet: { bookletSerialNumber: "SN123", isPintwinUser: 1 },
			identity,
		});
		expect(r.ok).toBe(true);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("5");
		expect(body.get("first_okekey")).toBe("9748|39");
		expect(body.get("second_okekey")).toBe("9748|41");
		expect(body.get("is_pintwin_user")).toBe("1");
		expect(body.get("booklet_serial_number")).toBe("SN123");
	});
});
