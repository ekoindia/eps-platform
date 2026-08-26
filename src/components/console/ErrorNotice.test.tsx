import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearCallLog } from "@/lib/auth/client";
import { clearCachedSession } from "@/lib/auth/session-cache";
import { LIVE_ACCOUNT_STATE_ID } from "@/lib/console/lifecycle";
import { ErrorNotice } from "./ErrorNotice";

// Both hooks are optional reads in the component, so they default to "absent"
// here — which is what every test written before the Raise-issue gate assumed.
const dialogs = vi.hoisted(() => ({ current: null as unknown }));
const auth = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/components/connect/DialogHost", () => ({
	useOptionalConnectDialogs: () => dialogs.current,
}));

vi.mock("@/lib/auth/AuthProvider", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/AuthProvider")>()),
	useOptionalAuth: () => auth.current,
}));

/** A developer session whose account sits at `accountStateId`. */
const developerAt = (accountStateId: number | null) => ({
	state: {
		status: "authed",
		role: "developer",
		me: { state: "active", mobile: "999", zohoId: null, profile: { accountStateId } },
	},
});

describe("ErrorNotice", () => {
	beforeEach(() => {
		clearCachedSession();
		clearCallLog();
		dialogs.current = null;
		auth.current = null;
	});

	it("shows the API's own message and the identifier line", () => {
		render(
			<ErrorNotice
				error={
					new ApiError("KYC_LIST_FAILED", "Upstream refused", 502, undefined, {
						source: "api",
						requestId: "rid-1",
					})
				}
			/>,
		);
		expect(screen.getByText("Upstream refused")).toBeInTheDocument();
		expect(
			screen.getByText("api · KYC_LIST_FAILED · rid rid-1"),
		).toBeInTheDocument();
	});

	it("falls back rather than showing a raw JS error to the user", () => {
		render(
			<ErrorNotice
				error={new TypeError("Cannot read properties of undefined")}
				fallback="Couldn't load your transactions."
			/>,
		);
		expect(
			screen.getByText("Couldn't load your transactions."),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/Cannot read properties/),
		).not.toBeInTheDocument();
	});

	it("names the fields upstream rejected", () => {
		// "Please provide the value of the field" names nothing on its own; this
		// is the whole reason `details` crosses the wire.
		render(
			<ErrorNotice
				error={
					new ApiError("STEP_FAILED", "Please provide the value", 400, {
						invalid_params: { agreement_status: "Required" },
					})
				}
			/>,
		);
		expect(screen.getByText("agreement_status")).toBeInTheDocument();
		expect(screen.getByText(/Required/)).toBeInTheDocument();
	});

	it("is announced to assistive tech", () => {
		render(<ErrorNotice error={new ApiError("X", "y", 500)} />);
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	it("renders the note variant without the alert styling", () => {
		// A deployment without connect-api is a configuration fact, not a fault.
		render(
			<ErrorNotice
				error={new ApiError("DASHBOARD_UNAVAILABLE", "not here", 501)}
				variant="note"
			/>,
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("offers no Raise issue button without a dialog host", () => {
		// The error boundary and the site header render outside the provider and
		// must not crash there.
		render(<ErrorNotice error={new ApiError("X", "y", 500)} />);
		expect(screen.queryByText("Raise issue")).not.toBeInTheDocument();
		expect(screen.getByText("Copy diagnostics")).toBeInTheDocument();
	});
});

describe("ErrorNotice — the Raise issue escape hatch", () => {
	const raise = () => screen.queryByRole("button", { name: /raise issue/i });

	beforeEach(() => {
		clearCachedSession();
		clearCallLog();
		dialogs.current = { showRaiseIssue: vi.fn() };
		auth.current = null;
	});

	const renderNotice = () =>
		render(<ErrorNotice error={new ApiError("X_FAILED", "Upstream refused", 502)} />);

	it("offers it to a fully live account", () => {
		auth.current = developerAt(LIVE_ACCOUNT_STATE_ID);
		renderNotice();
		expect(raise()).toBeVisible();
	});

	// A ticket is filed against a Zoho contact, and the lead is only converted
	// into one when the account goes live. Offering the button earlier promises
	// a support channel that upstream will refuse.
	it("hides it for an account that is live-ish but not yet converted", () => {
		// 62 = "Limited KYC Active", which the lifecycle derivation reads as
		// `active` because it fails open. That is not the same question.
		auth.current = developerAt(62);
		renderNotice();
		expect(raise()).toBeNull();
	});

	it("hides it when the account state is unknown", () => {
		auth.current = developerAt(null);
		renderNotice();
		expect(raise()).toBeNull();
	});

	it("hides it outside a session entirely", () => {
		auth.current = null;
		renderNotice();
		expect(raise()).toBeNull();
	});

	it("hides it where no dialog host is mounted, however live the account", () => {
		dialogs.current = null;
		auth.current = developerAt(LIVE_ACCOUNT_STATE_ID);
		renderNotice();
		expect(raise()).toBeNull();
	});

	it("still offers Copy diagnostics when Raise issue is hidden", () => {
		auth.current = developerAt(62);
		renderNotice();
		expect(raise()).toBeNull();
		expect(
			screen.getByRole("button", { name: /copy diagnostics/i }),
		).toBeVisible();
	});
});
