import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider } from "../auth/provider";
import type { Sessions } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import { createInMemoryKV, type KV } from "../store/kv";
import { AppError, errorBody } from "./errors";
import { mountNotifications } from "./notifications";
import type { NotificationView } from "./notificationsView";
import type { AppEnv } from "./requestId";

const upstream = {
	accessToken: "full-token",
	accessTokenLite: "lite",
	accessExpiresAt: Date.now() + 60_000,
};

/** A plain, in-date, unread NORMAL notification. */
function item(overrides: Record<string, unknown> = {}) {
	return {
		id: 352,
		notification_type: 0,
		title: "Scheduled maintenance",
		desc: "AePS will be unavailable\n\non Sunday 02:00–04:00 IST",
		notify_time: "2021-03-05 14:00:00",
		priority: 2,
		read: 0,
		delivery_status: 0,
		...overrides,
	};
}

/** A successful interaction-10010 envelope. */
function envelope(notifications: unknown[]) {
	return { status: 0, message: "ok", data: { notifications } };
}

function harness(
	opts: {
		role?: string | null;
		sid?: string | null;
		connect?: Partial<ConnectClient> | null;
		upstreamSession?: unknown;
		kv?: KV;
		notifications?: unknown[];
	} = {},
) {
	const role = opts.role === undefined ? "developer" : opts.role;
	const sid = opts.sid === undefined ? "sid-1" : opts.sid;
	const app = new Hono<AppEnv>();
	// Mirrors app.ts's onError so status/code assertions match production.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message, undefined, err.source), err.status as never);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});

	const sessions = {
		verifyAccess: vi
			.fn()
			.mockResolvedValue(
				role
					? { sub: "9990000001", role, orgId: 1, sid: sid ?? undefined }
					: null,
			),
	} as unknown as Sessions;

	const auth = {
		name: "connect",
		getUpstream: vi
			.fn()
			.mockResolvedValue(
				opts.upstreamSession === undefined ? upstream : opts.upstreamSession,
			),
	} as unknown as AuthProvider;

	const interact = vi.fn(
		async (_token: string, body: Record<string, unknown>) =>
			body.interaction_type_id === 10010
				? envelope(opts.notifications ?? [item()])
				: { status: 0, message: "ok" },
	);
	const connect =
		opts.connect === null
			? undefined
			: ({ interact, ...opts.connect } as unknown as ConnectClient);

	mountNotifications(app, {
		sessions,
		auth,
		connect,
		kv: opts.kv ?? createInMemoryKV(),
	});
	return { app, interact };
}

/** POSTs the list route with the session cookie attached. */
function load(app: Hono<AppEnv>) {
	return app.request("/notifications", {
		method: "POST",
		headers: { Cookie: "eps_at=token" },
	});
}

/** The list a successful call returned. */
async function listOf(res: Response): Promise<NotificationView[]> {
	return ((await res.json()) as { notifications: NotificationView[] })
		.notifications;
}

async function errorOf(res: Response): Promise<{ code: string }> {
	return ((await res.json()) as { error: { code: string } }).error;
}

/** Bodies of the calls made with a given interaction id. */
function callsOf(
	interact: ReturnType<typeof vi.fn>,
	interactionId: number,
): Record<string, unknown>[] {
	return interact.mock.calls
		.map((call) => call[1] as Record<string, unknown>)
		.filter((body) => body.interaction_type_id === interactionId);
}

