import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError, clearCallLog } from "@/lib/auth/client";
import { clearCachedSession } from "@/lib/auth/session-cache";
import { ErrorNotice } from "./ErrorNotice";

describe("ErrorNotice", () => {
	beforeEach(() => {
		clearCachedSession();
		clearCallLog();
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
