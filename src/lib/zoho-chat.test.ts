import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	isChatHiddenPath,
	openZohoChat,
	setChatIdentity,
	setZohoChatHidden,
	setZohoChatOverlayHidden,
} from "./zoho-chat";

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
	delete (window as unknown as { __loadZohoWidget?: unknown }).__loadZohoWidget;
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

/**
 * Completes the stub `$zoho.salesiq` that the bootstrap (or `hookReady`) seeded
 * with the real widget APIs and fires `ready`, the way the SalesIQ script does.
 */
function finishWidgetLoad() {
	const salesiq = (
		window as unknown as {
			$zoho: { salesiq: Record<string, unknown> & { ready: () => void } };
		}
	).$zoho.salesiq;
	Object.assign(salesiq, {
		visitor: {
			info: vi.fn(),
			name: vi.fn(),
			email: vi.fn(),
			contactnumber: vi.fn(),
		},
		floatbutton: { visible: vi.fn() },
		chatwindow: { visible: vi.fn() },
		chat: { start: vi.fn() },
	});
	salesiq.ready();
	return salesiq as unknown as {
		floatbutton: { visible: ReturnType<typeof vi.fn> };
		chatwindow: { visible: ReturnType<typeof vi.fn> };
		chat: { start: ReturnType<typeof vi.fn> };
	};
}

describe("isChatHiddenPath", () => {
	it("hides chat on the signup form and console subpages", () => {
		expect(isChatHiddenPath("/signup")).toBe(true);
		expect(isChatHiddenPath("/signup/")).toBe(true);
		expect(isChatHiddenPath("/console/profile")).toBe(true);
		expect(isChatHiddenPath("/console/transaction/abc/step")).toBe(true);
	});

	it("keeps chat on the console home and everywhere else", () => {
		expect(isChatHiddenPath("/console")).toBe(false);
		expect(isChatHiddenPath("/console/")).toBe(false);
		expect(isChatHiddenPath("/")).toBe(false);
		expect(isChatHiddenPath("/products/aeps")).toBe(false);
		// Not a console subpath despite the shared prefix.
		expect(isChatHiddenPath("/consoles-are-fun")).toBe(false);
	});
});

describe("setZohoChatHidden", () => {
	it("hides the bubble and any open window on a chat-free route", () => {
		const { salesiq } = mockWidget();
		const floatbutton = { visible: vi.fn() };
		Object.assign(salesiq, { floatbutton });

		setZohoChatHidden(true);

		expect(floatbutton.visible).toHaveBeenCalledWith("hide");
		expect(salesiq.chatwindow.visible).toHaveBeenCalledWith("hide");
	});

	it("restores the bubble without opening a chat", () => {
		const { salesiq } = mockWidget();
		const floatbutton = { visible: vi.fn() };
		Object.assign(salesiq, { floatbutton });

		setZohoChatHidden(false);

		expect(floatbutton.visible).toHaveBeenCalledWith("show");
		expect(salesiq.chat.start).not.toHaveBeenCalled();
	});

	it("pulls in a widget the bootstrap skipped when chat becomes allowed", () => {
		const load = vi.fn();
		(window as unknown as { __loadZohoWidget?: () => void }).__loadZohoWidget =
			load;

		setZohoChatHidden(false);

		expect(load).toHaveBeenCalled();
	});

	it("does not throw before the widget exists", () => {
		expect(() => setZohoChatHidden(true)).not.toThrow();
	});

	it("stays hidden when the route changed while the widget was still loading", () => {
		// Visible hard load: the bootstrap's 1s timer is in flight.
		setZohoChatHidden(false);
		// Visitor navigates to /console/profile before the script lands.
		setZohoChatHidden(true);

		const salesiq = finishWidgetLoad();

		expect(salesiq.floatbutton.visible).toHaveBeenLastCalledWith("hide");
	});
});

describe("setZohoChatOverlayHidden", () => {
	it("hides the bubble while an overlay is open and restores it on close", () => {
		const { salesiq } = mockWidget();
		const floatbutton = { visible: vi.fn() };
		Object.assign(salesiq, { floatbutton });
		setZohoChatHidden(false);

		setZohoChatOverlayHidden(true);
		expect(floatbutton.visible).toHaveBeenLastCalledWith("hide");

		setZohoChatOverlayHidden(false);
		expect(floatbutton.visible).toHaveBeenLastCalledWith("show");
	});

	it("leaves the route rule in charge when the overlay closes", () => {
		const { salesiq } = mockWidget();
		const floatbutton = { visible: vi.fn() };
		Object.assign(salesiq, { floatbutton });
		setZohoChatHidden(true);

		setZohoChatOverlayHidden(true);
		setZohoChatOverlayHidden(false);

		expect(floatbutton.visible).toHaveBeenLastCalledWith("hide");
	});
});

describe("openZohoChat before the widget loads", () => {
	it("loads the widget and opens the chat once it is ready", () => {
		const load = vi.fn();
		(window as unknown as { __loadZohoWidget?: () => void }).__loadZohoWidget =
			load;
		setZohoChatHidden(true);

		openZohoChat();

		expect(load).toHaveBeenCalled();

		const salesiq = finishWidgetLoad();

		expect(salesiq.chat.start).toHaveBeenCalled();
		expect(salesiq.floatbutton.visible).toHaveBeenCalledWith("show");
	});
});
