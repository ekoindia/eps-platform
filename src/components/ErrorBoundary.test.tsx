import { ErrorBoundary } from "@/components/ErrorBoundary";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Always throws on render. Typed as returning an element so JSX accepts it. */
function Boom({ message = "kaboom" }: { message?: string }): ReactElement {
	throw new Error(message);
}

beforeEach(() => {
	// React logs caught render errors; the boundary logs its own. Both are noise
	// here and would otherwise bury a real failure in the output.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
	it("renders children when nothing throws", () => {
		render(
			<ErrorBoundary>
				<p>all good</p>
			</ErrorBoundary>,
		);

		expect(screen.getByText("all good")).toBeInTheDocument();
	});

	it("shows the actual error message, not just a generic apology", () => {
		render(
			<ErrorBoundary>
				<Boom message="role_trxn_list is not defined" />
			</ErrorBoundary>,
		);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		// The whole point of the details panel: without this the failure is
		// unactionable for the user and unreportable for support.
		expect(
			screen.getByText(/role_trxn_list is not defined/),
		).toBeInTheDocument();
	});

	it("keeps the details collapsed by default", () => {
		render(
			<ErrorBoundary>
				<Boom />
			</ErrorBoundary>,
		);

		const details = screen.getByText("Error details").closest("details");
		expect(details).not.toHaveAttribute("open");
	});

	it("clears the error when Try again is pressed", () => {
		let shouldThrow = true;
		const Flaky = () => {
			if (shouldThrow) throw new Error("transient");
			return <p>recovered</p>;
		};

		render(
			<ErrorBoundary>
				<Flaky />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		shouldThrow = false;
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(screen.getByText("recovered")).toBeInTheDocument();
	});
});
