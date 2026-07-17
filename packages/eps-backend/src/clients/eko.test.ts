import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { createEkoClient, identityOf, mapTransactionRows } from "./eko";
import { INTERACTION_154_SAMPLE } from "./transactions.sample";

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
	// Default to the live path so every existing test still asserts a real POST;
	// the fixture short-circuit is opted into per-test.
	transactionsMock: false,
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

	// The mobile IS the initiator_id on every later interaction, so a 369 without
	// one must never become a usable profile — it would send `initiator_id=` and
	// earn a 403 that reads like an auth failure. `error` (not not_found/inactive)
	// keeps it retryable and stops any session being minted, mirroring
	// connect-api's "unknown response → 500".
	it.each([
		["missing", undefined],
		["empty", ""],
		["blank", "   "],
	])(
		"maps a 369 with a %s mobile to error, not found",
		async (_label, mobile) => {
			const f = mockFetch(200, {
				response_type_id: 369,
				data: {
					user_detail: {
						...(mobile === undefined ? {} : { mobile }),
						org_id: 1,
						user_type: "23",
						role_list: [1],
					},
				},
			});
			const eko = createEkoClient(ekoCfg, f);
			expect((await eko.getProfile({ mobile: "9990000001" })).kind).toBe(
				"error",
			);
		},
	);

	// The guard sits ahead of BOTH profile branches: an onboarding user's steps
	// build their identity from this same profile, so a blank mobile breaks them
	// exactly as it breaks a fully-onboarded one.
	it("maps a 369 onboarding profile with no mobile to error", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: { user_detail: { onboarding: 1, org_id: 1, user_type: "23" } },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect((await eko.getProfile({ mobile: "9990000001" })).kind).toBe("error");
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

describe("mapProfile onboarding_steps", () => {
	// Trust boundary: onboarding_steps is untrusted upstream data. Array.isArray
	// guards the array itself but not its elements — a null element must
	// degrade to a neutral step instead of throwing on `s.role`.
	it('maps a null element to {role: -1, label: ""} instead of throwing', async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: {
				user_detail: {
					mobile: "9990000001",
					org_id: 1,
					user_type: "23",
					onboarding: 1,
					onboarding_steps: [null, { role: 13000, label: "PAN Details" }],
				},
			},
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("onboarding");
		if (r.kind === "onboarding") {
			expect(r.profile.onboardingSteps).toEqual([
				{ role: -1, label: "" },
				{ role: 13000, label: "PAN Details" },
			]);
		}
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
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};
	const businessDetails = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		email: "asha@acme.in",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};

	/** Extracts the form-encoded body of a captured mock fetch call. */
	function bodyOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		return new URLSearchParams(init.body as string);
	}

	/** Extracts the `form-data` part's URL-decoded fields from a multipart call. */
	function multipartFieldsOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		const formData = init.body as FormData;
		return new URLSearchParams(String(formData.get("form-data")));
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

	it("verifyPan sends 523 as multipart with one 'form-data' part and no file", async () => {
		const f = mockFetch(200, { response_type_id: 1569 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.verifyPan({ pan: "ABCDE1234F", identity });
		expect(r.ok).toBe(true);

		const init = (f as unknown as Mock).mock.calls[0][1];
		const body = init.body as FormData;
		expect(body).toBeInstanceOf(FormData);
		// Exactly one part, named "form-data" — no file part.
		expect(Array.from(body.keys())).toEqual(["form-data"]);
		expect(body.get("file")).toBeNull();
		// fetch must set the multipart Content-Type (with boundary) itself.
		expect(
			(init.headers as Record<string, string>)["Content-Type"],
		).toBeUndefined();

		const fields = multipartFieldsOf(f);
		expect(fields.get("interaction_type_id")).toBe("523");
		expect(fields.get("doc_id")).toBe("ABCDE1234F");
		expect(fields.get("doc_type")).toBe("2");
		expect(fields.get("intent_id")).toBe("3");
		expect(fields.get("source")).toBe("EPS");
		expect(fields.get("latlong")).toBe("27.176670,78.008075,7787");
		// Once the partial account exists, the user acts as their own initiator.
		expect(fields.get("initiator_id")).toBe("9990000001");
		expect(fields.get("user_code")).toBe("20810001");
		expect(fields.get("org_id")).toBe("1");
		// A client_ref_id is always generated, matching sendOtp/verifyOtp.
		expect(fields.get("client_ref_id")).toBeTruthy();
	});

	it("verifyPan generates a distinct client_ref_id per call", async () => {
		const f = mockFetch(200, { response_type_id: 1569 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.verifyPan({ pan: "ABCDE1234F", identity });
		await eko.verifyPan({ pan: "ABCDE1234F", identity });
		const first = multipartFieldsOf(f, 0).get("client_ref_id");
		const second = multipartFieldsOf(f, 1).get("client_ref_id");
		expect(first).toBeTruthy();
		expect(second).toBeTruthy();
		expect(first).not.toBe(second);
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

	it("getBooklet returns null when response_status_id is not 0, even with a valid type", async () => {
		const f = mockFetch(200, {
			response_status_id: 1,
			response_type_id: 1646,
			data: { booklet_serial_number: "SN123", is_pintwin_user: 1 },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getBooklet({ identity })).toBeNull();
	});

	it("fetchPintwinKey accepts key_id 0 as valid", async () => {
		const f = mockFetch(200, {
			data: { pintwin_key: "1974856302", key_id: 0 },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(
			await eko.fetchPintwinKey({ mobile: "9990000001", identity }),
		).toEqual({ pintwinKey: "1974856302", keyId: 0 });
	});

	it("createPartialAccount returns failure when response_type_id is missing", async () => {
		const f = mockFetch(200, {});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.createPartialAccount({ mobile: "9990000001" });
		expect(r).toEqual({
			ok: false,
			message: "The request could not be completed.",
			responseTypeId: -1,
		});
	});

	it("submitBusiness posts interaction 522 with the actor, latlong and a client_ref_id", async () => {
		const f = mockFetch(200, { response_type_id: 1567 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.submitBusiness({ details: businessDetails, identity });
		expect(r.ok).toBe(true);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("522");
		expect(body.get("initiator_id")).toBe("9990000001");
		expect(body.get("user_code")).toBe("20810001");
		expect(body.get("org_id")).toBe("1");
		expect(body.get("source")).toBe("EPS");
		expect(body.get("latlong")).toBe("27.176670,78.008075,7787");
		expect(body.get("client_ref_id")).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.get("name")).toBe("Acme Retail");
		expect(body.get("current_address_state")).toBe("Karnataka");
	});

	it("submitBusiness reports the upstream message on a non-1567 response", async () => {
		const f = mockFetch(200, {
			response_type_id: 1502,
			message: "Invalid pincode",
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.submitBusiness({ details: businessDetails, identity });
		expect(r).toEqual({
			ok: false,
			message: "Invalid pincode",
			responseTypeId: 1502,
		});
	});
});

describe("sign agreement interactions", () => {
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};
	function bodyOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		return new URLSearchParams(init.body as string);
	}

	it("getAgreementUrl posts 287 (mobile as csp_id/user_id) and maps a 1613 URL", async () => {
		const f = mockFetch(200, {
			response_type_id: 1613,
			data: { short_url: "https://sign/x", document_id: "DOC9", pipe: 3 },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getAgreementUrl({ mobile: "9990000001", identity });
		expect(r).toEqual({
			ok: true,
			shortUrl: "https://sign/x",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: false,
		});
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("287");
		expect(body.get("agreement_id")).toBe("5");
		expect(body.get("csp_id")).toBe("9990000001");
		expect(body.get("user_id")).toBe("9990000001");
		expect(body.get("initiator_id")).toBe("9990000001");
		expect(body.get("latlong")).toBe("27.176670,78.008075,7787");
	});

	it.each([1615, 1069])(
		"getAgreementUrl treats response_type_id %i as already-signed",
		async (code) => {
			const f = mockFetch(200, {
				response_type_id: code,
				data: { document_id: "DOC9", pipe: 0 },
			});
			const eko = createEkoClient(ekoCfg, f);
			const r = await eko.getAgreementUrl({ mobile: "9990000001", identity });
			expect(r).toEqual({
				ok: true,
				shortUrl: "",
				documentId: "DOC9",
				pipe: 0,
				alreadySigned: true,
			});
		},
	);

	it("getAgreementUrl fails on an unexpected type, ignoring a stray short_url", async () => {
		// Strict: a partial short_url on a non-1613 response must NOT read as success.
		const f = mockFetch(200, {
			response_type_id: 1500,
			message: "Nope",
			data: { short_url: "https://stale" },
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getAgreementUrl({ mobile: "9990000001", identity });
		expect(r).toEqual({ ok: false, message: "Nope", responseTypeId: 1500 });
	});

	it("submitSignAgreement posts 293 with the document id, agreement id and a client_ref_id", async () => {
		const f = mockFetch(200, { response_type_id: 1615 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.submitSignAgreement({ documentId: "DOC9", identity });
		expect(r.ok).toBe(true);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("293");
		expect(body.get("document_id")).toBe("DOC9");
		expect(body.get("agreement_id")).toBe("5");
		expect(body.get("esign_completed")).toBe("true");
		expect(body.get("initiator_id")).toBe("9990000001");
		expect(body.get("client_ref_id")).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("submitSignAgreement reports the upstream message on failure", async () => {
		const f = mockFetch(200, { response_type_id: 1500, message: "Not signed" });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.submitSignAgreement({ documentId: "DOC9", identity });
		expect(r).toEqual({
			ok: false,
			message: "Not signed",
			responseTypeId: 1500,
		});
	});
});

describe("identityOf", () => {
	// REGRESSION: initiator_id is the user's registered MOBILE, never an internal
	// id. connect-api (the live Eloka backend) puts `user_id: detail.mobile` in
	// the 151 login claim and then sends `initiator_id = tokenDetails.user_id` on
	// every interaction. Sending `eko_user_id` instead makes upstream answer 403
	// "Invalid Sender/Initiator", which broke wallet balance AND every onboarding
	// step. Pin the field so it cannot silently regress to ekoUserId again.
	it("uses the mobile as initiator_id, not ekoUserId", () => {
		const profile = {
			name: "Dev",
			email: "d@e.in",
			mobile: "9990000001",
			code: "20810001",
			userType: "23",
			ekoUserId: "55501",
			roleList: [],
			orgId: 1,
			onboarding: 0,
			zohoId: "",
			onboardingSteps: [],
		};
		expect(identityOf(profile)).toEqual({
			initiatorId: "9990000001",
			userCode: "20810001",
			orgId: 1,
		});
	});
});

describe("getWalletBalance", () => {
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};

	function bodyOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		return new URLSearchParams(init.body as string);
	}

	it("posts 9 as the acting user and returns the balance as a number", async () => {
		const f = mockFetch(200, {
			response_status_id: 0,
			data: { balance: "2800000" },
		});
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getWalletBalance({ identity })).toBe(2800000);
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("9");
		// The acting user's own identity — NOT the configured service account.
		expect(body.get("initiator_id")).toBe("9990000001");
		expect(body.get("user_code")).toBe("20810001");
		expect(body.get("org_id")).toBe("1");
		expect(body.get("client_ref_id")).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("returns 0, not null, for a genuinely empty wallet", async () => {
		const f = mockFetch(200, { response_status_id: 0, data: { balance: "0" } });
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getWalletBalance({ identity })).toBe(0);
	});

	it("returns null when upstream omits the balance", async () => {
		const f = mockFetch(200, { response_status_id: 1, message: "nope" });
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getWalletBalance({ identity })).toBeNull();
	});

	it("returns null on an unparseable balance rather than NaN", async () => {
		const f = mockFetch(200, { data: { balance: "" } });
		const eko = createEkoClient(ekoCfg, f);
		expect(await eko.getWalletBalance({ identity })).toBeNull();
	});

	it("forwards X-Real-IP", async () => {
		const f = mockFetch(200, { data: { balance: "10" } });
		const eko = createEkoClient(ekoCfg, f);
		await eko.getWalletBalance({ identity, xRealIp: "203.0.113.9" });
		const [, init] = (f as unknown as Mock).mock.calls[0];
		expect(init.headers["X-Real-IP"]).toBe("203.0.113.9");
	});
});

describe("getTransactionHistory", () => {
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};

	function bodyOf(f: typeof fetch, call = 0): URLSearchParams {
		const init = (f as unknown as Mock).mock.calls[call][1];
		return new URLSearchParams(init.body as string);
	}

	const liveCfg = { ...ekoCfg, transactionsMock: false };

	it("posts 154 as the acting user with the paging window", async () => {
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient(liveCfg, f);
		await eko.getTransactionHistory({
			identity,
			accountId: "392961",
			startIndex: 25,
			limit: 25,
			filters: {},
		});
		const body = bodyOf(f);
		expect(body.get("interaction_type_id")).toBe("154");
		// The acting user's own identity — NOT the configured service account.
		expect(body.get("initiator_id")).toBe("9990000001");
		expect(body.get("user_code")).toBe("20810001");
		expect(body.get("start_index")).toBe("25");
		expect(body.get("limit")).toBe("25");
		expect(body.get("account_id")).toBe("392961");
		expect(body.get("isNetworkTransactionHistory")).toBe("0");
	});

	it("omits account_id when it is unknown", async () => {
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient(liveCfg, f);
		await eko.getTransactionHistory({
			identity,
			accountId: null,
			startIndex: 0,
			limit: 25,
			filters: {},
		});
		expect(bodyOf(f).has("account_id")).toBe(false);
	});

	it("forwards filters but never lets one override a system field", async () => {
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient(liveCfg, f);
		await eko.getTransactionHistory({
			identity,
			accountId: null,
			startIndex: 0,
			limit: 25,
			// A hostile filter object: the route's allow-list would already reject
			// these, so this pins the client's own defence in depth.
			filters: {
				tid: "2886973933",
				interaction_type_id: "515",
				user_code: "99999999",
				start_index: "999",
			},
		});
		const body = bodyOf(f);
		expect(body.get("tid")).toBe("2886973933");
		expect(body.get("interaction_type_id")).toBe("154");
		expect(body.get("user_code")).toBe("20810001");
		expect(body.get("start_index")).toBe("0");
	});

	it("serves fixture rows without calling upstream when mock is on", async () => {
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient({ ...ekoCfg, transactionsMock: true }, f);
		const { rows } = await eko.getTransactionHistory({
			identity,
			accountId: null,
			startIndex: 0,
			limit: 3,
			filters: {},
		});
		expect(rows).toHaveLength(3);
		expect(f).not.toHaveBeenCalled();
	});

	it("honours a filter in mock mode rather than returning every fixture row", async () => {
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient({ ...ekoCfg, transactionsMock: true }, f);
		const { rows } = await eko.getTransactionHistory({
			identity,
			accountId: null,
			startIndex: 0,
			limit: 25,
			filters: { tid: "2886973933" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].tid).toBe("2886973933");
	});

	it("returns nothing in mock mode when a filter matches no fixture row", async () => {
		// Otherwise the fixture lies: a search for a TID that isn't there would
		// still show rows, reading as a real match.
		const f = mockFetch(200, { data: { transaction_list: [] } });
		const eko = createEkoClient({ ...ekoCfg, transactionsMock: true }, f);
		const { rows } = await eko.getTransactionHistory({
			identity,
			accountId: null,
			startIndex: 0,
			limit: 25,
			filters: { tid: "0000000001" },
		});
		expect(rows).toEqual([]);
	});
});

describe("mapTransactionRows", () => {
	it("coerces numeric strings to numbers", () => {
		const rows = mapTransactionRows({
			data: {
				transaction_list: [
					{
						tid: "2886973933",
						tx_name: "Digi Khata Load Wallet",
						amount_dr: "200000",
						fee: "25",
						r_bal: "2800000",
						response_status_id: "1",
						status: "Failed",
						datetime: "2026-04-16 11:49:00",
					},
				],
			},
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].amount_dr).toBe(200000);
		expect(rows[0].fee).toBe(25);
		expect(rows[0].r_bal).toBe(2800000);
		expect(rows[0].response_status_id).toBe(1);
	});

	it("defaults missing money fields to 0 rather than NaN", () => {
		const rows = mapTransactionRows({
			data: { transaction_list: [{ tid: "1" }] },
		});
		expect(rows[0].amount_dr).toBe(0);
		expect(rows[0].amount_cr).toBe(0);
		expect(rows[0].insurance_amount).toBe(0);
		expect(Number.isNaN(rows[0].r_bal)).toBe(false);
	});

	it("drops blank optional text fields so the UI can skip them", () => {
		const rows = mapTransactionRows({
			data: {
				transaction_list: [{ tid: "1", customer_name: "  ", bank: "HDFC" }],
			},
		});
		expect(rows[0].customer_name).toBeUndefined();
		expect(rows[0].bank).toBe("HDFC");
	});

	it("returns an empty list when the payload carries no transaction_list", () => {
		expect(mapTransactionRows({ data: {} })).toEqual([]);
		expect(mapTransactionRows({})).toEqual([]);
		expect(mapTransactionRows(null)).toEqual([]);
	});
});

describe("mapTransactionRows against the real interaction-154 response", () => {
	const rows = mapTransactionRows(INTERACTION_154_SAMPLE);

	it("reads the envelope upstream actually sends", () => {
		// data.transaction_list — NOT Eloka's data.data.transaction_list.
		expect(rows).toHaveLength(7);
	});

	it("coerces tx_typeid, which arrives as a string", () => {
		expect(rows[0].tx_typeid).toBe(1049);
		expect(rows[1].tx_typeid).toBe(697);
	});

	it("defaults absent money legs to 0 rather than NaN", () => {
		// The QR Collection row has amount_cr but no amount_dr at all.
		expect(rows[1].amount_cr).toBe(10);
		expect(rows[1].amount_dr).toBe(0);
		expect(rows[0].amount_cr).toBe(0);
		for (const row of rows) {
			expect(Number.isNaN(row.amount_dr)).toBe(false);
			expect(Number.isNaN(row.amount_cr)).toBe(false);
			expect(Number.isNaN(row.r_bal)).toBe(false);
		}
	});

	it("keeps the ISO datetime with its offset", () => {
		expect(rows[0].datetime).toBe("2026-04-16T11:49:09.000+05:30");
		expect(Number.isNaN(new Date(rows[0].datetime).getTime())).toBe(false);
	});

	it("carries the masked counterparty fields through untouched", () => {
		expect(rows[2].customer_mobile).toBe("XXXXXX1732");
		expect(rows[2].account).toBe("XXXXXXXX3882");
		expect(rows[2].bank).toBe("State Bank of India");
		expect(rows[2].recipient_name).toBe("Vikram Rao");
	});

	it("preserves each row's own status wording", () => {
		expect(rows.map((r) => r.status)).toEqual([
			"Failed",
			"Payment received",
			"Success",
			"Success",
			"Success",
			"Success",
			"Initiated",
		]);
	});

	it("reads the fractional charges", () => {
		expect(rows[1].fee).toBe(5.91);
		expect(rows[5].gst).toBe(0.76);
	});
});
