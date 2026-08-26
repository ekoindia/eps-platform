/**
 * Partner-initiated intimation that the one-time API activation fee has been
 * paid by bank transfer.
 *
 * Production credentials unlock every API on the platform, so the fee is
 * collected on trust: the partner transfers the money and tells us here, and
 * Eko's finance team reconciles it against the bank statement. Nothing on this
 * route confirms a payment — it only carries the claim, plus enough verified
 * identity for finance to match it to an account.
 *
 * The identity half of the mail (name, EkoCode, mobile, email, PAN, GST) is
 * read from the caller's own upstream profile and NEVER from the request body,
 * so a partner cannot file an intimation in somebody else's name. The browser
 * supplies only the facts about the transfer, which are the partner's to state.
 */
import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import { withTimeout } from "../clients/http";
import type { Config } from "../config";
import type { KV } from "../store/kv";
import type { EkoProfile } from "../types";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";
import { escapeHtml } from "./support-ticket";
import { recordUpstream } from "./trace";

/**
 * Intimations one partner may file per {@link RL_WINDOW_SEC} window. Generous
 * for a genuine correction or a second payment, tight enough that a stuck retry
 * loop cannot bury finance in mail.
 */
const INTIMATE_LIMIT = 10;

/**
 * The payment rails a partner can transfer over, keyed by their uppercased form
 * so the browser's exact casing does not matter, and valued by the label
 * finance reads in the mail.
 *
 * A map rather than a set because "Intra-Bank Transfer" is not its own
 * uppercase: normalising the input and echoing it back would put
 * "INTRA-BANK TRANSFER" in the table.
 */
const MODES = new Map([
	["IMPS", "IMPS"],
	["NEFT", "NEFT"],
	["RTGS", "RTGS"],
	["INTRA-BANK TRANSFER", "Intra-Bank Transfer"],
]);

/** Caps on the untrusted parts of the intimation. */
const MAX_UTR = 64;
const MAX_PRODUCTS = 60;
const MAX_PRODUCT_LABEL = 120;
const MAX_OTHER_PRODUCTS = 500;
const MAX_DEPOSITOR = 120;
const MAX_GST = 32;
/** Above this an "activation fee" is a typo or a probe, not a fee. */
const MAX_AMOUNT = 1_00_00_000;

/** One transaction slip. Same ceiling as the support desk's attachments. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/**
 * What a transaction slip may be. An explicit list, NOT `image/*` — the
 * wildcard waves through SVG, which is a script carrier, and this file is
 * forwarded into an email a human will open.
 */
const SLIP_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const SLIP_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

/**
 * Whether a file may be attached as a transaction slip.
 *
 * Requires the declared MIME type AND the extension to agree: the browser
 * supplies both, and either alone is trivially wrong — a `.svg` renamed to
 * `.png` still announces `image/svg+xml`.
 *
 * ponytail: declaration-only, no magic-byte sniffing. The file is forwarded as
 * an opaque attachment and never rendered by us; sniff the leading bytes if it
 * ever starts being parsed or displayed server-side.
 * @param file - The uploaded file.
 * @returns True when both the type and the extension are allowed.
 */
function isAllowedSlip(file: File): boolean {
	const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
	return (
		SLIP_TYPES.has(file.type.toLowerCase()) && SLIP_EXTENSIONS.has(extension)
	);
}

/** Everything the browser is allowed to say about the transfer. */
interface PaymentClaim {
	amount: number;
	/** Strict `YYYY-MM-DD`, already checked to be a real, non-future date. */
	date: string;
	mode: string;
	utr: string;
	/**
	 * Whose bank account the money came from, as printed on it. The partner's own
	 * name is only a default — a firm often transfers from a director's or a
	 * parent company's account, and finance reconciles against what the statement
	 * actually says.
	 */
	depositorName: string;
	/** Display labels of the APIs the fee covers. */
	products: string[];
	/** Free-text for anything not in the catalogue. */
	otherProducts: string;
	/**
	 * GST number the partner typed, used ONLY when their profile carries none.
	 * A profile that has one always wins: this is a gap-filler, not an override.
	 */
	gst: string;
}

