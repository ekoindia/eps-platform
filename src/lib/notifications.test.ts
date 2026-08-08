import { ApiError } from "@/lib/auth/client";
import {
	markNotificationRead,
	notificationsSnapshot,
	POLL_MS,
	resetNotificationsCache,
	startNotificationsPolling,
	type NotificationView,
} from "@/lib/notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notificationsMock = vi.fn();
const markReadMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/lib/auth/client", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth/client")>(
			"@/lib/auth/client",
		);
	return {
		...actual,
		authClient: {
			notifications: () => notificationsMock(),
			markNotificationRead: (id: number) => markReadMock(id),
		},
	};
});

vi.mock("sonner", () => ({
	toast: (title: string, opts?: unknown) => toastMock(title, opts),
}));

/** A minimal notification. */
function item(overrides: Partial<NotificationView> = {}): NotificationView {
	return {
		id: 1,
		title: "Scheduled maintenance",
		body: "Sunday 02:00",
		preview: ["Sunday 02:00"],
		markdown: false,
		notifyTime: "2026-08-01T08:30:00.000Z",
		priority: 2,
		state: 1,
		read: false,
		fresh: true,
		...overrides,
	};
}

/**
 * Drains the microtask queue.
 *
 * Several ticks, not one: `poll()` starts from a resolved promise (so a
 * synchronous client throw cannot escape into React's commit phase), so its
 * result lands a few microtasks deep.
 */
const settle = async () => {
	for (let tick = 0; tick < 5; tick++) await Promise.resolve();
};

beforeEach(() => {
	vi.useFakeTimers();
	notificationsMock.mockReset().mockResolvedValue({ notifications: [item()] });
	markReadMock.mockReset().mockResolvedValue({ ok: true });
	toastMock.mockReset();
	localStorage.clear();
	// `document.hidden` is a getter on the prototype; each test that needs a
	// hidden tab overrides it and restores here.
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
	resetNotificationsCache();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("polling lifecycle", () => {
	it("fetches once immediately and once per interval", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);
		expect(notificationsSnapshot()).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(notificationsMock).toHaveBeenCalledTimes(2);
	});

	it("starts only one timer however often it is called", async () => {
		startNotificationsPolling("user-a");
		startNotificationsPolling("user-a");
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(notificationsMock).toHaveBeenCalledTimes(2);
	});

	it("re-keys when the signed-in identity changes without a sign-out", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsSnapshot()).toHaveLength(1);

		notificationsMock.mockResolvedValueOnce({ notifications: [] });
		startNotificationsPolling("user-b");
		// The previous user's list must be gone the moment the identity changes,
		// not once the new fetch lands.
		expect(notificationsSnapshot()).toHaveLength(0);
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(2);
	});

	it("skips a tick while the tab is hidden and catches up on return", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);

		vi.spyOn(document, "hidden", "get").mockReturnValue(true);
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		expect(notificationsMock).toHaveBeenCalledTimes(1);

		vi.spyOn(document, "hidden", "get").mockReturnValue(false);
		document.dispatchEvent(new Event("visibilitychange"));
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(2);
	});

	it("does not let an in-flight response repopulate a reset cache", async () => {
		let resolve: (value: {
			notifications: NotificationView[];
		}) => void = () => {};
		notificationsMock.mockReturnValueOnce(
			new Promise((r) => {
				resolve = r;
			}),
		);

		startNotificationsPolling("user-a");
		// The session ends while the request is in the air.
		resetNotificationsCache();
		resolve({ notifications: [item({ title: "Previous user's news" })] });
		await settle();

		expect(notificationsSnapshot()).toHaveLength(0);
	});
});

describe("error handling", () => {
	it("stops permanently on a 501 and settles empty", async () => {
		notificationsMock.mockRejectedValue(
			new ApiError("NOTIFICATIONS_UNAVAILABLE", "nope", 501),
		);
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsSnapshot()).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(POLL_MS * 3);
		expect(notificationsMock).toHaveBeenCalledTimes(1);
	});

	it("keeps the last good list and keeps polling after a transient failure", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsSnapshot()).toHaveLength(1);

		notificationsMock.mockRejectedValueOnce(
			new ApiError("UPSTREAM_ERROR", "blip", 500),
		);
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(notificationsSnapshot()).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(notificationsMock).toHaveBeenCalledTimes(3);
	});
});

describe("read marking", () => {
	it("flips the snapshot before the request resolves", async () => {
		startNotificationsPolling("user-a");
		await settle();

		markNotificationRead(1);
		expect(notificationsSnapshot()[0].read).toBe(true);
		expect(markReadMock).toHaveBeenCalledWith(1);
	});

	it("does nothing for an unknown or already-read id", async () => {
		notificationsMock.mockResolvedValue({
			notifications: [item({ id: 1, read: true })],
		});
		startNotificationsPolling("user-a");
		await settle();

		markNotificationRead(1);
		markNotificationRead(999);
		expect(markReadMock).not.toHaveBeenCalled();
	});

	it("reconciles with one extra poll when the update fails", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);

		markReadMock.mockRejectedValueOnce(
			new ApiError("UPSTREAM_ERROR", "blip", 500),
		);
		markNotificationRead(1);
		await settle();
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(2);
	});

	it("does not reconcile after a terminal error", async () => {
		notificationsMock.mockRejectedValueOnce(
			new ApiError("NOT_DEVELOPER_SESSION", "nope", 403),
		);
		startNotificationsPolling("user-a");
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);

		// Nothing is in the cache to mark, but the guard is what matters: a retry
		// here would be a loop against an endpoint known not to answer.
		markNotificationRead(1);
		await settle();
		expect(notificationsMock).toHaveBeenCalledTimes(1);
	});
});

describe("toast", () => {
	it("announces the newest UNREAD item, not merely the newest", async () => {
		notificationsMock.mockResolvedValue({
			notifications: [
				item({ id: 9, title: "Already seen", read: true }),
				item({ id: 8, title: "Still unread", read: false }),
			],
		});
		startNotificationsPolling("user-a");
		await settle();

		expect(toastMock).toHaveBeenCalledTimes(1);
		expect(toastMock.mock.calls[0][0]).toBe("Still unread");
	});

	it("announces an item once, however often it is polled", async () => {
		startNotificationsPolling("user-a");
		await settle();
		await vi.advanceTimersByTimeAsync(POLL_MS);
		await vi.advanceTimersByTimeAsync(POLL_MS);

		expect(toastMock).toHaveBeenCalledTimes(1);
	});

	it("stays quiet for an item upstream had already delivered", async () => {
		notificationsMock.mockResolvedValue({
			notifications: [item({ id: 5, title: "Months old", fresh: false })],
		});
		startNotificationsPolling("user-a");
		await settle();

		expect(toastMock).not.toHaveBeenCalled();
	});

	it("announces again for a different user on the same machine", async () => {
		startNotificationsPolling("user-a");
		await settle();
		expect(toastMock).toHaveBeenCalledTimes(1);

		startNotificationsPolling("user-b");
		await settle();
		expect(toastMock).toHaveBeenCalledTimes(2);
	});

	it("gives a high-priority item a longer life", async () => {
		notificationsMock.mockResolvedValue({
			notifications: [item({ priority: 3 })],
		});
		startNotificationsPolling("user-a");
		await settle();

		const opts = toastMock.mock.calls[0][1] as { duration: number };
		expect(opts.duration).toBeGreaterThan(8_000);
	});
});
