import NextStepsCard from "@/components/console/NextStepsCard";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The entitlement hook is the switch under test for the KYC link, so it is
// driven directly — same as Documents.test.tsx does.
const kycEnabled = vi.fn();
vi.mock("@/lib/connect/use-kyc", () => ({
	useKycEnabled: () => kycEnabled(),
}));

beforeEach(() => {
	kycEnabled.mockReturnValue(false);
});

function renderCard(me: Partial<MeView> & { state: Lifecycle }) {
	return render(
		<MemoryRouter>
			<NextStepsCard
				me={{ mobile: "999", profile: null, zohoId: null, ...me }}
			/>
		</MemoryRouter>,
	);
}

const fee = () => screen.queryByText(/one-time integration fee/i);

describe("NextStepsCard", () => {
	it("always offers a way through to the credentials steps", () => {
		renderCard({ state: "lead" });
		const links = screen.getAllByRole("link", { name: /credentials/i });
		expect(links).toHaveLength(2);
		for (const link of links) {
			expect(link).toHaveAttribute("href", "/console/credentials");
			// The action is a button, not an underlined label.
			expect(link).toHaveTextContent("View");
		}
	});

	it("does not underline the step labels", () => {
		renderCard({ state: "lead" });
		expect(screen.getByText(/finish your kyc/i).closest("a")).toBeNull();
	});

	it("marks KYC pending until the account is active", () => {
		renderCard({ state: "onboarded" });
		expect(screen.getByText("Pending")).toBeInTheDocument();
	});

	// The state that exists to say exactly this. Nothing in the component tests
	// for it by name — it falls out of "not active" — so this guards that.
	it("marks KYC pending, and offers the upload, for a kyc-pending account", () => {
		kycEnabled.mockReturnValue(true);
		renderCard({ state: "kyc-pending" });
		expect(screen.getByText("Pending")).toBeInTheDocument();
		expect(screen.queryByText("Done")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /uploading documents/i }),
		).toHaveAttribute("href", "/console/documents");
	});

	it("marks KYC done once the account is active, and strikes it out", () => {
		renderCard({ state: "active" });
		expect(screen.getByText("Done")).toBeInTheDocument();
		expect(screen.queryByText("Pending")).not.toBeInTheDocument();
		expect(screen.getByText(/finish your kyc/i)).toHaveClass("line-through");
		// The strike must not reach the badge beside it.
		expect(screen.getByText("Done")).not.toHaveClass("line-through");
	});

	it("badges only the step whose status it can answer", () => {
		renderCard({ state: "lead" });
		// Every row carries a status mark; only one carries a badge.
		expect(
			screen.getAllByLabelText(/not started|status unknown/i),
		).toHaveLength(4);
		expect(screen.getByLabelText("Not started")).toBeInTheDocument();
		expect(screen.getAllByText(/^(Pending|Done)$/)).toHaveLength(1);
	});

	it("does not link KYC while the entitlement says no", () => {
		renderCard({ state: "lead" });
		expect(
			screen.queryByRole("link", { name: /uploading documents/i }),
		).not.toBeInTheDocument();
		expect(screen.getByText(/finish your kyc/i)).toBeInTheDocument();
	});

	it("links KYC to the upload page once entitled", () => {
		kycEnabled.mockReturnValue(true);
		renderCard({ state: "lead" });
		expect(
			screen.getByRole("link", { name: /uploading documents/i }),
		).toHaveAttribute("href", "/console/documents");
	});

	// Was gated on `profile.dateOfJoining >= 2026-08-03`. The gate came out
	// because that field has no format contract and no other consumer, so it
	// silently hid the step from accounts that DO owe the fee.
	it("shows the fee step whatever the join date says", () => {
		for (const dateOfJoining of [undefined, "2019-05-12", "03-08-2026"]) {
			const { unmount } = renderCard({
				state: "active",
				profile: { name: "Asha", dateOfJoining } as never,
			});
			expect(fee()).toBeInTheDocument();
			unmount();
		}
	});

	it("sends the fee step through to the payment page", () => {
		renderCard({ state: "active" });
		// The label itself stays plain text; the action is the button beside it.
		expect(fee()?.closest("a")).toBeNull();
		expect(
			screen.getByRole("link", { name: /one-time integration fee/i }),
		).toHaveAttribute("href", "/console/pay-activation-fee");
	});
});
