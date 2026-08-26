import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { Config } from "../config";
import { createInMemoryKV, type KV } from "../store/kv";
import { buildEmailSubject, mountActivationFee } from "./activationFee";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";
import { trace, traceForResponse } from "./trace";
import type { EkoProfile, ProfileResult } from "../types";

const ACTIVATION_CFG: Config["activationFee"] = {
	webhookUrl: "https://automaton8n.example/webhook/abc",
	recipients: ["eps@eko.in", "finance@eko.co.in"],
	timeoutMs: 20_000,
};

function profile(overrides: Partial<EkoProfile> = {}): EkoProfile {
	return {
		name: "Acme Fintech Pvt Ltd",
		email: "ops@acme.test",
		mobile: "9990000001",
		code: 20810,
		userType: "23",
		ekoUserId: "1",
		roleList: [],
		orgId: 1,
		onboarding: 0,
		zohoId: "z1",
		onboardingSteps: [],
		accounts: [],
		evalueAccountId: "acc-1",
		detailBlocks: { business_detail: { gst_number: "07AAACA1234A1Z5" } },
		accountStateId: 1,
		userDetail: {
			pancardnumber: "AAACA1234A",
			crm_lead_id: "lead-1",
			crm_contact_id: "contact-1",
		},
		...overrides,
	} as unknown as EkoProfile;
}

function harness(
	opts: {
		role?: string | null;
		/** `null` means "this deployment has no webhook"; omit for the default. */
		cfg?: Config["activationFee"] | null;
		crmRecordBaseUrl?: string;
		profileResult?: ProfileResult;
		kv?: KV;
		fetchImpl?: typeof fetch;
	} = {},
) {
	const role = opts.role === undefined ? "developer" : opts.role;
	const app = new Hono<AppEnv>();
	app.use("*", trace());
	// Mirrors app.ts's onError so status/code assertions match production, and
	// echoes the trace so a test sees exactly what reaches the browser.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(
				{
					...errorBody(err.code, err.message, undefined, err.source),
					trace: traceForResponse(),
				},
				err.status as never,
			);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});

	const sessions = {
		verifyAccess: vi
			.fn()
			.mockResolvedValue(role ? { sub: "9990000001", role, orgId: 1 } : null),
	} as unknown as Sessions;

	const getProfile = vi.fn().mockResolvedValue(
		opts.profileResult ?? {
			kind: "found",
			responseTypeId: 1,
			profile: profile(),
		},
	);
	const eko = { getProfile } as unknown as EkoClient;

	const sent: { url: string; body: FormData }[] = [];
	const fetchImpl =
		opts.fetchImpl ??
		(vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			sent.push({ url: String(url), body: init?.body as FormData });
			return new Response("ok", { status: 200 });
		}) as unknown as typeof fetch);

	mountActivationFee(app, {
		sessions,
		eko,
		kv: opts.kv ?? createInMemoryKV(),
		cfg: opts.cfg === null ? undefined : (opts.cfg ?? ACTIVATION_CFG),
		crmRecordBaseUrl:
			opts.crmRecordBaseUrl === undefined
				? "https://crm.zoho.in/crm/org60006414357"
				: opts.crmRecordBaseUrl,
		fetchImpl,
	});
	return { app, sent, getProfile };
}

const VALID = {
	amount: "6000",
	date: "2026-08-20",
	mode: "NEFT",
	utr: "N123456789",
	depositorName: "Acme Fintech Pvt Ltd",
	products: ["PAN Verification (Lite)"],
	otherProducts: "",
	gst: "",
};

/** POSTs the route with the session cookie and a JSON payload part attached. */
function intimate(
	app: Hono<AppEnv>,
	payload: Record<string, unknown> = VALID,
	extra?: (form: FormData) => void,
) {
	const form = new FormData();
	form.append("payload", JSON.stringify(payload));
	extra?.(form);
	return app.request("/activation-fee/intimate", {
		method: "POST",
		headers: { Cookie: "eps_at=token" },
		body: form,
	});
}

/** The error code an unhappy response carried. */
async function codeOf(res: Response): Promise<string> {
	return ((await res.json()) as { error: { code: string } }).error.code;
}

/** The `body` part of the mail the webhook received. */
async function bodyOf(sent: { body: FormData }[]): Promise<string> {
	return String(sent[0].body.get("body"));
}

