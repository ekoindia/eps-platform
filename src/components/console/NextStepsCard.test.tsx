import NextStepsCard from "@/components/console/NextStepsCard";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The entitlement hook is the switch under test for the KYC link, so it is
// driven directly — same as Documents.test.tsx does.
const kycEnabled = vi.fn();
vi.mock("@/lib/connect/use-kyc", () => ({
	useKycEnabled: () => kycEnabled(),
}));

// The pack itself. Null by default — unresolved, unentitled or failed — so
// every case written before the fetch existed still sees the account-state row.
const documents = vi.fn();
vi.mock("@/lib/connect/kyc-documents", () => ({
	useKycDocuments: (enabled: boolean) => documents(enabled),
}));

/** A pack of documents at the given statuses, in the parsed shape. */
function pack(...statuses: number[]) {
	return statuses.map((status, i) => ({
		docType: String(i + 1),
		name: `Document ${i + 1}`,
		info: "",
		pages: 1,
		status,
		statusDesc: "",
		error: "",
	}));
}

// Same treatment for the E-sign entitlement. Defaults to the unresolved list, so
// every case that predates the row keeps the card it was written against.
const interactions = vi.fn();
vi.mock("@/lib/connect/use-interactions", () => ({
	useRoleTransactionList: () => interactions(),
}));

/** An interaction list that grants the ids given, in the shape the API returns. */
function entitledTo(...ids: number[]) {
	return Object.fromEntries(ids.map((id) => [String(id), { id }]));
}