describe("notifications route gate", () => {
	it("401s without a session cookie", async () => {
		const { app } = harness({ role: null });
		const res = await app.request("/notifications", { method: "POST" });
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ role: "admin" });
		const res = await load(app);
		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("501s where there is no connect client", async () => {
		const { app } = harness({ connect: null });
		const res = await load(app);
		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("NOTIFICATIONS_UNAVAILABLE");
	});

	it("401s when the sealed upstream session is gone", async () => {
		const { app } = harness({ upstreamSession: null });
		const res = await load(app);
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("CONNECT_SESSION_EXPIRED");
	});

	it("502s when the envelope reports a business failure", async () => {
		const { app } = harness({
			connect: {
				interact: vi.fn(async () => ({ status: 1, message: "nope" })),
			} as Partial<ConnectClient>,
		});
		const res = await load(app);
		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("NOTIFICATIONS_FAILED");
	});

	it("503s when the rate-limit store is unreachable", async () => {
		const kv = {
			get: async () => null,
			set: async () => {},
			incr: async () => {
				throw new Error("store down");
			},
		} as unknown as KV;
		const { app } = harness({ kv });
		const res = await load(app);
		expect(res.status).toBe(503);
		expect((await errorOf(res)).code).toBe("RATE_LIMIT_UNAVAILABLE");
	});

	it("rate-limits on the stable subject, not the session id", async () => {
		const seen: string[] = [];
		const inner = createInMemoryKV();
		const kv = {
			...inner,
			incr: async (key: string, ttl: number) => {
				seen.push(key);
				return inner.incr(key, ttl);
			},
		} as unknown as KV;
		const { app } = harness({ kv });
		await load(app);
		expect(seen).toEqual(["rl:notif:9990000001"]);
	});
});