/**
 * Reads a `YYYY-MM-DD` date, rejecting anything that is not a real calendar day.
 *
 * `new Date("2026-02-31")` does not throw — it rolls forward to March 3rd — so
 * parsing alone would silently accept an impossible date and print it back to
 * finance as a different one. Round-tripping through `toISOString` is what
 * catches that.
 * @param raw - The candidate value from the request.
 * @returns The date, or null when it is malformed, impossible or in the future.
 */
function parsePaymentDate(raw: unknown): string | null {
	if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
	const parsed = new Date(`${raw}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	// Rolled-over dates (Feb 31st) come back as a different day than they went in.
	if (parsed.toISOString().slice(0, 10) !== raw) return null;
	// Compared date-only, in UTC, against UTC "today": a partner in IST filing
	// late in the evening is on tomorrow's UTC date, and their own date must not
	// be rejected as "in the future" for it.
	const today = new Date().toISOString().slice(0, 10);
	return raw > today ? null : raw;
}

/**
 * Validates the browser's half of the intimation.
 *
 * Every field here is the partner's own claim about a transfer they made, so
 * the checks are for coherence, not authority — the point is that finance never
 * receives an unreadable amount, an impossible date or a megabyte of prose.
 * @param payload - The parsed `payload` part of the multipart body.
 * @returns The normalised claim.
 * @throws AppError 400 INVALID_INPUT naming the first field that fails.
 */
export function parsePaymentClaim(
	payload: Record<string, unknown>,
): PaymentClaim {
	// Number inputs hand back strings; coerce explicitly rather than letting a
	// stray "1,200" become NaN three lines later.
	const amount = Number(
		typeof payload.amount === "string" ? payload.amount.trim() : payload.amount,
	);
	if (!Number.isFinite(amount) || amount <= 0) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Enter the amount you transferred.",
		);
	}
	if (amount > MAX_AMOUNT) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"That amount looks too large — please check it.",
		);
	}
	if (Math.round(amount * 100) !== amount * 100) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Amount can have at most two decimal places.",
		);
	}

	const date = parsePaymentDate(payload.date);
	if (!date) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Enter a valid transaction date that isn't in the future.",
		);
	}

	const mode = MODES.get(
		typeof payload.mode === "string" ? payload.mode.trim().toUpperCase() : "",
	);
	if (!mode) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			`Choose how you transferred the money (${[...MODES.values()].join(", ")}).`,
		);
	}

	const depositorName =
		typeof payload.depositorName === "string"
			? payload.depositorName.trim().slice(0, MAX_DEPOSITOR)
			: "";
	if (!depositorName) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Enter the name on the bank account the money came from.",
		);
	}

	const utr = typeof payload.utr === "string" ? payload.utr.trim() : "";
	if (!utr || utr.length > MAX_UTR) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Enter the UTR / reference number from your bank.",
		);
	}

	// ponytail: capped and escaped, not whitelisted against the API catalogue —
	// that catalogue lives in the website bundle, and duplicating it here to
	// police a partner's description of their own payment buys nothing. Add a
	// shared list if these labels ever drive billing rather than a human's inbox.
	const rawProducts = Array.isArray(payload.products) ? payload.products : [];
	const products = rawProducts
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, MAX_PRODUCTS)
		.map((item) => item.slice(0, MAX_PRODUCT_LABEL));
	const otherProducts =
		typeof payload.otherProducts === "string"
			? payload.otherProducts.trim().slice(0, MAX_OTHER_PRODUCTS)
			: "";
	if (products.length === 0 && !otherProducts) {
		throw new AppError(
			400,
			"INVALID_INPUT",
			"Select at least one product the fee covers.",
		);
	}

	const gst =
		typeof payload.gst === "string"
			? payload.gst.trim().slice(0, MAX_GST)
			: "";

	return {
		amount,
		date,
		mode,
		utr,
		depositorName,
		products,
		otherProducts,
		gst,
	};
}

/**
 * The partner's GST number, if their profile carries one anywhere.
 *
 * Unlike PAN, GST has no agreed field name on interaction 151 — it turns up
 * under different keys per user type, and some profiles have none at all. So
 * this scans the allowlisted business blocks and the flat user detail for a key
 * that names GST, rather than pinning a name that may not exist.
 * @param profile - The caller's own upstream profile.
 * @returns The GST number, or "" when the profile does not carry one.
 */
export function findGstNumber(profile: EkoProfile): string {
	const looksLikeGst = (key: string) => /gst/i.test(key);
	const sources: Record<string, unknown>[] = [profile.userDetail];
	for (const block of Object.values(profile.detailBlocks)) {
		if (block && typeof block === "object" && !Array.isArray(block)) {
			sources.push(block as Record<string, unknown>);
		}
	}
	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			if (!looksLikeGst(key)) continue;
			if (typeof value !== "string" && typeof value !== "number") continue;
			const text = String(value).trim();
			if (text) return text;
		}
	}
	return "";
}

/** One `<tr>` of the intimation table. Blank values read as an em dash. */
const row = (label: string, value: string): string =>
	`<tr><td><strong>${escapeHtml(label)}</strong></td><td>${value ? escapeHtml(value) : "—"}</td></tr>`;

/**
 * One `<tr>` whose value is markup this module built itself.
 *
 * Separate from {@link row} so that escaping stays the default: a caller has to
 * name this one to opt out, and the only thing that does is the CRM row, whose
 * cell is anchors rather than text.
 */
const rawRow = (label: string, html: string): string =>
	`<tr><td><strong>${escapeHtml(label)}</strong></td><td>${html || "—"}</td></tr>`;

/**
 * The Zoho CRM org these records live in. Not a secret — it is in the URL of
 * every record anyone at Eko opens — but it is the one part of the link that is
 * an account fact rather than a record fact, so it is named once.
 */
const ZOHO_ORG = "org60006414357";

/**
 * A link to one Zoho CRM record, or "" when there is no id to link to.
 *
 * The id is upstream's, so it is escaped for the attribute AND percent-encoded
 * for the path: a value carrying a quote would otherwise break out of the href,
 * and this mail is read in a client that will happily render whatever it is
 * handed.
 * @param tab - The CRM tab, e.g. `"Leads"`.
 * @param id - The record id from the profile, in whatever shape it arrived.
 * @param label - Link text.
 * @returns An `<a>`, or "" when the id is absent or blank.
 */
function zohoLink(tab: string, id: unknown, label: string): string {
	if (typeof id !== "string" && typeof id !== "number") return "";
	const trimmed = String(id).trim();
	if (!trimmed) return "";
	const href = `https://crm.zoho.in/crm/${ZOHO_ORG}/tab/${tab}/${encodeURIComponent(trimmed)}`;
	return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

/**
 * Builds the HTML mail finance receives.
 *
 * Everything interpolated is escaped: the product labels and UTR are the
 * partner's own text, and the profile fields are upstream's — neither is
 * trusted to be markup-free.
 * @param profile - The caller's verified upstream profile.
 * @param claim - The validated transfer details.
 * @returns The mail body, as HTML.
 */
export function buildEmailBody(
	profile: EkoProfile,
	claim: PaymentClaim,
): string {
	const code =
		profile.code === null || profile.code === undefined
			? ""
			: String(profile.code);
	const pan = String(profile.userDetail.pancardnumber ?? "").trim();
	const productList = [...claim.products, claim.otherProducts]
		.filter(Boolean)
		.join(", ");
	return [
		`<p>Please confirm the activation fee received on behalf of the partner <strong>${escapeHtml(profile.name)}</strong> with Eko code: <strong>${escapeHtml(code)}</strong></p>`,
		"<table border='1' cellpadding='6' cellspacing='0'>",
		row("Name of Company/Partner", profile.name),
		row("EkoCode", code),
		row("Mobile", profile.mobile),
		row("Email", profile.email),
		row("Activation Fee Received", `₹${claim.amount.toLocaleString("en-IN")}`),
		row("Transaction Date", claim.date),
		row("Mode of Payment", claim.mode),
		row("UTR / Reference Number", claim.utr),
		row("Name of Depositor (as per bank account)", claim.depositorName),
		row("PAN", pan),
		// The profile always wins. The browser's value only fills a gap, so a
		// partner cannot restate a GST number upstream already holds.
		row("GST", findGstNumber(profile) || claim.gst),
		// Straight into the record finance needs open to confirm anything. A
		// partner mid-onboarding has a lead and no contact yet, so either link may
		// simply be absent.
		rawRow(
			"Zoho CRM",
			[
				zohoLink("Leads", profile.userDetail.crm_lead_id, "Lead"),
				zohoLink("Contacts", profile.userDetail.crm_contact_id, "Contact"),
			]
				.filter(Boolean)
				.join(", "),
		),
		row("Product List", productList),
		row("Category", "EPS Partner"),
		"</table>",
	].join("\n");
}

/**
 * Subject line for one intimation.
 *
 * Carries the EkoCode and the partner name so finance can triage from the inbox
 * list without opening anything, and so a thread is searchable by code — which
 * is the id they reconcile against.
 * @param profile - The caller's verified upstream profile.
 * @returns The subject, with blank identity parts simply omitted.
 */
export function buildEmailSubject(profile: EkoProfile): string {
	const code =
		profile.code === null || profile.code === undefined
			? ""
			: String(profile.code).trim();
	const parts = ["EPS One-Time Activation Fee Received"];
	if (code) parts.push(`#${code}`);
	const name = profile.name?.trim();
	if (name) parts.push(name);
	return parts.join(" | ");
}

/**
 * Mounts the activation-fee intimation route.
 * @param app - The Hono app.
 * @param deps - Sessions for the auth gate, the Eko client for the caller's own
 * profile, KV for rate limiting, and the activation-fee config (absent when the
 * feature is not configured for this deployment).
 */
export function mountActivationFee(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		eko: EkoClient;
		kv: KV;
		cfg?: Config["activationFee"];
		fetchImpl?: typeof fetch;
	},
): void {
	const { sessions, eko, kv, cfg } = deps;

	/** The signed-in developer's mobile — the only identity this route trusts. */
	async function requireDeveloperSession(c: Context<AppEnv>): Promise<string> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account cannot submit an activation-fee payment.",
			);
		}
		return claim.sub;
	}

	/**
	 * POST /activation-fee/intimate → { message }
	 *
	 * Multipart: a `payload` JSON part plus an optional `attachment` file.
	 */
	app.post("/activation-fee/intimate", async (c) => {
		const mobile = await requireDeveloperSession(c);
		await enforceRateLimit(
			kv,
			`rl:actfee:${mobile}`,
			INTIMATE_LIMIT,
			RL_WINDOW_SEC,
		);
		if (!cfg) {
			throw new AppError(
				503,
				"ACTIVATION_FEE_DISABLED",
				"We can't record activation-fee payments right now. Please email eps@eko.in with your transfer details.",
			);
		}

		const form = await c.req.formData().catch(() => null);
		if (!form)
			throw new AppError(400, "INVALID_INPUT", "Expected a multipart body");
		// Repeated parts would let a caller show one payload to a validator and
		// another to the mail builder; `getAll` is what makes that visible.
		if (
			form.getAll("payload").length !== 1 ||
			form.getAll("attachment").length > 1
		) {
			throw new AppError(
				400,
				"INVALID_INPUT",
				"Send exactly one payload and at most one attachment.",
			);
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
		const claim = parsePaymentClaim(payload);

		const slip = form.get("attachment");
		const attachment = slip instanceof File && slip.size > 0 ? slip : null;
		if (attachment) {
			if (attachment.size > MAX_FILE_BYTES) {
				throw new AppError(
					400,
					"INVALID_INPUT",
					"That file is too large — 5 MB maximum.",
				);
			}
			if (!isAllowedSlip(attachment)) {
				throw new AppError(
					400,
					"INVALID_INPUT",
					"Attach the slip as a JPG, PNG or PDF.",
				);
			}
		}

		const xRealIp = c.req.header("x-real-ip");
		const profile = await eko.getProfile({ mobile, xRealIp });
		if (profile.kind === "error") {
			// A lookup failure is ours, not a statement about this account, and it
			// is retryable — reporting it as a 403 would tell a paying partner
			// their account is ineligible when it is our upstream that is down.
			throw new AppError(
				502,
				"PROFILE_UNAVAILABLE",
				"Couldn't reach your account details right now. Please try again in a moment.",
			);
		}
		if (profile.kind !== "found") {
			throw new AppError(
				403,
				"NO_PROFILE",
				"Your account isn't fully active yet, so there's no activation fee to record against it.",
			);
		}

		// A fresh, server-built body: the browser's FormData is never forwarded, so
		// no extra part it invented can reach the webhook.
		const out = new FormData();
		out.append("to", cfg.recipients.join(", "));
		out.append("subject", buildEmailSubject(profile.profile));
		out.append("body", buildEmailBody(profile.profile, claim));
		if (attachment) out.append("attachment", attachment, attachment.name);

		// No Content-Type header: fetch derives `multipart/form-data` plus the
		// boundary from the FormData body, and naming it here would leave the
		// request unparseable.
		const doFetch = withTimeout(deps.fetchImpl ?? fetch, cfg.timeoutMs);
		const startedAt = Date.now();
		let res: Response | null = null;
		let transportError: string | null = null;
		let bodyText = "";
		try {
			res = await doFetch(cfg.webhookUrl, { method: "POST", body: out });
			// Read once, before any branch: an unread body keeps the socket open,
			// and the text is the only thing that says WHY the webhook refused.
			bodyText = await res.text().catch(() => "");
		} catch (err) {
			transportError = err instanceof Error ? err.message : String(err);
		}

		// The trace rides back to the browser, so the URL never enters it: this
		// webhook is an unauthenticated endpoint that mails staff, and its address
		// is exactly the secret the whole proxy exists to keep. A fixed label plus
		// the status is all ops needs to tell "it refused us" from "we never
		// reached it", and the full reason is on the server's own console.
		recordUpstream({
			path: "activation-fee webhook",
			clientRefId: null,
			status: res?.status ?? null,
			durMs: Date.now() - startedAt,
			error: transportError,
		});

		if (!res || !res.ok) {
			// Server-side only. `bodyText` is the webhook's own words and routinely
			// repeats the URL back at us ("the requested webhook is not
			// registered"), which is why it is logged here and never returned.
			console.error("[eps-backend] activation-fee webhook failed", {
				rid: c.get("rid"),
				status: res?.status ?? null,
				transportError,
				body: bodyText.slice(0, 500),
			});
			throw new AppError(
				502,
				"ACTIVATION_FEE_SEND_FAILED",
				// Naming the status turns "it just fails" into something the partner
				// can quote and ops can act on without reading a log.
				res
					? `Couldn't send your payment details — the mail service answered ${res.status}. Please try again, or email eps@eko.in.`
					: "Couldn't reach the mail service to send your payment details. Please try again, or email eps@eko.in.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({
			message:
				"Thanks — we've sent your payment details to Team Eko. Finance will confirm once the transfer is reconciled.",
		});
	});
}
