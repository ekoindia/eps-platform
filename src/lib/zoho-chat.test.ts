import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openZohoChat, setChatIdentity } from "./zoho-chat";

vi.mock("@/hooks/use-tracking-params", () => ({
	getStoredTrackingParams: vi.fn(() => ({})),
	getCalculatorContext: vi.fn(() => null),
}));
import {
	getCalculatorContext,
	getStoredTrackingParams,
} from "@/hooks/use-tracking-params";

/** Installs a mock SalesIQ widget on window and returns its visitor spies. */
function mockWidget() {
	const visitor = {
		info: vi.fn(),
		name: vi.fn(),
		email: vi.fn(),
		contactnumber: vi.fn(),
	};
	const salesiq = {
		visitor,
		chatwindow: { visible: vi.fn() },
		chat: { start: vi.fn() },
	};
	(window as unknown as { $zoho: unknown }).$zoho = { salesiq };
	return { visitor, salesiq };
}

beforeEach(() => {
	setChatIdentity(null);
	// clearAllMocks() resets calls but keeps mockReturnValue, so restate the
	// "no attribution" default or it leaks between tests.
	vi.mocked(getStoredTrackingParams).mockReturnValue({});
	vi.mocked(getCalculatorContext).mockReturnValue(null);
});

afterEach(() => {
	vi.clearAllMocks();
	delete (window as unknown as { $zoho?: unknown }).$zoho;
});

describe("openZohoChat visitor identity", () => {
	it("identifies a logged-in visitor to the operator", () => {
		const { visitor } = mockWidget();
		setChatIdentity({
			name: "Rahul Sharma",
			email: "rahul@example.in",
			contactNumber: "9990000079",
		});

		openZohoChat();

		expect(visitor.name).toHaveBeenCalledWith("Rahul Sharma");
		expect(visitor.email).toHaveBeenCalledWith("rahul@example.in");
		expect(visitor.contactnumber).toHaveBeenCalledWith("9990000079");
	});

	it("pushes nothing identifying for an anonymous visitor", () => {
		const { visitor } = mockWidget();

		openZohoChat();

		expect(visitor.name).not.toHaveBeenCalled();
		expect(visitor.email).not.toHaveBeenCalled();
		expect(visitor.contactnumber).not.toHaveBeenCalled();
	});

	it("only pushes the fields it knows", () => {
		const { visitor } = mockWidget();
		setChatIdentity({ contactNumber: "9990000079" });

		openZohoChat();

		expect(visitor.contactnumber).toHaveBeenCalledWith("9990000079");
		expect(visitor.name).not.toHaveBeenCalled();
		expect(visitor.email).not.toHaveBeenCalled();
	});

	it("stops identifying the visitor after logout clears the identity", () => {
		const { visitor } = mockWidget();
		setChatIdentity({ name: "Rahul Sharma" });
		openZohoChat();
		expect(visitor.name).toHaveBeenCalledTimes(1);

		setChatIdentity(null);
		openZohoChat();

		expect(visitor.name).toHaveBeenCalledTimes(1);
	});

	it("still opens the chat when the widget has no identity API", () => {
		// An older widget build, or the pre-load stub in index.html.
		const salesiq = {
			visitor: { info: vi.fn() },
			chatwindow: { visible: vi.fn() },
			chat: { start: vi.fn() },
		};
		(window as unknown as { $zoho: unknown }).$zoho = { salesiq };
		setChatIdentity({ name: "Rahul Sharma" });

		expect(() => openZohoChat()).not.toThrow();
		expect(salesiq.chat.start).toHaveBeenCalled();
	});

	it("does nothing when the widget is absent", () => {
		setChatIdentity({ name: "Rahul Sharma" });
		expect(() => openZohoChat()).not.toThrow();
	});
});

describe("openZohoChat attribution", () => {
	it("still pushes tracking and calculator context alongside identity", () => {
		vi.mocked(getStoredTrackingParams).mockReturnValue({
			utm_source: "google",
		});
		vi.mocked(getCalculatorContext).mockReturnValue("AePS, DMT");
		const { visitor } = mockWidget();
		setChatIdentity({ name: "Rahul Sharma" });

		openZohoChat();

		expect(visitor.info).toHaveBeenCalledWith({
			utm_source: "google",
			apis_interested: "AePS, DMT",
		});
		expect(visitor.name).toHaveBeenCalledWith("Rahul Sharma");
	});

	it("skips visitor.info when there is no context to push", () => {
		const { visitor } = mockWidget();

		openZohoChat();

		expect(visitor.info).not.toHaveBeenCalled();
	});
});

describe("openZohoChat window handling", () => {
	it("shows the window and starts a chat", () => {
		const { salesiq } = mockWidget();

		openZohoChat();

		expect(salesiq.chatwindow.visible).toHaveBeenCalledWith("show");
		expect(salesiq.chat.start).toHaveBeenCalled();
	});
});