describe("POST /activation-fee/intimate — access", () => {
	it("401s without a session", async () => {
		const { app } = harness({ role: null });
		expect((await intimate(app)).status).toBe(401);
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ role: "signup" });
		const res = await intimate(app);
		expect(res.status).toBe(403);
		expect(await codeOf(res)).toBe("NOT_DEVELOPER_SESSION");
	});

	it("503s with a named code when no webhook is configured", async () => {
		const { app, sent } = harness({ cfg: null });
		const res = await intimate(app);
		expect(res.status).toBe(503);
		expect(await codeOf(res)).toBe("ACTIVATION_FEE_DISABLED");
		expect(sent).toHaveLength(0);
	});
});

describe("POST /activation-fee/intimate — validation", () => {
	it.each([
		["a missing amount", { ...VALID, amount: "" }],
		["a zero amount", { ...VALID, amount: "0" }],
		["a negative amount", { ...VALID, amount: "-100" }],
		["a non-numeric amount", { ...VALID, amount: "1,200" }],
		["an implausibly large amount", { ...VALID, amount: "999999999" }],
		["more than two decimal places", { ...VALID, amount: "100.005" }],
		["a non-ISO date", { ...VALID, date: "20-08-2026" }],
		["an impossible calendar date", { ...VALID, date: "2026-02-31" }],
		["a future date", { ...VALID, date: "2099-01-01" }],
		["an unknown payment mode", { ...VALID, mode: "CHEQUE" }],
		["a blank UTR", { ...VALID, utr: "   " }],
		["a blank depositor name", { ...VALID, depositorName: "   " }],
		["a missing depositor name", { ...VALID, depositorName: undefined }],
		["no products at all", { ...VALID, products: [], otherProducts: "" }],
	])("400s on %s", async (_label, payload) => {
		const { app, sent } = harness();
		const res = await intimate(app, payload);
		expect(res.status).toBe(400);
		expect(await codeOf(res)).toBe("INVALID_INPUT");
		expect(sent).toHaveLength(0);
	});

	it("accepts a free-text product when nothing is ticked", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, {
			...VALID,
			products: [],
			otherProducts: "Something bespoke",
		});
		expect(res.status).toBe(200);
		expect(await bodyOf(sent)).toContain("Something bespoke");
	});

	it("400s on a duplicated payload part", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, VALID, (form) => {
			form.append("payload", JSON.stringify({ ...VALID, amount: "1" }));
		});
		expect(res.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	it("caps an oversized product array and each label", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, {
			...VALID,
			products: Array.from({ length: 200 }, () => "X".repeat(500)),
		});
		expect(res.status).toBe(200);
		const body = await bodyOf(sent);
		expect(body).not.toContain("X".repeat(121));
	});
});

describe("POST /activation-fee/intimate — attachment", () => {
	const slip = (name: string, type: string, bytes = 10) =>
		new File([new Uint8Array(bytes)], name, { type });

	it("forwards an allowed slip", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, VALID, (form) => {
			form.append(
				"attachment",
				slip("slip.pdf", "application/pdf"),
				"slip.pdf",
			);
		});
		expect(res.status).toBe(200);
		expect(sent[0].body.get("attachment")).toBeInstanceOf(File);
	});

	it("400s when the MIME type and the extension disagree", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, VALID, (form) => {
			form.append("attachment", slip("evil.png", "image/svg+xml"), "evil.png");
		});
		expect(res.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	it("400s on an oversized slip", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, VALID, (form) => {
			form.append(
				"attachment",
				slip("big.pdf", "application/pdf", 6 * 1024 * 1024),
				"big.pdf",
			);
		});
		expect(res.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	it("400s on more than one attachment", async () => {
		const { app, sent } = harness();
		const res = await intimate(app, VALID, (form) => {
			form.append("attachment", slip("a.pdf", "application/pdf"), "a.pdf");
			form.append("attachment", slip("b.pdf", "application/pdf"), "b.pdf");
		});
		expect(res.status).toBe(400);
		expect(sent).toHaveLength(0);
	});
});

