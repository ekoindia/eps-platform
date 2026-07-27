import { WalletBalance } from "@/components/console/WalletBalance";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { resetWalletBalanceCache } from "@/lib/wallet-balance";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const walletBalance = vi.fn();
const connectInteractions = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: {
		walletBalance: () => walletBalance(),
		connectInteractions: () => connectInteractions(),
	},
}));

// The flag is a module constant read at import, so it has to be mocked rather
// than set through import.meta.env.
vi.mock("@/lib/config/features", async (orig) => ({
	...(await orig<typeof import("@/lib/config/features")>()),
	SHOW_CONNECT_WIDGET: true,
}));

/** Renders the card inside a router, which the Load-Balance link needs. */
function renderCard() {
	return render(
		<MemoryRouter>
			<WalletBalance />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	walletBalance.mockReset();
	connectInteractions.mockReset();
	walletBalance.mockResolvedValue({ balance: 2800000 });
	resetWalletBalanceCache();
	resetRoleTransactionCache();
});

describe("WalletBalance — Load Balance button", () => {
	it("links to the retailer flow when the user is entitled to it", async () => {
		connectInteractions.mockResolvedValue({
			// Real shape: the id is in `id`; `interaction_type_id` is 0 for composites.
			interactions: [
				{ id: 491, interaction_type_id: 0, behavior: 7, label: "Load E-value" },
			],
		});

		renderCard();

		const link = await screen.findByLabelText("Load E-value balance");
		expect(link).toHaveAttribute("href", "/console/transaction/491");
	});

	it("links to the distributor flow when that is the entitlement", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [
				{
					id: 240,
					interaction_type_id: 0,
					behavior: 6,
					label: "Request E-value",
				},
			],
		});

		renderCard();

		const link = await screen.findByLabelText("Load E-value balance");
		expect(link).toHaveAttribute("href", "/console/transaction/240");
	});

	it("stays hidden when the user may not load E-value", async () => {
		connectInteractions.mockResolvedValue({
			interactions: [{ interaction_type_id: 154, label: "History" }],
		});

		renderCard();

		// The balance still arrives — the button's absence must not gate the card.
		expect(await screen.findByText("₹28,00,000")).toBeInTheDocument();
		expect(screen.queryByLabelText("Load E-value balance")).toBeNull();
	});

	it("still renders the balance when the interaction list fails", async () => {
		connectInteractions.mockRejectedValue(new Error("upstream down"));

		renderCard();

		expect(await screen.findByText("₹28,00,000")).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.queryByLabelText("Load E-value balance")).toBeNull(),
		);
	});
});
