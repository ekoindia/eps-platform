import { NotificationsCard } from "@/components/console/NotificationsCard";
import type { NotificationView } from "@/lib/notifications";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markReadMock = vi.fn();
const panelMock = vi.fn();
let items: NotificationView[] = [];

vi.mock("@/lib/notifications", () => ({
	useNotifications: () => ({
		items,
		unread: items.filter((item) => !item.read).length,
	}),
	// The real one flips `read` in the store; here the test decides what the next
	// render sees, which is what lets the "stays open" case below be written.
	markNotificationRead: (id: number) => markReadMock(id),
	requestNotificationPanel: () => panelMock(),
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
	panelMock.mockReset();
	items = [];
});

describe("NotificationsCard", () => {
	it("lists only unread notifications", () => {
		items = [
			item({ id: 1, title: "Unread announcement" }),
			item({ id: 2, title: "Old news", read: true }),
		];
		render(<NotificationsCard />);

		expect(screen.getByText("Unread announcement")).toBeInTheDocument();
		expect(screen.queryByText("Old news")).not.toBeInTheDocument();
	});

	it("renders nothing at all once everything has been read", () => {
		items = [item({ read: true }), item({ id: 2, read: true })];
		const { container } = render(<NotificationsCard />);
		expect(container).toBeEmptyDOMElement();
	});

	it("caps the rows and offers the full list", () => {
		items = Array.from({ length: 8 }, (_, i) =>
			item({ id: i + 1, title: `Item ${i + 1}` }),
		);
		render(<NotificationsCard />);

		expect(screen.getByText("Item 5")).toBeInTheDocument();
		expect(screen.queryByText("Item 6")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /View all \(8\)/ }));
		expect(panelMock).toHaveBeenCalled();
	});

	it("offers the full list when read items are hidden, even under the row cap", () => {
		// Two unread, so the cap is not reached — but three read ones exist and
		// this card will never show them.
		items = [
			item({ id: 1 }),
			item({ id: 2 }),
			item({ id: 3, read: true }),
			item({ id: 4, read: true }),
			item({ id: 5, read: true }),
		];
		render(<NotificationsCard />);
		expect(
			screen.getByRole("button", { name: /View all \(5\)/ }),
		).toBeInTheDocument();
	});

	it("hides the link when the card is showing everything there is", () => {
		items = [item({ id: 1 }), item({ id: 2 })];
		render(<NotificationsCard />);
		expect(screen.queryByRole("button", { name: /View all/ })).toBeNull();
	});

	it("keeps the detail open after the row it came from is marked read", () => {
		items = [item({ id: 42, title: "Rate limits change" })];
		const { rerender } = render(<NotificationsCard />);

		fireEvent.click(screen.getByText("Rate limits change"));
		expect(markReadMock).toHaveBeenCalledWith(42);

		// What the store does next: the item is read, so it leaves the unread list.
		// The dialog must survive that — it is resolved against the full list.
		items = [item({ id: 42, title: "Rate limits change", read: true })];
		rerender(<NotificationsCard />);

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Rate limits change")).toBeInTheDocument();
	});
});
