import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { SessionClaim, Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import type { NotificationView } from "./notificationsView";
import { normalizeNotifications } from "./notificationsView";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";

/** `interaction_type_id` for the notification list. */
const LIST_INTERACTION = 10010;

/** `interaction_type_id` for a read/dismissed status update. */
const STATUS_INTERACTION = 10012;

/** `interaction_type_id` for a delivery-status update. */
const DELIVERY_INTERACTION = 10023;

/** `notification_status` value meaning READ. DISMISSED (2) has no caller here. */
const STATUS_READ = 1;

/** `delivery_status` value meaning "delivered by a pull", i.e. by this fetch. */
const DELIVERY_PULL = 2;

/**
 * Polls per session per `RL_WINDOW_SEC`. The window is 600s and so is the poll
 * period, and the window is FIXED rather than sliding, so one honest tab can
 * legitimately land two polls inside one window at the boundary. 30 leaves room
 * for a partner with several tabs open and still bounds a scripted caller.
 */
const LIST_LIMIT = 30;

/** Read-marks per session per window, on its own counter so opening a dozen
 * notifications cannot starve the poll above. */
const READ_LIMIT = 60;

/**
 * Delivery marks issued per poll.
 *
 * Uncapped, a partner returning after a month would turn one poll into ~200
 * concurrent upstream calls. Whatever is left over still reports
 * `delivery_status: 0` next time, so nothing is lost — it just catches up.
 */
const MAX_DELIVERY_MARKS = 20;

/** Concurrent delivery marks in flight. */
const DELIVERY_CONCURRENCY = 5;

/** Trims an untrusted upstream string to a bounded one, for error messages. */
function text(value: unknown, max = 200): string {
	return typeof value === "string" ? value.slice(0, max) : "";
}

/** A notification id as it may appear in a path. */
const NOTIFICATION_ID = /^\d{1,12}$/;

/**
 * Mounts the console's notification endpoints.
 *
 * Mounted unconditionally and answering 501 under the `eko` provider, for the
 * reason `mountDashboard` is: a named 501 lets the console decide not to show a
 * bell, where a 404 is indistinguishable from a routing bug.
 *
 * BOTH routes are POST, including the list. The list runs an upstream
 * transaction AND marks delivery, so it is neither safe nor idempotent, and a
 * link prefetcher or a retrying proxy must not be able to trigger it.
 *
 * CSRF: these are cookie-authenticated mutations, protected the same way every
 * other POST here is — `app.ts` installs `cors({ origin: cfg.corsOrigins,
 * credentials: true })`, and a JSON content type forces a preflight that an
 * unlisted origin fails.
 * @param app - The Hono app.
 * @param deps - Session verifier, auth provider, connect client (absent under
 *   the `eko` provider) and KV for the rate limiter.
 */
export function mountNotifications(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		auth: AuthProvider;
		connect?: ConnectClient;
		kv: KV;
	},
): void {
	const { sessions, auth, connect, kv } = deps;

	// ponytail: third copy of this gate (see dashboard.ts and connect.ts). Their
	// 501 codes and role rules differ, so extracting it now means editing two
	// working routes to add one. Lift it into a shared helper when a fourth
	// appears.
	/** Resolves the caller's claim, or throws unless this session can be served. */
	async function requireNotificationSession(
		c: Context<AppEnv>,
	): Promise<SessionClaim> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account has no notifications.",
			);
		}
		if (!connect || !claim.sid || !auth.getUpstream) {
			throw new AppError(
				501,
				"NOTIFICATIONS_UNAVAILABLE",
				"Notifications aren't available on this deployment.",
			);
		}
		return claim;
	}

	/** Opens the sealed upstream session. Mirrors `requireUpstream` in `dashboard.ts`. */
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
	 * Tells upstream that these items reached the user through a pull.
	 *
	 * BEST EFFORT, AT MOST ONCE — started before the response is written and
	 * deliberately not awaited, so a partner never waits on bookkeeping they
	 * cannot see. A deploy, a crash or a torn-down connection can lose a mark;
	 * the cost is that upstream re-reports the item as undelivered on the next
	 * poll, which is exactly what this function then retries. If this service is
	 * ever moved onto a serverless/edge runtime — where the process may be frozen
	 * the instant the response is flushed — these calls must be awaited instead.
	 *
	 * Each call carries its own `.catch()`: an unhandled rejection in a floating
	 * promise takes down the Node process.
	 * @param items - The list just served.
	 */
	function markDelivered(
		items: NotificationView[],
		upstream: UpstreamSession,
		xRealIp?: string,
	): void {
		const pending = items
			.filter((item) => item.fresh)
			.slice(0, MAX_DELIVERY_MARKS);
		if (pending.length === 0) return;

		const queue = [...pending];
		/** Drains the queue, `DELIVERY_CONCURRENCY` calls in flight at a time. */
		const worker = async (): Promise<void> => {
			for (let item = queue.shift(); item; item = queue.shift()) {
				await connect!
					.interact(
						upstream.accessToken,
						{
							// Same reason as the read call: every EMS interaction carries it.
							source: "EPS",
							interaction_type_id: DELIVERY_INTERACTION,
							notification_id: item.id,
							delivery_status: DELIVERY_PULL,
						},
						{ xRealIp },
					)
					.catch((e: unknown) => {
						console.warn(
							`[notifications] deliver ${item.id}: ${e instanceof Error ? e.message : String(e)}`,
						);
					});
			}
		};
		void Promise.all(
			Array.from({ length: Math.min(DELIVERY_CONCURRENCY, queue.length) }, () =>
				worker(),
			),
		).catch(() => {});
	}

	/**
	 * POST /notifications → { notifications }
	 *
	 * Not cached in KV, unlike `/dashboard`, and that is a correctness decision
	 * rather than an omission:
	 *   - `read` is mutated by `POST /notifications/:id/read` AND by Eloka, so a
	 *     TTL'd list would keep the bell's unread bubble lit for the length of the
	 *     TTL after the user had cleared it.
	 *   - the delivery pass must see upstream's real `delivery_status`; a cache
	 *     hit would either skip the marking or replay it.
	 *   - the browser polls once per ten minutes. There is nearly nothing to save.
	 * The rate limiter, not a cache, is what protects upstream here.
	 */
	app.post("/notifications", async (c) => {
		const claim = await requireNotificationSession(c);
		// Keyed on `sub`, not `sid`: a session id changes on every sign-in, which
		// would both reset the quota and leave a new KV key behind each time.
		await enforceRateLimit(
			kv,
			`rl:notif:${claim.sub}`,
			LIST_LIMIT,
			RL_WINDOW_SEC,
		);

		const xRealIp = c.req.header("x-real-ip");
		const upstream = await requireUpstream(claim);
		const envelope = await connect!.interact(
			upstream.accessToken,
			{
				// client_ref_id is added by the connect client, so a browser-sent one
				// can never be replayed here.
				interaction_type_id: LIST_INTERACTION,
				source: "EPS",
			},
			{ xRealIp },
		);
		// connect-api answers HTTP 200 for business failures, so the envelope is
		// what decides — the rule every route in `connect.ts` follows.
		if (Number(envelope.status ?? -1) !== 0) {
			throw AppError.fromUpstream(
				502,
				"NOTIFICATIONS_FAILED",
				text(envelope.message) || "Couldn't load your notifications right now.",
			);
		}

		const notifications = normalizeNotifications(envelope, Date.now());
		markDelivered(notifications, upstream, xRealIp);

		c.header("Cache-Control", "no-store");
		return c.json({ notifications });
	});

	/**
	 * POST /notifications/:id/read
	 *
	 * `notification_status` is hard-coded to READ: DISMISSED has no caller in the
	 * console, and an upstream status enum is not something the browser should be
	 * able to choose.
	 */
	app.post("/notifications/:id/read", async (c) => {
		const claim = await requireNotificationSession(c);
		await enforceRateLimit(
			kv,
			`rl:notif:read:${claim.sub}`,
			READ_LIMIT,
			RL_WINDOW_SEC,
		);

		const raw = c.req.param("id");
		if (!NOTIFICATION_ID.test(raw)) {
			throw new AppError(400, "INVALID_INPUT", "notification id is invalid");
		}

		const upstream = await requireUpstream(claim);
		const envelope = await connect!.interact(
			upstream.accessToken,
			{
				// `source` is sent here as it is on the list call. Eloka's fetcher adds
				// it to EVERY interaction, and the EMS interactions are the ones that
				// read it — omitting it is the difference between a call upstream
				// accepts and one it rejects with a non-zero envelope.
				source: "EPS",
				interaction_type_id: STATUS_INTERACTION,
				// A NUMBER, never the path string: upstream is lenient about types and
				// this is the field that decides whose row is updated.
				notification_id: Number(raw),
				notification_status: STATUS_READ,
			},
			{ xRealIp: c.req.header("x-real-ip") },
		);
		// Only an EXPLICIT non-zero status is a failure.
		//
		// `Number(envelope.status ?? -1) !== 0` — the rule the list call uses, and
		// what this used to do — turns a MISSING `status` into a 502, and a status
		// update is exactly the interaction that need not answer with the usual
		// data envelope. Eloka is the evidence: `updateEMS` fires 10012/10023 and
		// never inspects the response at all, only the transport error, so nothing
		// upstream ever promised a `status: 0` here. HTTP 200 with no business
		// failure is an accepted update.
		const status = envelope.status;
		const refused =
			status !== undefined && status !== null && Number(status) !== 0;
		if (refused || status === undefined) {
			// Logged either way: on a refusal because the browser only shows
			// "couldn't update" and upstream's reason is the only thing that says why,
			// and on a silent success because the envelope's SHAPE is the thing this
			// service was guessing at. Keys and upstream's own status/message only —
			// never a notification's contents.
			console.warn(
				`[notifications] read ${raw} ${refused ? "refused" : "answered without a status"}:` +
					` status=${text(String(status ?? "-"), 16)}` +
					` response_status_id=${text(String(envelope.response_status_id ?? "-"), 16)}` +
					` message=${text(envelope.message)}` +
					` keys=[${Object.keys(envelope).join(", ")}]`,
			);
		}
		if (refused) {
			throw AppError.fromUpstream(
				502,
				"NOTIFICATION_UPDATE_FAILED",
				text(envelope.message) || "Couldn't update that notification.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({ ok: true });
	});
}