describe("POST /activation-fee/intimate — profile", () => {
	it("502s (retryable) when the profile lookup itself fails", async () => {
		const { app, sent } = harness({
			profileResult: { kind: "error", responseTypeId: 9 } as ProfileResult,
		});
		const res = await intimate(app);
		expect(res.status).toBe(502);
		expect(await codeOf(res)).toBe("PROFILE_UNAVAILABLE");
		expect(sent).toHaveLength(0);
	});

	it.each(["onboarding", "inactive", "not_found", "not_allowed"] as const)(
		"403s a %s profile",
		async (kind) => {
			const { app } = harness({
				profileResult: { kind, responseTypeId: 9 } as ProfileResult,
			});
			const res = await intimate(app);
			expect(res.status).toBe(403);
			expect(await codeOf(res)).toBe("NO_PROFILE");
		},
	);
});

describe("POST /activation-fee/intimate — the mail", () => {
	it("addresses the configured recipients with the agreed subject", async () => {
		const { app, sent } = harness();
		await intimate(app);
		expect(sent[0].url).toBe(ACTIVATION_CFG?.webhookUrl);
		expect(sent[0].body.get("to")).toBe("eps@eko.in, finance@eko.co.in");
		expect(sent[0].body.get("subject")).toBe(
			"EPS One-Time Activation Fee Received | #20810 | Acme Fintech Pvt Ltd",
		);
	});

	it("takes identity from the profile, never from the request", async () => {
		const { app, sent } = harness();
		await intimate(app, {
			...VALID,
			// All spoofed. None of these may appear in the mail.
			name: "Attacker Ltd",
			code: "99999",
			pan: "ZZZZZ9999Z",
			gst: "99ZZZZZ9999Z1Z9",
			email: "attacker@evil.test",
		});
		const body = await bodyOf(sent);
		expect(body).toContain("Acme Fintech Pvt Ltd");
		expect(body).toContain("20810");
		expect(body).toContain("AAACA1234A");
		expect(body).toContain("07AAACA1234A1Z5");
		expect(body).toContain("ops@acme.test");
		expect(body).not.toContain("Attacker Ltd");
		expect(body).not.toContain("ZZZZZ9999Z");
		expect(body).not.toContain("attacker@evil.test");
	});

	it("escapes partner-supplied text so it cannot inject markup", async () => {
		const { app, sent } = harness();
		await intimate(app, {
			...VALID,
			otherProducts: "<img src=x onerror=alert(1)>",
		});
		const body = await bodyOf(sent);
		expect(body).not.toContain("<img");
		expect(body).toContain("&lt;img");
	});

	it("prints an em dash for a profile with no PAN or GST", async () => {
		const { app, sent } = harness({
			profileResult: {
				kind: "found",
				responseTypeId: 1,
				profile: profile({ detailBlocks: {}, userDetail: {} }),
			} as ProfileResult,
		});
		await intimate(app);
		expect(await bodyOf(sent)).toContain("—");
	});

	it("carries the transfer facts the partner stated", async () => {
		const { app, sent } = harness();
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).toContain("2026-08-20");
		expect(body).toContain("NEFT");
		expect(body).toContain("N123456789");
		expect(body).toContain("PAN Verification (Lite)");
		expect(body).toContain("EPS Partner");
	});
});

describe("POST /activation-fee/intimate — webhook failures", () => {
	it("502s when the webhook rejects", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("nope", { status: 500 }),
		) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const res = await intimate(app);
		expect(res.status).toBe(502);
		expect(await codeOf(res)).toBe("ACTIVATION_FEE_SEND_FAILED");
	});

	it("502s rather than throwing when the webhook is unreachable", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const res = await intimate(app);
		expect(res.status).toBe(502);
		expect(await codeOf(res)).toBe("ACTIVATION_FEE_SEND_FAILED");
	});
});

describe("POST /activation-fee/intimate — rate limit", () => {
	it("429s once the per-partner window is spent", async () => {
		const kv = createInMemoryKV();
		const { app } = harness({ kv });
		for (let i = 0; i < 10; i++) {
			expect((await intimate(app)).status).toBe(200);
		}
		const res = await intimate(app);
		expect(res.status).toBe(429);
		expect(await codeOf(res)).toBe("RATE_LIMITED");
	});
});