beforeEach(() => {
	kycEnabled.mockReturnValue(false);
	interactions.mockReturnValue(null);
	documents.mockReset().mockReturnValue(null);
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

	// The bug this state was added for: 47 read as `active`, so a partner whose
	// documents were refused saw a struck-out KYC row and an "Active" account.
	it("marks a rejected KYC red, and offers the re-upload", () => {
		kycEnabled.mockReturnValue(true);
		renderCard({ state: "kyc-rejected" });
		const badge = screen.getByText("Re-upload required");
		expect(badge).toBeInTheDocument();
		// Red, not the neutral grey every other state gets.
		expect(badge).toHaveClass("bg-destructive");
		expect(screen.queryByText("Pending")).not.toBeInTheDocument();
		expect(screen.queryByText("Done")).not.toBeInTheDocument();
		expect(screen.getByText(/finish your kyc/i)).not.toHaveClass(
			"line-through",
		);
		// The icon must not say "Not started" for a pack that was submitted.
		expect(screen.queryByLabelText("Not started")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Re-upload required")).toBeInTheDocument();
		const link = screen.getByRole("link", { name: /uploading documents/i });
		expect(link).toHaveAttribute("href", "/console/documents");
		expect(link).toHaveTextContent("Re-upload");
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
		expect(
			screen.getAllByText(/^(Pending|Done|Re-upload required)$/),
		).toHaveLength(1);
	});

	// The row rides the same 223 entitlement as the rail's E-sign Documents item,
	// so the two can never disagree about whether a signature is owed.
	it("hides the E-sign step while 223 is not entitled", () => {
		renderCard({ state: "kyc-pending" });
		expect(
			screen.queryByText(/sign pending documents/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /sign document/i }),
		).not.toBeInTheDocument();
	});

	it("heads the card with the E-sign step once 223 is entitled", () => {
		interactions.mockReturnValue(entitledTo(223));
		renderCard({ state: "kyc-pending" });
		expect(
			screen.getByRole("link", { name: /sign document/i }),
		).toHaveAttribute("href", "/console/transaction/223");
		// Position asserted structurally: signing gates the document pack, so it
		// outranks the upload row.
		const first = screen.getAllByRole("listitem")[0];
		expect(
			within(first).getByText(/sign pending documents/i),
		).toBeInTheDocument();
		// Owed, so the ring is the live one — not the muted "unknown" mark.
		expect(within(first).getByLabelText("Not started")).toHaveClass(
			"text-primary",
		);
	});

	// The row appears a tick late, once the list resolves — the same way the rail's
	// item does. A card built only against a settled list would not catch this.
	it("adds the E-sign step when the list resolves after mount", () => {
		const { rerender } = renderCard({ state: "kyc-pending" });
		expect(
			screen.queryByText(/sign pending documents/i),
		).not.toBeInTheDocument();
		interactions.mockReturnValue(entitledTo(223));
		rerender(
			<MemoryRouter>
				<NextStepsCard
					me={{
						mobile: "999",
						profile: null,
						zohoId: null,
						state: "kyc-pending",
					}}
				/>
			</MemoryRouter>,
		);
		expect(screen.getByText(/sign pending documents/i)).toBeInTheDocument();
	});

	// One filled button per card. While a signature is owed, it is the signature's.
	it("hands the filled button to E-sign and demotes the upload", () => {
		kycEnabled.mockReturnValue(true);
		interactions.mockReturnValue(entitledTo(223));
		renderCard({ state: "kyc-pending" });
		expect(screen.getByRole("link", { name: /sign document/i })).toHaveClass(
			"bg-primary",
		);
		const upload = screen.getByRole("link", { name: /uploading documents/i });
		expect(upload).toHaveClass("border");
		expect(upload).not.toHaveClass("bg-primary");
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

	// The pack says what the account state cannot: which documents are owed.
	describe("driven by the document pack", () => {
		beforeEach(() => {
			kycEnabled.mockReturnValue(true);
		});

		it("asks for the pack only for an account whose KYC is outstanding", () => {
			renderCard({ state: "lead" });
			expect(documents).toHaveBeenCalledWith(false);

			documents.mockClear();
			renderCard({ state: "kyc-pending" });
			expect(documents).toHaveBeenCalledWith(true);
		});

		it("marks the row approved, with no button, once every document is", () => {
			documents.mockReturnValue(pack(2, 2, 2));
			renderCard({ state: "kyc-pending" });

			expect(screen.getByText("Approved")).toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: /uploading documents/i }),
			).not.toBeInTheDocument();
		});

		// "No Records Found" comes back as an empty list — nothing is owed.
		it("reads an empty pack as nothing owed", () => {
			documents.mockReturnValue([]);
			renderCard({ state: "kyc-pending" });

			expect(screen.getByText("Approved")).toBeInTheDocument();
			expect(screen.getByText(/finish your kyc/i)).toHaveClass("line-through");
		});

		// Uploaded and with the reviewer: nothing for the partner to do, so no
		// button and no orange ring calling them to act.
		it("shows a pack in review as approval pending, with no button", () => {
			documents.mockReturnValue(pack(1, 2));
			renderCard({ state: "kyc-pending" });

			expect(screen.getByText("Approval Pending")).toBeInTheDocument();
			expect(screen.getByLabelText("Approval pending")).toHaveClass(
				"text-muted-foreground/50",
			);
			expect(
				screen.queryByRole("link", { name: /uploading documents/i }),
			).not.toBeInTheDocument();
		});

		it("counts what is owed, in red, and asks for a re-upload", () => {
			documents.mockReturnValue(pack(0, 0, 3, 2));
			renderCard({ state: "kyc-pending" });

			const badge = screen.getByText("2 Pending, 1 Re-upload");
			expect(badge).toHaveClass("bg-destructive");
			expect(
				screen.getByRole("link", { name: /uploading documents/i }),
			).toHaveTextContent("Re-upload");
		});

		it("drops the zero bucket, and asks for an upload when nothing was refused", () => {
			documents.mockReturnValue(pack(0, 0, 0));
			renderCard({ state: "kyc-pending" });

			expect(screen.getByText("3 Pending")).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: /uploading documents/i }),
			).toHaveTextContent("Upload");
		});

		// A transient 502 reads exactly like a pack still in flight, and neither
		// may take away the way in.
		it("falls back to the account state when the pack never arrives", () => {
			renderCard({ state: "kyc-rejected" });

			expect(screen.getByText("Re-upload required")).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: /uploading documents/i }),
			).toHaveTextContent("Re-upload");
		});

		it("keeps the account's own Done for an active account", () => {
			documents.mockReturnValue(pack(0, 0));
			renderCard({ state: "active" });

			expect(screen.getByText("Done")).toBeInTheDocument();
			expect(screen.queryByText("2 Pending")).not.toBeInTheDocument();
		});
	});
});
