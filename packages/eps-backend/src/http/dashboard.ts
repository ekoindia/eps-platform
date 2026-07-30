import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createHash, randomInt } from "node:crypto";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { SessionClaim, Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import type { KV } from "../store/kv";
import type { DashboardView, ServiceRef } from "./dashboardView";
import {
	buildDashboardView,
	parseServiceList,
	REQUEST_KEYS,
} from "./dashboardView";
import { istRange, parsePreset } from "./dashboardRange";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";

/** `interaction_type_id` for the business-dashboard aggregates. */
const DASHBOARD_INTERACTION = 682;

/** `interaction_type_id` for the `tx_typeid` → service-name master list. */
const SERVICE_LIST_INTERACTION = 1044;

/**
 * Dashboard reads per session per `RL_WINDOW_SEC`. One per page load plus one
 * per preset the user clicks; a curious human lands well under this, and the
 * response is cached anyway, so this only bites a scripted caller.
 */
const DASHBOARD_LIMIT = 60;

/**
 * How long a rendered view stays fresh.
 *
 * `today` moves continuously, so it gets the short window. Every other preset
 * ends at yesterday 23:59:59 — a closed window whose numbers cannot change — so
 * it gets the long one.
 */
const TTL_TODAY_SEC = 60;
const TTL_CLOSED_SEC = 900;

/** How long the service-name list stays fresh. It changes when Eko adds a product. */
const TTL_SERVICES_SEC = 3600;

/** Shape of a `tx_typeid` filter, before it is checked against the master list. */
const TYPE_ID = /^\d{1,10}$/;

/**
 * A fresh 20-digit `client_ref_id`, in the shape connect-api's samples use.
 *
 * Built here and never accepted from the browser, so one caller cannot replay or
 * collide with another's reference. Mirrors `kycClientRefId` in `connect.ts`.
 */
function clientRefId(): string {
	const stamp = String(Date.now()).slice(-13).padStart(13, "0");
	return `${stamp}${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
}

/**
 * A short, stable tag for the upstream this deployment talks to.
 *
 * It goes into every cache key. Without it, a UAT and a production instance
 * sharing one Redis would collide on `dash:<mobile>:<preset>` and serve UAT
 * numbers to a live partner — the keys are otherwise identical, because the
 * mobile is the same person in both.
 * @param baseUrl - The configured connect-api base URL.
 * @returns Eight hex characters.
 */
function scopeTagOf(baseUrl: string): string {
	return createHash("sha256").update(baseUrl).digest("hex").slice(0, 8);
}

/** Trims an untrusted upstream string to a bounded one, for error messages. */
function text(value: unknown, max = 200): string {
	return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Mounts the console's business-dashboard endpoint.
 *
 * ONE route for all four datasets rather than one route each: they share a date
 * range, a service-name map, a cache entry and a loading state, and upstream
 * serves them in a single interaction — four routes would refetch the name map
 * four times and quadruple the browser's round-trips for one screen.
 *
 * Unlike `mountConnect`, this route is mounted unconditionally and answers 501
 * under the `eko` provider rather than being absent. Those routes hand out
 * CREDENTIALS, so not existing is the right answer there; this one hands out
 * aggregate counts, and a named 501 lets the console say "not on this
 * deployment" instead of guessing at a 404.
 * @param app - The Hono app.
 * @param deps - Session verifier, auth provider, connect client (absent under
 *   the `eko` provider), KV, and the configured connect-api base URL.
 */
export function mountDashboard(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		auth: AuthProvider;
		connect?: ConnectClient;
		kv: KV;
		connectBaseUrl?: string;
	},
): void {
	const { sessions, auth, connect, kv } = deps;
	const scopeTag = scopeTagOf(deps.connectBaseUrl ?? "none");

	/** Resolves the caller's claim, or throws unless this session can be served. */
	async function requireDashboardSession(
		c: Context<AppEnv>,
	): Promise<SessionClaim> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account has no business dashboard.",
			);
		}
		if (!connect || !claim.sid || !auth.getUpstream) {
			throw new AppError(
				501,
				"DASHBOARD_UNAVAILABLE",
				"Business analytics aren't available on this deployment.",
			);
		}
		return claim;
	}

	/** Opens the sealed upstream session. Mirrors `requireUpstream` in `connect.ts`. */
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
	 * The `tx_typeid` → name list, cached per account.
	 *
	 * A failure here is NOT fatal: the dashboard still renders with `Service <id>`
	 * labels, which is a far better answer than a red box because a secondary
	 * lookup blinked. Only a non-empty result is cached — caching `[]` would pin
	 * the degraded labels in place for the next hour.
	 */
	async function loadServices(
		claim: SessionClaim,
		upstream: UpstreamSession,
		xRealIp?: string,
	): Promise<ServiceRef[]> {
		const key = `dash:svc:${scopeTag}:${claim.sub}`;
		// Cache reads/writes here are best-effort: a store outage should cost a
		// cache miss (recompute upstream), not a 503. Auth, session and the rate
		// limiter above stay fail-closed — only the dash:* cache is expendable.
		const cached = await kv.get(key).catch(() => null);
		if (cached) return JSON.parse(cached) as ServiceRef[];

		let services: ServiceRef[] = [];
		try {
			const envelope = await connect!.interact(
				upstream.accessToken,
				{
					interaction_type_id: SERVICE_LIST_INTERACTION,
					client_ref_id: clientRefId(),
					source: "EPS",
				},
				{ xRealIp },
			);
			services = parseServiceList(envelope);
		} catch (e) {
			console.warn(
				`[dashboard] service list unavailable: ${e instanceof Error ? e.message : String(e)}`,
			);
			return [];
		}
		if (services.length > 0) {
			await kv
				.set(key, JSON.stringify(services), TTL_SERVICES_SEC)
				.catch(() => {});
		}
		return services;
	}

	/**
	 * POST /dashboard → DashboardView
	 *
	 * POST, not GET, for the reason `/connect/kyc/documents` is: this runs a
	 * transaction upstream rather than reading a cacheable resource, and the body
	 * is one partner's business numbers, which must never sit in a proxy cache.
	 *
	 * The accepted body is exactly `{ preset, typeId? }`. A `datefrom`/`dateto`
	 * pair from the browser is ignored, never forwarded: an arbitrary window is
	 * an unbounded upstream scan, and the preset enum both bounds it and makes
	 * the cache key derivable.
	 */
	app.post("/dashboard", async (c) => {
		const claim = await requireDashboardSession(c);
		await enforceRateLimit(
			kv,
			`rl:dash:${claim.sid}`,
			DASHBOARD_LIMIT,
			RL_WINDOW_SEC,
		);

		const body = await c.req.json().catch(() => ({}));
		const preset = parsePreset((body as { preset?: unknown }).preset);
		const rawTypeId = (body as { typeId?: unknown }).typeId;
		let typeId: string | undefined;
		if (rawTypeId !== undefined && rawTypeId !== null && rawTypeId !== "") {
			typeId = String(rawTypeId).trim();
			if (!TYPE_ID.test(typeId)) {
				throw new AppError(400, "INVALID_INPUT", "typeId is invalid");
			}
		}

		const xRealIp = c.req.header("x-real-ip");
		const cacheKey = `dash:${scopeTag}:${claim.sub}:${preset}:${typeId ?? "all"}`;
		// Best-effort read — see loadServices. A dead store degrades to a cache
		// miss and the upstream call below, never a 503.
		const cached = await kv.get(cacheKey).catch(() => null);
		if (cached) {
			c.header("Cache-Control", "no-store");
			return c.json(JSON.parse(cached) as DashboardView);
		}

		const upstream = await requireUpstream(claim);
		const range = istRange(preset);
		// `typeid` is only meaningful on the two per-service datasets; upstream
		// takes dates alone for the other two.
		const filtered = typeId ? { ...range, typeid: typeId } : range;

		/** The dashboard aggregate itself. Started before it is awaited. */
		const dashboardCall = () =>
			connect!.interactJson(
				upstream.accessToken,
				{
					source: "EPS",
					client_ref_id: clientRefId(),
					interaction_type_id: DASHBOARD_INTERACTION,
					requestPayload: {
						[REQUEST_KEYS.overview]: filtered,
						[REQUEST_KEYS.mostUsedServices]: filtered,
						[REQUEST_KEYS.successRates]: range,
						[REQUEST_KEYS.usage]: range,
					},
				},
				{ xRealIp },
			);

		// The two upstream calls are INDEPENDENT — 1044 names services, 682
		// counts them — so the unfiltered case runs them concurrently and the
		// partner waits for the slower one rather than for their sum.
		//
		// A `typeId` filter is the one case that must stay sequential: the name
		// list is what says whether that id is real, and it has to say so before
		// the id is forwarded upstream.
		let services: ServiceRef[];
		let envelope: Record<string, unknown>;
		if (typeId) {
			services = await loadServices(claim, upstream, xRealIp);
			// Membership is checked only when the list actually loaded. Rejecting a
			// filter because the SECONDARY lookup failed would turn a cosmetic
			// outage into a broken filter; the regex above already bounds what goes
			// upstream.
			if (services.length > 0 && !services.some((s) => s.typeId === typeId)) {
				throw new AppError(
					400,
					"INVALID_INPUT",
					"typeId is not a known service",
				);
			}
			envelope = await dashboardCall();
		} else {
			[services, envelope] = await Promise.all([
				loadServices(claim, upstream, xRealIp),
				dashboardCall(),
			]);
		}

		// connect-api answers HTTP 200 for business failures, so the envelope is
		// what decides — same rule every route in `connect.ts` follows.
		if (Number(envelope.status ?? -1) !== 0) {
			throw new AppError(
				502,
				"DASHBOARD_FAILED",
				text(envelope.message) || "Couldn't load your dashboard right now.",
			);
		}

		const dashboardObject = (
			envelope.data as { dashboard_object?: unknown } | undefined
		)?.dashboard_object;
		const { view, absent } = buildDashboardView({
			preset,
			range,
			dashboardObject,
			services,
		});

		// An absent dataset is not the same as a zero one, and only the log can
		// tell them apart later: zeros are what a quiet week looks like, absences
		// are what an upstream contract change or an out-of-scope account looks
		// like. This is the first place a 682 scope problem would show up.
		if (absent.length > 0) {
			console.warn(`[dashboard] absent datasets: ${absent.join(", ")}`);
		}

		await kv
			.set(
				cacheKey,
				JSON.stringify(view),
				preset === "today" ? TTL_TODAY_SEC : TTL_CLOSED_SEC,
			)
			.catch(() => {});

		c.header("Cache-Control", "no-store");
		return c.json(view);
	});
}