describe("POST /activation-fee/intimate — diagnosing a failed send", () => {
	/** The whole error envelope, trace included. */
	async function envelopeOf(res: Response) {
		return (await res.json()) as {
			error: { message: string };
			trace: { path: string | null; status: number | null; error: string | null }[];
		};
	}

	it("names the status the mail service answered with", async () => {
		// n8n answers 404 for a /webhook-test/ URL whose editor is not listening —
		// the single most likely reason this route fails in a dev environment.
		const fetchImpl = vi.fn(
			async () => new Response("webhook not registered", { status: 404 }),
		) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const body = await envelopeOf(await intimate(app));
		expect(body.error.message).toContain("404");
	});

	it("says it never reached the service when the transport fails", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const body = await envelopeOf(await intimate(app));
		expect(body.error.message).toMatch(/couldn't reach the mail service/i);
	});

	it("puts the failed call in the trace so ops can see it", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("nope", { status: 500 }),
		) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const body = await envelopeOf(await intimate(app));
		const call = body.trace.find((c) => c.path === "activation-fee webhook");
		expect(call?.status).toBe(500);
	});

	it("never leaks the webhook URL into the trace the browser receives", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("The requested webhook is not registered", { status: 404 }),
		) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl });
		const res = await intimate(app);
		// The whole envelope, not just the trace: the URL must not appear anywhere
		// a partner can read, and neither must the webhook's own words about it.
		const raw = await res.text();
		expect(raw).not.toContain("automaton8n");
		expect(raw).not.toContain("/webhook/abc");
		expect(raw).not.toContain("not registered");
	});

	it("records the reached-and-refused case distinctly from never-reached", async () => {
		const refused = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;
		const { app } = harness({ fetchImpl: refused });
		const body = await envelopeOf(await intimate(app));
		const call = body.trace.find((c) => c.path === "activation-fee webhook");
		expect(call?.status).toBeNull();
		expect(call?.error).toBeTruthy();
	});
});

describe("POST /activation-fee/intimate — payment mode", () => {
	it.each([
		["IMPS", "IMPS"],
		["NEFT", "NEFT"],
		["RTGS", "RTGS"],
		["Intra-Bank Transfer", "Intra-Bank Transfer"],
	])("accepts %s", async (sent_, label) => {
		const { app, sent } = harness();
		const res = await intimate(app, { ...VALID, mode: sent_ });
		expect(res.status).toBe(200);
		expect(await bodyOf(sent)).toContain(label);
	});

	it("normalises casing without mangling the label finance reads", async () => {
		const { app, sent } = harness();
		await intimate(app, { ...VALID, mode: "intra-bank transfer" });
		const body = await bodyOf(sent);
		expect(body).toContain("Intra-Bank Transfer");
		expect(body).not.toContain("INTRA-BANK TRANSFER");
	});

	it("still refuses a rail that is not on the list", async () => {
		const { app } = harness();
		const res = await intimate(app, { ...VALID, mode: "CHEQUE" });
		expect(res.status).toBe(400);
	});
});

describe("POST /activation-fee/intimate — depositor and GST", () => {
	it("carries the depositor name into the mail", async () => {
		const { app, sent } = harness();
		await intimate(app, { ...VALID, depositorName: "Ramesh Kumar" });
		const body = await bodyOf(sent);
		expect(body).toContain("Name of Depositor (as per bank account)");
		expect(body).toContain("Ramesh Kumar");
	});

	it("accepts a depositor who is not the partner", async () => {
		// A firm often transfers from a director's account; finance reconciles
		// against the statement, not against the partner name.
		const { app, sent } = harness();
		await intimate(app, { ...VALID, depositorName: "A Director" });
		expect(await bodyOf(sent)).toContain("A Director");
	});

	it("uses the profile's GST and ignores whatever the browser sent", async () => {
		const { app, sent } = harness();
		await intimate(app, { ...VALID, gst: "99ZZZZZ9999Z1Z9" });
		const body = await bodyOf(sent);
		expect(body).toContain("07AAACA1234A1Z5");
		expect(body).not.toContain("99ZZZZZ9999Z1Z9");
	});

	it("falls back to the typed GST only when the profile has none", async () => {
		const { app, sent } = harness({
			profileResult: {
				kind: "found",
				responseTypeId: 1,
				profile: profile({ detailBlocks: {}, userDetail: {} }),
			} as ProfileResult,
		});
		await intimate(app, { ...VALID, gst: "27AAACA1234A1Z5" });
		expect(await bodyOf(sent)).toContain("27AAACA1234A1Z5");
	});

	it("prints an em dash when neither the profile nor the partner has one", async () => {
		const { app, sent } = harness({
			profileResult: {
				kind: "found",
				responseTypeId: 1,
				profile: profile({ detailBlocks: {}, userDetail: {} }),
			} as ProfileResult,
		});
		await intimate(app, { ...VALID, gst: "" });
		expect(await bodyOf(sent)).toContain("—");
	});
});

