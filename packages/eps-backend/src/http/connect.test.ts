import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { Sessions } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import { createInMemoryKV } from "../store/kv";
import { mountConnect } from "./connect";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";

const NOW = Date.now();

/** A sealed upstream session as `connectProvider.load` would hand one back. */
function upstream(overrides: Partial<UpstreamSession> = {}): UpstreamSession {
	return {
		accessToken: "ca_full",
		refreshToken: "ca_refresh",
		accessTokenLite: "ca_lite",
		accessTokenCrm: "ca_crm",
		accessExpiresAt: NOW + 3_600_000,
		sessionExpiresAt: NOW + 28_800_000,
		...overrides,
	};
}

/**
 * Builds an app with session/provider doubles.
 * @param claim - What `verifyAccess` resolves to; null means no session.
 * @param overrides - Upstream session (or null for expired) and client stubs.
 */
function harness(
	claim: Record<string, unknown> | null,
	overrides: {
		session?: UpstreamSession | null;
		connect?: Partial<ConnectClient>;
		getUpstream?: AuthProvider["getUpstream"];
	} = {},
) {
	const app = new Hono<AppEnv>();
	// Mirrors app.ts's onError so status/code assertions match production.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as never);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});

	const sessions = {
		verifyAccess: vi.fn().mockResolvedValue(claim),
	} as unknown as Sessions;

	const session =
		overrides.session === undefined ? upstream() : overrides.session;
	const auth = {
		name: "connect",
		getUpstream:
			"getUpstream" in overrides
				? overrides.getUpstream
				: vi.fn(async () => session),
	} as unknown as AuthProvider;

	const connect = {
		interactions: vi.fn(async () => [{ id: 491, label: "Load E-value" }]),
		...overrides.connect,
	} as unknown as ConnectClient;

	mountConnect(app, {
		sessions,
		auth,
		connect,
		kv: createInMemoryKV(),
		connectBaseUrl: "https://api.beta.ekoconnect.in",
	});
	return { app, connect, auth };
}

const developer = {
	sub: "9990000001",
	role: "developer",
	orgId: 1,
	sid: "s-1",
};
const withCookie = { headers: { Cookie: "eps_at=token" } };

/** The parsed error envelope of a failed response. */
async function errorOf(res: Response): Promise<{ code: string }> {
	const body = (await res.json()) as { error: { code: string } };
	return body.error;
}

describe("GET /connect/token", () => {
	it("returns only the lite and crm tokens", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			accessTokenLite: "ca_lite",
			accessTokenCrm: "ca_crm",
			expiresAt: NOW + 3_600_000,
		});
	});

	it("never exposes the full access or refresh token", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		// The whole security posture of this feature in one assertion.
		const body = await res.text();
		expect(body).not.toContain("ca_full");
		expect(body).not.toContain("ca_refresh");
	});

	it("marks the response no-store", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("nulls a missing crm token rather than omitting the field", async () => {
		const { app } = harness(developer, {
			session: upstream({ accessTokenCrm: undefined }),
		});
		const res = await app.request("/connect/token", withCookie);

		expect(await res.json()).toMatchObject({ accessTokenCrm: null });
	});

	it("401s without a session", async () => {
		const { app } = harness(null);
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ ...developer, role: "admin" });
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("501s a session with no sid (the eko provider)", async () => {
		const { app } = harness({ ...developer, sid: undefined });
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("CONNECT_UNAVAILABLE");
	});

	it("401s CONNECT_SESSION_EXPIRED once the sealed session is gone", async () => {
		const { app } = harness(developer, { session: null });
		const res = await app.request("/connect/token", withCookie);

		// 401, not 404: the client must re-login deterministically.
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("CONNECT_SESSION_EXPIRED");
	});

	it("502s rather than publishing a session with no lite token", async () => {
		const { app } = harness(developer, {
			session: upstream({ accessTokenLite: undefined }),
		});
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("CONNECT_TOKEN_MISSING");
	});

	it("rate-limits per session", async () => {
		const { app } = harness(developer);
		let last: Response | undefined;
		// The cap is 60 per window; the 61st must be refused.
		for (let i = 0; i < 61; i++) {
			last = await app.request("/connect/token", withCookie);
		}

		expect(last!.status).toBe(429);
		expect((await errorOf(last!)).code).toBe("RATE_LIMITED");
	});
});

