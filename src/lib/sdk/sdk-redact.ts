/**
 * Debug-mode masking classes baked into the SDK surface as `redact`. Every SDK
 * masks its debug output by these lists — see "Debug mode conformance" in
 * docs/sdk-golden-vector.md. Fail-closed: a key in none of the lists prints as
 * `****`, so a new or unknown field is hidden until someone classifies it here.
 *
 * Names are lowercase leaf names (`entries[].bank_account` → `bank_account`).
 */
import type { SdkEndpoint } from "@/lib/sdk/build-sdk-surface";

export interface SdkRedact {
	/** Printed raw when safe-shaped: Eko-issued ids, status codes, enums,
	 * amounts, timestamps. Never a free-form customer field. */
	safe: string[];
	/** Classified identifiers: printed as `****` + last 4. */
	last4: string[];
	/** Free text: printed after the text scrub (known values, digit runs, PAN,
	 * e-mail). */
	text: string[];
	/** Structural containers the masker walks into. */
	nest: string[];
}

const SAFE = [
	// Envelope and status codes.
	"status",
	"response_status_id",
	"response_type_id",
	"tx_status",
	"status_code",
	"service_status",
	"verification_status",
	"account_status_code",
	"kyc_state",
	// Ids issued by Eko or the upstream network.
	"tid",
	"reference_tid",
	"refund_tid",
	"client_ref_id", // caller-chosen: SDKs also require the `client-ref` format
	"otp_ref_id",
	"txn_otp_request_id",
	"kyc_request_id",
	"intent_id",
	"bulk_reference_id",
	"bulk_verification_id",
	"verification_id",
	"reference_id",
	"recipient_id",
	"beneficiary_id",
	"bank_recipient_id",
	"utr",
	"bank_ref_num",
	"bbpstrxnrefid",
	"upstream_rrn",
	"stan",
	"fp_transaction_id",
	"transaction_id",
	"user_code",
	"operator_id",
	"operator_location_id",
	"location_id",
	"service_code",
	"bank_id",
	"bank_code",
	"param_id",
	"data_type_id",
	"circleid",
	// Enums and codes.
	"type",
	"category",
	"channel",
	"currency",
	"payment_mode",
	"recipient_type",
	"recipient_id_type",
	"customer_id_type",
	"document_type",
	"document_requested",
	"shop_type",
	"source",
	"phone_operator_code",
	"account_type",
	"modelname",
	"txntype",
	"allowed_channel",
	"available_channel",
	"operator_category",
	"operator_category_id",
	"operator_category_group",
	"ifsc", // a bank branch code, not personal
	// Amounts, fees, limits (the partner's, never a customer balance).
	"amount",
	"fee",
	"totalfee",
	"total_amount",
	"totalamount",
	"refunded_amount",
	"collectable_amount",
	"commission",
	"tds",
	"gst",
	"service_tax",
	"remaining_limit",
	"next_allowed_limit",
	"total_monthly_limit",
	// Times and counters.
	"timestamp",
	"transaction_date",
	"transaction_time",
	"createdat",
	"last_updated_at",
	"otp_expiry_timestamp",
	"status_as_on",
	"count",
	"status_check_attempts",
	"status_check_gap",
	"status_check_start_in",
];

const LAST4 = [
	"aadhar",
	"aadhaar",
	"masked_aadhaar",
	"masked_aadhaar_number",
	"pan",
	"pan_no",
	"pan_number",
	"account",
	"bank_account",
	"bank_account_no",
	"utility_acc_no",
	"customer_id",
	"customer_mobile",
	"customermobilenumber",
	"mobile",
	"mobile_number",
	"phone",
	"recipient_mobile",
	"confirmation_mobile_no",
	"initiator_id",
	"customer_vpa",
	"vpa",
	"uan",
	"gstin",
	"cin",
	"din",
	"dl_number",
	"epic_number",
	"vehicle_number",
	"registration_number",
];

const TEXT = [
	"message",
	"error_message",
	"invalid_params",
	"reason",
	"comment",
	"comments",
	"description",
	"status_desc",
	"status_text",
	"txstatus_desc",
	"service_status_desc",
	"channel_desc",
	"pattern_error",
];

const NEST = [
	"data",
	"entries",
	"list_elements",
	"recipient_list",
	"service_list",
	"service_status_list",
	"fund_transfer_list",
	"param_attributes",
	"dependent_params",
];

/** Formats whose params are identifiers worth a last-4 hint. */
const LAST4_FORMATS = new Set(["aadhaar", "pan", "mobile"]);

/** Lowercase leaf name: `entries[].bank_account` → `bank_account`. */
export const redactKey = (name: string): string =>
	name.toLowerCase().replace(/^.*[.\]]/, "");

/**
 * The surface's `redact` object: the curated lists above plus every endpoint
 * param whose format marks it as an identifier, sorted for byte-stable output.
 */
export const buildRedact = (endpoints: SdkEndpoint[]): SdkRedact => {
	const last4 = new Set(LAST4);
	for (const e of endpoints)
		for (const p of e.params)
			if (p.format && LAST4_FORMATS.has(p.format)) last4.add(redactKey(p.name));
	const sorted = (names: Iterable<string>) => [...new Set(names)].sort();
	return {
		safe: sorted(SAFE),
		last4: sorted(last4),
		text: sorted(TEXT),
		nest: sorted(NEST),
	};
};