describe("buildEmailSubject", () => {
	it("names the code and the partner so finance can triage from the list", () => {
		expect(buildEmailSubject(profile())).toBe(
			"EPS One-Time Activation Fee Received | #20810 | Acme Fintech Pvt Ltd",
		);
	});

	it("drops an identity part it does not have rather than printing a gap", () => {
		expect(buildEmailSubject(profile({ name: "" }))).toBe(
			"EPS One-Time Activation Fee Received | #20810",
		);
		expect(
			buildEmailSubject(profile({ code: "" } as unknown as Partial<EkoProfile>)),
		).toBe("EPS One-Time Activation Fee Received | Acme Fintech Pvt Ltd");
	});
});

describe("POST /activation-fee/intimate — the Zoho CRM row", () => {
	const ORG = "https://crm.zoho.in/crm/org60006414357/tab";

	/** A profile carrying exactly these CRM ids. */
	const withCrm = (userDetail: Record<string, unknown>) =>
		({
			kind: "found",
			responseTypeId: 1,
			profile: profile({ userDetail }),
		}) as ProfileResult;

	it("links both records when the profile has both ids", async () => {
		const { app, sent } = harness();
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).toContain("Zoho CRM");
		expect(body).toContain(`<a href="${ORG}/Leads/lead-1">Lead</a>`);
		expect(body).toContain(`<a href="${ORG}/Contacts/contact-1">Contact</a>`);
		expect(body).toContain("</a>, <a");
	});

	// A partner mid-onboarding is still a lead; the contact is created on
	// conversion, so one link routinely exists without the other.
	it("links only the lead when there is no contact yet", async () => {
		const { app, sent } = harness({
			profileResult: withCrm({ crm_lead_id: "lead-9" }),
		});
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).toContain(`${ORG}/Leads/lead-9`);
		expect(body).not.toContain("/Contacts/");
		expect(body).not.toContain("</a>, <a");
	});

	it("links only the contact when the lead has been converted away", async () => {
		const { app, sent } = harness({
			profileResult: withCrm({ crm_contact_id: "contact-9" }),
		});
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).toContain(`${ORG}/Contacts/contact-9`);
		expect(body).not.toContain("/Leads/");
	});

	it("prints an em dash when the profile has neither", async () => {
		// Upstream sends "" rather than omitting the keys, which is the shape this
		// has to survive — a link to /Leads/ would be a link to nothing.
		const { app, sent } = harness({
			profileResult: withCrm({ crm_lead_id: "", crm_contact_id: "  " }),
		});
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).not.toContain("crm.zoho.in");
		expect(body).toContain("Zoho CRM");
	});

	it("omits the links entirely when no record base URL is configured", async () => {
		const { app, sent } = harness({ crmRecordBaseUrl: "" });
		await intimate(app);
		const body = await bodyOf(sent);
		// The row still exists — its absence would read as "this partner has no
		// CRM record", which is a different claim.
		expect(body).toContain("Zoho CRM");
		expect(body).not.toContain("<a href");
	});

	it("follows a base URL pointed at another org or datacentre", async () => {
		const { app, sent } = harness({
			crmRecordBaseUrl: "https://crm.zoho.com/crm/org999",
		});
		await intimate(app);
		expect(await bodyOf(sent)).toContain(
			"https://crm.zoho.com/crm/org999/tab/Leads/lead-1",
		);
	});

	it("accepts a numeric id, which is how Zoho ids usually arrive", async () => {
		const { app, sent } = harness({
			profileResult: withCrm({ crm_lead_id: 123456789 }),
		});
		await intimate(app);
		expect(await bodyOf(sent)).toContain(`${ORG}/Leads/123456789`);
	});

	it("cannot be made to break out of the href", async () => {
		const { app, sent } = harness({
			profileResult: withCrm({
				crm_lead_id: '"><script>alert(1)</script>',
			}),
		});
		await intimate(app);
		const body = await bodyOf(sent);
		expect(body).not.toContain("<script>");
		expect(body).not.toContain('"><');
	});
});