describe("GET /connect/interactions", () => {
	it("returns the role-scoped interaction list", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/interactions", withCookie);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			interactions: [{ id: 491, label: "Load E-value" }],
		});
	});

	it("spends the FULL token upstream, which never reaches the browser", async () => {
		const { app, connect } = harness(developer);
		await app.request("/connect/interactions", {
			headers: { ...withCookie.headers, "x-real-ip": "1.2.3.4" },
		});

		expect(connect.interactions).toHaveBeenCalledWith("ca_full", {
			xRealIp: "1.2.3.4",
		});
	});

	it("401s without a session", async () => {
		const { app } = harness(null);
		const res = await app.request("/connect/interactions", withCookie);

		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});
});

describe("POST /connect/kyc/documents", () => {
	/** The 586 envelope, trimmed to the two rows the assertions need. */
	const listEnvelope = {
		status: 0,
		message: "Success",
		data: {
			user_code: "39300001",
			document_list: [
				{ doc_type: "1", name: "Aadhaar Card", pages: "2", is_required: 1 },
				{ doc_type: "13", name: "Blank Check", pages: "1", is_required: 0 },
			],
		},
	};

	it("passes the rows through unparsed", async () => {
		const { app } = harness(developer, {
			connect: { interact: vi.fn(async () => listEnvelope) },
		});

		const res = await app.request("/connect/kyc/documents", {
			method: "POST",
			...withCookie,
		});

		expect(res.status).toBe(200);
		// `is_required` survives the proxy; the console is what ignores it.
		expect(await res.json()).toEqual({
			documents: listEnvelope.data.document_list,
		});
	});

	it("identifies the user from the session, not the browser", async () => {
		const interact = vi.fn(
			async (_token: string, _fields: Record<string, unknown>) => listEnvelope,
		);
		const { app } = harness(developer, { connect: { interact } });

		await app.request("/connect/kyc/documents", {
			method: "POST",
			body: new URLSearchParams({ user_id: "8888888888" }),
			...withCookie,
		});

		const [token, fields] = interact.mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(token).toBe("ca_full");
		expect(fields.user_id).toBe("9990000001");
		expect(fields.interaction_type_id).toBe(539);
		expect(String(fields.client_ref_id)).toMatch(/^\d{20}$/);
	});

	it("marks the response no-store", async () => {
		const { app } = harness(developer, {
			connect: { interact: vi.fn(async () => listEnvelope) },
		});

		const res = await app.request("/connect/kyc/documents", {
			method: "POST",
			...withCookie,
		});

		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("returns an empty list rather than null when upstream sends none", async () => {
		const { app } = harness(developer, {
			connect: { interact: vi.fn(async () => ({ status: 0, data: {} })) },
		});

		const res = await app.request("/connect/kyc/documents", {
			method: "POST",
			...withCookie,
		});

		expect(await res.json()).toEqual({ documents: [] });
	});

	it("reads upstream's 'no records found' failure as an empty pack", async () => {
		// Upstream reports "nothing outstanding" as a FAILED envelope. Surfacing
		// that as an error would show a red box to every account whose KYC is
		// already complete — the most common state a live account is in.
		for (const message of [
			"No Records Found",
			"no records found",
			"No Record Found",
		]) {
			const { app } = harness(developer, {
				connect: { interact: vi.fn(async () => ({ status: 1, message })) },
			});

			const res = await app.request("/connect/kyc/documents", {
				method: "POST",
				...withCookie,
			});

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ documents: [] });
		}
	});

	it("502s on a business failure behind an HTTP 200", async () => {
		const { app } = harness(developer, {
			connect: {
				interact: vi.fn(async () => ({ status: 1, message: "Not allowed" })),
			},
		});

		const res = await app.request("/connect/kyc/documents", {
			method: "POST",
			...withCookie,
		});

		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("KYC_LIST_FAILED");
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ ...developer, role: "admin" });
		const res = await app.request("/connect/kyc/documents", {
			method: "POST",
			...withCookie,
		});

		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});
});

