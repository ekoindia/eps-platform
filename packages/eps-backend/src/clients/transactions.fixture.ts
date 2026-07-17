import type { TransactionRow } from "../types";

/**
 * Stand-in transaction rows, served when `EKO_TRANSACTIONS_MOCK=true`.
 *
 * ponytail: temporary. Exists so the console page runs end-to-end through the
 * real auth → cookie → BFF → client path while interaction 154 is unprobed.
 * Delete with the `transactionsMock` flag once the contract is confirmed — see
 * docs/features/transaction-history.md §Unverified.
 *
 * The rows are chosen to cover what the rendering logic actually branches on:
 * a plain debit, a credit, a FAILED row (must zero out of both money columns),
 * a row carrying every charge component, a row carrying every earning
 * component, and one row per non-zero `response_status_id`.
 */

/** Builds a row from the zero-valued defaults. */
function row(overrides: Partial<TransactionRow>): TransactionRow {
	return {
		tid: "0000000000",
		tx_typeid: 1,
		tx_name: "Digi Khata Load Wallet",
		amount_dr: 0,
		amount_cr: 0,
		fee: 0,
		commission_earned: 0,
		bonus: 0,
		tds: 0,
		gst: 0,
		insurance_amount: 0,
		eko_service_charge: 0,
		eko_gst: 0,
		r_bal: 0,
		status: "Success",
		response_status_id: 0,
		datetime: "2026-04-16T11:49:00.000+05:30",
		...overrides,
	};
}

export const TRANSACTION_FIXTURE: TransactionRow[] = [
	row({
		tid: "2886973933",
		tx_name: "Digi Khata Load Wallet",
		amount_dr: 200000,
		r_bal: 2800000,
		status: "Failed",
		response_status_id: 1,
		datetime: "2026-04-16T11:49:00.000+05:30",
		customer_name: "Asha Verma",
		customer_mobile: "9876543210",
	}),
	row({
		tid: "2886973901",
		tx_name: "DMT Send Money",
		amount_dr: 5000,
		fee: 25,
		tds: 2,
		gst: 4,
		eko_gst: 3,
		r_bal: 2805000,
		datetime: "2026-04-16T11:40:00.000+05:30",
		customer_name: "Rakesh Kumar",
		customer_mobile: "9812345678",
		bank: "HDFC Bank",
		account: "50100123456789",
		rrn: "412345678901",
	}),
	row({
		tid: "2886973870",
		tx_name: "AePS Cash Withdrawal",
		amount_cr: 2000,
		commission_earned: 12,
		eko_service_charge: 3,
		bonus: 1,
		r_bal: 2810000,
		datetime: "2026-04-16T10:15:00.000+05:30",
		customer_name: "Sunita Devi",
		customer_mobile: "9701234567",
		bank: "State Bank of India",
	}),
	row({
		tid: "2886973844",
		tx_name: "Mobile Recharge",
		amount_dr: 299,
		fee: 2,
		r_bal: 2812000,
		status: "Initiated",
		response_status_id: 2,
		datetime: "2026-04-15T18:02:00.000+05:30",
		operator: "Airtel",
		customer_mobile: "9955512345",
	}),
	row({
		tid: "2886973812",
		tx_name: "Insurance Premium",
		amount_dr: 1500,
		insurance_amount: 120,
		gst: 21,
		r_bal: 2813799,
		status: "Refund initiated",
		response_status_id: 3,
		datetime: "2026-04-15T16:30:00.000+05:30",
		customer_name: "Imran Sheikh",
	}),
	row({
		tid: "2886973799",
		tx_name: "Settlement Payout",
		amount_dr: 50000,
		r_bal: 2863799,
		status: "Payment received",
		response_status_id: 5,
		datetime: "2026-04-15T12:00:00.000+05:30",
		bank: "ICICI Bank",
		account: "000501234567",
		trackingnumber: "TRK99881",
	}),
	row({
		tid: "2886973755",
		tx_name: "Digi Khata Load Wallet",
		amount_cr: 100000,
		r_bal: 2913799,
		status: "Scheduled",
		response_status_id: 8,
		datetime: "2026-04-14T09:45:00.000+05:30",
	}),
	row({
		tid: "2886973700",
		tx_name: "Bill Payment",
		amount_dr: 780,
		r_bal: 2914579,
		status: "Scheduled expired",
		response_status_id: 9,
		datetime: "2026-04-14T08:05:00.000+05:30",
		operator: "BSES Rajdhani",
	}),
	row({
		tid: "2886973688",
		tx_name: "UPI Collect",
		amount_cr: 3500,
		commission_earned: 7,
		r_bal: 2915359,
		datetime: "2026-04-13T19:20:00.000+05:30",
		recipient_name: "Meena Traders",
		recipient_mobile: "9888877777",
	}),
	row({
		tid: "2886973640",
		tx_name: "AePS Balance Enquiry",
		r_bal: 2915359,
		datetime: "2026-04-13T15:10:00.000+05:30",
		bank: "Punjab National Bank",
	}),
	row({
		tid: "2886973600",
		tx_name: "DMT Send Money",
		amount_dr: 10000,
		fee: 45,
		r_bal: 2925404,
		datetime: "2026-04-12T11:00:00.000+05:30",
		customer_name: "Vikram Rao",
		customer_mobile: "9600011122",
		bank: "Axis Bank",
	}),
	row({
		tid: "2886973560",
		tx_name: "Digi Khata Load Wallet",
		amount_cr: 500000,
		r_bal: 2935449,
		datetime: "2026-04-12T09:30:00.000+05:30",
	}),
];
