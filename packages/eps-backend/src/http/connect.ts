import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { randomInt } from "node:crypto";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { SessionClaim, Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";
import {
	buildTicketFields,
	isProductionConnect,
	QUERY_TYPES_INTERACTION,
} from "./support-ticket";

/**
 * Token reads per session per `RL_WINDOW_SEC`. The console fetches once per
 * widget mount and once per `login-again`, so a well-behaved client sits in
 * single digits; this only bites a scripted one.
 */
const TOKEN_LIMIT = 60;

/** Interaction-list reads per session per window. The console caches it. */
const INTERACTIONS_LIMIT = 30;

/** Query-type reads per session per window — one per raise-issue dialog opened. */
const QUERY_TYPES_LIMIT = 30;

/** Tickets per session per window. A human raises one, then waits for an answer. */
const TICKET_LIMIT = 10;

/** Document-list reads per session per window. The console fetches on mount. */
const KYC_LIST_LIMIT = 30;

/** Document uploads per session per window. A full KYC pack is a handful. */
const KYC_UPLOAD_LIMIT = 20;

/** Caps on the untrusted parts of a ticket, before it reaches the support desk. */
const MAX_TEXT = 4000;
const MAX_INPUTS = 20;
const MAX_FILES = 6;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** `interaction_type_id` for "fetch the required document list". */
const KYC_LIST_INTERACTION = 539;

/** `interaction_type_id` for "upload a document". */
const KYC_UPLOAD_INTERACTION = 523;

/**
 * Per-file ceiling for a KYC document. Deliberately its OWN constant rather
 * than the support desk's `MAX_FILE_BYTES`: a passport scan is not a screenshot,
 * and this is the knob to turn if upstream accepts more.
 */
const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Most files one document may ask for. A sanity bound on upstream's `pages`. */
const KYC_MAX_PAGES = 6;

/**
 * Upstream's wording for "this account has nothing to upload".
 *
 * It arrives as a FAILED envelope (non-zero `status`) rather than a success
 * carrying an empty `document_list`, which is why it needs naming here: without
 * this the console shows a red error box to every user whose KYC pack is
 * already complete — the most common state a live account is in.
 *
 * Matched on the message because it is all upstream gives us to go on. Kept
 * narrow deliberately: anything else non-zero is still a real failure and still
 * surfaces as one.
 */
const KYC_NO_RECORDS = /no\s+records?\s+found/i;

/**
 * What a KYC document may be.
 *
 * An explicit list, NOT `image/*`: the wildcard waves through HEIC, SVG and
 * WEBP, which document-review pipelines reject — and SVG is a script carrier.
 */
const KYC_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const KYC_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

/**
 * Whether a file may be uploaded as a KYC document.
 *
 * Requires the declared MIME type AND the extension to agree, because the
 * browser supplies both and either alone is trivially wrong — a `.svg` renamed
 * to `.png` still announces `image/svg+xml`, and a file with no extension can
 * claim any type it likes.
 *
 * ponytail: declaration-only, no magic-byte sniffing. Upgrade to reading the
 * first bytes if connect-api ever starts trusting our validation rather than
 * doing its own.
 * @param file - The uploaded file.
 * @returns True when both the type and the extension are allowed.
 */
function isAllowedKycFile(file: File): boolean {
	const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
	return (
		KYC_TYPES.has(file.type.toLowerCase()) && KYC_EXTENSIONS.has(extension)
	);
}

/**
 * A fresh 20-digit `client_ref_id`, matching the shape connect-api's own samples
 * use for these interactions.
 *
 * Built here and never accepted from the browser, so one caller cannot replay or
 * collide with another's reference. The timestamp is explicitly sliced and
 * padded to 13 digits rather than assumed to be that long, and the random tail
 * keeps its full width so two uploads in the same millisecond stay distinct.
 * @returns Exactly 20 digits.
 */
function kycClientRefId(): string {
	const stamp = String(Date.now()).slice(-13).padStart(13, "0");
	return `${stamp}${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
}

/**
 * Trims an untrusted string to a bounded one.
 * @param value - Anything the browser sent.
 * @param max - Longest string to keep.
 * @returns The trimmed string, or "" for anything that is not a string.
 */
function text(value: unknown, max = 200): string {
	return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Mounts the endpoints backing the embedded Connect widget.
 *
 * These exist because `<tf-wlc-widget>` authenticates by reading
 * `sessionStorage` inside the host page's own realm — it has no token prop and
 * no postMessage API, so an HttpOnly cookie cannot reach it. Verified against
 * the shipped bundle's `TfApiBehavior._getAPIDefaultHeaders`.
 *
 * The exposure is deliberately narrowed to what that function actually reads:
 *
 * - `access_token_lite` — every transaction call. In the whole 1.4MB bundle the
 *   `fulltoken` flag that would select the FULL token appears exactly once: its
 *   own definition. No call site passes it, so setting lite means the full-token
 *   fallback never fires.
 * - `access_token_crm` — one fire-and-forget `/crm/updateProdDeal` ping.
 *
 * The full `accessToken` and the `refreshToken` therefore never leave this
 * process. `/connect/interactions` proves the point: it needs the full token, so
 * it runs here rather than in the browser.
 *
 * Mounted only when the connect provider is configured, so under the `eko`
 * provider these routes do not exist at all rather than answering 501.
 * @param app - The Hono app.
 * @param deps - Session verifier, auth provider, connect client and KV.
 */
export function mountConnect(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		auth: AuthProvider;
		connect: ConnectClient;
		kv: KV;
		/** The configured connect-api, which decides whether tickets are real. */
		connectBaseUrl: string;
	},
): void {
	const { sessions, auth, connect, kv } = deps;
	const isProduction = isProductionConnect(deps.connectBaseUrl);

	/**
	 * Resolves the caller's claim, or throws unless this is a developer session
	 * that can actually carry upstream Connect credentials.
	 */
	async function requireWidgetSession(
		c: Context<AppEnv>,
	): Promise<SessionClaim> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account cannot run transaction flows.",
			);
		}
		// A developer session minted under the `eko` provider has no `sid` and no
		// upstream material behind it. 501 rather than 403: the account is fine,
		// this deployment simply cannot serve widget flows.
		if (!claim.sid || !auth.getUpstream) {
			throw new AppError(
				501,
				"CONNECT_UNAVAILABLE",
				"Transaction flows aren't available on this deployment.",
			);
		}
		return claim;
	}

	/**
	 * Opens the sealed upstream session.
	 * @throws {AppError} 401 CONNECT_SESSION_EXPIRED once it has aged out, so the
	 *   client re-authenticates deterministically instead of retrying forever.
	 */
	async function requireUpstream(
		claim: SessionClaim,
	): Promise<UpstreamSession> {
		const upstream = await auth.getUpstream!(claim.sid!);
		if (!upstream) {
			throw new AppError(
				401,
				"CONNECT_SESSION_EXPIRED",
				"Your session has expired. Please sign in again.",
			);
		}
		return upstream;
	}

	/**
	 * GET /connect/token → { accessTokenLite, accessTokenCrm, expiresAt }
	 *
	 * `no-store` because the body is a bearer credential: without it a shared
	 * proxy or the browser's bfcache could hand one user's token to the next.
	 */
	app.get("/connect/token", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxtok:${claim.sid}`,
			TOKEN_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		// connect-api minted a session but no lite token. The widget would fall
		// back to reading `access_token`, which we deliberately do not publish, so
		// it would send `Bearer null` on every call. Refuse instead of shipping a
		// widget that cannot authenticate.
		if (!upstream.accessTokenLite) {
			throw new AppError(
				502,
				"CONNECT_TOKEN_MISSING",
				"Couldn't start a transaction session right now.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({
			accessTokenLite: upstream.accessTokenLite,
			accessTokenCrm: upstream.accessTokenCrm ?? null,
			expiresAt: upstream.accessExpiresAt,
		});
	});

	/**
	 * GET /connect/interactions → { interactions }
	 *
	 * The role-scoped interaction list the widget needs as `role_trxn_list`, and
	 * what tells the console which Load-E-value flow this user is entitled to.
	 * Proxied rather than called from the browser because it requires the FULL
	 * upstream token.
	 */
	app.get("/connect/interactions", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxint:${claim.sid}`,
			INTERACTIONS_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const interactions = await connect.interactions(upstream.accessToken, {
			xRealIp: c.req.header("x-real-ip"),
		});

		// Entitlements, not public data — same reasoning as the token route.
		c.header("Cache-Control", "no-store");
		return c.json({ interactions });
	});

	/**
	 * POST /connect/kyc/documents → { documents }
	 *
	 * The documents this user must upload to finish KYC. Proxied because it needs
	 * the FULL upstream token, and POST rather than GET because it is a
	 * transaction upstream, not a cacheable read.
	 *
	 * The rows are passed through unparsed — `parseDocumentList` in
	 * `src/lib/connect/kyc.ts` owns their shape, so there is one tolerant reader
	 * of an upstream payload we have only one sample of, not two that can drift.
	 * `is_required` rides along and the console ignores it: every listed document
	 * is treated as mandatory.
	 */
	app.post("/connect/kyc/documents", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxkycl:${claim.sid}`,
			KYC_LIST_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const envelope = await connect.interact(
			upstream.accessToken,
			{
				interaction_type_id: KYC_LIST_INTERACTION,
				client_ref_id: kycClientRefId(),
				locale: "en",
				// From the sealed session, never the browser: this is whose KYC pack
				// gets listed.
				user_id: claim.sub,
			},
			{ xRealIp: c.req.header("x-real-ip") },
		);

		// connect-api answers HTTP 200 for business failures, so the envelope is
		// what decides — same as every other route here. The one exception is
		// "no records found", which upstream reports as a failure but which means
		// this account simply has nothing outstanding.
		const message = text(envelope.message, 200);
		if (Number(envelope.status ?? -1) !== 0) {
			if (KYC_NO_RECORDS.test(message)) {
				c.header("Cache-Control", "no-store");
				return c.json({ documents: [] });
			}
			throw new AppError(
				502,
				"KYC_LIST_FAILED",
				message || "Couldn't load your document list.",
			);
		}

		const data = (envelope.data ?? {}) as { document_list?: unknown };
		c.header("Cache-Control", "no-store");
		return c.json({
			documents: Array.isArray(data.document_list) ? data.document_list : [],
		});
	});

	/**
	 * POST /connect/kyc/upload (multipart) → { message }
	 *
	 * Uploads one document's pages. The browser sends `doc_type`, `pages` and
	 * `file1..fileN`; everything that identifies the uploader is added here.
	 */
	app.post("/connect/kyc/upload", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxkycu:${claim.sid}`,
			KYC_UPLOAD_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const form = await c.req.formData().catch(() => null);
		if (!form) {
			throw new AppError(400, "INVALID_INPUT", "Expected a multipart body");
		}

		const docType = text(form.get("doc_type"), 16);
		if (!docType) {
			throw new AppError(400, "INVALID_INPUT", "doc_type is required");
		}

		const pages = Number(text(form.get("pages"), 8));
		if (!Number.isInteger(pages) || pages < 1 || pages > KYC_MAX_PAGES) {
			throw new AppError(
				400,
				"INVALID_INPUT",
				`pages must be a whole number between 1 and ${KYC_MAX_PAGES}`,
			);
		}

		// Exactly `pages` files, named `file1..fileN`. Not "at most": a short pack
		// is a half-uploaded document that upstream cannot review, and the caller
		// would have no way to add the missing page afterwards.
		const files: Array<{ name: string; file: File }> = [];
		for (let page = 1; page <= pages; page++) {
			const name = `file${page}`;
			const value = form.get(name);
			if (!(value instanceof File) || value.size === 0) {
				throw new AppError(400, "INVALID_INPUT", `${name} is required`);
			}
			if (value.size > KYC_MAX_FILE_BYTES) {
				throw new AppError(
					400,
					"FILE_TOO_LARGE",
					`${value.name || name} is larger than ${KYC_MAX_FILE_BYTES / (1024 * 1024)} MB`,
				);
			}
			if (!isAllowedKycFile(value)) {
				throw new AppError(
					400,
					"UNSUPPORTED_FILE_TYPE",
					`${value.name || name} must be a JPG, PNG or PDF`,
				);
			}
			files.push({ name, file: value });
		}

		const envelope = await connect.uploadInteraction(
			upstream.accessToken,
			{
				// Every field URL-encodes into one `formdata` part, so they are all
				// strings by the time they leave here.
				interaction_type_id: String(KYC_UPLOAD_INTERACTION),
				client_ref_id: kycClientRefId(),
				locale: "en",
				user_id: claim.sub,
				doc_type: docType,
				pages: String(pages),
			},
			files,
			{ xRealIp: c.req.header("x-real-ip") },
		);

		if (Number(envelope.status ?? -1) !== 0) {
			throw new AppError(
				502,
				"KYC_UPLOAD_FAILED",
				text(envelope.message, 200) || "Couldn't upload that document.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({
			message: text(envelope.message, 200) || "Document uploaded.",
		});
	});

	/**
	 * POST /connect/support/query-types → { issueTypes }
	 *
	 * The categories, sub-categories and issue types a query may be raised under,
	 * scoped to one transaction. Proxied because it needs the FULL upstream token.
	 *
	 * `is_admin` is fixed at 0: it widens the list to internal-only issue types,
	 * and no console session is an upstream admin.
	 */
	app.post("/connect/support/query-types", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxqt:${claim.sid}`,
			QUERY_TYPES_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const body = (await c.req.json().catch(() => ({}))) as Record<
			string,
			unknown
		>;
		const envelope = await connect.interact(
			upstream.accessToken,
			{
				interaction_type_id: QUERY_TYPES_INTERACTION,
				tid: text(body.tid, 32),
				tx_typeid: text(body.tx_typeid, 32),
				feedback_origin: text(body.feedback_origin, 64),
				status: text(body.status, 8),
				operator: text(body.operator, 64),
				partner_id: text(body.partner_id, 64),
				channel: text(body.channel, 64),
				is_admin: 0,
			},
			{ xRealIp: c.req.header("x-real-ip") },
		);

		const data = envelope.data as { issuetype_list?: unknown } | undefined;
		const issueTypes = Array.isArray(data?.issuetype_list)
			? data.issuetype_list
			: [];

		c.header("Cache-Control", "no-store");
		return c.json({ issueTypes });
	});

	/**
	 * POST /connect/support/ticket (multipart) → { feedbackTicketId, message }
	 *
	 * Raises a support ticket. The browser sends a `payload` JSON part plus any
	 * attachments; the Zoho-Desk description, comment and technical notes are
	 * assembled here, from that payload and the session — so the console never
	 * learns the ticket schema and cannot claim to be a different user.
	 */
	app.post("/connect/support/ticket", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxtkt:${claim.sid}`,
			TICKET_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const form = await c.req.formData().catch(() => null);
		if (!form) {
			throw new AppError(400, "INVALID_INPUT", "Expected a multipart body");
		}

		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(String(form.get("payload") ?? "{}")) as Record<
				string,
				unknown
			>;
		} catch {
			throw new AppError(400, "INVALID_INPUT", "payload is not valid JSON");
		}

		const summary = text(payload.summary, 200);
		if (!summary) {
			throw new AppError(400, "INVALID_INPUT", "summary is required");
		}

		const rawInputs = Array.isArray(payload.inputs) ? payload.inputs : [];
		const inputs = rawInputs.slice(0, MAX_INPUTS).map((field) => {
			const entry = (field ?? {}) as Record<string, unknown>;
			return { label: text(entry.label, 120), value: text(entry.value, 500) };
		});

		const client = (payload.client ?? {}) as Record<string, unknown>;

		const fields = buildTicketFields({
			summary,
			category: text(payload.category, 120),
			subCategory: text(payload.subCategory, 120),
			comment: text(payload.comment, MAX_TEXT),
			context: text(payload.context, MAX_TEXT),
			inputs,
			origin: text(payload.origin, 64),
			tat: text(payload.tat, 16),
			priority: text(payload.priority, 32),
			tid: text(payload.tid, 32),
			txTypeId: text(payload.txTypeId, 32),
			transactionDetail: payload.transactionDetail,
			preMsgTemplate: text(payload.preMsgTemplate, 500),
			client: {
				useragent: text(client.useragent, 500),
				screen: text(client.screen, 64),
				deviceTime: text(client.deviceTime, 64),
				url: text(client.url, 500),
			},
			user: {
				mobile: claim.sub,
				orgId: claim.orgId,
				zohoId: claim.zohoId,
				role: claim.role,
			},
			isProduction,
		});

		const files: Array<{ name: string; file: File }> = [];
		for (const [name, value] of form.entries()) {
			if (name === "payload" || !(value instanceof File)) continue;
			if (files.length >= MAX_FILES) {
				throw new AppError(400, "INVALID_INPUT", "Too many attachments");
			}
			if (value.size > MAX_FILE_BYTES) {
				throw new AppError(
					400,
					"FILE_TOO_LARGE",
					`${value.name || name} is larger than 5 MB`,
				);
			}
			files.push({ name, file: value });
		}

		const envelope = await connect.createSupportTicket(
			upstream.accessToken,
			fields,
			files,
			{ xRealIp: c.req.header("x-real-ip") },
		);

		const data = (envelope.data ?? {}) as { feedback_ticket_id?: unknown };
		const feedbackTicketId = data.feedback_ticket_id
			? String(data.feedback_ticket_id)
			: "";
		if (Number(envelope.status ?? -1) !== 0 || !feedbackTicketId) {
			throw new AppError(
				502,
				"TICKET_NOT_CREATED",
				text(envelope.message, 200) || "Couldn't create the ticket.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({
			feedbackTicketId,
			message: text(envelope.message, 200) || "Submitted successfully.",
		});
	});
}