describe("POST /connect/kyc/upload", () => {
	/** A JPG of `bytes` bytes, named so the extension check passes. */
	function jpg(name = "page.jpg", bytes = 8): File {
		return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
	}

	/** An upload body: the two fields plus `file1..fileN`. */
	function uploadBody(
		fields: Record<string, string>,
		files: Array<[string, File]> = [],
	): FormData {
		const form = new FormData();
		for (const [key, value] of Object.entries(fields)) form.append(key, value);
		for (const [name, file] of files) form.append(name, file, file.name);
		return form;
	}

	/** A harness whose upload double records what it was handed. */
	function uploadHarness(
		envelope: Record<string, unknown> = {
			status: 0,
			message: "Details updated",
		},
	) {
		const uploadInteraction = vi.fn(
			async (
				_token: string,
				_fields: Record<string, string>,
				_files: Array<{ name: string; file: File }>,
			) => envelope,
		);
		const { app } = harness(developer, { connect: { uploadInteraction } });
		return { app, uploadInteraction };
	}

	it("sends both pages, named and ordered, with session identity", async () => {
		const { app, uploadInteraction } = uploadHarness();

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "2" }, [
				["file1", jpg("front.jpg")],
				["file2", jpg("back.jpg")],
			]),
			...withCookie,
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: "Details updated" });

		const [token, fields, files] = uploadInteraction.mock.calls[0] as [
			string,
			Record<string, string>,
			Array<{ name: string; file: File }>,
		];
		expect(token).toBe("ca_full");
		expect(fields).toEqual({
			interaction_type_id: "523",
			client_ref_id: expect.stringMatching(/^\d{20}$/),
			locale: "en",
			user_id: "9990000001",
			doc_type: "1",
			pages: "2",
		});
		// The upload transport URL-encodes these into one part, so every value has
		// to already be a string.
		expect(Object.values(fields).every((v) => typeof v === "string")).toBe(
			true,
		);
		expect(files.map((f) => f.name)).toEqual(["file1", "file2"]);
		expect(files.map((f) => f.file.name)).toEqual(["front.jpg", "back.jpg"]);
		// `doc_id` and `intent_id` are deliberately not sent.
		expect(fields).not.toHaveProperty("doc_id");
		expect(fields).not.toHaveProperty("intent_id");
	});

	it("refuses a short pack rather than half-uploading a document", async () => {
		const { app, uploadInteraction } = uploadHarness();

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "2" }, [["file1", jpg()]]),
			...withCookie,
		});

		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
		expect(uploadInteraction).not.toHaveBeenCalled();
	});

	it("ignores files past the declared page count", async () => {
		const { app, uploadInteraction } = uploadHarness();

		await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "1" }, [
				["file1", jpg()],
				["file2", jpg()],
			]),
			...withCookie,
		});

		const [, , files] = uploadInteraction.mock.calls[0] as [
			string,
			Record<string, string>,
			Array<{ name: string; file: File }>,
		];
		expect(files.map((f) => f.name)).toEqual(["file1"]);
	});

	it("requires doc_type", async () => {
		const { app } = uploadHarness();

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ pages: "1" }, [["file1", jpg()]]),
			...withCookie,
		});

		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
	});

	it("rejects an unusable page count", async () => {
		const { app } = uploadHarness();

		for (const pages of ["0", "-1", "abc", "1.5", "99", ""]) {
			const res = await app.request("/connect/kyc/upload", {
				method: "POST",
				body: uploadBody({ doc_type: "1", pages }, [["file1", jpg()]]),
				...withCookie,
			});

			expect(res.status).toBe(400);
		}
	});

	it("refuses an oversized page", async () => {
		const { app } = uploadHarness();

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "1" }, [
				["file1", jpg("big.jpg", 11 * 1024 * 1024)],
			]),
			...withCookie,
		});

		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("FILE_TOO_LARGE");
	});

	it("refuses a file type document review would reject", async () => {
		const { app } = uploadHarness();

		for (const file of [
			new File(["x"], "scan.svg", { type: "image/svg+xml" }),
			new File(["x"], "scan.webp", { type: "image/webp" }),
			// A disallowed file wearing an allowed extension, and the reverse.
			new File(["x"], "scan.png", { type: "image/svg+xml" }),
			new File(["x"], "scan.svg", { type: "image/png" }),
			new File(["x"], "scan", { type: "image/png" }),
		]) {
			const res = await app.request("/connect/kyc/upload", {
				method: "POST",
				body: uploadBody({ doc_type: "1", pages: "1" }, [["file1", file]]),
				...withCookie,
			});

			expect((await errorOf(res)).code).toBe("UNSUPPORTED_FILE_TYPE");
		}
	});

	it("accepts a PDF", async () => {
		const { app } = uploadHarness();

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "12", pages: "1" }, [
				["file1", new File(["x"], "cert.pdf", { type: "application/pdf" })],
			]),
			...withCookie,
		});

		expect(res.status).toBe(200);
	});

	it("502s on a business failure behind an HTTP 200", async () => {
		const { app } = uploadHarness({ status: 1, message: "Document rejected" });

		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "1" }, [["file1", jpg()]]),
			...withCookie,
		});

		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("KYC_UPLOAD_FAILED");
	});

	it("401s without a session", async () => {
		const { app } = harness(null);
		const res = await app.request("/connect/kyc/upload", {
			method: "POST",
			body: uploadBody({ doc_type: "1", pages: "1" }, [["file1", jpg()]]),
			...withCookie,
		});

		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});
});

