import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildSdkSurface } from "@/lib/sdk/build-sdk-surface";

const bundle = buildAgentBundle(getDocumentedSpecs());
const surface = buildSdkSurface(bundle);

describe("buildSdkSurface", () => {
	it("lists both environments with base URLs", () => {
		const ids = surface.environments.map((e) => e.id);
		expect(ids).toContain("sandbox");
		expect(ids).toContain("production");
	});

	it("emits one endpoint per api with method + path + typed params", () => {
		expect(surface.endpoints.length).toBe(bundle.apis.length);
		const e = surface.endpoints[0];
		expect(e).toHaveProperty("slug");
		expect(e).toHaveProperty("method");
		expect(e).toHaveProperty("path");
		expect(Array.isArray(e.params)).toBe(true);
		for (const p of e.params) {
			expect(typeof p.name).toBe("string");
			expect(typeof p.type).toBe("string");
			expect(typeof p.required).toBe("boolean");
		}
		// requiredParams stays in sync with params (back-compat).
		expect(e.requiredParams).toEqual(
			e.params.filter((p) => p.required).map((p) => p.name),
		);
	});

	it("includes the error-code table", () => {
		expect(surface.errorCodes.length).toBeGreaterThan(0);
	});

	it("bakes the format registry and only the constraints a param sets", () => {
		expect(surface.formats["client-ref"]).toMatch(/^\^.*\$$/);
		const sender = surface.endpoints.find((e) => e.slug === "dmt-get-sender")!;
		const ref = sender.params.find((p) => p.name === "client_ref_id")!;
		expect(ref).toEqual({
			name: "client_ref_id",
			type: "string",
			required: false,
			format: "client-ref",
			maxLength: 20,
		});
		// Every format a param names resolves in the baked map.
		for (const e of surface.endpoints)
			for (const p of e.params)
				if (p.format) expect(surface.formats).toHaveProperty(p.format);
	});

	it("flags money-moving endpoints as financial and omits the key otherwise", () => {
		const bySlug = (slug: string) =>
			surface.endpoints.find((e) => e.slug === slug)!;
		expect(bySlug("bbps-pay-bill").financial).toBe(true);
		expect(bySlug("dmt-get-sender")).not.toHaveProperty("financial");
		// AePS enquiries move no money and return no `tx_status`.
		expect(bySlug("aeps-fingpay-balance-enquiry")).not.toHaveProperty(
			"financial",
		);
		expect(bySlug("aeps-fingpay-mini-statement")).not.toHaveProperty(
			"financial",
		);
		expect(surface.endpoints.filter((e) => e.financial).length).toBe(
			bundle.apis.filter((a) => a.financial).length,
		);
	});

	it("marks retrySafe from semantics, not from method", () => {
		const safe = (slug: string) =>
			surface.endpoints.find((e) => e.slug === slug)?.retrySafe;
		expect(safe("transaction-inquiry")).toBe(true); // free GET
		expect(safe("get-ifsc-details")).toBe(false); // billable GET
		expect(safe("deactivate-user-service")).toBe(true); // idempotent free PUT
		expect(safe("pan-lite")).toBe(false); // billable POST lookup
		expect(safe("dmt-initiate-transfer")).toBe(false); // moves money
		// Not financial, but each call spends a single-use biometric PID block.
		expect(safe("aeps-fingpay-balance-enquiry")).toBe(false);
		expect(safe("aeps-fingpay-mini-statement")).toBe(false);
		for (const e of surface.endpoints)
			expect(e.retrySafe, e.slug).toBeTypeOf("boolean");
	});
});

describe("buildSdkSurface redact (debug-mode masking)", () => {
	const { safe, last4, text, nest } = surface.redact;
	const lists = { safe, last4, text, nest };

	it("keeps the four lists disjoint", () => {
		const seen = new Map<string, string>();
		for (const [list, names] of Object.entries(lists))
			for (const name of names) {
				expect(seen.get(name), `${name} in ${list}`).toBeUndefined();
				seen.set(name, list);
			}
	});

	it("never prints a personal-data field raw", () => {
		// Token-prefix stems: `recipient_id` is fine, `ip_address` is not.
		const STEMS = ["aadha", "pan", "mobile", "phone", "otp", "pid", "dob", "name", "address", "email", "vpa", "ip", "lat", "long", "token", "acc"];
		const ALLOWED = new Set(["account_type", "account_status_code", "otp_ref_id", "otp_expiry_timestamp", "txn_otp_request_id", "phone_operator_code"]);
		const offenders = safe.filter(
			(key) =>
				!ALLOWED.has(key) &&
				key.split(/[_.]/).some((token) => STEMS.some((stem) => token.startsWith(stem))),
		);
		expect(offenders).toEqual([]);
	});

	it("classifies the identifiers support needs a last-4 hint for", () => {
		for (const key of ["aadhar", "pan_number", "bank_account", "customer_id", "customer_mobile", "initiator_id"])
			expect(last4).toContain(key);
	});

	it("leaves OTPs, biometrics and names to the default full mask", () => {
		const classified = new Set([...safe, ...last4, ...text, ...nest]);
		for (const key of ["otp", "otp_verification_token", "piddata", "name", "dob", "email"])
			expect(classified.has(key), key).toBe(false);
	});

	it("adds every aadhaar / pan / mobile-format param to last4", () => {
		for (const e of surface.endpoints)
			for (const p of e.params)
				if (p.format && ["aadhaar", "pan", "mobile"].includes(p.format))
					expect(last4).toContain(p.name.toLowerCase().replace(/^.*[.\]]/, ""));
	});

	it("stores lowercase, sorted names", () => {
		for (const names of Object.values(lists)) {
			expect(names).toEqual([...names].sort());
			for (const name of names) expect(name).toBe(name.toLowerCase());
		}
	});
});
