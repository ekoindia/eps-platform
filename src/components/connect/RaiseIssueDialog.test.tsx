import { RaiseIssueDialog } from "@/components/connect/RaiseIssueDialog";
import { authClient } from "@/lib/auth/client";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", () => ({
	authClient: { connectSupport: { queryTypes: vi.fn(), ticket: vi.fn() } },
}));

const queryTypes = vi.mocked(authClient.connectSupport.queryTypes);

/** The dialog's own props, none of which the assertions here care about. */
function renderDialog() {
	return render(
		<RaiseIssueDialog
			onClose={() => {}}
			setHidden={() => {}}
			setPending={() => {}}
		/>,
	);
}

describe("RaiseIssueDialog", () => {
	beforeEach(() => vi.resetAllMocks());

	// The bug this file exists for: an empty catalogue took the form branch, every
	// ChipList inside it returned null for an empty array, and the dialog rendered
	// its heading over nothing at all.
	it("never renders an empty card when upstream has no issue types", async () => {
		queryTypes.mockResolvedValue({ issueTypes: [] });

		renderDialog();

		// The fallback issue, already selected, with its comment box open — not a
		// bare heading.
		expect(await screen.findByText("Other query")).toBeInTheDocument();
		expect(screen.getByLabelText(/Comments \*/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Submit" }),
		).toBeInTheDocument();
	});

	// The backend now forwards the upstream's own words; showing a generic string
	// instead would hide "not entitled", which is the actionable half.
	it("shows the message the backend refused with", async () => {
		queryTypes.mockRejectedValue(
			new Error("Interaction not allowed for this role"),
		);

		renderDialog();

		expect(
			await screen.findByText("Interaction not allowed for this role"),
		).toBeInTheDocument();
	});

	it("steps through categories when upstream does return issue types", async () => {
		queryTypes.mockResolvedValue({
			issueTypes: [
				{
					label: "Money not received",
					category: { id: 1, title: "Payment" },
					sub_category: { id: 10, title: "DMT" },
				},
				{
					label: "Wrong amount",
					category: { id: 2, title: "Account" },
					sub_category: { id: 20, title: "Balance" },
				},
			],
		});

		renderDialog();

		// Two categories is a real choice, so the step is shown and nothing is
		// pre-selected.
		expect(await screen.findByText("Payment")).toBeInTheDocument();
		expect(screen.getByText("Account")).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.queryByText("Money not received")).not.toBeInTheDocument(),
		);
	});
});
