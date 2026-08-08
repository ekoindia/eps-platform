import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { NotificationView } from "@/lib/notifications";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markReadMock = vi.fn();
let items: NotificationView[] = [];

let panelRequest: (() => void) | null = null;

vi.mock("@/lib/notifications", () => ({
	useNotifications: () => ({
		items,
		unread: items.filter((item) => !item.read).length,
	}),
	markNotificationRead: (id: number) => markReadMock(id),
	subscribeNotificationPanel: (listener: () => void) => {
		panelRequest = listener;
		return () => {
			panelRequest = null;
		};
	},
}));

function item(overrides: Partial<NotificationView> = {}): NotificationView {
	return {
		id: 1,
		title: "Scheduled maintenance",
		body: "AePS is down Sunday",
		preview: ["AePS is down Sunday"],
		markdown: false,
		notifyTime: "2026-08-01T08:30:00.000Z",
		priority: 2,
		state: 1,
		read: false,
		fresh: true,
		...overrides,
	};
}

beforeEach(() => {
	markReadMock.mockReset();
	items = [];
});

describe("NotificationBell", () => {
	it("renders nothing while the list is empty", () => {
		// The prerender/first-paint contract: the store's server snapshot is empty,
		// so the bell must be absent from both trees or hydration mismatches.
		const { container } = render(<NotificationBell />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the unread count and names it for a screen reader", () => {
		items = [item({ id: 1 }), item({ id: 2, read: true })];
		render(<NotificationBell />);

		expect(
			screen.getByRole("button", { name: "Notifications, 1 unread" }),
		).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();
	});

	it("drops the count once everything is read", () => {
		items = [item({ read: true })];
		render(<NotificationBell />);

		expect(
			screen.getByRole("button", { name: "Notifications" }),
		).toBeInTheDocument();
		expect(screen.queryByText("1")).not.toBeInTheDocument();
	});

	it("caps the badge so a long list cannot stretch the header", () => {
		items = Array.from({ length: 12 }, (_, i) => item({ id: i + 1 }));
		render(<NotificationBell />);
		expect(screen.getByText("9+")).toBeInTheDocument();
	});

	it("opens its panel when something asks for the full list", () => {
		items = [item({ id: 7, title: "Rate limits change" })];
		render(<NotificationBell />);
		expect(screen.queryByText("Rate limits change")).not.toBeInTheDocument();

		// What the console card's "View all" does, through the store.
		act(() => panelRequest?.());

		expect(screen.getByText("Rate limits change")).toBeInTheDocument();
	});

	it("marks a notification read when its row is opened", () => {
		items = [item({ id: 42, title: "Rate limits change" })];
		render(<NotificationBell />);

		fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
		fireEvent.click(screen.getByText("Rate limits change"));

		expect(markReadMock).toHaveBeenCalledWith(42);
	});
});