describe("POST /connect/support/query-types", () => {
	it("unwraps issuetype_list and pins is_admin to 0", async () => {
		const { app, connect } = harness(developer, {
			connect: {
				interact: vi.fn(async () => ({
					data: { issuetype_list: [{ label: "Money not received" }] },
				})),
			},
		});

		const res = await app.request("/connect/support/query-types", {
			method: "POST",
			body: JSON.stringify({ tid: "123", tx_typeid: "77", is_admin: 1 }),
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			issueTypes: [{ label: "Money not received" }],
		});
		// Sent as 0 whatever the browser asked for: is_admin widens the list to
		// internal-only issue types.
		expect(connect.interact).toHaveBeenCalledWith(
			"ca_full",
			expect.objectContaining({ interaction_type_id: 10022, is_admin: 0 }),
			expect.anything(),
		);
	});
});

describe("POST /connect/support/ticket", () => {
	/** A multipart body with the payload part plus any attachments. */
	function ticketBody(
		payload: Record<string, unknown>,
		files: File[] = [],
	): FormData {
		const form = new FormData();
		form.append("payload", JSON.stringify(payload));
		files.forEach((file, i) => form.append(`file_${i + 1}`, file, file.name));
		return form;
	}

	it("builds the ticket from the session, not the browser", async () => {
		const created = vi.fn(
			async (
				_token: string,
				_fields: Record<string, string>,
				_files: Array<{ name: string; file: File }>,
			) => ({
				status: 0,
				message: "Submitted",
				data: { feedback_ticket_id: "T-42" },
			}),
		);
		const { app } = harness(developer, {
			connect: { createSupportTicket: created },
		});

		const res = await app.request("/connect/support/ticket", {
			method: "POST",
			body: ticketBody({
				summary: "Money not received",
				comment: "Customer says <b>nothing</b> arrived",
				client: { useragent: "jsdom" },
			}),
			...withCookie,
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			feedbackTicketId: "T-42",
			message: "Submitted",
		});

		const [token, fields, files] = created.mock.calls[0];
		expect(token).toBe("ca_full");
		expect(files).toEqual([]);
		expect(fields.feedback_issue_type).toBe("Money not received");
		// The harness points at beta, so support can filter these out.
		expect(fields.summary).toBe("[IGNORE] Money not received");
		// The user's markup is escaped, not rendered, in the ticket body.
		expect(fields.comment).toContain("&lt;b&gt;nothing&lt;/b&gt;");
		// Identity comes from the session claim.
		expect(JSON.parse(fields.technical_notes).user.user_mobile).toBe(
			"9990000001",
		);
	});

	it("forwards attachments", async () => {
		const created = vi.fn(
			async (
				_token: string,
				_fields: Record<string, string>,
				_files: Array<{ name: string; file: File }>,
			) => ({
				status: 0,
				data: { feedback_ticket_id: "T-43" },
			}),
		);
		const { app } = harness(developer, {
			connect: { createSupportTicket: created },
		});

		await app.request("/connect/support/ticket", {
			method: "POST",
			body: ticketBody({ summary: "Proof needed" }, [
				new File(["x"], "screenshot.jpg", { type: "image/jpeg" }),
			]),
			...withCookie,
		});

		expect(created.mock.calls[0][2]).toHaveLength(1);
	});

	it("refuses an oversized attachment", async () => {
		const { app } = harness(developer, {
			connect: { createSupportTicket: vi.fn(async () => ({ status: 0 })) },
		});

		const res = await app.request("/connect/support/ticket", {
			method: "POST",
			body: ticketBody({ summary: "Big" }, [
				new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", {
					type: "image/jpeg",
				}),
			]),
			...withCookie,
		});

		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("FILE_TOO_LARGE");
	});

	it("502s when upstream creates no ticket", async () => {
		const { app } = harness(developer, {
			connect: {
				createSupportTicket: vi.fn(async () => ({
					status: 1,
					message: "Not allowed",
				})),
			},
		});

		const res = await app.request("/connect/support/ticket", {
			method: "POST",
			body: ticketBody({ summary: "Nope" }),
			...withCookie,
		});

		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("TICKET_NOT_CREATED");
	});
});