describe("notifications normalization", () => {
	it("serves only NORMAL notifications", async () => {
		const { app } = harness({
			notifications: [
				item({ id: 1, title: "Announcement" }),
				item({ id: 2, notification_type: 1, title: "COMMAND-clear-cache" }),
				item({ id: 3, notification_type: 2, title: "Earn with AePS" }),
				item({ id: 4, notification_type: 3, title: "Customer ad" }),
			],
		});
		const res = await load(app);
		const body = await res.text();
		expect(body).not.toContain("Earn with AePS");
		expect(body).not.toContain("COMMAND-clear-cache");
		expect(body).not.toContain("Customer ad");
		expect(JSON.parse(body).notifications).toHaveLength(1);
	});

	it("treats a missing type as NORMAL but drops an unparseable one", async () => {
		const { app } = harness({
			notifications: [
				item({ id: 1, notification_type: undefined }),
				item({ id: 2, notification_type: "0" }),
				item({ id: 3, notification_type: "banner" }),
			],
		});
		const list = await listOf(await load(app));
		expect(list.map((n) => n.id).sort()).toEqual([1, 2]);
	});

	it("reads notify_time as an IST wall clock", async () => {
		const { app } = harness({
			notifications: [item({ notify_time: "2021-03-05 14:00:00" })],
		});
		const [only] = await listOf(await load(app));
		// 14:00 IST is 08:30 UTC.
		expect(only.notifyTime).toBe("2021-03-05T08:30:00.000Z");
	});

	it("falls back to now when notify_time is unparseable", async () => {
		const { app } = harness({
			notifications: [item({ notify_time: "yesterday-ish" })],
		});
		const [only] = await listOf(await load(app));
		expect(Date.parse(only.notifyTime)).toBeLessThanOrEqual(Date.now());
		expect(Date.now() - Date.parse(only.notifyTime)).toBeLessThan(10_000);
	});

	it("drops expired and not-yet-due items", async () => {
		const future = new Date(Date.now() + 86_400_000)
			.toISOString()
			.slice(0, 19)
			.replace("T", " ");
		const { app } = harness({
			notifications: [
				item({ id: 1 }),
				item({ id: 2, expiry_time: "2020-03-18 15:11:00" }),
				// Scheduled: upstream sent it early. `notify_time` is compared in IST,
				// so a UTC "tomorrow" is unambiguously in the future either way.
				item({ id: 3, notify_time: future }),
			],
		});
		const list = await listOf(await load(app));
		expect(list.map((n) => n.id)).toEqual([1]);
	});

	it("dedupes by id, never by content", async () => {
		const { app } = harness({
			notifications: [
				item({ id: 1, notify_time: "2021-03-05 14:00:00" }),
				// Same text, different notification. Must survive.
				item({ id: 2, notify_time: "2021-03-04 14:00:00" }),
				// Same id. Must collapse.
				item({ id: 1, notify_time: "2021-03-05 14:00:00" }),
			],
		});
		const list = await listOf(await load(app));
		expect(list.map((n) => n.id)).toEqual([1, 2]);
	});

	it("sorts newest first and caps the list at 50", async () => {
		const many = Array.from({ length: 60 }, (_, i) =>
			item({
				id: i + 1,
				notify_time: `2021-03-05 ${String(i % 24).padStart(2, "0")}:00:00`,
			}),
		);
		const { app } = harness({ notifications: many });
		const list = await listOf(await load(app));
		expect(list).toHaveLength(50);
		expect(Date.parse(list[0].notifyTime)).toBeGreaterThanOrEqual(
			Date.parse(list[1].notifyTime),
		);
	});

	it("keeps absolute links and drops relative and javascript ones", async () => {
		const { app } = harness({
			notifications: [
				item({ id: 1, link: "https://eko.in/x", link_label: "Open" }),
				item({ id: 2, link: "/transaction/252/626", link_label: "Start" }),
				item({ id: 3, link: "javascript:alert(1)", link_label: "Click" }),
			],
		});
		const list = await listOf(await load(app));
		const byId = new Map(list.map((n) => [n.id, n]));
		expect(byId.get(1)?.link).toBe("https://eko.in/x");
		expect(byId.get(1)?.linkLabel).toBe("Open");
		expect(byId.get(2)?.link).toBeUndefined();
		// A label with no link is a button that does nothing.
		expect(byId.get(2)?.linkLabel).toBeUndefined();
		expect(byId.get(3)?.link).toBeUndefined();
	});

	it("keeps https media only, and validates youtube and qr payloads", async () => {
		const { app } = harness({
			notifications: [
				item({
					id: 1,
					image: "http://files.eko.co.in/a.png",
					youtube: "https://youtu.be/sJRRC0YaK5A",
					qr_code: "x".repeat(4096),
				}),
				item({
					id: 2,
					image: "https://files.eko.co.in/a.png",
					youtube: "sJRRC0YaK5A",
					qr_code: "upi://pay?pa=eko@bank",
				}),
			],
		});
		const byId = new Map((await listOf(await load(app))).map((n) => [n.id, n]));
		expect(byId.get(1)?.image).toBeUndefined();
		expect(byId.get(1)?.youtube).toBeUndefined();
		expect(byId.get(1)?.qrCode).toBeUndefined();
		expect(byId.get(2)?.image).toBe("https://files.eko.co.in/a.png");
		expect(byId.get(2)?.youtube).toBe("sJRRC0YaK5A");
		expect(byId.get(2)?.qrCode).toBe("upi://pay?pa=eko@bank");
	});

	it("flags markdown and strips its syntax out of the preview", async () => {
		const { app } = harness({
			notifications: [
				item({
					markdown: 1,
					desc: "## **Heads up**\n\nSee [the docs](https://eko.in/docs)",
				}),
			],
		});
		const [only] = await listOf(await load(app));
		expect(only.markdown).toBe(true);
		expect(only.body).toContain("## **Heads up**");
		expect(only.preview).toEqual(["Heads up", "See the docs"]);
	});

	it("survives a malformed payload instead of throwing", async () => {
		const { app } = harness({
			notifications: [
				item({ id: "352", desc: undefined, priority: 99, state: "x" }),
				item({ id: 0 }),
				item({ id: null }),
				"not an object",
				null,
			],
		});
		const res = await load(app);
		expect(res.status).toBe(200);
		const list = await listOf(res);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({
			id: 352,
			body: "",
			preview: [],
			priority: 2,
			state: 1,
		});
	});

	it("returns an empty list when upstream sends no notifications array", async () => {
		const { app } = harness({
			connect: {
				interact: vi.fn(async () => ({ status: 0, data: {} })),
			} as Partial<ConnectClient>,
		});
		expect(await listOf(await load(app))).toEqual([]);
	});
});

