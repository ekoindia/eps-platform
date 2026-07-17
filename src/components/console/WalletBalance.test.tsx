import { WalletBalance } from "@/components/console/WalletBalance";
import { ApiError } from "@/lib/auth/client";
import { resetWalletBalanceCache } from "@/lib/wallet-balance";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const walletBalance = vi.fn();
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	authClient: { walletBalance: () => walletBalance() },
}));

beforeEach(() => {
	walletBalance.mockReset();
	// The balance cache is module state that deliberately outlives a mount, so
	// without this a case inherits the previous one's balance and never fetches.
	resetWalletBalanceCache();
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

	// Every console navigation remounts this card (AnimatedRoutes keys the route
	// subtree on the pathname), so a per-mount fetch meant a request and a
	// "Loading…" flash on every page change.
	it("reuses the cached balance on a remount instead of refetching", async () => {
		walletBalance.mockResolvedValue({ balance: 100 });
		const first = render(<WalletBalance />);
		expect(await screen.findByText("₹100")).toBeInTheDocument();
		first.unmount();

		render(<WalletBalance />);
		// Present on the first frame — no "Loading…" in between.
		expect(screen.getByText("₹100")).toBeInTheDocument();
		expect(walletBalance).toHaveBeenCalledTimes(1);
	});

	it("carries the cooldown across a remount, then releases it", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		walletBalance.mockResolvedValue({ balance: 100 });
		const first = render(<WalletBalance />);
		expect(await screen.findByText("₹100")).toBeInTheDocument();
		first.unmount();

		// 10s into the cached balance's 30s window: hopping pages must not hand
		// back an armed button to click past the rate limit.
		vi.advanceTimersByTime(10_000);
		render(<WalletBalance />);
		const button = screen.getByRole("button", {
			name: /refresh e-value balance/i,
		});
		expect(button).toBeDisabled();

		// ...but it must unlock on the remainder, not stay dead for this mount.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000);
		});
		expect(button).toBeEnabled();
	});

	it("shares one request between cards mounted before it lands", async () => {
		walletBalance.mockResolvedValue({ balance: 100 });
		render(<WalletBalance />);
		render(<WalletBalance />);
		await waitFor(() => expect(screen.getAllByText("₹100")).toHaveLength(2));
		expect(walletBalance).toHaveBeenCalledTimes(1);
	});

	it("retries a transient failure on remount rather than caching it", async () => {
		walletBalance.mockRejectedValue(
			new ApiError("UPSTREAM_ERROR", "boom", 502),
		);
		const first = render(<WalletBalance />);
		expect(await screen.findByText("Couldn't load")).toBeInTheDocument();
		first.unmount();

		walletBalance.mockResolvedValue({ balance: 100 });
		render(<WalletBalance />);
		expect(await screen.findByText("₹100")).toBeInTheDocument();
		expect(walletBalance).toHaveBeenCalledTimes(2);
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
