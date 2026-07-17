import { WalletBalance } from "@/components/console/WalletBalance";
import { ApiError } from "@/lib/auth/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const walletBalance = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { walletBalance: () => walletBalance() },
}));

beforeEach(() => {
	walletBalance.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("WalletBalance", () => {
	it("renders the balance in Indian currency format", async () => {
		walletBalance.mockResolvedValue({ balance: 2800000 });
		render(<WalletBalance />);
		expect(await screen.findByText("₹28,00,000")).toBeInTheDocument();
		expect(screen.getByText("E-value Balance")).toBeInTheDocument();
	});

	it("renders a real zero balance rather than hiding it", async () => {
		walletBalance.mockResolvedValue({ balance: 0 });
		render(<WalletBalance />);
		expect(await screen.findByText("₹0")).toBeInTheDocument();
	});

	it("renders nothing when the account has no wallet (403)", async () => {
		walletBalance.mockRejectedValue(new ApiError("NO_WALLET", "no", 403));
		const { container } = render(<WalletBalance />);
		await waitFor(() => expect(container).toBeEmptyDOMElement());
	});

	it("keeps the card with an honest message on a transient failure", async () => {
		walletBalance.mockRejectedValue(
			new ApiError("UPSTREAM_ERROR", "boom", 502),
		);
		render(<WalletBalance />);
		expect(await screen.findByText("Couldn't load")).toBeInTheDocument();
	});

	it("refetches on refresh, then locks the button for the cooldown", async () => {
		walletBalance.mockResolvedValue({ balance: 100 });
		render(<WalletBalance />);

		const button = await screen.findByRole("button", {
			name: /refresh e-value balance/i,
		});
		await waitFor(() => expect(button).toBeEnabled());

		walletBalance.mockResolvedValue({ balance: 250 });
		fireEvent.click(button);
		expect(await screen.findByText("₹250")).toBeInTheDocument();
		expect(walletBalance).toHaveBeenCalledTimes(2);

		// A second click inside the cooldown must not reach the backend.
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(walletBalance).toHaveBeenCalledTimes(2);
	});
});
