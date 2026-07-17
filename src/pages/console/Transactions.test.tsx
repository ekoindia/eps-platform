import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeView } from "@/lib/auth/client";
import type {
	TransactionPage,
	TransactionRow,
} from "@/lib/console/transactions";
import Transactions from "@/pages/console/Transactions";

// Mocked at the module boundary, per repo convention — never `fetch`.
vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	transactionsClient: { search: vi.fn() },
}));

const { transactionsClient } = await import("@/lib/auth/client");
const search = vi.mocked(transactionsClient.search);

/** A zeroed row; each test overrides only what it exercises. */
function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
	return {
		tid: "2886973933",
		tx_typeid: 1,
		tx_name: "Digi Khata Load Wallet",
		amount_dr: 200000,
		amount_cr: 0,
		fee: 0,
		commission_earned: 0,
		bonus: 0,
		tds: 0,
		gst: 0,
		insurance_amount: 0,
		eko_service_charge: 0,
		eko_gst: 0,
		r_bal: 2800000,
		status: "Success",
		response_status_id: 0,
		datetime: "2026-04-16 11:49:00",
		...overrides,
	};
}

function page(overrides: Partial<TransactionPage> = {}): TransactionPage {
	return {
		rows: [row()],
		startIndex: 0,
		limit: 25,
		hasNext: false,
		...overrides,
	};
}

const activeMe: MeView = {
	state: "active",
	mobile: "9990000001",
	profile: null,
	zohoId: null,
};

function renderPage(me: MeView = activeMe) {
	return render(
		<MemoryRouter initialEntries={["/console/transactions"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route path="transactions" element={<Transactions />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	search.mockResolvedValue(page());
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("Transactions", () => {
	it("renders a row for each transaction", async () => {
		search.mockResolvedValue(
			page({
				rows: [row(), row({ tid: "2886973901", tx_name: "DMT Send Money" })],
			}),
		);
		renderPage();
		expect(
			await screen.findByText("Digi Khata Load Wallet"),
		).toBeInTheDocument();
		expect(screen.getByText("DMT Send Money")).toBeInTheDocument();
		// TID is a detail, not a column — it shows only in the expanded row.
		expect(screen.queryByText("2886973933")).not.toBeInTheDocument();
	});

	it("shows a debit as a negative amount", async () => {
		renderPage();
		expect(await screen.findByText(/−\s*₹2,00,000/)).toBeInTheDocument();
	});

	it("blanks the money columns for a failed transaction", async () => {
		// The row failed, so debit/credit must not report money that never moved —
		// the running balance still shows. `status` and `response_status_id` agree,
		// as they do on the wire.
		search.mockResolvedValue(
			page({ rows: [row({ response_status_id: 1, status: "Failed" })] }),
		);
		renderPage();
		expect(await screen.findByText("Failed")).toBeInTheDocument();
		expect(screen.queryByText("₹2,00,000.00")).not.toBeInTheDocument();
	});

	it("shows upstream's own status wording", async () => {
		// id 5 is generically "Hold", but upstream calls this one "Payment received".
		search.mockResolvedValue(
			page({
				rows: [row({ response_status_id: 5, status: "Payment received" })],
			}),
		);
		renderPage();
		expect(await screen.findByText("Payment received")).toBeInTheDocument();
		expect(screen.queryByText("Hold")).not.toBeInTheDocument();
	});

	it("expands a row to reveal its other details", async () => {
		renderPage();
		await screen.findByText("Digi Khata Load Wallet");
		expect(screen.queryByText("Other Details")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /show details for/i }));
		expect(screen.getByText("Other Details")).toBeInTheDocument();
		expect(screen.getByText("TID")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /hide details for/i }));
		expect(screen.queryByText("Other Details")).not.toBeInTheDocument();
	});

	it("totals the page and labels them as per-page", async () => {
		search.mockResolvedValue(
			page({
				rows: [
					row({ amount_dr: 100, fee: 5, r_bal: 900 }),
					row({ tid: "2", amount_dr: 0, amount_cr: 50, r_bal: 1000 }),
				],
			}),
		);
		renderPage();
		expect(await screen.findByText("Totals for this page")).toBeInTheDocument();
		const totals = screen.getByText("Totals for this page").closest("tr");
		// Closing balance is the NEWEST row's running balance (list is newest-first).
		expect(
			within(totals as HTMLElement).getByText("₹105.00"),
		).toBeInTheDocument();
		expect(
			within(totals as HTMLElement).getByText("₹50.00"),
		).toBeInTheDocument();
		expect(
			within(totals as HTMLElement).getByText("₹900.00"),
		).toBeInTheDocument();
	});

	it("shows an empty state when there are no transactions", async () => {
		search.mockResolvedValue(page({ rows: [] }));
		renderPage();
		expect(await screen.findByText(/nothing found/i)).toBeInTheDocument();
	});

	it("surfaces a failure instead of an empty table", async () => {
		search.mockRejectedValue(new Error("boom"));
		renderPage();
		expect(
			await screen.findByText(/couldn't load your transactions/i),
		).toBeInTheDocument();
	});

	it("does not fetch for an account that cannot have transactions", async () => {
		renderPage({ ...activeMe, state: "lead" });
		expect(await screen.findByText(/continue onboarding/i)).toBeInTheDocument();
		expect(search).not.toHaveBeenCalled();
	});

	it("pages forward and back", async () => {
		search.mockResolvedValue(page({ hasNext: true }));
		renderPage();
		await screen.findByText("Digi Khata Load Wallet");
		expect(search).toHaveBeenCalledWith(
			expect.objectContaining({ start_index: 0 }),
			expect.anything(),
		);

		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		await waitFor(() =>
			expect(search).toHaveBeenCalledWith(
				expect.objectContaining({ start_index: 25 }),
				expect.anything(),
			),
		);

		// pagination unmounts while the next page loads; wait for it back
		fireEvent.click(await screen.findByRole("button", { name: /previous/i }));
		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith(
				expect.objectContaining({ start_index: 0 }),
				expect.anything(),
			),
		);
	});

	it("turns a quick search into the filter its shape implies", async () => {
		renderPage();
		await screen.findByText("Digi Khata Load Wallet");

		const box = screen.getByLabelText(/search transactions/i);
		fireEvent.change(box, { target: { value: "9876543210" } });
		fireEvent.submit(box);
		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith(
				expect.objectContaining({
					filters: { customer_mobile: "9876543210" },
				}),
				expect.anything(),
			),
		);
	});

	it("normalizes a pasted amount before sending it", async () => {
		// The backend's amount rule rejects commas, so sending the raw paste would
		// 400 on exactly the input the user copied out of the table.
		renderPage();
		await screen.findByText("Digi Khata Load Wallet");

		const box = screen.getByLabelText(/search transactions/i);
		fireEvent.change(box, { target: { value: "2,00,000" } });
		fireEvent.submit(box);
		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith(
				expect.objectContaining({ filters: { amount: "200000" } }),
				expect.anything(),
			),
		);
	});

	it("applies filters from the dialog", async () => {
		renderPage();
		await screen.findByText("Digi Khata Load Wallet");

		fireEvent.click(screen.getByRole("button", { name: /filter/i }));
		fireEvent.change(await screen.findByLabelText("TID"), {
			target: { value: "2886973933" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith(
				expect.objectContaining({ filters: { tid: "2886973933" } }),
				expect.anything(),
			),
		);
	});
});