describe("notifications delivery marking", () => {
	it("marks exactly the undelivered items, and never the delivered ones", async () => {
		const { app, interact } = harness({
			notifications: [
				item({ id: 1, delivery_status: 0 }),
				item({ id: 2, delivery_status: 2 }),
			],
		});
		await load(app);
		// The fan-out is deliberately not awaited; let its microtasks drain.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const marks = callsOf(interact, 10023);
		expect(marks).toEqual([
			{
				source: "EPS",
				interaction_type_id: 10023,
				notification_id: 1,
				delivery_status: 2,
			},
		]);
	});

	it("caps the fan-out at 20 per poll", async () => {
		const { app, interact } = harness({
			notifications: Array.from({ length: 40 }, (_, i) =>
				item({ id: i + 1, notify_time: "2021-03-05 14:00:00" }),
			),
		});
		await load(app);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(callsOf(interact, 10023)).toHaveLength(20);
	});

	it("still answers 200 when the marking fails", async () => {
		const interact = vi.fn(
			async (_t: string, body: Record<string, unknown>) => {
				if (body.interaction_type_id === 10023)
					throw new Error("upstream down");
				return envelope([item()]);
			},
		);
		const { app } = harness({
			connect: { interact } as unknown as Partial<ConnectClient>,
		});
		const res = await load(app);
		expect(res.status).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
});

describe("notifications read route", () => {
	it("rejects a non-numeric id", async () => {
		const { app } = harness();
		const res = await app.request("/notifications/abc/read", {
			method: "POST",
			headers: { Cookie: "eps_at=token" },
		});
		expect(res.status).toBe(400);
		expect((await errorOf(res)).code).toBe("INVALID_INPUT");
	});

	it("marks read with a numeric id and a fixed status", async () => {
		const { app, interact } = harness();
		const res = await app.request("/notifications/123/read", {
			method: "POST",
			headers: { Cookie: "eps_at=token" },
		});
		expect(res.status).toBe(200);
		expect(callsOf(interact, 10012)).toEqual([
			{
				// Every EMS interaction carries `source`; omitting it is what upstream
				// refuses with a non-zero envelope.
				source: "EPS",
				interaction_type_id: 10012,
				notification_id: 123,
				notification_status: 1,
			},
		]);
	});

	it("accepts an envelope that carries no status at all", async () => {
		// What a status-update interaction may well answer with — Eloka never
		// inspected this response, so nothing promised a `status: 0`. Treating the
		// silence as failure is what made every read 502.
		const interact = vi.fn(async (_t: string, body: Record<string, unknown>) =>
			body.interaction_type_id === 10012
				? { message: "Success" }
				: envelope([item()]),
		);
		const { app } = harness({
			connect: { interact } as unknown as Partial<ConnectClient>,
		});
		const res = await app.request("/notifications/123/read", {
			method: "POST",
			headers: { Cookie: "eps_at=token" },
		});
		expect(res.status).toBe(200);
	});

	it("accepts an explicit status of zero", async () => {
		const { app } = harness();
		const res = await app.request("/notifications/123/read", {
			method: "POST",
			headers: { Cookie: "eps_at=token" },
		});
		expect(res.status).toBe(200);
	});

	it("502s when upstream refuses the update", async () => {
		const { app } = harness({
			connect: {
				interact: vi.fn(async () => ({ status: 5, message: "no such id" })),
			} as Partial<ConnectClient>,
		});
		const res = await app.request("/notifications/123/read", {
			method: "POST",
			headers: { Cookie: "eps_at=token" },
		});
		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("NOTIFICATION_UPDATE_FAILED");
	});

	it("never lets the browser choose client_ref_id", async () => {
		const { app, interact } = harness();
		await load(app);
		for (const call of interact.mock.calls) {
			expect(call[1]).not.toHaveProperty("client_ref_id");
		}
	});
});
