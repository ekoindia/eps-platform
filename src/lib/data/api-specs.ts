/**
 * Technical REST API specifications for Eko's products — one entry per REST API.
 *
 * This is the single source of truth for endpoint-level technical details
 * (method, path, params, request/response shapes, error scenarios) used to
 * power product-page API previews and a future developer reference portal.
 *
 * DRY: shared elements are NOT duplicated here. Auth headers live in
 * `api-auth.ts`, common request params + response envelope + resolvers in
 * `api-specs-common.ts`, and the error-code table in `api-error-codes.ts`.
 * Each spec declares ONLY what is unique to it; use the resolvers
 * (`resolveHeaders`, `resolveRequestParams`, `resolveResponseFields`) to
 * reconstruct the full view.
 *
 * Many APIs map to one product (e.g. PAN -> PAN Lite / Advanced / Bulk). The
 * `productId` field is a foreign key into `API_PRODUCTS` (api-products.ts).
 *
 * NOTE: This file is generated/assembled from developer-portal data. Some
 * response shapes for JavaScript-rendered or rate-limited portal pages were
 * seeded from curated samples and should be reconciled against live API calls.
 */
import type { ApiSpec } from "./api-specs-common";

export const API_SPECS: ApiSpec[] = [
	// MARK: DMT
	{
		id: "dmt-get-sender",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Sender",
		name: "Get Sender Profile",
		slug: "dmt-get-sender",
		summary:
			"Fetch the DMT-Fino profile of a registered sender by mobile number.",
		description:
			"The first step in the DMT flow. Call this to check whether a customer is already registered as a DMT sender. If the sender exists, the response returns their profile and remaining transfer limits so you can skip registration.",
		relevance: "M",
		bestFor:
			"Checking sender registration status before starting a DMT transaction.",
		method: "GET",
		path: "/customer/payment/dmt-fino/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/fino-get-sender",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
			{
				name: "user_code",
				type: "string",
				required: true,
				description: "Agent user code (sent as a query parameter).",
				example: "20810200",
			},
		],
		responseData: [
			{
				name: "is_registered",
				type: "number",
				description:
					"Registration flag from the profile lookup. Read customer_profile.kyc_state to determine KYC completion.",
				example: 0,
			},
			{
				name: "next_allowed_limit",
				type: "number",
				imp: true,
				description: "Remaining remittance limit currently available (INR).",
				example: 25000.0,
			},
			{
				name: "kyc_state",
				type: "number",
				description: "Top-level KYC flag for the lookup response.",
				example: 0,
			},
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description: "Sender profile summary (present once KYC is complete).",
				children: [
					{
						name: "name",
						type: "string",
						description: "Sender name.",
						imp: true,
						example: "Rahul",
					},
					{
						name: "mobile",
						type: "string",
						description: "Sender's mobile number.",
						example: "9155927131",
					},
					{
						name: "balance",
						type: "string",
						description: "Sender wallet balance (INR).",
						example: "0.00",
					},
					{
						name: "total_monthly_limit",
						type: "string",
						description: "Sender's monthly remittance limit (INR).",
						example: "25000.0",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						description: "Remaining limit currently available (INR).",
						example: "25000.0",
					},
					{
						name: "kyc_state",
						type: "number",
						description: "Sender KYC state (1 = KYC complete on the profile).",
						imp: true,
						example: 1,
					},
					{
						name: "chart",
						type: "array",
						description: "Per-period limit-usage breakdown.",
						children: [
							{
								name: "data_type_id",
								type: "number",
								description: "Identifier for the limit period/bucket.",
								example: 10,
							},
							{
								name: "data",
								type: "object",
								description: "Limit usage for the period.",
								children: [
									{
										name: "unavailable",
										type: "number",
										description: "Amount blocked/unavailable (INR).",
										example: 0,
									},
									{
										name: "used",
										type: "number",
										description: "Amount already used (INR).",
										example: 0,
									},
									{
										name: "remaining",
										type: "number",
										description: "Remaining limit for the period (INR).",
										example: 25000,
									},
								],
							},
							{
								name: "label",
								type: "string",
								description: "Display label for the period.",
								example: "",
							},
						],
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: -1,
			response_type_id: 309,
			message: "Success!",
			data: {
				is_registered: 0,
				next_allowed_limit: 25000.0,
				kyc_state: 0,
				customer_profile: {
					total_monthly_limit: "25000.0",
					mobile: "9155927131",
					balance: "0.00",
					next_allowed_limit: "25000.0",
					name: "Rahul",
					kyc_state: 1,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 0, remaining: 25000 },
							label: "",
						},
					],
				},
			},
		},
		errorScenarios: [
			{
				scenario: "Sender not enrolled — proceed to Onboard Sender",
				statusCode: 200,
				example: {
					status: 308,
					response_status_id: 1,
					message: "Failure!Customer Not Enrolled",
					response_type_id: 308,
					data: { ekyc_enabled: "" },
				},
			},
			{
				scenario:
					"Enrolled on Eko, KYC pending on Fino — proceed to Sender eKYC",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Customer KYC Pending",
					response_type_id: 2134,
					data: { otp_ref_id: "" },
				},
			},
		],
		responseTypes: [
			{ id: 308, meaning: "Sender not found", next: "dmt-onboard-sender" },
			{ id: 309, meaning: "Sender found", next: "dmt-get-recipients" },
			{
				id: 2134,
				meaning: "Sender found, Biometric eKYC pending",
				next: "dmt-fino-sender-ekyc",
			},
			{
				id: 2129,
				meaning: "Sender found, Validate eKYC OTP pending",
				next: "dmt-fino-validate-ekyc-otp",
			},
		],
	},
	{
		id: "dmt-onboard-sender",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Sender",
		name: "Onboard Sender",
		slug: "dmt-onboard-sender",
		summary:
			"Register a new customer as a DMT-Fino sender using basic KYC details.",
		description:
			"Registers a new customer in the DMT-Fino system. Provide the customer's name, date of birth, and residence address. On success the sender is opened on Eko but KYC on Fino is still pending — complete biometric eKYC (Sender eKYC → Validate eKYC OTP) next. If the sender was already onboarded on Fino externally, the response instead matches the KYC-complete profile from Get Sender Profile (response_type_id 309) and no eKYC is required. After onboarding, call Get Sender Profile to read the sender's current stage.",
		relevance: "M",
		bestFor: "First-time sender registration in the DMT flow.",
		method: "POST",
		path: "/customer/payment/dmt-fino/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/create-customer",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description:
					"Sender's 10-digit mobile number (used as customer identifier).",
				example: "9123456789",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Full name of the sender as per their ID proof.",
				example: "Ramesh Kumar",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description: "Date of birth in YYYY-MM-DD format.",
				example: "1990-05-15",
			},
			{
				name: "residence_address",
				type: "string",
				required: true,
				description:
					"Customer's residence address as a JSON-encoded object with keys: line, city, state, pincode, district, area.",
				example:
					'{"line":"India","city":"Indore","state":"Madhya Pradesh","pincode":"226024","district":"Indore","area":"gita bhavan"}',
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"OTP reference placeholder returned with the KYC-pending status. Empty until eKYC is initiated via Sender eKYC.",
				example: "",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Customer KYC Pending",
			response_type_id: 2134,
			data: { otp_ref_id: "" },
		},
		errorScenarios: [
			{
				scenario:
					"Alternate success — sender already onboarded on Eko, KYC pending",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Wallet opened successfully.",
					response_type_id: 300,
					data: {
						customer_id_type: "mobile_number",
						state_desc: "Non-Kyc",
						state: "2",
						customer_id: "9002331157",
					},
				},
			},
		],
		responseTypes: [
			{
				id: 2134,
				meaning: "Onboarded, KYC pending — proceed to Sender eKYC",
				next: "dmt-fino-sender-ekyc",
			},
			{
				id: 300,
				meaning:
					"Already onboarded, KYC pending — re-check stage with Get Sender Profile",
				next: "dmt-get-sender",
			},
			{
				id: 309,
				meaning:
					"Already onboarded on Fino — KYC complete, proceed to Recipients",
				next: "dmt-get-recipients",
			},
		],
	},
	{
		id: "dmt-fino-sender-ekyc",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Sender",
		name: "Sender eKYC (Biometric)",
		slug: "dmt-fino-sender-ekyc",
		summary:
			"Initiate biometric Aadhaar eKYC to verify and upgrade a DMT sender's account.",
		description:
			"Performs biometric eKYC using fingerprint data linked to the sender's Aadhaar number. Requires a compatible RD-service device; the PID XML is captured at the agent's terminal and submitted with the sender's Aadhaar number (include the `wadh` value when generating the PID). On success the system dispatches an OTP for confirmation; call Validate eKYC OTP next. A successful eKYC upgrades the sender's monthly limit from ₹5,000 to ₹25,000.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		descriptionFile: "dmt-fino-sender-ekyc.md",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "M",
		bestFor: "KYC upgrade for new senders to raise monthly transfer limits.",
		method: "PUT",
		path: "/customer/payment/dmt-fino/sender/{customer_id}/otp",
		docsUrl: "https://developers.eko.in/reference/fino-dmt-customer-kyc",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description: "12-digit Aadhaar number of the sender.",
				example: "234567890123",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"XML-encoded biometric PID data captured from a certified biometric device (fingerprint scanner).",
				example:
					'<PidData><Resp errCode="0" errInfo="Capture Success" .../></PidData>',
			},
		],
		responseData: [
			{
				name: "user_code",
				type: "string",
				description: "Agent user code associated with the KYC request.",
				example: "10472151",
			},
			{
				name: "intent_id",
				type: "string",
				description: "Reserved intent identifier (empty in the standard flow).",
				example: "",
			},
			{
				name: "kyc_request_id",
				type: "string",
				description:
					"Unique identifier for this KYC request. Required for the Validate eKYC OTP step.",
				imp: true,
				example: "9332126",
			},
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID for the OTP sent to the sender's Aadhaar-linked mobile. Required for the Validate eKYC OTP step.",
				imp: true,
				example: "666803844",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Validate the OTP",
			response_type_id: 2129,
			data: {
				user_code: "10472151",
				intent_id: "",
				kyc_request_id: "9332126",
				otp_ref_id: "666803844",
			},
		},
		errorScenarios: [
			{
				scenario: "Incorrect PID data — eKYC verification failed",
				statusCode: 200,
				example: {
					status: 2135,
					response_status_id: 1,
					message: "Customer KYC Pending",
					response_type_id: 2135,
					data: { description: "K-100 EKYC Verification failed" },
				},
			},
			{
				scenario: "Sender already has an existing relationship with the bank",
				statusCode: 200,
				example: {
					status: 2135,
					response_status_id: 1,
					message: "Customer KYC Pending",
					response_type_id: 2135,
					data: {
						description:
							"Sorry! Since you already have an existing relationship with the bank",
					},
				},
			},
		],
		responseTypes: [
			{
				id: 2129,
				meaning: "OTP sent — proceed to Validate eKYC OTP",
				next: "dmt-fino-validate-ekyc-otp",
			},
		],
	},
	{
		id: "dmt-fino-validate-ekyc-otp",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Sender",
		name: "Validate eKYC OTP",
		slug: "dmt-fino-validate-ekyc-otp",
		summary:
			"Confirm sender eKYC by verifying the OTP sent to the Aadhaar-linked mobile.",
		description:
			"Final step of the sender eKYC flow. Submit the OTP received on the Aadhaar-linked mobile number along with the otp_ref_id and kyc_request_id from the Sender eKYC response. On success the sender's account is upgraded to fully KYC-verified status with a ₹25,000 monthly limit.",
		relevance: "M",
		bestFor: "Completing sender eKYC after biometric capture.",
		method: "PUT",
		path: "/customer/payment/dmt-fino/sender/{customer_id}/otp/verify",
		docsUrl: "https://developers.eko.in/reference/fino-validate-aadhar",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
			{
				name: "otp",
				type: "string",
				required: true,
				description:
					"One-time password received on the sender's Aadhaar-linked mobile number.",
				example: "784512",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description:
					"OTP reference ID returned by the Sender eKYC (or Onboard Sender) API call.",
				example: "OTPREF20240101001",
			},
			{
				name: "kyc_request_id",
				type: "string",
				required: true,
				description:
					"KYC request identifier returned by the Sender eKYC API call.",
				example: "KYC20240101001",
			},
		],
		responseData: [
			{
				name: "user_code",
				type: "string",
				description:
					"Agent user code for the now KYC-verified sender. eKYC is complete on success.",
				imp: true,
				example: "10472151",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Customer Registration Completed",
			response_type_id: 2132,
			data: { user_code: "10472151" },
		},
		errorScenarios: [
			{
				scenario: "Sender already registered",
				statusCode: 200,
				example: {
					status: 2131,
					response_status_id: 1,
					message: "Validate OTP Failed",
					response_type_id: 2131,
					data: { description: "Customer Already registred" },
				},
			},
			{
				scenario: "Incorrect OTP entered",
				statusCode: 200,
				example: {
					status: 2131,
					response_status_id: 302,
					message: "Validate OTP Failed",
					response_type_id: 2131,
					data: { description: "Wrong OTP" },
				},
			},
			{
				scenario: "OTP has expired",
				statusCode: 200,
				example: {
					status: 2131,
					response_status_id: 303,
					message: "Validate OTP Failed",
					response_type_id: 2131,
					data: { description: "OTP expired" },
				},
			},
		],
	},
	{
		id: "dmt-get-recipients",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Recipients",
		name: "Get Recipients",
		slug: "dmt-get-recipients",
		summary: "Retrieve the list of saved beneficiaries for a DMT sender.",
		description:
			"Returns all beneficiaries (recipients) previously registered under the sender's DMT-Fino account. Use this before initiating a transfer — if the desired beneficiary already exists you can use their recipient_id directly to send money, skipping Add Recipient.",
		relevance: "M",
		bestFor:
			"Listing a sender's saved beneficiaries before initiating a transfer.",
		method: "GET",
		path: "/customer/payment/dmt-fino/sender/{customer_id}/recipients",
		docsUrl: "https://developers.eko.in/reference/fino-get-recipients",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
		],
		responseData: [
			{
				name: "pan_required",
				type: "number",
				description: "PAN requirement flag for the sender.",
				example: 2,
			},
			{
				name: "remaining_limit_before_pan_required",
				type: "number",
				description:
					"Amount the sender can still transfer before PAN becomes mandatory (INR).",
				example: 50000.0,
			},
			{
				name: "recipient_list",
				type: "array",
				description: "Registered beneficiaries for this sender.",
				children: [
					{
						name: "recipient_id",
						type: "number",
						description:
							"Identifier used in the Send Transaction OTP and Execute Transaction APIs.",
						imp: true,
						example: 117015428,
					},
					{
						name: "beneficiary_id",
						type: "number",
						description: "Beneficiary identifier (mirrors recipient_id).",
						example: 117015428,
					},
					{
						name: "bank_recipient_id",
						type: "number",
						description: "Bank-side recipient identifier.",
						example: 117015428,
					},
					{
						name: "recipient_name",
						type: "string",
						description: "Beneficiary name.",
						imp: true,
						example: "yashwant basnett",
					},
					{
						name: "recipient_mobile",
						type: "string",
						description: "Beneficiary mobile number.",
						example: "9002331157",
					},
					{
						name: "bank",
						type: "string",
						description: "Beneficiary bank name.",
						example: "State Bank of India",
					},
					{
						name: "ifsc",
						type: "string",
						description: "Beneficiary bank IFSC code.",
						example: "SBIN0007515",
					},
					{
						name: "account",
						type: "string",
						description: "Beneficiary bank account number.",
						example: "38759149196",
					},
					{
						name: "account_type",
						type: "string",
						description: "Type of the beneficiary account.",
						example: "Bank Account",
					},
					{
						name: "ifsc_status",
						type: "number",
						description: "Whether the IFSC is valid/active (1 = valid).",
						example: 1,
					},
					{
						name: "is_verified",
						type: "number",
						description:
							"Whether the account has been penny-drop verified (1 = verified).",
						example: 0,
					},
					{
						name: "is_otp_required",
						type: "string",
						description:
							"Whether an OTP is required to transact to this recipient.",
						example: "0",
					},
					{
						name: "pipes",
						type: "object",
						description:
							"Available settlement pipes for this recipient, keyed by pipe id.",
						example: { "3": { pipe: 3, status: 1 } },
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 23,
			data: {
				pan_required: 2,
				recipient_list: [
					{
						recipient_id: 117015428,
						beneficiary_id: 117015428,
						bank_recipient_id: 117015428,
						recipient_name: "yashwant basnett",
						recipient_mobile: "9002331157",
						bank: "State Bank of India",
						ifsc: "SBIN0007515",
						account: "38759149196",
						account_type: "Bank Account",
						ifsc_status: 1,
						is_verified: 0,
						is_otp_required: "0",
						pipes: { "3": { pipe: 3, status: 1 } },
					},
				],
				remaining_limit_before_pan_required: 50000.0,
			},
		},
		errorScenarios: [
			{
				scenario: "No recipients registered yet — add one",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: -1,
					message: "No recepients found",
					response_type_id: 22,
				},
			},
			{
				scenario: "Customer does not exist in system",
				statusCode: 200,
				example: {
					status: 463,
					response_status_id: 1,
					message: "customer_id does not exist in system",
					response_type_id: -1,
					invalid_params: { customer_id: "Customer does not exist in System" },
				},
			},
		],
		responseTypes: [
			{
				id: 22,
				meaning: "No recipients — add one before transacting",
				next: "dmt-add-recipient",
			},
			{
				id: 23,
				meaning: "Recipients found — proceed to Send Transaction OTP",
				next: "dmt-send-otp",
			},
		],
	},
	{
		id: "dmt-add-recipient",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Recipients",
		name: "Add Recipient",
		slug: "dmt-add-recipient",
		summary: "Register a new beneficiary under a sender's DMT-Fino account.",
		description:
			"Adds a new beneficiary to the sender's saved recipients list. Provide the recipient's full name, bank account number, IFSC code, and mobile number. On success a recipient_id is returned; use it in Send Transaction OTP and Execute Transaction. The system may validate the account via penny-drop before activating the recipient.",
		relevance: "M",
		bestFor: "Adding a new beneficiary before a first-time transfer.",
		method: "POST",
		path: "/customer/payment/dmt-fino/sender/{customer_id}/recipient",
		docsUrl: "https://developers.eko.in/reference/fino-add-recipient",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
			{
				name: "recipient_mobile",
				type: "string",
				required: true,
				description: "Beneficiary's 10-digit mobile number.",
				example: "9002331157",
			},
			{
				name: "recipient_name",
				type: "string",
				required: true,
				description:
					"Full name of the beneficiary as it appears on their bank account.",
				example: "yashwant basnett",
			},
			{
				name: "ifsc",
				type: "string",
				required: true,
				description: "IFSC code of the beneficiary's bank branch.",
				example: "SBIN0007515",
			},
			{
				name: "account",
				type: "string",
				required: true,
				description: "Beneficiary's bank account number.",
				example: "38759149196",
			},
		],
		responseData: [
			{
				name: "recipient_id",
				type: "number",
				description:
					"Unique identifier assigned to the newly added recipient. Required for Send Transaction OTP and Execute Transaction.",
				imp: true,
				example: 117015428,
			},
			{
				name: "customer_id",
				type: "string",
				description: "Sender's mobile number (echoed back).",
				example: "9155927131",
			},
			{
				name: "recipient_mobile",
				type: "string",
				description: "Beneficiary mobile number (echoed back).",
				example: "9002331157",
			},
			{
				name: "initiator_id",
				type: "string",
				description: "Partner initiator ID (echoed back).",
				example: "<initiator_id>",
			},
			{
				name: "pipes",
				type: "object",
				description: "Available settlement pipes for the new recipient.",
				example: {},
			},
			{
				name: "otp_ref_id",
				type: "string",
				description: "OTP reference placeholder (empty on add).",
				example: "",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success!Please transact using Recipientid",
			response_type_id: 43,
			data: {
				recipient_id: 117015428,
				customer_id: "9155927131",
				recipient_mobile: "9002331157",
				initiator_id: "<initiator_id>",
				pipes: {},
				otp_ref_id: "",
			},
		},
		errorScenarios: [
			{
				scenario: "Recipient already registered for this sender",
				statusCode: 200,
				example: {
					status: 342,
					response_status_id: 1,
					message: "Recipient already registered",
					response_type_id: -1,
					data: {},
				},
			},
			{
				scenario: "Customer does not exist in system",
				statusCode: 200,
				example: {
					status: 463,
					response_status_id: 1,
					message: "customer_id does not exist in system",
					response_type_id: -1,
					invalid_params: { customer_id: "Customer does not exist in System" },
				},
			},
		],
		responseTypes: [
			{
				id: 43,
				meaning: "Recipient added — proceed to Send Transaction OTP",
				next: "dmt-send-otp",
			},
		],
	},
	{
		id: "dmt-send-otp",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Transaction",
		name: "Send Transaction OTP",
		slug: "dmt-send-otp",
		summary:
			"Request an OTP to the sender's mobile number to authorise an upcoming money transfer.",
		description:
			"Sends an OTP to the sender's registered mobile number as a pre-authorisation step before initiating the actual money transfer. Provide the recipient_id, the transfer amount, and the sender's customer_id. The returned otp_ref_id must be passed to Initiate Transfer along with the OTP entered by the customer.",
		relevance: "M",
		bestFor:
			"Pre-authorising a DMT transfer by triggering OTP dispatch to the sender.",
		method: "POST",
		path: "/customer/payment/dmt-fino/otp",
		docsUrl: "https://developers.eko.in/reference/fino-otp-transaction",
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "number",
				required: true,
				description:
					"Unique recipient ID returned by Add Recipient or Get Recipients.",
				example: 98765,
			},
			{
				name: "amount",
				type: "number",
				required: true,
				description: "Transfer amount in INR (integer, no decimals).",
				example: 500,
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9123456789",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID for the OTP sent. Must be passed to Execute Transaction along with the customer-entered OTP.",
				imp: true,
				example: "666902416",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Send OTP",
			response_type_id: 2133,
			data: {
				otp_ref_id: "666902416",
			},
		},
		errorScenarios: [
			{
				scenario: "Sender monthly limit exhausted",
				statusCode: 200,
				example: {
					status: 36,
					response_type_id: 36,
					response_status_id: 1,
					message: "Sender/beneficiary monthly limit exhausted",
					data: {},
				},
			},
			{
				scenario: "Beneficiary monthly limit exhausted",
				statusCode: 200,
				example: {
					status: 945,
					response_type_id: 945,
					response_status_id: 1,
					message: "Beneficiary monthly limit exhausted",
					data: {},
				},
			},
			{
				scenario: "Customer does not exist in system",
				statusCode: 200,
				example: {
					status: 463,
					response_status_id: 1,
					message: "customer_id does not exist in system",
					response_type_id: -1,
					invalid_params: { customer_id: "Customer does not exist in System" },
				},
			},
		],
		responseTypes: [
			{
				id: 2133,
				meaning: "Transaction OTP sent — proceed to Execute Transaction",
				next: "dmt-initiate-transfer",
			},
		],
	},
	{
		id: "dmt-initiate-transfer",
		productId: "dmt",
		provider: "DMT – Fino",
		group: "Transaction",
		name: "Initiate Transfer",
		slug: "dmt-initiate-transfer",
		summary: "Execute a DMT-Fino money transfer after OTP verification.",
		description:
			"The final and only financial step in the DMT flow. Debits the agent's wallet and initiates an IMPS transfer to the registered recipient's bank account after OTP validation. Requires the otp and otp_ref_id from Send Transaction OTP plus a unique client_ref_id per attempt for idempotency and reconciliation. The response returns tid (Eko transaction ID) and bank_ref_num (the IMPS RRN/UTR). Use a fresh otp_ref_id and OTP for each attempt — a consumed OTP is rejected — and always persist tid, bank_ref_num, and your client_ref_id to reconcile before retrying.",
		relevance: "M",
		bestFor:
			"Executing the actual money transfer — the only money-debit step in the DMT flow.",
		method: "POST",
		path: "/customer/payment/dmt-fino",
		docsUrl: "https://developers.eko.in/reference/initiate-transaction-fino",
		financial: true,
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "number",
				required: true,
				description:
					"Unique recipient ID from Add Recipient or Get Recipients.",
				example: 117015428,
			},
			{
				name: "amount",
				type: "number",
				required: true,
				description:
					"Transfer amount in INR (must match the amount sent to Send Transaction OTP).",
				example: 100,
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9155927131",
			},
			{
				name: "otp",
				type: "string",
				required: true,
				description:
					"OTP entered by the customer, received on their registered mobile.",
				example: "4702",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description: "OTP reference ID from the Send Transaction OTP response.",
				example: "667007109",
			},
			{
				name: "client_ref_id",
				type: "string",
				required: true,
				description:
					"Unique partner reference for this transaction (idempotency & reconciliation). Use a fresh value per attempt.",
				example: "<unique_client_ref_id>",
			},
		],
		responseData: [
			{
				name: "tx_status",
				type: "string",
				description:
					"Transaction state within the data block: 0=Success, 1=Fail, 2=Awaited.",
				imp: true,
				example: "0",
			},
			{
				name: "txstatus_desc",
				type: "string",
				description: "Human-readable transaction status.",
				example: "Success",
			},
			{
				name: "tid",
				type: "string",
				description:
					"Eko's internal transaction ID. Store for reconciliation and support queries.",
				imp: true,
				example: "3570311831",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description:
					"Bank reference number (RRN / UTR) for the IMPS transaction.",
				imp: true,
				example: "620415011744",
			},
			{
				name: "amount",
				type: "string",
				description: "Amount transferred (INR).",
				imp: true,
				example: "100.00",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the transfer (INR).",
				example: "10.0",
			},
			{
				name: "collectable_amount",
				type: "string",
				description: "Total collectable from the sender (amount + fee).",
				example: "110.0",
			},
			{
				name: "service_tax",
				type: "string",
				description: "Service tax component on the fee (INR).",
				example: "1.53",
			},
			{
				name: "tds",
				type: "string",
				description: "Tax deducted at source on the agent's commission (INR).",
				example: "0.01",
			},
			{
				name: "commission",
				type: "string",
				description:
					"Commission earned by the agent on this transaction (INR).",
				example: "0.47",
			},
			{
				name: "sender_name",
				type: "string",
				description: "Name of the sender.",
				example: "Rahul",
			},
			{
				name: "recipient_name",
				type: "string",
				description: "Name of the beneficiary credited.",
				imp: true,
				example: "Master YASHWANT BASNETT",
			},
			{
				name: "recipient_id",
				type: "number",
				description: "Recipient identifier credited.",
				example: 117015428,
			},
			{
				name: "bank",
				type: "string",
				description: "Beneficiary bank name.",
				example: "State Bank of India",
			},
			{
				name: "account",
				type: "string",
				description: "Beneficiary account number credited.",
				example: "38759149196",
			},
			{
				name: "channel_desc",
				type: "string",
				description: "Settlement channel used (e.g. IMPS).",
				example: "IMPS",
			},
			{
				name: "balance",
				type: "string",
				description: "Agent wallet balance after the transaction (INR).",
				imp: true,
				example: "10131.18",
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Echo of the partner reference sent in the request.",
				example: "<unique_client_ref_id>",
			},
			{
				name: "currency",
				type: "string",
				description: "Currency code.",
				example: "INR",
			},
			{
				name: "timestamp",
				type: "string",
				description: "Server-side timestamp of the transaction.",
				example: "2026-07-23T09:46:35.396Z",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Transaction successful",
			response_type_id: 325,
			data: {
				tx_status: "0",
				txstatus_desc: "Success",
				tid: "3570311831",
				amount: "100.00",
				fee: "10.0",
				collectable_amount: "110.0",
				service_tax: "1.53",
				tds: "0.01",
				commission: "0.47",
				sender_name: "Rahul",
				recipient_name: "Master YASHWANT BASNETT",
				recipient_id: 117015428,
				bank: "State Bank of India",
				account: "38759149196",
				channel_desc: "IMPS",
				bank_ref_num: "620415011744",
				balance: "10131.18",
				client_ref_id: "<unique_client_ref_id>",
				currency: "INR",
				timestamp: "2026-07-23T09:46:35.396Z",
			},
		},
		errorScenarios: [
			{
				scenario: "Transaction declined — OTP already consumed",
				statusCode: 200,
				example: {
					status: 55,
					response_status_id: 1,
					message: "Transaction declined. Please try after sometime.",
					response_type_id: 55,
					data: {
						tx_status: "1",
						txstatus_desc: "Failed",
						reason: "OTP already Consumed",
						amount: "100.00",
						tid: "3570311840",
						client_ref_id: "<unique_client_ref_id>",
						balance: "10021.64",
					},
				},
			},
			{
				scenario: "Transaction declined — insufficient balance in agent wallet",
				statusCode: 200,
				example: {
					status: 55,
					response_status_id: 1,
					message: "Transaction declined. Please try after sometime.",
					response_type_id: 55,
					data: {
						tx_status: "1",
						txstatus_desc: "Failed",
						reason: "Insufficient balance",
					},
				},
			},
			{
				scenario: "Transaction declined — wrong OTP entered",
				statusCode: 200,
				example: {
					status: 55,
					response_status_id: 1,
					message: "Transaction declined. Please try after sometime.",
					response_type_id: 55,
					data: {
						tx_status: "1",
						txstatus_desc: "Failed",
						reason: "Wrong OTP",
					},
				},
			},
			{
				scenario: "Transaction declined — sender monthly limit exhausted",
				statusCode: 200,
				example: {
					status: 55,
					response_status_id: 1,
					message: "Transaction declined. Please try after sometime.",
					response_type_id: 55,
					data: {
						tx_status: "1",
						txstatus_desc: "Failed",
						reason: "Sender/beneficiary monthly limit exhausted",
					},
				},
			},
			{
				scenario:
					"Transaction awaited (non-final) — reconcile by tid before retrying",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Transaction in progress",
					data: {
						tx_status: "2",
						txstatus_desc: "Awaited",
						tid: "3570311831",
						amount: "100.00",
					},
				},
			},
		],
	},
	// MARK: AePS
	{
		id: "activate-aeps-fingpay",
		productId: "aeps",
		name: "Activate AePS Fingpay for Agent",
		slug: "activate-aeps-fingpay",
		provider: "AePS – Fingpay",
		group: "Activate for Agent",
		summary:
			"Enable AePS Fingpay service for your agent by submitting their biometric device details and KYC documents.",
		description:
			"This API enables an agent (identified by their `user_code`) to use the AePS Fingpay service. It accepts the agent's biometric device model, serial number, address proofs, and KYC documents (PAN card, Aadhaar front and back) as a multipart form submission. After submission, the activation enters a 'pending' state and is approved within 2–3 business days. Only activated agents can perform AePS transactions. File uploads must be JPEG/JPG/PDF format, each under 1 MB; PNG is not accepted.\n\n> [!NOTE]\n> This API must be called after onboarding your agent using the [**Onboard User API**](/docs/onboard-user).\n\n> [!WARNING]\n> The approval may take 1-2 business days.",
		relevance: "M",
		bestFor:
			"Platforms onboarding BC agents and CSPs to offer AePS services for the first time",
		method: "PUT",
		path: "/admin/network/agent/{user_code}/aeps-fingpay/activate",
		docsUrl: "https://developers.eko.in/reference/activate-aeps-fingpay",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of the agent for whom AePS Fingpay service is being activated.",
				example: "20810200",
			},
			{
				name: "modelname",
				type: "string",
				required: true,
				description:
					"Model name/designation of the UIDAI-certified biometric device (e.g., Morpho 1300E3, Mantra MFS100).",
				example: "Morpho 1300E3",
			},
			{
				name: "devicenumber",
				type: "string",
				required: true,
				description:
					"Serial number of the biometric device as printed on the device or its packaging.",
				example: "SN1234567890",
			},
			{
				name: "shop_type",
				type: "number",
				required: true,
				description:
					"The shop-type ID of the Agent. Use `Get Shop Types` API for a list of shop-types and corresponding IDs",
				example: 4215,
			},
			{
				name: "office_address",
				type: "object",
				required: true,
				description:
					"Agent's current office/operating address as a JSON object with keys: line, city, state, state_id, pincode. To get state_id, see the `Get States` API",
				example: {
					line: "Shop No. 5, Gandhi Market",
					city: "Gurgaon",
					state: "Haryana",
					state_id: 23,
					pincode: "122003",
				},
			},
			{
				name: "address_as_per_proof",
				type: "object",
				required: true,
				description:
					"Agent's address exactly as it appears on the submitted address proof document. JSON object with keys: line, city, state, sate_id, pincode. To get state_id, see the `Get States` API",
				example: {
					line: "Shop No. 5, Gandhi Market",
					city: "Gurgaon",
					state: "Haryana",
					state_id: 23,
					pincode: "122003",
				},
			},
			{
				name: "pan_card",
				type: "file",
				required: true,
				description:
					"PAN card document upload (multipart/form-data). Accepted formats: JPEG, JPG, PDF. Max size: 1 MB. PNG not accepted.",
				example: "<binary file>",
			},
			{
				name: "aadhar",
				label: "Aadhaar Number",
				type: "string",
				required: true,
				description: "12-digit Aadhaar number of the sender.",
				example: "123456789012",
			},
			{
				name: "aadhar_front",
				label: "Aadhaar Front Image",
				type: "file",
				required: true,
				description:
					"Front side of the Aadhaar card (multipart/form-data). Accepted formats: JPEG, JPG, PDF. Max size: 1 MB.",
				example: "<binary file>",
			},
			{
				name: "aadhar_back",
				label: "Aadhaar Back Image",
				type: "file",
				required: true,
				description:
					"Back side of the Aadhaar card (multipart/form-data). Accepted formats: JPEG, JPG, PDF. Max size: 1 MB.",
				example: "<binary file>",
			},
			{
				name: "latlong",
				label: "Geolocation",
				type: "string",
				required: true,
				description:
					"GPS coordinates of the agent for whom AePS Fingpay service is being activated. Format: <latitude,longitude>",
				example: "28.6139,77.2090",
			},
		],
		responseTypes: [
			{
				id: 1259,
				meaning: "AePS Registration Successful",
				next: "dmt-onboard-sender",
			},
			{ id: 1297, meaning: "User does not exist", next: "onboard-user" },
		],
		responseData: [
			{
				name: "service_status_desc",
				type: "string",
				description:
					"Current state of the AePS Fingpay activation request. 'pending' means documents are submitted and under review.",
				imp: true,
				example: "pending",
			},
			{
				name: "service_status",
				type: "number",
				description: "State-id of the AePS Fingpay activation request.",
				imp: true,
				example: "ACT20240101001",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			response_type_id: 1259,
			message: "AePS Registration Successful",
			data: {
				service_status_desc: "Activated",
				balance: "",
				user_code: "37659001",
				initiator_id: "7042769383",
				service_status: "1",
				service_code: "43",
				remarks: "",
			},
		},
		errorScenarios: [
			{
				scenario: "Agent not onboarded",
				statusCode: 200,
				example: {
					status: 1297,
					response_status_id: 1,
					response_type_id: 1297,
					message: "This user does not exist",
					data: {
						initiator_id: "",
					},
				},
			},
		],
	},
	{
		id: "aeps-fingpay-shop-types",
		productId: "aeps",
		name: "Get Shop Types",
		slug: "aeps-fingpay-shop-types",
		provider: "AePS – Fingpay",
		group: "Activate for Agent",
		summary:
			"List the Merchant Category Codes (MCC) available for AePS Fingpay agent onboarding.",
		description:
			"Returns the list of Merchant Category Codes (MCC). Use the `value` of the chosen entry as the `shop_type` in the Activate AePS Fingpay request.",
		relevance: "M",
		bestFor:
			"Populating the shop-type dropdown before onboarding an agent for AePS Fingpay",
		method: "GET",
		path: "/user/collection/aeps-fingpay/get-Mcc-Category",
		docsUrl: "https://developers.eko.in/reference/activate-aeps-fingpay",
		extraRequestParams: [],
		responseTypes: [
			{
				id: 2110,
				meaning: "Shop-type list returned successfully",
				next: "activate-aeps-fingpay",
			},
		],
		responseData: [
			{
				name: "param_attributes",
				type: "object",
				description: "Container for the returned list.",
				children: [
					{
						name: "list_elements",
						type: "array",
						description: "Array of available MCC categories.",
						imp: true,
						children: [
							{
								name: "label",
								type: "string",
								description:
									"Human-readable category name (display to the agent).",
								example: "Electronics Shops",
							},
							{
								name: "value",
								type: "number",
								description:
									"Integer MCC code — use as `shop_type` in the Activate AePS Fingpay request.",
								imp: true,
								example: 5732,
							},
						],
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			param_attributes: {
				list_elements: [
					{
						label: "Courier services — air and ground and freight forwarders",
						value: 4215,
					},
					{ label: "Travel agencies and tour operators", value: 4722 },
					{ label: "Groceries and supermarkets", value: 5411 },
					{ label: "Electronics Shops", value: 5732 },
					{ label: "Fast food restaurants", value: 5814 },
				],
			},
			response_type_id: 2110,
			message: "Success",
			status: 0,
		},
	},
	{
		id: "aeps-fingpay-states",
		productId: "aeps",
		name: "Get States",
		slug: "aeps-fingpay-states",
		provider: "AePS – Fingpay",
		group: "Activate for Agent",
		summary:
			"List the states (with their state_id) available for AePS Fingpay agent onboarding.",
		description:
			"Returns the list of states. Use the `value` of the chosen state as the `state_id` inside the `address_as_per_proof` and `office_address` objects in the Activate AePS Fingpay request.",
		relevance: "M",
		bestFor:
			"Populating the state dropdown for the agent address before AePS Fingpay onboarding",
		method: "GET",
		path: "/user/collection/aeps-fingpay/get-states",
		docsUrl: "https://developers.eko.in/reference/activate-aeps-fingpay",
		extraRequestParams: [],
		responseTypes: [
			{
				id: 2127,
				meaning: "State list returned successfully",
				next: "activate-aeps-fingpay",
			},
		],
		responseData: [
			{
				name: "param_attributes",
				type: "object",
				description: "Container for the returned list.",
				children: [
					{
						name: "list_elements",
						type: "array",
						description: "Array of available states.",
						imp: true,
						children: [
							{
								name: "stateCode",
								type: "string",
								description: "Two-letter state code.",
								example: "MH",
							},
							{
								name: "label",
								type: "string",
								description: "State name (display to the agent).",
								example: "Maharashtra",
							},
							{
								name: "value",
								type: "number",
								description:
									"Integer state ID — use as `state_id` in the address objects.",
								imp: true,
								example: 15,
							},
						],
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			param_attributes: {
				list_elements: [
					{ stateCode: "HR", label: "Haryana", value: 8 },
					{ stateCode: "KA", label: "Karnataka", value: 12 },
					{ stateCode: "MH", label: "Maharashtra", value: 15 },
					{ stateCode: "SK", label: "Sikkim", value: 23 },
					{ stateCode: "UP", label: "Uttar Pradesh", value: 27 },
				],
			},
			response_type_id: 2127,
			message: "Success",
			status: 0,
		},
	},
	{
		id: "aeps-fingpay-send-otp-kyc",
		productId: "aeps",
		name: "Send OTP (eKYC)",
		slug: "aeps-fingpay-send-otp-kyc",
		provider: "AePS – Fingpay",
		group: "Agent eKYC (1-Time)",
		summary:
			"Initiate AePS Fingpay eKYC by sending an OTP to the agent's registered Aadhaar-linked mobile number.",
		description:
			"First-time KYC follows three steps in order: `Send OTP` → `Verify OTP` → `Biometric`. On subsequent days, use the Daily KYC (biometric-only) endpoint.\n\nThis is the first step in the one-time AePS Fingpay eKYC flow. The OTP is delivered to the number passed in `customer_id`. The eKYC flow — Send OTP → Verify OTP → Biometric — must be completed once per agent before they can perform any AePS transactions. This step is a prerequisite; do not confuse it with the Daily KYC which is required on each calendar day.",
		relevance: "M",
		bestFor:
			"Initial one-time KYC setup for newly activated AePS Fingpay agents",
		method: "POST",
		path: "/user/collection/aeps-fingpay/kyc/otp",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					"RSA-encrypted, Base64-encoded Aadhaar number of the agent undergoing eKYC.",
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description:
					"Registered mobile number of the agent/merchant undergoing eKYC. The OTP is delivered to this number.",
				example: "9123456789",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Required for security and fraud prevention.",
				example: "28.6139,77.2090",
			},
		],
		responseTypes: [
			{
				id: 1600,
				meaning: "OTP request has been sent",
				next: "aeps-fingpay-verify-otp-kyc",
			},
		],
		responseData: [
			{
				name: "reference_tid",
				type: "string",
				description:
					"Transaction reference ID for this eKYC session. Must be passed to the Verify OTP API.",
				imp: true,
				example: "EKYKF4719702240123152147525I",
			},
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID for the OTP session. Must be passed to the Verify OTP API.",
				imp: true,
				example: "2465238",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				reference_tid: "EKYKF4719702240123152147525I",
				otp_ref_id: "2465238",
			},
			response_type_id: 1600,
			message: "OTP request has been sent",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "AePS Fingpay service not activated for this agent",
				statusCode: 200,
				example: {
					response_status_id: 1,
					response_type_id: 346,
					message: "Agent not allowed to this transaction",
					status: 346,
				},
			},
			{
				scenario: "Incorrectly encrypted Aadhaar",
				statusCode: 200,
				example: {
					response_status_id: 1,
					invalid_params: {
						aadhar: "Please provide the value of the field {2} {3}",
					},
					response_type_id: -1,
					message: "Please provide the value of the field",
					status: 97,
				},
			},
		],
	},
	{
		id: "aeps-fingpay-verify-otp-kyc",
		productId: "aeps",
		name: "Verify OTP (eKYC)",
		slug: "aeps-fingpay-verify-otp-kyc",
		provider: "AePS – Fingpay",
		group: "Agent eKYC (1-Time)",
		summary:
			"Verify the eKYC OTP sent to the agent's Aadhaar-linked mobile number to advance the one-time AePS Fingpay eKYC.",
		description:
			"The second step of the one-time AePS Fingpay eKYC flow (Send OTP → Verify OTP → Biometric). Submits the OTP the agent received, together with the `otp_ref_id` and `reference_tid` returned by the Send OTP API, to validate the agent's identity before biometric capture. Aadhaar must be RSA-encrypted and Base64-encoded.",
		relevance: "M",
		bestFor: "Completing OTP validation during initial one-time agent eKYC",
		method: "PUT",
		path: "/user/collection/aeps-fingpay/kyc/otp/verify",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-kyc-verify-otp",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description:
					"Registered mobile number of the agent/merchant undergoing eKYC.",
				example: "9123456789",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					"RSA-encrypted, Base64-encoded Aadhaar number of the agent undergoing eKYC.",
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "otp",
				type: "string",
				required: true,
				description:
					"OTP received on the agent's Aadhaar-registered mobile number.",
				example: "123456",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description: "Reference ID returned by the Send OTP (eKYC) API.",
				example: "2465238",
			},
			{
				name: "reference_tid",
				type: "string",
				required: true,
				description:
					"Transaction reference ID returned by the Send OTP (eKYC) API.",
				example: "EKYKF4719702240123152147525I",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Required for security and fraud prevention.",
				example: "28.6139,77.2090",
			},
		],
		responseTypes: [
			{
				id: 1604,
				meaning: "Validation successful",
				next: "aeps-fingpay-biometric-ekyc",
			},
		],
		responseData: [
			{
				name: "reference_tid",
				type: "string",
				description:
					"Transaction reference ID for this eKYC verification. Carry forward to the Biometric eKYC step.",
				imp: true,
				example: "BEKYF4719702240123152147525I",
			},
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID of the OTP session. Carry forward to the Biometric eKYC step.",
				imp: true,
				example: "815031",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				reference_tid: "BEKYF4719702240123152147525I",
				otp_ref_id: "815031",
			},
			response_type_id: 1604,
			message: "Validation successful",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Invalid or expired OTP",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						last_used_okekey: "",
						reason:
							"The details entered are incorrect or the OTP has expired. Kindly request a new OTP.",
					},
					response_type_id: 461,
					message: "Failed!Please try after some time",
					status: 461,
				},
			},
		],
	},
	{
		id: "aeps-fingpay-biometric-ekyc",
		productId: "aeps",
		name: "Biometric eKYC",
		slug: "aeps-fingpay-biometric-ekyc",
		provider: "AePS – Fingpay",
		group: "Agent eKYC (1-Time)",
		summary:
			"Complete one-time AePS Fingpay eKYC by submitting the agent's Aadhaar and live biometric fingerprint capture.",
		// Short text for the .md twin / OpenAPI / agent bundle; the docs page
		// renders the richer `descriptionFile` (callouts, Aadhaar-encryption code).
		description:
			"The final step in the one-time AePS Fingpay eKYC flow, called after OTP verification. Submits the agent's RSA-encrypted Aadhaar and live biometric PID to UIDAI; on success the agent is eligible for AePS transactions.\n\nIf you generate the PID block with your own code rather than the RD service default, set `wadh=E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=` alongside `fCount`, `fType` and the other attributes.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		descriptionFile: "aeps-fingpay-biometric-ekyc.md",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "M",
		bestFor:
			"Completing the mandatory one-time biometric identity verification for AePS Fingpay agents",
		method: "PUT",
		path: "/user/collection/aeps-fingpay/kyc/biometric",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					"RSA-encrypted, Base64-encoded Aadhaar number of the agent.",
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description:
					"Registered mobile number of the agent/merchant undergoing eKYC.",
				example: "9123456789",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Required for security and fraud prevention.",
				example: "28.6139,77.2090",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"PID XML string from the UIDAI-certified biometric device (fType=2, Data type='X', mc in DeviceInfo).",
				example:
					"<?xml version='1.0'?><PidData><Data type='X'>...</Data><DeviceInfo mc='...' /></PidData>",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description:
					"Eko bank code of the agent's bank. Resolve it using the [Get List of Banks](./get-banks) API.",
				example: "HDFC",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description:
					"Reference ID returned by the preceding OTP step, linking this biometric capture to the verified OTP session.",
				example: "2465238",
			},
			{
				name: "reference_tid",
				type: "string",
				required: true,
				description:
					"Transaction reference ID returned by the preceding OTP step.",
				example: "EKYKF4719702240123152147525I",
			},
		],
		responseTypes: [
			{
				id: 1605,
				meaning: "eKYC successful — agent may now complete Daily KYC",
				next: "aeps-fingpay-daily-auth",
			},
		],
		responseData: [
			{
				name: "user_code",
				type: "string",
				description: "User code of the agent whose eKYC is now complete.",
				imp: true,
				example: "20810200",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: { user_code: "20810200" },
			response_type_id: 1605,
			message: "Congratulations! eKYC successful",
			status: 0,
		},
		errorScenarios: [
			{
				scenario:
					"OTP steps skipped — Send OTP and Verify OTP must both succeed first",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						last_used_okekey: "",
						reason: "Merchant is Inactive or Invalid Details",
					},
					response_type_id: 461,
					message: "Failed!Please try after some time",
					status: 461,
				},
			},
		],
	},
	{
		id: "aeps-fingpay-daily-auth",
		productId: "aeps",
		name: "Daily KYC",
		slug: "aeps-fingpay-daily-auth",
		provider: "AePS – Fingpay",
		group: "Agent eKYC (Daily)",
		summary:
			"Perform the mandatory daily biometric re-verification that authorises an agent to carry out AePS transactions for the current calendar day.",
		description:
			"Biometric-only re-verification for the days after the one-time eKYC — no OTP step is required. AePS Fingpay requires every agent to re-authenticate themselves biometrically at the start of each working day, before their first transaction of the day.\n\nIf this fails with reason `Please complete bank eKYC to process the transaction.`, re-run the full first-time eKYC sequence — Send OTP → Verify OTP → Biometric — before retrying.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "H",
		bestFor:
			"Agent-side automation to trigger the daily biometric KYC at session start before serving AePS customers",
		method: "PUT",
		path: "/user/collection/aeps-fingpay/kyc/biometric/daily",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					"RSA-encrypted, Base64-encoded Aadhaar number of the agent performing daily KYC.",
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Registered mobile number of the agent/merchant.",
				example: "9123456789",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"GPS coordinates of the agent's location at the time of daily KYC.",
				example: "28.6139,77.2090",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"PID XML string from the UIDAI-certified biometric device (fType=2, Data type='X', mc in DeviceInfo). This represents the agent's own fingerprint, not the customer's. If you generate the PID block yourself, the value of `wadh` must be blank/empty for Daily KYC.",
				example:
					"<?xml version='1.0'?><PidData><Data type='X'>...</Data><DeviceInfo mc='...' /></PidData>",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description:
					"Eko bank code of the agent's bank. Resolve it using the [Get List of Banks](./get-banks) API.",
				example: "HDFC",
			},
		],
		responseTypes: [
			{
				id: 1713,
				meaning: "Daily KYC successful — the agent may transact today",
			},
			{
				id: 1714,
				meaning:
					"Daily KYC failed — if `data.reason` is 'Please complete bank eKYC to process the transaction.', re-run the full eKYC from Send OTP",
				next: "aeps-fingpay-send-otp-kyc",
			},
		],
		responseData: [
			{
				name: "user_code",
				type: "string",
				description:
					"User code of the agent whose daily KYC is now complete for the current calendar day.",
				imp: true,
				example: "20810200",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: { user_code: "20810200" },
			response_type_id: 1713,
			message: "KYC sucess",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "KYC failed — no reason returned",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { reason: "", comment: "" },
					response_type_id: 1714,
					message: "KYC Fail",
					status: 1714,
				},
			},
			{
				scenario:
					"Invalid biometric data — check the `wadh` value in the PID block",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						reason: "Authentication Failed. Invalid Biometric data.",
						comment: "",
					},
					response_type_id: 1714,
					message: "KYC Fail",
					status: 1714,
				},
			},
			{
				scenario:
					"Bank eKYC pending — re-run Send OTP → Verify OTP → Biometric first",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						reason: "Please complete bank eKYC to process the transaction.",
						comment: "",
					},
					response_type_id: 1714,
					message: "KYC Fail",
					status: 1714,
				},
			},
		],
	},
	{
		id: "aeps-fingpay-cash-withdrawal",
		productId: "aeps",
		name: "AePS Cash Withdrawal",
		slug: "aeps-fingpay-cash-withdrawal",
		provider: "AePS – Fingpay",
		summary:
			"Withdraw cash from any Aadhaar-linked bank account using biometric fingerprint authentication — no card or PIN required.",
		description:
			"Allows a customer to withdraw cash from their bank account at an agent/BC point by providing their Aadhaar number and a live fingerprint scan. The agent's biometric device captures a PID XML blob which is passed verbatim to this API. The customer's Aadhaar is RSA-encrypted before transmission. Requires the agent to have completed AePS Fingpay activation, the one-time eKYC (Send OTP → Verify OTP → Biometric), and the Daily KYC for the current day.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		descriptionFile: "aeps-fingpay-cash-withdrawal.md",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "H",
		bestFor:
			"BC agents, CSPs, and kirana-store banking points enabling cardless cash withdrawal for rural customers",
		method: "POST",
		path: "/customer/collection/aeps-fingpay/cash-withdrawl/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		financial: true,
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "10000001",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's registered mobile number.",
				example: "9000000000",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description:
					"Short bank code identifying the customer's Aadhaar-linked bank (e.g. `HDFC`, `SBIN`). Obtain from the bank list API.",
				example: "HDFC",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					'RSA-encrypted, Base64-encoded Aadhaar number. Encrypt the 12-digit Aadhaar with the Eko RSA public key using PKCS#1 v1.5 padding (Java\'s default `Cipher.getInstance("RSA")`), then Base64-encode the ciphertext.',
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"GPS coordinates of the transaction origin in 'latitude,longitude' format.",
				example: "28.6139,77.2090",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"PID data captured from the UIDAI-certified biometric device, as a raw XML string. Must use Data type='X' (XML, not Protobuf). DeviceInfo must include the 'mc' (device certificate) parameter. fType must be 2.",
				example:
					"<?xml version='1.0'?><PidData><Data type='X'>...</Data><DeviceInfo mc='...' /></PidData>",
			},
			{
				name: "amount",
				type: "number",
				required: true,
				description:
					"Withdrawal amount in Indian Rupees (integer). Must be greater than 0 for cash withdrawal.",
				example: 1000,
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				description:
					"Eko's internal transaction ID. Use for reconciliation and support queries.",
				imp: true,
				example: "0000000000",
			},
			{
				name: "amount",
				type: "string",
				description: "Withdrawal amount processed in the transaction (INR).",
				imp: true,
				example: "1000.00",
			},
			{
				name: "bank",
				type: "string",
				description: "Name of the customer's bank where the debit occurred.",
				imp: true,
				example: "Example Bank",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description:
					"Bank/NPCI reference number (RRN) for the transaction. Empty on failure.",
				imp: true,
				example: "0000000000",
			},
			{
				name: "balance",
				type: "string",
				description:
					"Remaining balance in the customer's bank account after withdrawal, if returned by the bank.",
				example: "0.00",
			},
			{
				name: "customer_balance",
				type: "string",
				description:
					"Customer's account balance as reported by the bank. Empty when not returned.",
				imp: true,
				example: "0.00",
			},
			{
				name: "tds",
				type: "string",
				description: "Tax deducted at source on the agent's commission (INR).",
				example: "0.00",
			},
			{
				name: "commission",
				type: "string",
				description:
					"Commission earned by the agent on this transaction (INR).",
				example: "0.00",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the transaction (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "service_tax",
				type: "string",
				description: "Service tax component on the fee (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "totalfee",
				type: "string",
				description: "Total fee including taxes (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "shop",
				type: "string",
				description: "Agent's shop/merchant name.",
				example: "Test User",
			},
			{
				name: "shop_address_line1",
				type: "string",
				description: "Agent's shop address. May be empty.",
				example: "",
			},
			{
				name: "sender_name",
				type: "string",
				description: "Name of the agent/sender initiating the transaction.",
				example: "Test User",
			},
			{
				name: "merchantname",
				type: "string",
				description: "Registered merchant name of the agent.",
				example: "Test User",
			},
			{
				name: "merchant_code",
				type: "string",
				description: "Merchant code of the agent. May be empty.",
				example: "",
			},
			{
				name: "user_code",
				type: "string",
				description: "Echo of the agent's user_code from the request.",
				example: "10000001",
			},
			{
				name: "aadhar",
				type: "string",
				description: "Masked Aadhaar number of the customer.",
				example: "XXXX XXXX 0000",
			},
			{
				name: "auth_code",
				type: "string",
				description: "Bank authorization code. May be empty.",
				example: "",
			},
			{
				name: "stan",
				type: "string",
				description:
					"System Trace Audit Number assigned by the switch. May be empty.",
				example: "",
			},
			{
				name: "terminal_id",
				type: "string",
				description: "Terminal identifier. May be empty.",
				example: "",
			},
			{
				name: "tx_status",
				type: "string",
				description:
					"Transaction state within the data block: 0=Success, 1=Fail, 2=Pending.",
				example: "0",
			},
			{
				name: "transaction_date",
				type: "string",
				description: "Transaction date (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "transaction_time",
				type: "string",
				description: "Transaction timestamp (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "reason",
				type: "string",
				description:
					"Failure reason, when the transaction did not complete. Empty on success.",
				example: "",
			},
			{
				name: "comment",
				type: "string",
				description:
					"Human-readable transaction remark from the provider (e.g. 'Request Completed').",
				example: "Request Completed",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				tx_status: "0",
				tds: "0.00",
				shop: "Test User",
				sender_name: "Test User",
				tid: "0000000000",
				bank: "Example Bank",
				balance: "0.00",
				user_code: "10000001",
				merchantname: "Test User",
				aadhar: "XXXX XXXX 0000",
				customer_balance: "0.00",
				transaction_time: "01-01-24 00:00:00",
				commission: "0.00",
				bank_ref_num: "0000000000",
				transaction_date: "01-01-24 00:00:00",
				amount: "1000.00",
				comment: "Request Completed",
			},
			response_type_id: 1463,
			message: "Transaction Successful",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Transaction Fail — incorrect merchant credentials",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						tx_status: "1",
						transaction_date: "01-01-24 00:00:00",
						reason: "",
						amount: "1000.00",
						merchant_code: "",
						shop: "Test User",
						sender_name: "Test User",
						tid: "0000000000",
						auth_code: "",
						shop_address_line1: "",
						user_code: "10000001",
						merchantname: "Test User",
						stan: "",
						aadhar: "XXXX XXXX 0000",
						customer_balance: "0.00",
						transaction_time: "01-01-24 00:00:00",
						comment: "Incorrect merchantId or pin",
						bank_ref_num: "",
						terminal_id: "",
					},
					response_type_id: 1464,
					message: "Transaction Fail",
					status: 1464,
				},
			},
			{
				scenario:
					"Transaction Fail — invalid bank_code (transaction not completed)",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						tx_status: "",
						transaction_date: "",
						reason: "Transaction Not Completed",
						amount: "",
						merchant_code: "",
						shop: "",
						sender_name: "",
						tid: "",
						auth_code: "",
						shop_address_line1: "",
						user_code: "",
						merchantname: "",
						stan: "",
						aadhar: "",
						customer_balance: "",
						transaction_time: "",
						comment: "Transaction Not Completed",
						bank_ref_num: "",
						terminal_id: "",
					},
					response_type_id: 1464,
					message: "Transaction Fail",
					status: 1464,
				},
			},
			{
				scenario: "Transaction Pending — awaiting bank confirmation",
				statusCode: 200,
				example: {
					response_status_id: 2,
					data: {
						tx_status: "2",
						transaction_date: "01-01-24 00:00:00",
						reason: "Transaction Pending",
						amount: "1000.00",
						merchant_code: "",
						shop: "Test User",
						fee: "",
						sender_name: "",
						tid: "0000000000",
						auth_code: "",
						shop_address_line1: "",
						user_code: "10000001",
						service_tax: "0.00",
						totalfee: "0.00",
						merchantname: "Test User",
						stan: "",
						aadhar: "XXXX XXXX 0000",
						customer_balance: "",
						transaction_time: "01-01-24 00:00:00",
						comment: "Transaction Pending",
						bank_ref_num: "",
						terminal_id: "",
					},
					response_type_id: 1465,
					message: "Transaction Pending",
					status: 0,
				},
			},
		],
		responseTypes: [
			{ id: 1463, meaning: "Transaction Successful" },
			{ id: 1464, meaning: "Transaction Fail" },
			{
				id: 1465,
				meaning: "Transaction Pending — check final status later",
				next: "transaction-inquiry",
			},
		],
	},
	{
		id: "aeps-fingpay-balance-enquiry",
		slug: "aeps-fingpay-balance-enquiry",
		productId: "aeps",
		name: "AePS Balance Enquiry",
		provider: "AePS – Fingpay",
		summary:
			"Check a customer's bank account balance using Aadhaar number and biometric fingerprint — no card or PIN required.",
		description:
			"Retrieves the real-time account balance from any Aadhaar-linked bank. Uses the dedicated `balance-enquiry` endpoint — the request shape matches Cash Withdrawal without the `amount` field. No money movement occurs and no debit takes place. The agent must have completed AePS Fingpay activation and the current-day daily authentication before calling this API.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "L",
		bestFor:
			"Agent-assisted balance checks for rural customers without smartphone or internet access",
		method: "POST",
		path: "/customer/collection/aeps-fingpay/balance-enquiry/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		financial: true,
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "10000001",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's registered mobile number.",
				example: "9000000000",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description:
					"Short bank code identifying the customer's Aadhaar-linked bank (e.g. `HDFC`, `SBIN`). Obtain from the bank list API.",
				example: "HDFC",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					'RSA-encrypted, Base64-encoded Aadhaar number. Encrypt the 12-digit Aadhaar with the Eko RSA public key using PKCS#1 v1.5 padding (Java\'s default `Cipher.getInstance("RSA")`), then Base64-encode the ciphertext.',
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"GPS coordinates of the transaction origin in 'latitude,longitude' format.",
				example: "28.6139,77.2090",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"PID XML string from the UIDAI-certified biometric device (fType=2, Data type='X', mc present in DeviceInfo).",
				example:
					"<?xml version='1.0'?><PidData><Data type='X'>...</Data><DeviceInfo mc='...' /></PidData>",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				description: "Eko's internal transaction ID for this enquiry.",
				imp: true,
				example: "0000000000",
			},
			{
				name: "amount",
				type: "string",
				description:
					"Echo of the transacted amount (INR). '0.0' for a balance enquiry.",
				example: "0.00",
			},
			{
				name: "customer_balance",
				type: "string",
				description:
					"Customer's account balance returned by the bank (INR). This is the key output of a Balance Enquiry.",
				imp: true,
				example: "0.00",
			},
			{
				name: "shop",
				type: "string",
				description: "Agent's shop/merchant name.",
				example: "Test User",
			},
			{
				name: "shop_address_line1",
				type: "string",
				description: "Agent's shop address. May be empty.",
				example: "",
			},
			{
				name: "sender_name",
				type: "string",
				description: "Name of the agent/sender initiating the enquiry.",
				example: "Test User",
			},
			{
				name: "merchantname",
				type: "string",
				description: "Registered merchant name of the agent.",
				example: "Test User",
			},
			{
				name: "merchant_code",
				type: "string",
				description: "Merchant code of the agent. May be empty.",
				example: "",
			},
			{
				name: "user_code",
				type: "string",
				description: "Echo of the agent's user_code from the request.",
				example: "10000001",
			},
			{
				name: "aadhar",
				type: "string",
				description: "Masked Aadhaar number of the customer.",
				example: "XXXX XXXX 0000",
			},
			{
				name: "auth_code",
				type: "string",
				description: "Bank authorization code. May be empty.",
				example: "",
			},
			{
				name: "stan",
				type: "string",
				description:
					"System Trace Audit Number assigned by the switch. May be empty.",
				example: "",
			},
			{
				name: "terminal_id",
				type: "string",
				description: "Terminal identifier. May be empty.",
				example: "",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the enquiry (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "service_tax",
				type: "string",
				description: "Service tax component on the fee (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "totalfee",
				type: "string",
				description: "Total fee including taxes (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "transaction_date",
				type: "string",
				description: "Transaction date (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "transaction_time",
				type: "string",
				description: "Transaction timestamp (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "reason",
				type: "string",
				description:
					"Failure reason, when the enquiry did not complete. Empty on success.",
				example: "",
			},
			{
				name: "comment",
				type: "string",
				description:
					"Human-readable remark from the provider (e.g. 'Request Completed').",
				example: "Request Completed",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				transaction_date: "01-01-24 00:00:00",
				amount: "0.00",
				shop: "Test User",
				sender_name: "Test User",
				tid: "0000000000",
				user_code: "10000001",
				merchantname: "Test User",
				aadhar: "XXXX XXXX 0000",
				customer_balance: "0.00",
				transaction_time: "01-01-24 00:00:00",
				comment: "Request Completed",
			},
			response_type_id: 1466,
			message: "Transaction Successful",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Transaction Fail — incorrect merchant credentials",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						tx_status: "1",
						transaction_date: "01-01-24 00:00:00",
						reason: "",
						amount: "0.00",
						merchant_code: "",
						shop: "Test User",
						sender_name: "Test User",
						tid: "0000000000",
						auth_code: "",
						shop_address_line1: "",
						user_code: "10000001",
						merchantname: "Test User",
						stan: "",
						aadhar: "XXXX XXXX 0000",
						customer_balance: "0.00",
						transaction_time: "01-01-24 00:00:00",
						comment: "Incorrect merchantId or pin",
						bank_ref_num: "",
						terminal_id: "",
					},
					response_type_id: 1464,
					message: "Transaction Fail",
					status: 1464,
				},
			},
		],
		responseTypes: [
			{ id: 1466, meaning: "Transaction Successful" },
			{ id: 1464, meaning: "Transaction Fail" },
		],
	},
	{
		id: "aeps-fingpay-mini-statement",
		productId: "aeps",
		name: "AePS Mini Statement",
		slug: "aeps-fingpay-mini-statement",
		provider: "AePS – Fingpay",
		summary:
			"Retrieve the last few transactions from an Aadhaar-linked bank account via biometric authentication.",
		description:
			"Fetches a mini statement (typically the last 5–10 transactions) from a customer's bank account by authenticating through Aadhaar biometrics. Uses the dedicated `mini-statement` endpoint — the request shape matches Balance Enquiry (no `amount`). No money movement occurs. The response includes a list of recent debit/credit transactions with amounts and dates. Useful for customers who want to verify recent activity at an agent point without visiting a branch.\n\nTo capture the `piddata` PID block with an RDService-compliant fingerprint scanner, see the [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice).",
		relatedLinks: [
			{
				label: "Aadhaar Biometric Authentication (RDService) guide",
				slug: "aadhaar-biometric-rdservice",
				description:
					"How to capture the PID block from a fingerprint scanner on Web or Android.",
			},
		],
		relevance: "L",
		bestFor:
			"BC agents providing passbook-equivalent transaction history to Aadhaar-linked account holders",
		method: "POST",
		path: "/customer/collection/aeps-fingpay/mini-statement/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
		financial: true,
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "10000001",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's registered mobile number.",
				example: "9000000000",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description:
					"Short bank code identifying the customer's Aadhaar-linked bank (e.g. `HDFC`, `SBIN`). Obtain from the bank list API.",
				example: "HDFC",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description:
					'RSA-encrypted, Base64-encoded Aadhaar number. Encrypt the 12-digit Aadhaar with the Eko RSA public key using PKCS#1 v1.5 padding (Java\'s default `Cipher.getInstance("RSA")`), then Base64-encode the ciphertext.',
				example: "BASE64_ENCRYPTED_AADHAAR",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"GPS coordinates of the transaction origin in 'latitude,longitude' format.",
				example: "28.6139,77.2090",
			},
			{
				name: "piddata",
				type: "string",
				required: true,
				description:
					"PID XML string from the UIDAI-certified biometric device (fType=2, Data type='X', mc present in DeviceInfo).",
				example:
					"<?xml version='1.0'?><PidData><Data type='X'>...</Data><DeviceInfo mc='...' /></PidData>",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				description: "Eko's internal transaction ID for this enquiry.",
				imp: true,
				example: "0000000000",
			},
			{
				name: "mini_statement_list",
				type: "array",
				description:
					"List of recent transactions. Each entry carries the transaction date, amount, direction (Dr/Cr), and narration.",
				imp: true,
				children: [
					{
						name: "date",
						type: "string",
						description: "Transaction date (DD/MM).",
						example: "01/01",
					},
					{
						name: "amount",
						type: "string",
						description: "Transaction amount in INR.",
						imp: true,
						example: "0.00",
					},
					{
						name: "narration",
						type: "string",
						description: "Bank-provided transaction narration or description.",
						example: "MAT/W/000000",
					},
					{
						name: "txnType",
						type: "string",
						description:
							"Transaction direction: 'Cr' for credit, 'Dr' for debit.",
						imp: true,
						example: "Dr",
					},
				],
			},
			{
				name: "sender_name",
				type: "string",
				description: "Name of the agent/sender initiating the enquiry.",
				example: "Test User",
			},
			{
				name: "merchantname",
				type: "string",
				description: "Registered merchant name of the agent.",
				example: "Test User",
			},
			{
				name: "merchant_code",
				type: "string",
				description: "Merchant code of the agent. May be empty.",
				example: "",
			},
			{
				name: "user_code",
				type: "string",
				description: "Echo of the agent's user_code from the request.",
				example: "10000001",
			},
			{
				name: "customer_balance",
				type: "string",
				description:
					"Customer's account balance as reported by the bank (INR). May be empty.",
				imp: true,
				example: "0.00",
			},
			{
				name: "commission",
				type: "string",
				description: "Commission earned by the agent on this enquiry (INR).",
				example: "0.00",
			},
			{
				name: "service_tax",
				type: "string",
				description: "Service tax component on the fee (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "totalfee",
				type: "string",
				description: "Total fee including taxes (INR). May be empty.",
				example: "0.00",
			},
			{
				name: "terminal_id",
				type: "string",
				description: "Terminal identifier. May be empty.",
				example: "",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description:
					"NPCI/bank reference number for this statement fetch. May be empty.",
				example: "",
			},
			{
				name: "transaction_date",
				type: "string",
				description: "Transaction date (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "transaction_time",
				type: "string",
				description: "Transaction timestamp (DD-MM-YY HH:MM:SS).",
				example: "01-01-24 00:00:00",
			},
			{
				name: "reason",
				type: "string",
				description:
					"Failure reason, when the enquiry did not complete. Empty on success.",
				example: "",
			},
			{
				name: "comment",
				type: "string",
				description:
					"Human-readable remark from the provider (e.g. 'Request Completed').",
				example: "Request Completed",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				transaction_date: "01-01-24 00:00:00",
				mini_statement_list: [
					{
						date: "01/01",
						amount: "0.00",
						narration: "MAT/W/000000",
						txnType: "Dr",
					},
					{
						date: "31/12",
						amount: "0.00",
						narration: "MAT/D/000000",
						txnType: "Cr",
					},
					{
						date: "28/12",
						amount: "0.00",
						narration: "POS/W/000000",
						txnType: "Dr",
					},
				],
				sender_name: "Test User",
				tid: "0000000000",
				user_code: "10000001",
				merchantname: "Test User",
				customer_balance: "0.00",
				transaction_time: "01-01-24 00:00:00",
				commission: "0.00",
				terminal_id: "",
				comment: "Request Completed",
			},
			response_type_id: 1527,
			message: "Transaction Successful",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Transaction Fail — incorrect merchant credentials",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: {
						transaction_date: "01-01-24 00:00:00",
						reason: "",
						merchant_code: "",
						merchantname: "Test User",
						customer_balance: "",
						transaction_time: "01-01-24 00:00:00",
						sender_name: "Test User",
						comment: "Incorrect merchantId or pin",
						bank_ref_num: "",
						tid: "0000000000",
						terminal_id: "",
					},
					response_type_id: 1528,
					message: "Transaction Fail",
					status: 1528,
				},
			},
		],
		responseTypes: [
			{ id: 1527, meaning: "Transaction Successful" },
			{ id: 1528, meaning: "Transaction Fail" },
		],
	},
	{
		id: "aeps-add-settlement-account",
		productId: "aeps",
		name: "Add Settlement Bank Account",
		slug: "aeps-add-settlement-account",
		provider: "AePS – Fingpay",
		group: "AePS Fund Settlement",
		summary:
			"Register a bank account as an AePS fund-settlement recipient for an agent.",
		description:
			"Adds and name-verifies a bank account to which an agent can settle AePS funds. On success a `recipient_id` is returned — pass it to Initiate Settlement. If the account holder name does not match, the response reports the mismatch. An agent can register up to 3 settlement accounts, and only banks that offer account verification are accepted.",
		relevance: "M",
		bestFor: "Registering an agent's settlement bank account before payout.",
		method: "POST",
		path: "/user/payment/aeps/settlement/account",
		docsUrl:
			"https://developers.eko.in/reference/add-fund-settlement-recipient-request",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "bank_id",
				type: "integer",
				required: true,
				description: "Unique identifier for the bank.",
				example: 12,
			},
			{
				name: "ifsc",
				type: "string",
				required: true,
				description: "IFSC code of the bank account.",
				example: "SBIN0000000",
			},
			{
				name: "service_code",
				type: "integer",
				required: true,
				description: "Service code for AePS fund settlement. Value: 39.",
				example: 39,
			},
			{
				name: "account",
				type: "string",
				required: true,
				description: "Account number of the user's bank account.",
				example: "00000000000002",
			},
		],
		responseData: [
			{
				name: "recipient_id",
				type: "number",
				imp: true,
				description:
					"Settlement recipient identifier — pass to Initiate Settlement.",
				example: 1893,
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: { recipient_id: 1893 },
			response_type_id: 1336,
			message: "Account added",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Account verification failed — name mismatch",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { sender_name: "SANATAN CSP", recipient_name: "R K LAKSHYKAR" },
					response_type_id: 1335,
					message: "Account verification fail, Name not matched",
					status: 1335,
				},
			},
			{
				scenario: "Account verification failed — name not returned by bank",
				statusCode: 200,
				example: {
					response_status_id: 1,
					response_type_id: 1334,
					message: "Account verification fail name not returned by bank",
					status: 1334,
				},
			},
		],
	},
	{
		// TODO(reconcile): sheet prod capture was a KYC-status response (rtid 1969,
		// "Fingpay daily KYC is completed", data {reason,user_code}), NOT an accounts
		// list — current sample keeps the correct shape; needs a clean prod success.
		id: "aeps-get-settlement-accounts",
		productId: "aeps",
		name: "Get Settlement Bank Accounts",
		slug: "aeps-get-settlement-accounts",
		provider: "AePS – Fingpay",
		group: "AePS Fund Settlement",
		summary:
			"List an agent's registered AePS settlement recipients with unsettled funds and remaining limit.",
		description:
			"Returns the agent's saved settlement bank accounts (each with a `recipient_id`), the total unsettled fund, and the remaining daily settlement limit.",
		relevance: "M",
		bestFor: "Choosing a settlement account and checking unsettled funds.",
		method: "GET",
		path: "/user/payment/aeps/settlement/accounts",
		docsUrl:
			"https://developers.eko.in/reference/get-all-aeps-fund-settlement-recipient-request",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
		],
		responseData: [
			{
				name: "unsettled_fund",
				type: "string",
				imp: true,
				description: "Total unsettled AePS fund available to settle (INR).",
				example: "6100.0",
			},
			{
				name: "remaining_limit",
				type: "string",
				description: "Remaining settlement limit for the day (INR).",
				example: "190000",
			},
			{
				name: "fund_transfer_list",
				type: "array",
				imp: true,
				description: "Registered settlement recipients.",
				children: [
					{
						name: "recipient_id",
						type: "string",
						imp: true,
						description:
							"Settlement recipient identifier — pass to Initiate Settlement.",
						example: "1828",
					},
					{
						name: "name",
						type: "string",
						description: "Account holder name.",
						example: "Test Recipient",
					},
					{
						name: "account",
						type: "string",
						description: "Bank account number.",
						example: "00000000000001",
					},
					{
						name: "ifsc",
						type: "string",
						description: "Bank branch IFSC.",
						example: "SBIN0000000",
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				unsettled_fund: "6100.0",
				remaining_limit: "190000",
				fund_transfer_list: [
					{
						name: "Test Recipient",
						ifsc: "SBIN0000000",
						account: "00000000000001",
						recipient_id: "1828",
					},
					{
						name: "Test Recipient",
						ifsc: "SBIN0000000",
						account: "00000000000002",
						recipient_id: "1829",
					},
				],
			},
			response_type_id: 1321,
			message: "List of fund transfer recipients",
			status: 0,
		},
	},
	{
		id: "aeps-initiate-settlement",
		productId: "aeps",
		name: "Initiate Settlement",
		slug: "aeps-initiate-settlement",
		provider: "AePS – Fingpay",
		group: "AePS Fund Settlement",
		summary:
			"Settle an agent's AePS funds to a registered bank account via NEFT/IMPS/RTGS.",
		description:
			"Initiates a fund settlement of the requested amount to a registered `recipient_id`. Returns the financial response envelope with `tx_status`, transaction id (`tid`), fee, and updated balance. Settlement is available Mon–Fri 10am–5pm (excl. RBI holidays); max ₹2,00,000 per transaction; requests after 5pm settle the next working day.",
		descriptionFile: "aeps-initiate-settlement.md",
		relevance: "M",
		bestFor: "Settling collected AePS funds to an agent's bank account.",
		method: "POST",
		path: "/user/payment/aeps/settlement",
		docsUrl: "https://developers.eko.in/reference/aeps-fund-settlement-request",
		financial: true,
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "amount",
				type: "integer",
				required: true,
				description:
					"Settlement amount requested (INR). Max 200000 per transaction.",
				example: 100,
			},
			{
				name: "recipient_id",
				type: "integer",
				required: true,
				description:
					"Settlement recipient identifier (from Add / Get Settlement Account).",
				example: 1829,
			},
			{
				name: "payment_mode",
				type: "integer",
				required: true,
				description: "Transfer method: 4 = NEFT, 5 = IMPS, 13 = RTGS.",
				example: 5,
			},
		],
		responseData: [
			{
				name: "tx_status",
				type: "string",
				imp: true,
				description: "Transaction status code (0 = success).",
				example: "0",
			},
			{
				name: "amount",
				type: "string",
				imp: true,
				description: "Settled amount (INR).",
				example: "5000.00",
			},
			{
				name: "txstatus_desc",
				type: "string",
				imp: true,
				description: "Human-readable transaction status.",
				example: "Success",
			},
			{
				name: "fee",
				type: "string",
				description: "Base fee charged for the settlement (INR).",
				example: "17.70",
			},
			{
				name: "gst",
				type: "string",
				description: "GST charged on the settlement fee (INR).",
				example: "2.70",
			},
			{
				name: "sender_name",
				type: "string",
				description: "Name of the settling agent.",
				example: "Test User",
			},
			{
				name: "tid",
				type: "string",
				imp: true,
				description: "Eko transaction ID for the settlement.",
				example: "0000000000",
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Client reference id echoed for the settlement.",
				example: "00000000000000000000",
			},
			{
				name: "balance",
				type: "string",
				imp: true,
				description: "Agent balance after the settlement (INR).",
				example: "0.00",
			},
			{
				name: "user_code",
				type: "string",
				imp: true,
				description: "Code of the user/agent the settlement was run for.",
				example: "10000001",
			},
			{
				name: "totalfee",
				type: "string",
				description: "Total fee charged for the settlement, incl. GST (INR).",
				example: "17.70",
			},
			{
				name: "recipient_name",
				type: "string",
				description: "Name on the destination bank account.",
				example: "Test Recipient",
			},
			{
				name: "ifsc",
				type: "string",
				description: "Destination branch IFSC.",
				example: "SBIN0000000",
			},
			{
				name: "bank_ref_num",
				type: "string",
				imp: true,
				description:
					"Bank reference / UTR number. Empty until the bank confirms the transfer.",
				example: "",
			},
			{
				name: "account",
				type: "string",
				description: "Destination account number.",
				example: "00000000000000",
			},
			{
				name: "timestamp",
				type: "string",
				description: "Settlement timestamp. Empty on the initial response.",
				example: "",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				tx_status: "0",
				amount: "5000.00",
				txstatus_desc: "Success",
				fee: "17.70",
				gst: "2.70",
				sender_name: "Test User",
				tid: "0000000000",
				client_ref_id: "00000000000000000000",
				balance: "0.00",
				user_code: "10000001",
				totalfee: "17.70",
				recipient_name: "Test Recipient",
				ifsc: "SBIN0000000",
				bank_ref_num: "",
				account: "00000000000000",
				timestamp: "",
			},
			response_type_id: 1477,
			message: "Transaction processed successfully",
			status: 0,
		},
	},
	// MARK: BBPS
	{
		id: "bbps-get-categories",
		productId: "bbps",
		name: "Get BBPS Categories",
		slug: "bbps-get-categories",
		summary:
			"Retrieve the list of supported BBPS biller categories (electricity, gas, DTH, etc.).",
		description:
			"Returns all active biller categories available on the BBPS network. Use the returned category_id to filter the Get Operators call. Categories include electricity, gas, water, DTH, broadband, prepaid recharge, FASTag, insurance, EMI payments, LPG booking, credit card, and more.",
		relevance: "M",
		bestFor:
			"Populating a category picker UI before letting the user choose a biller.",
		method: "GET",
		path: "/customer/payment/bbps/categories",
		docsUrl: "https://developers.eko.in/reference/bbps-get-categories",
		extraRequestParams: [],
		responseData: [
			{
				name: "categories",
				type: "array",
				description: "List of all supported BBPS biller categories.",
				imp: true,
				children: [
					{
						name: "id",
						type: "number",
						description:
							"Unique category identifier (category_id). Pass as the `category` query param when filtering operators.",
						imp: true,
						example: 5,
					},
					{
						name: "category_name",
						type: "string",
						description: "Human-readable category label.",
						imp: true,
						example: "Electricity",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				categories: [
					{
						id: 1,
						category_name: "Prepaid",
					},
					{
						id: 2,
						category_name: "DTH",
					},
					{
						id: 4,
						category_name: "Postpaid",
					},
					{
						id: 5,
						category_name: "Electricity",
					},
					{
						id: 6,
						category_name: "Gas",
					},
					{
						id: 7,
						category_name: "Water",
					},
					{
						id: 8,
						category_name: "Broadband",
					},
					{
						id: 9,
						category_name: "Landline",
					},
					{
						id: 10,
						category_name: "Insurance",
					},
					{
						id: 11,
						category_name: "FASTag",
					},
					{
						id: 12,
						category_name: "LPG Booking",
					},
					{
						id: 13,
						category_name: "EMI Payments",
					},
					{
						id: 14,
						category_name: "Credit Card",
					},
					{
						id: 15,
						category_name: "Education",
					},
					{
						id: 16,
						category_name: "Metro",
					},
					{
						id: 17,
						category_name: "Municipal Corp",
					},
				],
			},
		},
	},
	{
		id: "bbps-get-locations",
		productId: "bbps",
		name: "Get BBPS Locations",
		slug: "bbps-get-locations",
		summary:
			"Retrieve the list of supported state/location IDs for filtering BBPS operators.",
		description:
			"Returns all supported location (state) identifiers. Pass the returned location_id as the `location` query parameter in the Get Operators call to narrow results to a specific state or circle.",
		relevance: "M",
		bestFor:
			"Populating a state filter when displaying biller lists to end users.",
		method: "GET",
		path: "/customer/payment/bbps/locations",
		docsUrl: "https://developers.eko.in/reference/bbps-get-locations",
		extraRequestParams: [],
		responseData: [
			{
				name: "locations",
				type: "array",
				description: "List of supported state/location entries.",
				children: [
					{
						name: "id",
						type: "number",
						description:
							"Location identifier to use as the `location` filter when querying operators.",
						imp: true,
						example: 7,
					},
					{
						name: "location_name",
						type: "string",
						description: "State or circle name.",
						example: "Delhi",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				locations: [
					{
						id: 1,
						location_name: "Andhra Pradesh",
					},
					{
						id: 2,
						location_name: "Bihar",
					},
					{
						id: 3,
						location_name: "Gujarat",
					},
					{
						id: 4,
						location_name: "Karnataka",
					},
					{
						id: 5,
						location_name: "Maharashtra",
					},
					{
						id: 6,
						location_name: "Rajasthan",
					},
					{
						id: 7,
						location_name: "Delhi",
					},
					{
						id: 8,
						location_name: "Tamil Nadu",
					},
					{
						id: 9,
						location_name: "Uttar Pradesh",
					},
					{
						id: 10,
						location_name: "West Bengal",
					},
				],
			},
		},
	},
	{
		id: "bbps-get-operators",
		productId: "bbps",
		name: "Get BBPS Operators",
		slug: "bbps-get-operators",
		summary:
			"List all active BBPS billers, optionally filtered by category and/or state.",
		description:
			"Returns every currently active BBPS biller. Use `category` and `location` query parameters to narrow results. The `billFetchResponse` flag on each operator tells you whether the Fetch Bill step is mandatory before payment. Operators that are temporarily disabled are excluded from the response — poll this endpoint periodically to keep your list fresh.",
		relevance: "M",
		bestFor:
			"Building a biller selection UI and determining which operators require a bill fetch before payment.",
		method: "GET",
		path: "/customer/payment/bbps/operators",
		docsUrl: "https://developers.eko.in/reference/bbps-get-operators",
		extraRequestParams: [
			{
				name: "category",
				type: "number",
				required: false,
				description: "Filter by category — use the `id` from Get Categories.",
				example: 5,
			},
			{
				name: "location",
				type: "number",
				required: false,
				description:
					"Filter by state/circle — use the `id` from Get Locations.",
				example: 7,
			},
		],
		responseData: [
			{
				name: "operators",
				type: "array",
				description: "List of active BBPS billers matching the filters.",
				children: [
					{
						name: "operator_id",
						type: "number",
						description:
							"Unique operator identifier. Pass this value in Fetch Bill and Pay Bill requests.",
						imp: true,
						example: 83,
					},
					{
						name: "operator_name",
						type: "string",
						description: "Display name of the biller.",
						imp: true,
						example: "BSES Rajdhani",
					},
					{
						name: "category_id",
						type: "number",
						description: "Category this operator belongs to.",
						example: 5,
					},
					{
						name: "billFetchResponse",
						type: "number",
						description:
							"1 = must call Fetch Bill API before Pay Bill; 0 = can pay directly.",
						imp: true,
						example: 1,
					},
					{
						name: "high_commission_channel",
						type: "number",
						description:
							"0 = instant settlement (default); 1 = delayed channel with higher commissions.",
						example: 0,
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				operators: [
					{
						operator_id: 83,
						operator_name: "BSES Rajdhani",
						category_id: 5,
						billFetchResponse: 1,
						high_commission_channel: 0,
					},
					{
						operator_id: 84,
						operator_name: "BSES Yamuna",
						category_id: 5,
						billFetchResponse: 1,
						high_commission_channel: 0,
					},
					{
						operator_id: 87,
						operator_name: "Tata Power Delhi Distribution",
						category_id: 5,
						billFetchResponse: 0,
						high_commission_channel: 0,
					},
				],
			},
		},
	},
	{
		id: "bbps-get-operator-parameters",
		productId: "bbps",
		name: "Get Operator Parameters",
		slug: "bbps-get-operator-parameters",
		summary:
			"Fetch the custom input fields required by a specific biller before payment.",
		description:
			"Returns the operator-specific parameter schema — field names, labels, data types, and validation regex — needed to build a dynamic payment form. Also returns `fetchBill` (1 = mandatory Fetch Bill step) and `BBPS` (1 = show Bharat BillPay branding). Call this once per operator and cache the result.",
		relevance: "M",
		bestFor:
			"Rendering a dynamic bill payment form with correct validation for each biller.",
		method: "GET",
		path: "/customer/payment/bbps/operator/{operator_id}/parameters",
		docsUrl: "https://developers.eko.in/reference/bbps-get-operator-parameters",
		extraRequestParams: [
			{
				name: "operator_id",
				type: "number",
				required: true,
				description: "The operator/biller ID from the Get Operators response.",
				example: 83,
			},
		],
		responseData: [
			{
				name: "fetchBill",
				type: "number",
				description:
					"1 = Fetch Bill API must be called before Pay Bill; 0 = direct payment allowed.",
				imp: true,
				example: 1,
			},
			{
				name: "BBPS",
				type: "number",
				description:
					"1 = biller is on the BBPS network; display the Bharat BillPay logo per NPCI guidelines.",
				example: 1,
			},
			{
				name: "data",
				type: "array",
				description: "List of input parameters required by this biller.",
				children: [
					{
						name: "param_name",
						type: "string",
						description:
							"API field name to send in the Fetch Bill / Pay Bill request.",
						imp: true,
						example: "utility_acc_no",
					},
					{
						name: "param_label",
						type: "string",
						description: "UI label to display to the end user.",
						example: "Consumer Number",
					},
					{
						name: "param_type",
						type: "string",
						description: "Input type: Numeric, Decimal, AlphaNumeric, or List.",
						example: "Numeric",
					},
					{
						name: "regex",
						type: "string",
						description:
							"Regular expression to validate the user's input before submission.",
						example: "^[0-9]{10,12}$",
					},
					{
						name: "error_message",
						type: "string",
						description:
							"Validation error message to show when the regex does not match.",
						example: "Please enter a valid 10-12 digit consumer number.",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				fetchBill: 1,
				BBPS: 1,
				data: [
					{
						param_name: "utility_acc_no",
						param_label: "Consumer Number",
						param_type: "Numeric",
						regex: "^[0-9]{10,12}$",
						error_message: "Please enter a valid 10-12 digit consumer number.",
					},
				],
			},
		},
	},
	{
		id: "bbps-fetch-bill",
		productId: "bbps",
		name: "Fetch BBPS Bill",
		slug: "bbps-fetch-bill",
		summary:
			"Retrieve outstanding bill details from a biller before processing payment.",
		description:
			"Fetches the live bill for a customer from the biller's system. Required for operators where `billFetchResponse = 1`. The response includes the outstanding amount, due date, and a `billfetchresponse` token that must be forwarded verbatim in the subsequent Pay Bill call. Pass `hc_channel=1` to use the higher-commission delayed channel.",
		relevance: "H",
		bestFor:
			"Showing the customer their outstanding bill amount and due date before confirming payment.",
		method: "GET",
		path: "/customer/payment/bbps/bill",
		docsUrl: "https://developers.eko.in/reference/bbps-fetch-bill",
		extraRequestParams: [
			{
				name: "utility_acc_no",
				type: "string",
				required: true,
				description: "Customer's account / consumer number with the biller.",
				example: "1234567890",
			},
			{
				name: "confirmation_mobile_no",
				type: "string",
				required: true,
				description: "Customer's mobile number for transaction confirmation.",
				example: "9999988888",
			},
			{
				name: "sender_name",
				type: "string",
				required: true,
				description: "Customer's full name.",
				example: "Ramesh Kumar",
			},
			{
				name: "operator_id",
				type: "string",
				required: true,
				description: "Biller identifier from the Get Operators response.",
				example: "83",
			},
			{
				name: "source_ip",
				type: "string",
				required: true,
				description: "IP address of the agent or retailer making this request.",
				example: "192.168.1.1",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Mandatory for agent activation compliance.",
				example: "28.6139,77.2090",
			},
			{
				name: "hc_channel",
				type: "number",
				required: false,
				description:
					"Payment channel: 0 = Instant (default), 1 = Delayed (higher commissions).",
				example: 0,
			},
			{
				name: "dob",
				type: "string",
				required: false,
				description:
					"Date of birth of the policy holder in DD/MM/YYYY format. Required for LIC policies.",
				example: "15/08/1985",
			},
			{
				name: "cycle_number",
				type: "string",
				required: false,
				description:
					"Electricity bill cycle number. Required for MSEB billers.",
				example: "202406",
			},
			{
				name: "authenticator",
				type: "string",
				required: false,
				description:
					"MSEB portal password. Required for certain MSEB accounts.",
				example: "mypassword123",
			},
		],
		responseData: [
			{
				name: "bill_amount",
				type: "string",
				description:
					"Outstanding bill amount in paise (divide by 100 for rupees).",
				imp: true,
				example: "135000",
			},
			{
				name: "due_date",
				type: "string",
				description: "Bill due date returned by the biller.",
				imp: true,
				example: "30/06/2024",
			},
			{
				name: "bill_number",
				type: "string",
				description: "Biller-assigned bill or reference number.",
				imp: true,
				example: "BN20240601XYZ",
			},
			{
				name: "bill_date",
				type: "string",
				description: "Date the bill was generated.",
				example: "01/06/2024",
			},
			{
				name: "customer_name",
				type: "string",
				description: "Customer name as registered with the biller.",
				imp: true,
				example: "Ramesh Kumar",
			},
			{
				name: "billfetchresponse",
				type: "string",
				description:
					"Opaque token from the biller's system. Must be passed as-is in the Pay Bill request body when the operator requires it.",
				imp: true,
				example: "eyJhbGciOiJSUzI1NiJ9...",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Bill fetched successfully",
			response_type_id: 1388,
			data: {
				bill_amount: "135000",
				due_date: "30/06/2024",
				bill_number: "BN20240601XYZ",
				bill_date: "01/06/2024",
				customer_name: "Ramesh Kumar",
				billfetchresponse: "eyJhbGciOiJSUzI1NiJ9...",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid consumer number — biller returns no bill",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 131,
					message: "Invalid account number. Please check and retry.",
					data: {},
				},
			},
			{
				scenario: "Biller system unavailable",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 151,
					message:
						"Biller system is temporarily unavailable. Please try again later.",
					data: {},
				},
			},
		],
	},
	{
		id: "bbps-pay-bill",
		productId: "bbps",
		name: "Pay BBPS Bill",
		slug: "bbps-pay-bill",
		summary:
			"Process a bill payment or recharge for any BBPS-connected biller.",
		description:
			"The core money-debit API that executes a bill payment or prepaid recharge on the BBPS network. For operators where `billFetchResponse = 1`, the `billfetchresponse` token returned by the Fetch Bill API must be included. Parameter names sent here must exactly match the `param_name` values from Get Operator Parameters. Pass `hc_channel=1` to route through the high-commission channel, which can take up to 6 hours to settle on the biller side.",
		relevance: "H",
		bestFor:
			"Executing utility bill payments and prepaid recharges for end customers.",
		method: "POST",
		path: "/customer/payment/bbps",
		docsUrl: "https://developers.eko.in/reference/bbps-pay",
		financial: true,
		extraRequestParams: [
			{
				name: "utility_acc_no",
				type: "string",
				required: true,
				description: "Customer's account or consumer number with the biller.",
				example: "1234567890",
			},
			{
				name: "confirmation_mobile_no",
				type: "string",
				required: true,
				description: "Customer's mobile number for payment confirmation.",
				example: "9999988888",
			},
			{
				name: "sender_name",
				type: "string",
				required: true,
				description: "Customer's full name.",
				example: "Ramesh Kumar",
			},
			{
				name: "operator_id",
				type: "string",
				required: true,
				description: "Biller identifier from the Get Operators response.",
				example: "83",
			},
			{
				name: "amount",
				type: "string",
				required: true,
				description: "Payment amount in rupees (e.g. '1350' for ₹1,350).",
				example: "1350",
			},
			{
				name: "source_ip",
				type: "string",
				required: true,
				description: "IP address of the agent or retailer making this request.",
				example: "192.168.1.1",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Mandatory for agent activation compliance.",
				example: "28.6139,77.2090",
			},
			{
				name: "billfetchresponse",
				type: "string",
				required: false,
				description:
					"The opaque token returned by the Fetch Bill API. Required when the operator's `billFetchResponse = 1`.",
				example: "eyJhbGciOiJSUzI1NiJ9...",
			},
			{
				name: "dob",
				type: "string",
				required: false,
				description:
					"Date of birth of the policy holder in DD/MM/YYYY format. Required for LIC policy payments.",
				example: "15/08/1985",
			},
			{
				name: "postalcode",
				type: "number",
				required: false,
				description:
					"6-digit PIN code of the customer. Required for MSEB electricity payments.",
				example: 400001,
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				description:
					"Eko's unique transaction identifier. Use this for status enquiry and dispute resolution.",
				imp: true,
				example: "1734567890",
			},
			{
				name: "operator_ref_id",
				type: "string",
				description:
					"Reference number issued by the biller / BBPS network confirming receipt of payment.",
				imp: true,
				example: "BBPS202406011234",
			},
			{
				name: "amount",
				type: "string",
				description: "Amount debited for this transaction.",
				imp: true,
				example: "1350",
			},
			{
				name: "balance",
				type: "string",
				description:
					"Remaining wallet balance of the agent after this transaction.",
				example: "4820.50",
			},
			{
				name: "utility_acc_no",
				type: "string",
				description:
					"Consumer/account number against which the payment was made.",
				example: "1234567890",
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Your reference ID echoed back.",
				example: "BBPS-20240601-001",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Bill payment successful",
			response_type_id: 333,
			tx_status: "0",
			txstatus_desc: "Success",
			data: {
				tid: "1734567890",
				operator_ref_id: "BBPS202406011234",
				amount: "1350",
				balance: "4820.50",
				utility_acc_no: "1234567890",
				client_ref_id: "BBPS-20240601-001",
			},
		},
		errorScenarios: [
			{
				scenario: "Insufficient agent wallet balance",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 347,
					message: "Insufficient balance.",
					tx_status: "1",
					txstatus_desc: "Fail",
					data: {},
				},
			},
			{
				scenario: "Transaction awaited — biller not confirmed yet",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Transaction is being processed.",
					tx_status: "2",
					txstatus_desc: "Response Awaited",
					data: {
						tid: "1734567891",
						amount: "1350",
					},
				},
			},
			{
				scenario: "Amount mismatch — pay amount differs from fetched bill",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 148,
					message: "Amount mismatch. Please fetch the bill again and retry.",
					tx_status: "1",
					txstatus_desc: "Fail",
					data: {},
				},
			},
		],
	},
	{
		id: "bbps-transaction-status",
		productId: "bbps",
		name: "BBPS Transaction Status",
		slug: "bbps-transaction-status",
		summary:
			"Check the current status of a BBPS bill payment by Eko TID or your client reference ID.",
		descriptionFile: "transaction-inquiry.md",
		relevance: "M",
		bestFor:
			"Reconciling pending transactions and confirming payment outcomes when the Pay Bill response is awaited.",
		method: "GET",
		path: "/tools/reference/transaction/{transaction-reference}",
		docsUrl: "https://developers.eko.in/reference/transaction-inquiry",
		extraRequestParams: [
			{
				name: "transaction-reference",
				type: "string",
				required: true,
				description:
					"Eko TID or your `client_ref_id` that identifies the transaction. Pass a TID as-is; to look up by `client_ref_id`, prefix it — e.g. `client_ref_id:567890`.",
				example: "1734567890",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				description: "Eko's transaction ID.",
				imp: true,
				example: "1734567890",
			},
			{
				name: "amount",
				type: "string",
				description: "Transaction amount in rupees.",
				imp: true,
				example: "1350",
			},
			{
				name: "operator_ref_id",
				type: "string",
				description: "Biller or BBPS network reference number.",
				imp: true,
				example: "BBPS202406011234",
			},
			{
				name: "utility_acc_no",
				type: "string",
				description: "Consumer/account number for which the bill was paid.",
				example: "1234567890",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Transaction found",
			response_type_id: 1388,
			data: {
				tid: "1734567890",
				tx_status: "0",
				txstatus_desc: "Success",
				amount: "1350",
				operator_ref_id: "BBPS202406011234",
				utility_acc_no: "1234567890",
			},
		},
		errorScenarios: [
			{
				scenario: "Transaction not found for the given reference",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "Transaction not found.",
					data: {},
				},
			},
		],
	},
	{
		id: "bbps-activate-service",
		productId: "bbps",
		name: "Activate BBPS Service",
		slug: "bbps-activate-service",
		summary:
			"Onboard an agent/retailer for BBPS bill payment services using service code 53.",
		description:
			"Before a retailer can process BBPS payments, the BBPS service (service_code = 53) must be activated for their `user_code`. This is a one-time setup call per agent. After activation, verify the status using the User Service Enquiry API. The agent's GPS coordinates (`latlong`) are mandatory for production compliance. On production, only IPs located in India are whitelisted; requests from outside India are blocked per compliance.",
		relevance: "M",
		bestFor:
			"Onboarding new agents onto the BBPS bill payment service before their first transaction.",
		method: "PUT",
		path: "/user/service/activate",
		docsUrl: "https://developers.eko.in/reference/bbps",
		extraRequestParams: [
			{
				name: "service_code",
				type: "number",
				required: true,
				description: "Service identifier for BBPS. Always 53.",
				example: 53,
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's GPS coordinates as `latitude,longitude`. Mandatory for BBPS agent activation.",
				example: "28.6139,77.2090",
			},
		],
		responseData: [
			{
				name: "service_code",
				type: "number",
				description: "The service code that was activated.",
				imp: true,
				example: 53,
			},
			{
				name: "service_status",
				type: "string",
				description:
					"Activation status for the service on the agent's account.",
				imp: true,
				example: "activated",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "BBPS service activated successfully",
			response_type_id: 1388,
			data: {
				service_code: 53,
				service_status: "activated",
			},
		},
		errorScenarios: [
			{
				scenario: "Service already activated for this agent",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 17,
					message: "Service is already active for this user.",
					data: {},
				},
			},
		],
	},
	{
		id: "cms-activate-service",
		productId: "cms",
		name: "Activate CMS Service",
		slug: "cms-activate-service",
		summary:
			"Activate the CMS (Cash Collection) service for an agent/retailer before they can initiate collections.",
		description:
			"Before a retailer or field agent can generate collection URLs or process cash collections, the CMS service (service_code 58) must be activated for their user account. This is a one-time step per agent. On success the agent's account is enabled for CMS transactions.",
		relevance: "M",
		bestFor:
			"NBFCs, insurance companies, microfinance institutions onboarding field collection agents",
		method: "PUT",
		path: "/user/service/activate",
		docsUrl: "https://developers.eko.in/v1/reference/activate-service-cms",
		extraRequestParams: [
			{
				name: "service_code",
				type: "string",
				required: true,
				description:
					"Code of the service to activate. Use 58 for CMS / cash collection.",
				example: "58",
			},
		],
		responseData: [
			{
				name: "is_service_activated",
				type: "boolean",
				description: "Whether the service is now active for the given user.",
				imp: true,
				example: true,
			},
			{
				name: "service_code",
				type: "string",
				description: "The service code that was activated.",
				example: "58",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Service activated successfully",
			response_type_id: 1389,
			data: {
				is_service_activated: true,
				service_code: "58",
			},
		},
		errorScenarios: [
			{
				scenario: "Service already activated for this user",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 17,
					message: "Service already active for the user",
					data: {},
				},
			},
			{
				scenario: "Invalid or inactive initiator_id / developer_key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden — regenerate keys or check service activation",
				},
			},
		],
	},
	{
		id: "cms-get-url",
		productId: "cms",
		name: "Generate CMS Collection URL",
		slug: "cms-get-url",
		summary:
			"Generate a session-specific CMS URL that redirects the field agent to the biller selection and payment flow.",
		description:
			"Returns a short-lived redirect URL that opens Eko's hosted cash-collection interface for the authenticated agent. The agent selects the biller, enters bill details, collects cash, and the customer account is credited in real time. The response also contains a transaction record with tid, amount, operator name, and commission fields once the collection is completed through the redirect flow.",
		relevance: "M",
		bestFor:
			"Field agents collecting loan EMIs, insurance premiums, utility bills, and subscription payments at the customer doorstep",
		method: "POST",
		path: "/marketuat/airtelPartner/generateCmsUrl",
		docsUrl: "https://developers.eko.in/v1/reference/get-cms-url",
		financial: true,
		extraRequestParams: [
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Agent's current GPS coordinates in 'latitude,longitude' format. Used for geo-tagging the collection event.",
				example: "28.6139,77.2090",
			},
			{
				name: "locale",
				type: "string",
				required: false,
				description:
					"Language locale for the hosted collection UI. Defaults to 'en' (English).",
				example: "en",
			},
		],
		responseData: [
			{
				name: "url",
				type: "string",
				description:
					"Short-lived session URL to redirect the agent to the hosted biller-selection and cash-collection flow.",
				imp: true,
				example: "https://cms.eko.in/session?token=eyJhbGciOiJIUzI1NiJ9...",
			},
			{
				name: "tid",
				type: "number",
				description:
					"Eko's internal transaction ID for this collection event, assigned after completion.",
				imp: true,
				example: 3199475932,
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "The client reference ID echoed back from the request.",
				example: "CMSTRXN123",
			},
			{
				name: "amount",
				type: "number",
				description: "Amount collected in INR.",
				imp: true,
				example: 100,
			},
			{
				name: "fee",
				type: "number",
				description: "Transaction fee charged for this collection.",
				example: 0,
			},
			{
				name: "gst",
				type: "number",
				description: "GST applied on the fee.",
				example: 0,
			},
			{
				name: "tds",
				type: "number",
				description: "TDS deducted on the commission for this transaction.",
				example: 0.007,
			},
			{
				name: "partners_commision",
				type: "number",
				description:
					"Commission credited to the partner/agent for this collection.",
				example: 0.135,
			},
			{
				name: "operator_id",
				type: "string",
				description:
					"Internal identifier of the biller/operator selected by the agent.",
				example: "2912",
			},
			{
				name: "operator_name",
				type: "string",
				description: "Human-readable name of the biller/operator.",
				imp: true,
				example: "L & T FINANCE HOLDINGS LIMITED",
			},
			{
				name: "service_code",
				type: "string",
				description:
					"Service code for CMS transactions (always 26 for cash collection).",
				example: "26",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description: "Bank reference number for the collection, if available.",
				example: null,
			},
			{
				name: "timestamp",
				type: "string",
				description:
					"Date and time of the transaction in 'YYYY-MM-DD HH:mm:ss' format (IST).",
				example: "2024-03-06 12:11:43",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "CMS URL generated successfully",
			response_type_id: 1388,
			tx_status: "0",
			txstatus_desc: "Success",
			data: {
				url: "https://cms.eko.in/session?token=eyJhbGciOiJIUzI1NiJ9...",
				tid: 3199475932,
				client_ref_id: "CMSTRXN123",
				amount: 100,
				fee: 0,
				gst: 0,
				tds: 0.007,
				partners_commision: 0.135,
				operator_id: "2912",
				operator_name: "L & T FINANCE HOLDINGS LIMITED",
				service_code: "26",
				bank_ref_num: null,
				timestamp: "2024-03-06 12:11:43",
			},
		},
		errorScenarios: [
			{
				scenario: "CMS service not activated for the agent",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "User not found or service not active",
					data: {},
				},
			},
			{
				scenario: "Missing or invalid latlong parameter",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid request: latlong is required",
					data: {},
				},
			},
			{
				scenario: "Insufficient balance in merchant wallet",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 347,
					message: "Insufficient balance",
					data: {},
				},
			},
			{
				scenario: "Invalid credentials or expired secret-key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden — invalid developer_key or secret-key",
				},
			},
		],
	},
	{
		id: "qr-generate-static",
		productId: "qr-payment",
		name: "Generate Static QR",
		slug: "qr-generate-static",
		summary:
			"Generate a permanent UPI QR code for a merchant/agent that can receive any amount.",
		description:
			"Creates a static UPI QR code linked to the agent's registered VPA (Virtual Payment Address) or the UPI ID. The same QR code can be reused for multiple transactions; the payer manually enters the amount. Suitable for fixed collection points such as shop counters and printed QR standees. Only one static QR string can be generated per `sender_id`.",
		relevance: "M",
		bestFor:
			"Retail stores, kiosks, and any merchant needing a reusable printed QR code.",
		method: "POST",
		path: "/users/collection/upi-razorpay/generate-static-qr",
		docsUrl: "https://developers.eko.in/reference/upi-generate-static-qr",
		omitCommonParams: ["client_ref_id"],
		extraRequestParams: [
			{
				name: "sender_id",
				type: "string",
				required: true,
				description:
					"Registered mobile number of the agent/merchant for which the QR code is generated.",
				example: "9876543210",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Display name of the agent/merchant shown on the QR code.",
				example: "Ravi Kumar Store",
			},
			{
				name: "email",
				type: "string",
				required: false,
				description: "Email address of the agent/merchant.",
				example: "ravi@example.com",
			},
		],
		responseData: [
			{
				name: "qr_string",
				type: "string",
				description:
					"Raw UPI QR payload string; encode this into a QR image using any QR library.",
				imp: true,
				example:
					"upi://pay?pa=merchant.vpa@razorpay&pn=Ravi+Kumar+Store&mc=0000&mode=02&purpose=00",
			},
			{
				name: "qr_image",
				type: "string",
				description:
					"Base64-encoded PNG image of the generated QR code, ready to display or embed.",
				imp: true,
				example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
			},
			{
				name: "vpa",
				label: "Merchant VPA (UPI ID)",
				type: "string",
				description:
					"UPI Virtual Payment Address (VPA) assigned to this merchant.",
				imp: true,
				example: "merchant.vpa@razorpay",
			},
			{
				name: "merchant_name",
				type: "string",
				description: "Merchant display name embedded in the QR.",
				example: "Ravi Kumar Store",
			},
			{
				name: "service_code",
				type: "string",
				description:
					"Internal service code identifying the QR collection service.",
				example: "27",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Static QR generated successfully.",
			response_type_id: 1388,
			data: {
				qr_string:
					"upi://pay?pa=merchant.vpa@razorpay&pn=Ravi+Kumar+Store&mc=0000&mode=02&purpose=00",
				qr_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
				vpa: "merchant.vpa@razorpay",
				merchant_name: "Ravi Kumar Store",
				service_code: "27",
			},
		},
		errorScenarios: [
			{
				scenario: "Agent not onboarded for QR collection service",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message:
						"User not found. Please onboard the agent before generating a QR code.",
					data: {},
				},
			},
			{
				scenario: "Invalid or unregistered sender_id",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "Sender not found.",
					data: {},
				},
			},
		],
	},
	{
		id: "qr-generate-dynamic",
		productId: "qr-payment",
		name: "Generate Dynamic QR",
		slug: "qr-generate-dynamic",
		summary:
			"Generate a one-time UPI QR code pre-loaded with a specific amount for a transaction.",
		description:
			"Creates a transaction-specific UPI QR code that embeds the exact payable amount. Each scan results in a fixed-amount payment, enabling automatic reconciliation without manual verification. Ideal for e-commerce checkout, restaurant billing, and event ticketing where the amount is known in advance.",
		relevance: "M",
		bestFor:
			"E-commerce checkout, restaurant POS, event ticketing — any flow where amount is fixed per transaction.",
		method: "POST",
		path: "/users/collection/upi-razorpay/generate-dynamic-qr",
		docsUrl: "https://developers.eko.in/reference/upi-generate-static-qr",
		extraRequestParams: [
			{
				name: "sender_id",
				type: "string",
				required: true,
				description:
					"Registered mobile number of the agent/merchant collecting the payment.",
				example: "9876543210",
			},
			{
				name: "amount",
				type: "number",
				required: true,
				description:
					"Amount (in INR) to embed in the QR code. The payer cannot change this value.",
				example: 499,
			},
			{
				name: "name",
				type: "string",
				required: false,
				description: "Display name of the merchant shown to the payer.",
				example: "Ravi Kumar Store",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "number",
				description:
					"Eko transaction ID for this QR. Store this to query status or initiate a refund.",
				imp: true,
				example: 2886601782,
			},
			{
				name: "qr_string",
				type: "string",
				description:
					"Raw UPI QR payload including the embedded amount; encode into a QR image.",
				imp: true,
				example:
					"upi://pay?pa=merchant.vpa@razorpay&pn=Ravi+Kumar+Store&am=499.00&mc=0000&tr=ORD-20240601-9871&tn=Payment&mode=02&purpose=00",
			},
			{
				name: "qr_image",
				type: "string",
				description:
					"Base64-encoded PNG image of the QR code, ready to display in your UI.",
				imp: true,
				example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
			},
			{
				name: "amount",
				type: "number",
				description:
					"The amount embedded in the QR (echoed back for confirmation).",
				imp: true,
				example: 499,
			},
			{
				name: "vpa",
				label: "Merchant VPA (UPI ID)",
				type: "string",
				description: "Merchant UPI VPA to which payment will be credited.",
				example: "merchant.vpa@razorpay",
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Your order reference echoed back for correlation.",
				example: "ORD-20240601-9871",
			},
			{
				name: "service_code",
				type: "string",
				description:
					"Internal service code identifying the QR collection service.",
				example: "27",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Dynamic QR generated successfully.",
			response_type_id: 1388,
			data: {
				tid: 2886601782,
				qr_string:
					"upi://pay?pa=merchant.vpa@razorpay&pn=Ravi+Kumar+Store&am=499.00&mc=0000&tr=ORD-20240601-9871&tn=Payment&mode=02&purpose=00",
				qr_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
				amount: 499,
				vpa: "merchant.vpa@razorpay",
				client_ref_id: "ORD-20240601-9871",
				service_code: "27",
			},
		},
		errorScenarios: [
			{
				scenario: "Amount missing or zero",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Amount is required and must be greater than zero.",
					data: {},
				},
			},
			{
				scenario: "Agent not onboarded for QR collection",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "User not found.",
					data: {},
				},
			},
		],
	},
	{
		id: "qr-transaction-inquiry",
		productId: "qr-payment",
		name: "Transaction Inquiry",
		slug: "qr-transaction-inquiry",
		summary:
			"Query the current status of a QR payment transaction by Eko TID or your client reference ID.",
		description:
			"Polls the real-time status of any transaction — including QR collection payments — using either the Eko transaction ID (tid) or your own client_ref_id. Use this when a webhook has not arrived within your expected window or to implement a status-check polling flow.",
		descriptionFile: "transaction-inquiry.md",
		relevance: "M",
		bestFor:
			"Reconciliation polling, fallback status check when webhook delivery is delayed.",
		method: "GET",
		path: "/tools/reference/transaction/{transaction-reference}",
		docsUrl: "https://developers.eko.in/reference/transaction-inquiry",
		extraRequestParams: [
			{
				name: "transaction-reference",
				type: "string",
				required: true,
				description:
					"Eko TID or your `client_ref_id` that identifies the transaction. Pass a TID as-is; to look up by `client_ref_id`, prefix it — e.g. `client_ref_id:567890`.",
				example: "2886601782",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "number",
				description: "Eko's internal transaction ID.",
				imp: true,
				example: 2886601782,
			},
			{
				name: "amount",
				type: "number",
				description: "Transaction amount in INR.",
				imp: true,
				example: 499,
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Your order/client reference echoed back.",
				example: "ORD-20240601-9871",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description: "Bank/NPCI reference number for the UPI transaction.",
				example: "313196224563",
			},
			{
				name: "payment_mode",
				type: "string",
				description: "Mode code of payment (e.g. UPI).",
				example: "5",
			},
			{
				name: "timestamp",
				type: "string",
				description: "Transaction timestamp in YYYY-MM-DD HH:MM:SS format.",
				example: "2024-06-01 14:23:05",
			},
			{
				name: "fee",
				type: "number",
				description: "Platform fee charged for this transaction.",
				example: 0,
			},
			{
				name: "gst",
				type: "number",
				description: "GST applied on the platform fee.",
				example: 0,
			},
			{
				name: "service_code",
				type: "string",
				description: "Service code identifying the collection product.",
				example: "27",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Transaction found.",
			response_type_id: 1388,
			tx_status: "0",
			txstatus_desc: "Success",
			data: {
				tid: 2886601782,
				tx_status: "0",
				txstatus_desc: "Success",
				amount: 499,
				client_ref_id: "ORD-20240601-9871",
				bank_ref_num: "313196224563",
				payment_mode: "5",
				timestamp: "2024-06-01 14:23:05",
				fee: 0,
				gst: 0,
				service_code: "27",
			},
		},
		errorScenarios: [
			{
				scenario: "Transaction not found for given reference",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "No transaction found for the given reference.",
					data: {},
				},
			},
		],
	},
	{
		id: "qr-transaction-status-callback",
		productId: "qr-payment",
		name: "Transaction Status Callback (Webhook)",
		slug: "qr-transaction-status-callback",
		summary:
			"Incoming webhook Eko POSTs to your server when a QR payment transaction changes state.",
		description:
			"Eko calls this webhook on your registered callback URL whenever a QR collection (or other) transaction status changes — typically from Initiated to Success or Fail. Your endpoint must return HTTP 200 to acknowledge receipt. Supports DMT, Fund Transfer, QR, and CMS transaction types. Configure your callback URL in the Eko developer portal.",
		relevance: "M",
		bestFor:
			"Real-time payment confirmation, instant order fulfilment trigger, reconciliation automation.",
		method: "POST",
		path: "/your-callback-url",
		docsUrl: "https://developers.eko.in/reference/transaction-status-callback",
		extraRequestParams: [],
		omitCommonParams: ["initiator_id"],
		responseData: [
			{
				name: "tid",
				type: "number",
				description:
					"Eko transaction ID. Use this to query further details or initiate a refund.",
				imp: true,
				example: 2886601782,
			},
			{
				name: "amount",
				type: "number",
				description: "Transaction amount in INR.",
				imp: true,
				example: 499,
			},
			{
				name: "client_ref_id",
				type: "string",
				description:
					"Your order reference echoed back for correlation with your internal system.",
				example: "ORD-20240601-9871",
			},
			{
				name: "old_tx_status",
				type: "number",
				description:
					"Previous transaction state before this update — useful for detecting transitions.",
				example: 2,
			},
			{
				name: "old_tx_status_desc",
				type: "string",
				description: "Human-readable label for the previous state.",
				example: "Initiated",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description: "Bank/NPCI UPI reference number.",
				example: "313196224563",
			},
			{
				name: "payment_mode",
				type: "string",
				description: "Payment mode code (e.g. 5 for UPI).",
				example: "5",
			},
			{
				name: "fee",
				type: "number",
				description: "Platform fee deducted.",
				example: 0,
			},
			{
				name: "gst",
				type: "number",
				description: "GST on the platform fee.",
				example: 0,
			},
			{
				name: "timestamp",
				type: "string",
				description: "Transaction timestamp in YYYY-MM-DD HH:MM:SS format.",
				example: "2024-06-01 14:23:05",
			},
		],
		sampleSuccessResponse: {
			status: 200,
			message: "Acknowledged",
		},
	},
	{
		id: "qr-get-refund-otp",
		productId: "qr-payment",
		name: "Get Refund OTP",
		slug: "qr-get-refund-otp",
		summary:
			"Request an OTP to the sender's mobile number as the first step of a two-step refund flow.",
		description:
			"Initiates the refund OTP flow for a failed or disputed QR payment transaction. Eko sends a one-time password to the original payer's registered mobile number. The OTP and the otp_ref_id returned here are required as inputs to the Initiate Refund API. This two-step mechanism prevents unauthorized refund initiation.",
		relevance: "M",
		bestFor:
			"Starting the refund process for a failed QR collection transaction.",
		method: "POST",
		path: "/customer/payment/refund/{tid}/otp",
		docsUrl: "https://developers.eko.in/reference/get-refund-otp",
		extraRequestParams: [
			{
				name: "tid",
				type: "string",
				required: true,
				description:
					"Eko transaction ID of the transaction to be refunded. Obtained from the QR payment response or Transaction Inquiry.",
				example: "2886601782",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID for the generated OTP session. Pass this along with the OTP to the Initiate Refund API.",
				imp: true,
				example: "OTP_REF_884321",
			},
			{
				name: "tid",
				type: "number",
				description:
					"Echoed Eko transaction ID confirming which transaction this OTP belongs to.",
				example: 2886601782,
			},
			{
				name: "message",
				type: "string",
				description: "Confirmation that the OTP has been dispatched.",
				example: "OTP sent to the registered mobile number.",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "OTP sent successfully.",
			response_type_id: 1388,
			data: {
				otp_ref_id: "OTP_REF_884321",
				tid: 2886601782,
				message: "OTP sent to the registered mobile number.",
			},
		},
		errorScenarios: [
			{
				scenario: "Transaction already refunded",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Transaction is already in refunded state.",
					data: {},
				},
			},
			{
				scenario:
					"Transaction not eligible for refund (still in Success state)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Transaction is not in a refundable state.",
					data: {},
				},
			},
		],
	},
	{
		id: "qr-initiate-refund",
		productId: "qr-payment",
		name: "Initiate Refund",
		slug: "qr-initiate-refund",
		summary:
			"Complete a QR payment refund using the OTP received from the Get Refund OTP step.",
		description:
			"Second and final step of the QR payment refund flow. Submits the OTP (sent to the payer's mobile) along with the otp_ref_id from the previous step to authorize and execute the refund. On success, funds are returned to the payer's UPI account. The service_code must always be 80 (PayPoint) and state must be 1.",
		relevance: "M",
		bestFor:
			"Processing customer refunds for failed or disputed QR collection transactions.",
		method: "POST",
		path: "/customer/payment/refund/{tid}",
		docsUrl: "https://developers.eko.in/reference/refund",
		financial: true,
		extraRequestParams: [
			{
				name: "tid",
				type: "string",
				required: true,
				description:
					"Eko transaction ID of the original QR payment to be refunded.",
				example: "2886601782",
			},
			{
				name: "otp",
				type: "number",
				required: true,
				description:
					"One-time password received by the payer on their registered mobile, obtained via Get Refund OTP.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description:
					"OTP session reference ID returned by the Get Refund OTP API.",
				example: "OTP_REF_884321",
			},
			{
				name: "service_code",
				type: "number",
				required: true,
				description: "Fixed value: 80 (PayPoint service code for refunds).",
				example: 80,
			},
			{
				name: "state",
				type: "number",
				required: true,
				description: "Fixed value: 1.",
				example: 1,
			},
		],
		responseData: [
			{
				name: "tid",
				type: "number",
				description: "Eko refund transaction ID.",
				imp: true,
				example: 2886605555,
			},
			{
				name: "amount",
				type: "number",
				description: "Amount refunded in INR.",
				imp: true,
				example: 499,
			},
			{
				name: "bank_ref_num",
				type: "string",
				description: "Bank/NPCI reference number for the refund credit.",
				example: "313196229999",
			},
			{
				name: "client_ref_id",
				type: "string",
				description: "Your reference for this refund request.",
				example: "REF-ORD-20240601-9871",
			},
			{
				name: "timestamp",
				type: "string",
				description: "Timestamp when the refund was processed.",
				example: "2024-06-02 09:11:00",
			},
			{
				name: "fee",
				type: "number",
				description: "Fee charged for the refund transaction (usually 0).",
				example: 0,
			},
			{
				name: "gst",
				type: "number",
				description: "GST on the refund fee.",
				example: 0,
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Refund initiated successfully.",
			tx_status: "4",
			txstatus_desc: "Refunded",
			data: {
				tid: 2886605555,
				tx_status: "4",
				txstatus_desc: "Refunded",
				amount: 499,
				bank_ref_num: "313196229999",
				client_ref_id: "REF-ORD-20240601-9871",
				timestamp: "2024-06-02 09:11:00",
				fee: 0,
				gst: 0,
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or expired OTP",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 302,
					message: "Wrong OTP. Please enter the correct OTP.",
					data: {},
				},
			},
			{
				scenario: "OTP session expired",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 303,
					message: "OTP expired. Please generate a new OTP.",
					data: {},
				},
			},
			{
				scenario: "Insufficient balance for refund processing",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 347,
					message: "Insufficient balance.",
					data: {},
				},
			},
		],
	},

	// MARK: KYC APIs...
	{
		id: "pan-lite",
		productId: "pan",
		name: "PAN Lite",
		slug: "pan-lite",
		summary:
			"Instant PAN validation with name and DOB match scores plus Aadhaar seeding status.",
		description:
			"PAN Lite performs a lightweight synchronous PAN verification. Supply the PAN number, holder name, and date of birth; the API returns match flags for name and DOB, the PAN activation status code, and whether the PAN is seeded (linked) with Aadhaar. Note: the name field in the response reflects the name you submitted, not the registered name on the PAN record — use PAN Advanced for the registered name.",
		relevance: "H",
		bestFor: "Basic PAN status checks and quick KYC pre-screening",
		method: "POST",
		path: "/tools/kyc/pan-lite",
		docsUrl: "https://developers.eko.in/reference/pan-lite",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/pan/pan-lite",
		extraRequestParams: [
			{
				name: "pan_number",
				label: "PAN Number",
				type: "string",
				required: true,
				description:
					"10-character alphanumeric PAN identifier (5 letters, 4 digits, 1 letter).",
				example: "ABCDE1234F",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Individual's name to match against PAN records.",
				example: "Rajesh Kumar",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				required: true,
				description: "Date of birth in YYYY-MM-DD format.",
				example: "1994-08-29",
			},
		],
		responseData: [
			{
				name: "pan",
				label: "PAN Number",
				type: "string",
				description: "The PAN number submitted in the request.",
				example: "ABCDE1234F",
			},
			{
				name: "name",
				type: "string",
				description:
					"Name as submitted in the request (not the registered name on the PAN card).",
				example: "Rajesh Kumar",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				description: "Date of birth as submitted in the request (YYYY-MM-DD).",
				example: "1994-08-29",
			},
			{
				name: "name_match",
				label: "Name Matched?",
				type: "string",
				description:
					"Whether the submitted name matches the PAN record. Values: 'Y' (match), 'N' (no match), or null (unavailable).",
				imp: true,
				example: "Y",
			},
			{
				name: "dob_match",
				label: "DOB Matched?",
				type: "string",
				description:
					"Whether the submitted date of birth matches the PAN record. Values: 'Y' (match), 'N' (no match), or null (unavailable).",
				imp: true,
				example: "Y",
			},
			{
				name: "pan_status",
				label: "PAN Activation Status",
				type: "string",
				description:
					"Granular PAN activation status code. E: Valid, EC: Valid (Acquisition), N: Non-existent, X: Deactivated, F: Fake, D: Deleted, EA: Valid (Amalgamation), ED: Valid (Death), EI: Valid (Dissolution), EL: Valid (Liquidated), EM: Valid (Merger), EP: Valid (Partition), ES: Valid (Split), EU: Valid (Under Liquidation)",
				imp: true,
				example: "E",
			},
			{
				name: "status",
				label: "PAN Validity Status",
				type: "string",
				description: "High-level PAN validity: 'VALID' or 'INVALID'.",
				imp: true,
				example: "VALID",
			},
			{
				name: "aadhaar_seeding_status",
				type: "string",
				description:
					"Aadhaar-PAN seeding/linking status. Values: 'Y' (seeded), 'R' (registered but not confirmed), 'NA' (not seeded), or null.",
				imp: true,
				example: "Y",
			},
			{
				name: "aadhaar_seeding_status_desc",
				type: "string",
				description:
					"Human-readable description of the Aadhaar-PAN linkage status.",
				example: "Aadhaar is linked to PAN",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "PAN verification successful",
			response_type_id: 1388,
			data: {
				pan: "ABCDE1234F",
				name: "Rajesh Kumar",
				dob: "1994-08-29",
				name_match: "Y",
				dob_match: "Y",
				pan_status: "E",
				status: "VALID",
				aadhaar_seeding_status: "Y",
				aadhaar_seeding_status_desc: "Aadhaar is linked to PAN",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or non-existent PAN",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "PAN not found or invalid",
					response_type_id: 1388,
					data: {
						pan: "ABCDE1234F",
						pan_status: "N",
						status: "INVALID",
						name_match: null,
						dob_match: null,
						aadhaar_seeding_status: null,
						aadhaar_seeding_status_desc: null,
					},
				},
			},
			{
				scenario: "Missing required parameter",
				statusCode: 400,
				example: {
					status: 1,
					message: "Bad request — missing or malformed parameter",
				},
			},
		],
	},
	{
		id: "pan-advanced",
		productId: "pan",
		name: "PAN Advanced",
		slug: "pan-advanced",
		summary:
			"Rich PAN verification returning registered name, PAN type, gender, DOB, masked Aadhaar, address, email, and mobile.",
		description:
			"PAN Advanced performs a deeper KYC lookup against the PAN database. In addition to the match flags returned by PAN Lite, it surfaces the registered name, name on the PAN card, PAN type (Individual / Company / etc.), gender, date of birth, masked Aadhaar number, Aadhaar link status, and structured address. Email and mobile fields are populated at a ~5–10% fill rate due to data-source availability. Use this API when downstream workflows need authoritative identity attributes beyond a pass/fail match.",
		relevance: "H",
		bestFor:
			"KYC workflows needing richer identity attributes and verified registered name",
		method: "POST",
		path: "/tools/kyc/pan-advanced",
		docsUrl: "https://developers.eko.in/reference/pan-advanced",
		sourceDoc: "https://www.cashfree.com/docs/api-reference/vrs/v2/pan/pan-360",
		extraRequestParams: [
			{
				name: "pan",
				label: "PAN Number",
				type: "string",
				required: true,
				description:
					"10-character alphanumeric PAN identifier (first 5 alphabets, 4 digits, 1 alphabet).",
				example: "ABCDE1234F",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description:
					"Individual's name per PAN information, used for match scoring.",
				example: "Rajesh Kumar",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				required: true,
				description: "Date of birth in YYYY-MM-DD format.",
				example: "1994-08-29",
			},
		],
		responseData: [
			{
				name: "pan",
				label: "PAN Number",
				type: "string",
				description: "PAN number submitted in the request.",
				// imp: true,
				example: "ABCDE1234F",
			},
			{
				name: "name_provided",
				type: "string",
				description: "Name as submitted in the request.",
				example: "Rajesh Kumar",
			},
			{
				name: "registered_name",
				type: "string",
				description: "Authoritative name registered in the PAN database.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "name_pan_card",
				label: "Name on PAN Card",
				type: "string",
				description: "Name printed on the physical PAN card.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "first_name",
				type: "string",
				description: "First name parsed from the PAN record.",
				example: "Rajesh",
			},
			{
				name: "last_name",
				type: "string",
				description: "Last name parsed from the PAN record.",
				example: "Kumar",
			},
			{
				name: "type",
				type: "string",
				description:
					"PAN holder category (e.g., 'Individual', 'Company', 'Firm', 'Trust', 'HUF').",
				imp: true,
				example: "Individual",
			},
			{
				name: "gender",
				type: "string",
				description:
					"Gender from PAN record. Values: 'M' (Male), 'F' (Female).",
				imp: true,
				example: "M",
			},
			{
				name: "date_of_birth",
				type: "string",
				description: "Date of birth from the PAN record (YYYY-MM-DD).",
				imp: true,
				example: "1994-08-29",
			},
			{
				name: "masked_aadhaar_number",
				type: "string",
				description:
					"Aadhaar number with first 8 digits masked for privacy (e.g., 'XXXX XXXX 1234').",
				imp: true,
				example: "XXXX XXXX 1234",
			},
			{
				name: "aadhaar_linked",
				label: "Aadhaar Linked?",
				type: "boolean",
				description: "Whether the PAN is linked to an Aadhaar number.",
				imp: true,
				example: true,
			},
			{
				name: "email",
				type: "string",
				description:
					"Email address associated with the PAN. Fill rate is approximately 5–10% due to data-source availability.",
				example: "rajesh.kumar@example.com",
			},
			{
				name: "mobile_number",
				type: "string",
				description:
					"Mobile number associated with the PAN. Fill rate is approximately 5–10% due to data-source availability.",
				example: "9876543210",
			},
			{
				name: "address",
				type: "object",
				description: "Structured address fields of the PAN holder.",
				imp: true,
				children: [
					{
						name: "full_address",
						type: "string",
						description: "Complete address string.",
						imp: true,
						example: "Woodland Heights, Ghatkopar, Mumbai, Maharashtra 400072",
					},
					{
						name: "street",
						type: "string",
						description: "Street name / house number.",
						example: "Woodland Heights, Ghatkopar",
					},
					{
						name: "city",
						type: "string",
						description: "City name.",
						example: "Mumbai",
					},
					{
						name: "state",
						type: "string",
						description: "State name.",
						example: "Maharashtra",
					},
					{
						name: "pincode",
						type: "number",
						description: "6-digit postal PIN code.",
						example: 400072,
					},
					{
						name: "country",
						type: "string",
						description: "Country name.",
						example: "India",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "PAN Advanced verification successful",
			response_type_id: 1388,
			data: {
				pan: "ABCDE1234F",
				name_provided: "Rajesh Kumar",
				registered_name: "Rajesh Kumar",
				name_pan_card: "Rajesh Kumar",
				first_name: "Rajesh",
				last_name: "Kumar",
				type: "Individual",
				gender: "M",
				date_of_birth: "1994-08-29",
				masked_aadhaar_number: "XXXX XXXX 1234",
				aadhaar_linked: true,
				email: "rajesh.kumar@example.com",
				mobile_number: "9876543210",
				address: {
					full_address:
						"Woodland Heights, Ghatkopar, Mumbai, Maharashtra 400072",
					street: "Woodland Heights, Ghatkopar",
					city: "Mumbai",
					state: "Maharashtra",
					pincode: 400072,
					country: "India",
				},
			},
		},
		errorScenarios: [
			{
				scenario: "PAN not found in database",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "PAN not found or verification failed",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Missing required parameter",
				statusCode: 400,
				example: {
					status: 1,
					message: "Bad request — missing or malformed parameter",
				},
			},
		],
	},
	{
		id: "pan-bulk-verify",
		productId: "pan",
		name: "Bulk PAN Verification",
		slug: "pan-bulk-verify",
		summary:
			"Async batch PAN verification — submit multiple PANs in one call and poll for results via the Bulk PAN Status API.",
		description:
			"Bulk PAN Verification accepts an array of PAN entries (each with a PAN number and optional name) in a single POST request and returns a reference_id for tracking. Because verification runs asynchronously, callers must subsequently poll the Bulk PAN Verification Status API with the returned reference_id to retrieve individual results. Suited for high-volume operations such as employee on-boarding, merchant KYC batches, or overnight reconciliation runs.",
		relevance: "M",
		bestFor:
			"High-volume PAN verification with async processing (employee on-boarding, batch KYC)",
		method: "POST",
		path: "/tools/kyc/pan/bulk",
		docsUrl: "https://developers.eko.in/reference/pan-bulk-verify",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/pan/verify-pan-in-bulk",
		extraRequestParams: [
			{
				name: "entries",
				type: "array",
				required: true,
				description:
					"Array of PAN verification entries. Each entry contains a PAN number (required), name (optional), user_code (optional), and source (optional, defaults to 'API').",
				example: [
					{
						pan: "ABCPV1234D",
						name: "John",
						source: "API",
					},
					{
						pan: "ABCPV1234L",
						name: "John Doe",
						source: "API",
					},
				],
			},
		],
		responseData: [
			{
				name: "reference_id",
				type: "number",
				description:
					"Unique identifier for the submitted batch. Pass this to the Bulk PAN Verification Status API to retrieve individual PAN results once processing is complete.",
				example: 123456,
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message:
				"Bulk PAN verification request accepted. Poll status API for results.",
			response_type_id: 1388,
			data: {
				reference_id: 123456,
			},
		},
		errorScenarios: [
			{
				scenario: "Empty or missing entries array",
				statusCode: 400,
				example: {
					status: 1,
					message:
						"Bad request — entries array is required and must not be empty",
				},
			},
			{
				scenario: "Malformed PAN in one or more entries",
				statusCode: 400,
				example: {
					status: 1,
					message:
						"Bad request — one or more entries contain an invalid PAN format",
				},
			},
		],
	},
	{
		id: "pan-bulk-status",
		productId: "pan",
		name: "Check Bulk PAN Verification Status",
		slug: "pan-bulk-status",
		summary:
			"Poll the result of a Bulk PAN Verification batch using the reference_id returned when the batch was submitted.",
		description:
			"Retrieves the per-PAN results for a batch previously submitted via the Bulk PAN Verification API. Because bulk verification runs asynchronously, callers poll this endpoint with the reference_id from the submit response until the batch finishes processing. The response returns a count and an array of entries, one per PAN, each carrying the validity, registered name, name-match score/result, Aadhaar-seeding status, and PAN status.",
		relevance: "M",
		bestFor:
			"Fetching individual PAN results after submitting a batch to the Bulk PAN Verification API.",
		method: "GET",
		path: "/tools/kyc/pan/bulk/status",
		docsUrl: "https://developers.eko.in/reference/bulk-pan-verification-status",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/pan/verify-pan-in-bulk",
		extraRequestParams: [
			{
				name: "reference_id",
				type: "string",
				required: true,
				description:
					"Unique id returned by the Bulk PAN Verification API for the submitted batch.",
				example: "123456",
			},
			{
				name: "bulk_reference_id",
				type: "string",
				required: false,
				description:
					"Unique id created to identify the bulk request, if you tracked one at submit time.",
				example: "BULK-PAN-20240101-001",
			},
		],
		responseData: [
			{
				name: "count",
				type: "number",
				description: "Number of entries in the results array.",
				imp: true,
				example: 2,
			},
			{
				name: "entries",
				type: "array",
				description: "Per-PAN verification results for the batch.",
				imp: true,
				children: [
					{
						name: "pan",
						type: "string",
						description: "10-character PAN identifier.",
						imp: true,
						example: "ABCPV1234D",
					},
					{
						name: "valid",
						type: "string",
						description: "PAN card validity status.",
						example: "true",
					},
					{
						name: "registered_name",
						type: "string",
						description: "Name on record against the PAN.",
						example: "John Doe",
					},
					{
						name: "name_provided",
						type: "string",
						description: "Name submitted in the bulk request for this PAN.",
						example: "John",
					},
					{
						name: "name_match_score",
						type: "string",
						description: "Name verification score.",
						example: "82.5",
					},
					{
						name: "name_match_result",
						type: "string",
						description: "Name match result.",
						example: "GOOD_PARTIAL_MATCH",
					},
					{
						name: "aadhaar_seeding_status",
						type: "string",
						description: "Aadhaar-PAN linkage status.",
						example: "Y",
					},
					{
						name: "pan_status",
						type: "string",
						description: "Current PAN status.",
						example: "VALID",
					},
					{
						name: "message",
						type: "string",
						description: "Success or failure details for this entry.",
						example: "PAN verified successfully",
					},
					{
						name: "reference_id",
						type: "string",
						description: "Unique reference identifier for the entry.",
						example: "123456",
					},
					{
						name: "last_updated_at",
						type: "string",
						description: "Timestamp when the entry was last updated.",
						example: "2024-01-01 12:30:45",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				count: 2,
				entries: [
					{
						pan: "ABCPV1234D",
						valid: "true",
						registered_name: "John Doe",
						name_provided: "John",
						name_match_score: "82.5",
						name_match_result: "GOOD_PARTIAL_MATCH",
						aadhaar_seeding_status: "Y",
						pan_status: "VALID",
						message: "PAN verified successfully",
						reference_id: "123456",
						last_updated_at: "2024-01-01 12:30:45",
					},
					{
						pan: "ABCPV1234L",
						valid: "true",
						registered_name: "John Doe",
						name_provided: "John Doe",
						name_match_score: "100",
						name_match_result: "EXACT_MATCH",
						aadhaar_seeding_status: "Y",
						pan_status: "VALID",
						message: "PAN verified successfully",
						reference_id: "123456",
						last_updated_at: "2024-01-01 12:30:46",
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Missing reference_id",
				statusCode: 400,
				example: {
					status: 1,
					message: "Bad request — reference_id is required",
				},
			},
			{
				scenario: "Unknown or expired reference_id",
				statusCode: 404,
				example: {
					status: 1,
					message: "No batch found for the supplied reference_id",
				},
			},
		],
	},

	{
		id: "aadhaar-dmt-levin-validate",
		productId: "dmt",
		provider: "DMT – Levin",
		group: "Sender",
		name: "Validate Aadhaar & Generate OTP",
		slug: "aadhaar-dmt-levin-validate",
		summary:
			"Validate a sender's Aadhaar number and trigger an OTP to the linked mobile for DMT Levin onboarding.",
		description:
			"Submits the sender's Aadhaar number via the DMT Levin channel to initiate OTP-based Aadhaar validation. The `otp_ref_id` from the sender's existing profile plus the Aadhaar number are required. Returns a new `otp_ref_id` for the validation session. Part of the Levin DMT sender onboarding flow.",
		relevance: "M",
		bestFor:
			"DMT Levin sender onboarding flows that require Aadhaar number validation as a step before completing identity verification.",
		method: "POST",
		path: "/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp",
		docsUrl: "https://developers.eko.in/reference/validate-aadhar-levin",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "integer",
				required: true,
				description: "Sender's mobile number.",
				example: 9876543210,
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description: "12-digit Aadhaar number of the sender.",
				example: "123456789012",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: true,
				description:
					"Reference ID returned from the Get Sender Info (or Create Sender) API for this customer.",
				example: "73849201",
			},
			{
				name: "additional_info",
				type: "string",
				required: true,
				description: "Additional info flag. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"New OTP reference ID for the Aadhaar validation session. Pass to Validate Sender Aadhaar OTP.",
				example: "93847201",
			},
			{
				name: "mobile_hint",
				type: "string",
				description: "Masked mobile number to which the OTP was dispatched.",
				example: "******3210",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Aadhaar OTP dispatched successfully",
			response_type_id: 1388,
			data: {
				otp_ref_id: "93847201",
				mobile_hint: "******3210",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid Aadhaar number",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 301,
					message: "Invalid Aadhaar number provided.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "aadhaar-dmt-levin-verify-otp",
		productId: "dmt",
		provider: "DMT – Levin",
		group: "Sender",
		name: "Validate Sender Aadhaar OTP",
		slug: "aadhaar-dmt-levin-verify-otp",
		summary:
			"Verify the Aadhaar OTP for a DMT Levin sender to complete identity validation.",
		description:
			"Validates the OTP received on the sender's Aadhaar-linked mobile number in the DMT Levin flow. Use `intent_id: 20` for Aadhaar validation (as opposed to `intent_id: 19` for sender onboarding). On success, the sender's identity is confirmed and their DMT Levin wallet profile is updated.",
		relevance: "M",
		bestFor:
			"Completing OTP-based Aadhaar validation in the DMT Levin sender onboarding flow.",
		method: "POST",
		path: "/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp/verify",
		docsUrl: "https://developers.eko.in/reference/validate-otp-levin",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's mobile number.",
				example: "9876543210",
			},
			{
				name: "otp",
				type: "integer",
				required: false,
				description: "OTP received on the Aadhaar-linked mobile number.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"Reference ID from the Validate Aadhaar (DMT Levin) response.",
				example: 93847201,
			},
			{
				name: "intent_id",
				type: "string",
				required: false,
				description:
					'Set to "19" for sender onboarding or "20" for Aadhaar validation.',
				example: "20",
			},
			{
				name: "additional_info",
				type: "string",
				required: false,
				description: "Additional info flag. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "verified",
				type: "boolean",
				description: "True if Aadhaar OTP validation was successful.",
				imp: true,
				example: true,
			},
			{
				name: "name",
				type: "string",
				description: "Verified sender name from Aadhaar.",
				imp: true,
				example: "Arjun Mehta",
			},
			{
				name: "gender",
				type: "string",
				description: "Gender from Aadhaar record.",
				imp: true,
				example: "M",
			},
			{
				name: "dob",
				type: "string",
				description: "Date of birth from Aadhaar.",
				imp: true,
				example: "10-01-1988",
			},
			{
				name: "masked_aadhaar",
				type: "string",
				description: "Aadhaar number with first 8 digits masked.",
				imp: true,
				example: "XXXX-XXXX-3456",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Aadhaar OTP verified successfully",
			response_type_id: 1388,
			data: {
				verified: true,
				name: "Arjun Mehta",
				gender: "M",
				dob: "10-01-1988",
				masked_aadhaar: "XXXX-XXXX-3456",
			},
		},
		errorScenarios: [
			{
				scenario: "Wrong OTP",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 302,
					message: "Wrong OTP. Please check and retry.",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "OTP expired",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 303,
					message: "OTP expired. Please regenerate.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "aadhaar-ppi-levin-validate",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Validate Aadhaar",
		slug: "aadhaar-ppi-levin-validate",
		summary:
			"Submit sender's Aadhaar number for OTP-based validation in the PPI Levin wallet onboarding flow.",
		description:
			"Triggers Aadhaar OTP dispatch for a PPI Levin wallet sender. Requires a `wallet_token` and `wallet_id` from the preceding Verify Sender OTP step. Returns an `otp_ref_id` to be used in the PPI Levin Validate OTP call.",
		relevance: "M",
		bestFor:
			"PPI Levin wallet onboarding flows where sender Aadhaar must be validated as part of the KYC chain.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/aadhaar/otp",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-validate-aadhar",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's mobile number.",
				example: "9876543210",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description: "12-digit Aadhaar number of the sender.",
				example: "123456789012",
			},
			{
				name: "wallet_token",
				type: "string",
				required: true,
				description:
					"Wallet authentication token returned from the Verify Sender OTP response.",
				example: "wtkn_abc123xyz",
			},
			{
				name: "wallet_id",
				type: "string",
				required: true,
				description:
					"Wallet identifier returned from the Verify Sender OTP response.",
				example: "wlt_0091234",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				description:
					"Reference ID for the Aadhaar OTP session — pass to the PPI Levin Validate OTP call.",
				example: "66748392",
			},
			{
				name: "mobile_hint",
				type: "string",
				description:
					"Masked mobile number to which the Aadhaar OTP was dispatched.",
				example: "******3210",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Aadhaar OTP sent successfully",
			response_type_id: 1388,
			data: {
				otp_ref_id: "66748392",
				mobile_hint: "******3210",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or expired wallet token",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "Invalid wallet token. Please re-authenticate the sender.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "aadhaar-ppi-levin-verify-otp",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Validate Aadhaar OTP",
		slug: "aadhaar-ppi-levin-verify-otp",
		summary:
			"Verify the Aadhaar OTP to complete identity validation in the PPI Levin wallet onboarding flow.",
		description:
			"Validates the OTP dispatched during the PPI Levin Aadhaar validation step. On success, the sender's Aadhaar identity is confirmed and their PPI Levin wallet profile is updated with verified KYC data. Wallet-level parameters `wallet_token` and `wallet_id` may be required.",
		relevance: "M",
		bestFor:
			"Completing Aadhaar OTP verification in the PPI Levin wallet sender onboarding flow.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/aadhaar/otp/verify",
		docsUrl:
			"https://developers.eko.in/reference/ppi-levin-validate-sender-aadhaar-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's mobile number.",
				example: "9876543210",
			},
			{
				name: "otp",
				type: "integer",
				required: false,
				description: "OTP received on the Aadhaar-linked mobile number.",
				example: 654321,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"Reference ID from the PPI Levin Validate Aadhaar response.",
				example: 66748392,
			},
			{
				name: "intent_id",
				type: "string",
				required: false,
				description:
					'Intent flag: "19" for sender onboarding, "20" for Aadhaar validation.',
				example: "20",
			},
			{
				name: "wallet_token",
				type: "string",
				required: false,
				description: "Wallet token for authenticated context.",
				example: "wtkn_abc123xyz",
			},
			{
				name: "wallet_id",
				type: "string",
				required: false,
				description: "Wallet identifier for the sender.",
				example: "wlt_0091234",
			},
		],
		responseData: [
			{
				name: "verified",
				type: "boolean",
				description: "True if Aadhaar OTP verification was successful.",
				imp: true,
				example: true,
			},
			{
				name: "name",
				type: "string",
				description: "Verified sender name from Aadhaar.",
				imp: true,
				example: "Sneha Patel",
			},
			{
				name: "gender",
				type: "string",
				description: "Gender from Aadhaar record: M, F, or T.",
				imp: true,
				example: "F",
			},
			{
				name: "dob",
				type: "string",
				description: "Date of birth as per Aadhaar.",
				imp: true,
				example: "05-07-1992",
			},
			{
				name: "masked_aadhaar",
				type: "string",
				description: "Aadhaar number with first 8 digits masked.",
				imp: true,
				example: "XXXX-XXXX-7890",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Aadhaar OTP verified successfully",
			response_type_id: 1388,
			data: {
				verified: true,
				name: "Sneha Patel",
				gender: "F",
				dob: "05-07-1992",
				masked_aadhaar: "XXXX-XXXX-7890",
			},
		},
		errorScenarios: [
			{
				scenario: "Wrong OTP",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 302,
					message: "Wrong OTP. Please check and retry.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "ppi-levin-get-sender",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Get Sender Information",
		slug: "ppi-levin-get-sender",
		summary:
			"Fetch a PPI Levin sender's wallet profile and onboarding/OTP state by mobile number.",
		description:
			"First step of the PPI Levin flow. For an enrolled sender the response returns an `otp_ref_id` and asks you to validate the OTP (call Verify Sender OTP). If the customer is not enrolled (response_type_id 308), proceed to Onboard Sender.",
		relevance: "M",
		bestFor:
			"Checking PPI Levin sender enrolment before starting a wallet transaction.",
		method: "GET",
		path: "/customer/payment/ppi-levin/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-get-sender-profile",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description:
					"Intent flag for the next onboarding/validation step (19 = sender onboarding).",
				example: 19,
			},
			{
				name: "kyc_request_id",
				type: "string",
				description: "KYC request reference, when a KYC step is pending.",
				example: "",
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Sender OTP.",
				example:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 2129,
		},
		errorScenarios: [
			{
				scenario: "Customer not enrolled — proceed to Onboard Sender",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { sender_name: "", ekyc_enabled: "" },
					response_type_id: 308,
					message: "Failure!Customer Not Enrolled",
					status: 308,
				},
			},
		],
	},
	{
		id: "ppi-levin-onboard-sender",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Onboard Sender",
		slug: "ppi-levin-onboard-sender",
		summary:
			"Register a new customer as a PPI Levin wallet sender using basic KYC details.",
		description:
			"Registers a new PPI Levin sender. Provide name, date of birth, and residence address. On success an OTP is dispatched and an `otp_ref_id` returned — call Verify Sender OTP next.",
		relevance: "M",
		bestFor: "First-time PPI Levin sender registration.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-onboard-sender",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Name of the sender as per ID.",
				example: "Shobhit",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description: "Date of birth of the sender in YYYY-MM-DD format.",
				example: "1990-05-15",
			},
			{
				name: "residence_address",
				type: "array",
				required: true,
				description: "Sender's address as an array of strings.",
				example: ["123 MG Road", "Bangalore", "Karnataka", "560001"],
			},
			{
				name: "service_code",
				type: "integer",
				required: false,
				description: "Fixed service code. Send 80.",
				example: 80,
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag for the next step (19 = sender onboarding).",
				example: 19,
			},
			{
				name: "kyc_request_id",
				type: "string",
				description: "KYC request reference, when a KYC step is pending.",
				example: "",
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Sender OTP.",
				example:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94YigSXr5Qr+aS8OTg/e0YrVEoPAbap746K5g==",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94YigSXr5Qr+aS8OTg/e0YrVEoPAbap746K5g==",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 2129,
		},
	},
	{
		id: "ppi-levin-verify-otp",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Verify Sender OTP",
		slug: "ppi-levin-verify-otp",
		summary:
			"Verify the sender OTP to authenticate the PPI Levin wallet and return the sender's profile and balance.",
		description:
			"Validates the OTP issued by Get Sender Information / Onboard Sender. For an existing sender the response returns the full wallet `customer_profile` (limits, balance, KYC state) and a `wallet_token` used by downstream calls. For a new customer the flow continues to Aadhaar validation (Aadhar Validation Pending) and then PAN (Pan Number Required).",
		relevance: "M",
		bestFor:
			"Authenticating a PPI Levin sender and retrieving wallet balance and monthly limits.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/otp/verify",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-verify-sender-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "otp",
				type: "integer",
				required: true,
				description:
					"OTP received from Get Sender Information, Onboard Sender, or Validate Aadhaar.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"otp_ref_id received from Get Sender Information, Onboard Sender, or Validate Aadhaar.",
				example: 66748392,
			},
			{
				name: "intent_id",
				type: "string",
				required: true,
				description:
					'Intent flag: "19" for sender onboarding, "20" for Aadhaar validation.',
				example: "19",
			},
		],
		responseData: [
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description:
					"Sender's wallet profile — limits, balance, KYC state, and usage chart.",
				children: [
					{
						name: "name",
						type: "string",
						imp: true,
						description: "Registered name of the sender.",
						example: "Shobhit",
					},
					{
						name: "mobile",
						type: "string",
						description: "Sender's mobile number.",
						example: "9444444444",
					},
					{
						name: "total_monthly_limit",
						type: "string",
						description: "Total monthly transfer limit (INR).",
						example: "50000",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						imp: true,
						description: "Remaining transfer limit for the period (INR).",
						example: "50000.0",
					},
					{
						name: "balance",
						type: "string",
						imp: true,
						description: "Current wallet balance (INR).",
						example: "0.00",
					},
					{
						name: "ekyc_enabled",
						type: "number",
						description: "Whether biometric eKYC is enabled (1) or not (0).",
						example: 0,
					},
					{
						name: "kyc_state",
						type: "number",
						description: "KYC completion state.",
						example: 0,
					},
					{
						name: "chart",
						type: "array",
						description: "Usage breakdown (used / remaining / unavailable).",
						children: [
							{
								name: "data_type_id",
								type: "number",
								description: "Chart data type identifier.",
								example: 10,
							},
							{
								name: "data",
								type: "object",
								description: "Used / remaining / unavailable amounts.",
								children: [
									{
										name: "used",
										type: "number",
										description: "Amount used in the period (INR).",
										example: 0,
									},
									{
										name: "remaining",
										type: "number",
										description: "Amount remaining in the period (INR).",
										example: 50000,
									},
									{
										name: "unavailable",
										type: "number",
										description: "Amount blocked/unavailable (INR).",
										example: 0,
									},
								],
							},
						],
					},
				],
			},
			{
				name: "wallet_token",
				type: "string",
				imp: true,
				description:
					"Wallet authentication token (JWT) required by downstream PPI Levin calls.",
				example:
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZGVudGlmaWNhdGlvbkNvZGUiOiJQaFY2Wkc1QjMzRDE2NzZWZGhKTStBPT0iLCJCQ0FnZW50SWQiOiJxYkxIdm1LMDBYU1NTcS9rL0tSN0pBPT0iLCJleHAiOjE3NDg0MTg0OTIsImlzcyI6IlBheVBvaW50IiwiYXVkIjoiUGFydG5lcnMifQ.ylDVDuNjIymfjBE9jB0ZU0Lqhvj67AWRQ_dC76HOHbA",
			},
			{
				name: "is_registered",
				type: "number",
				description: "Whether the sender is already fully registered.",
				example: 0,
			},
			{
				name: "next_allowed_limit",
				type: "number",
				description: "Remaining transfer limit at the top level (INR).",
				example: 50000,
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				customer_profile: {
					total_monthly_limit: "50000",
					mobile: "9444444444",
					kyc_id: "",
					ekyc_enabled: 0,
					kyc_validity: "",
					kyc_remark: "",
					kyc_type: "",
					balance: "0.00",
					next_allowed_limit: "50000.0",
					name: "Shobhit",
					digital_ekyc: 0,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 0, remaining: 50000 },
							label: "",
						},
					],
					email: "",
					kyc_state: 0,
				},
				wallet_token:
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZGVudGlmaWNhdGlvbkNvZGUiOiJQaFY2Wkc1QjMzRDE2NzZWZGhKTStBPT0iLCJCQ0FnZW50SWQiOiJxYkxIdm1LMDBYU1NTcS9rL0tSN0pBPT0iLCJleHAiOjE3NDg0MTg0OTIsImlzcyI6IlBheVBvaW50IiwiYXVkIjoiUGFydG5lcnMifQ.ylDVDuNjIymfjBE9jB0ZU0Lqhvj67AWRQ_dC76HOHbA",
				id_proof_type_id: "",
				is_registered: 0,
				id_proof: "",
				otpOptionalSum: "",
				sender_name: "",
				otpNotRequiredSum: "",
				ekyc_enabled: "",
				wallet_id: "",
				otpNotRequiredSumNeft: "",
				next_allowed_limit: 50000,
				kyc_state: 0,
				otpOptionalSumNeft: "",
			},
			response_type_id: 309,
			message: "Success!",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "New customer — Aadhaar validation pending",
				statusCode: 200,
				example: {
					response_status_id: 1,
					response_type_id: 2136,
					message: "Aadhar Validation Pending",
					status: 2136,
				},
			},
			{
				scenario: "Aadhaar validated — PAN required next",
				statusCode: 200,
				example: {
					response_status_id: 0,
					data: { application_id: "" },
					response_type_id: 2147,
					message: "Pan Number Required",
					status: 0,
				},
			},
		],
	},
	{
		id: "ppi-levin-validate-pan",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Sender",
		name: "Validate PAN",
		slug: "ppi-levin-validate-pan",
		summary:
			"Validate the sender's PAN to complete PPI Levin KYC and return the updated wallet profile.",
		description:
			"Submits the sender's PAN to finish PPI Levin onboarding KYC. On success the response returns the updated `customer_profile` (with the verified sender name and recalculated limits).",
		relevance: "M",
		bestFor: "Completing PPI Levin sender KYC with PAN verification.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/pan",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-validate-pan",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "pan_number",
				type: "string",
				required: false,
				description: "The PAN number of the sender.",
				example: "ABCDE1234F",
			},
			{
				name: "wallet_id",
				type: "string",
				required: false,
				description: "Wallet identifier, when applicable.",
				example: "",
			},
			{
				name: "wallet_token",
				type: "string",
				required: false,
				description: "Wallet authentication token, when applicable.",
				example: "",
			},
		],
		responseData: [
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description:
					"Updated wallet profile with verified sender name and recalculated limits.",
				children: [
					{
						name: "name",
						type: "string",
						imp: true,
						description: "Verified registered name of the sender.",
						example: "Karan Garg",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						imp: true,
						description: "Remaining transfer limit for the period (INR).",
						example: "5287.0",
					},
					{
						name: "balance",
						type: "string",
						description: "Current wallet balance (INR).",
						example: "0.00",
					},
				],
			},
			{
				name: "sender_name",
				type: "string",
				imp: true,
				description: "Verified name of the sender.",
				example: "Karan Garg",
			},
			{
				name: "next_allowed_limit",
				type: "number",
				description: "Remaining transfer limit at the top level (INR).",
				example: 5287,
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				customer_profile: {
					total_monthly_limit: "50000.0",
					mobile: "9444444444",
					kyc_id: "",
					ekyc_enabled: 0,
					kyc_validity: "",
					kyc_remark: "",
					kyc_type: "",
					balance: "0.00",
					next_allowed_limit: "5287.0",
					name: "Karan Garg",
					digital_ekyc: 0,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 44713, remaining: 5287 },
							label: "",
						},
					],
					email: "",
					kyc_state: 0,
				},
				id_proof_type_id: "",
				is_registered: 0,
				id_proof: "",
				otpOptionalSum: "",
				sender_name: "Karan Garg",
				otpNotRequiredSum: "",
				ekyc_enabled: "",
				otpNotRequiredSumNeft: "",
				next_allowed_limit: 5287,
				account: "",
				kyc_state: 0,
				otpOptionalSumNeft: "",
			},
			response_type_id: 309,
			message: "Success!",
			status: 0,
		},
	},
	{
		id: "ppi-levin-get-recipients",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Recipients",
		name: "Get List of Recipients",
		slug: "ppi-levin-get-recipients",
		summary: "Retrieve the list of saved beneficiaries for a PPI Levin sender.",
		description:
			"Returns every recipient saved under a PPI Levin sender, with bank/account details, verification status, available channels (IMPS/NEFT), and the sender's remaining limit before PAN becomes mandatory.",
		relevance: "M",
		bestFor: "Listing a PPI Levin sender's beneficiaries before a transfer.",
		method: "GET",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/recipients",
		docsUrl:
			"https://developers.eko.in/reference/ppi-levin-get-list-of-recipients",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "wallet_token",
				type: "string",
				required: false,
				description: "Wallet authentication token, when applicable.",
				example: "",
			},
		],
		responseData: [
			{
				name: "pan_required",
				type: "number",
				description:
					"Whether PAN is required to continue transacting (2 = not yet required).",
				example: 2,
			},
			{
				name: "remaining_limit_before_pan_required",
				type: "number",
				description:
					"Amount the sender can still transfer before PAN is required (INR).",
				example: 50000,
			},
			{
				name: "recipient_list",
				type: "array",
				imp: true,
				description: "Saved beneficiaries for this sender.",
				children: [
					{
						name: "recipient_id",
						type: "number",
						imp: true,
						description: "Unique recipient identifier — use to transact.",
						example: 10018839,
					},
					{
						name: "recipient_name",
						type: "string",
						imp: true,
						description: "Beneficiary's name.",
						example: "Aditya",
					},
					{
						name: "recipient_mobile",
						type: "string",
						description: "Beneficiary's mobile number.",
						example: "9999999990",
					},
					{
						name: "bank",
						type: "string",
						description: "Beneficiary's bank name.",
						example: "Kotak Mahindra Bank",
					},
					{
						name: "account",
						type: "string",
						description: "Masked beneficiary account number.",
						example: "1XXXXXX90657",
					},
					{
						name: "ifsc",
						type: "string",
						description: "Beneficiary branch IFSC.",
						example: "KKBK0000878",
					},
					{
						name: "beneficiary_id",
						type: "number",
						description: "Beneficiary identifier, when bank-registered.",
						example: 40378,
					},
					{
						name: "channel",
						type: "number",
						description: "Allowed transfer channel (0 = IMPS, 2 = NEFT).",
						example: 0,
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				pan_required: 2,
				recipient_list: [
					{
						channel_absolute: 0,
						available_channel: 0,
						account_type: "Bank Account",
						ifsc_status: 1,
						is_self_account: "0",
						channel: 0,
						is_imps_scheduled: 0,
						recipient_id_type: "acc_ifsc",
						imps_inactive_reason: "",
						allowed_channel: 0,
						is_verified: 0,
						beneficiary_id: 40378,
						bank: "Kotak Mahindra Bank",
						is_otp_required: "0",
						recipient_mobile: "9999999990",
						recipient_name: "Aditya",
						ifsc: "KKBK0000878",
						account: "1XXXXXX90657",
						pipes: { "3": { pipe: 3, status: 1 } },
						recipient_id: 10018839,
						is_rblbc_recipient: 1,
					},
					{
						channel_absolute: 2,
						available_channel: 2,
						account_type: "Bank Account",
						ifsc_status: 1,
						is_self_account: "0",
						channel: 2,
						is_imps_scheduled: 0,
						recipient_id_type: "acc_ifsc",
						imps_inactive_reason: "",
						allowed_channel: 2,
						is_verified: 0,
						beneficiary_id: null,
						bank: "State Bank of India",
						is_otp_required: "0",
						recipient_mobile: "6888888886",
						recipient_name: "Madness",
						ifsc: "SBIN00005656",
						account: "43XXXXXXXXX45",
						pipes: { "3": { pipe: 3, status: 1 } },
						recipient_id: 10065177,
						is_rblbc_recipient: 1,
					},
				],
				remaining_limit_before_pan_required: 50000,
				is_insured: "",
			},
			response_type_id: 23,
			message: "Success",
			status: 0,
		},
	},
	{
		id: "ppi-levin-add-recipient",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Recipients",
		name: "Add Recipient",
		slug: "ppi-levin-add-recipient",
		summary: "Register a new beneficiary under a PPI Levin sender's account.",
		description:
			"Adds a beneficiary (bank account) to a PPI Levin sender. On success a `recipient_id` is returned — use it to send transaction OTP and initiate the transfer. Maximum 5 recipients per day.",
		relevance: "M",
		bestFor: "Adding a bank beneficiary before a PPI Levin transfer.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/recipient",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-add-recipient",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "bank_id",
				type: "integer",
				required: true,
				description: "Unique ID assigned to the beneficiary's bank.",
				example: 12,
			},
			{
				name: "recipient_name",
				type: "string",
				required: true,
				description: "Full name of the recipient.",
				example: "Aditya",
			},
			{
				name: "recipient_mobile",
				type: "string",
				required: true,
				description: "Recipient's 10-digit mobile number.",
				example: "9775597777",
			},
			{
				name: "recipient_type",
				type: "string",
				required: true,
				description: "Recipient type. Value will be 3.",
				example: "3",
			},
			{
				name: "account",
				type: "string",
				required: true,
				description: "Recipient's bank account number.",
				example: "1234567890657",
			},
			{
				name: "ifsc",
				type: "string",
				required: true,
				description: "IFSC code of the recipient's bank branch.",
				example: "KKBK0000878",
			},
			{
				name: "type",
				type: "string",
				required: false,
				description: "Recipient identifier type. Defaults to `ifsc`.",
				example: "ifsc",
			},
			{
				name: "account_type",
				type: "string",
				required: false,
				description: "Account type. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "recipient_id",
				type: "number",
				imp: true,
				description: "Unique recipient identifier — use to transact.",
				example: 10017740,
			},
			{
				name: "recipient_mobile",
				type: "string",
				description: "Recipient's mobile number (echoed back).",
				example: "9775597777",
			},
			{
				name: "customer_id",
				type: "string",
				description: "Sender's mobile number (echoed back).",
				example: "9444444444",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				initiator_id: "6000000094",
				recipient_mobile: "9775597777",
				recipient_id_type: "",
				customer_id: "9444444444",
				pipes: {},
				recipient_id: 10017740,
			},
			response_type_id: 43,
			message: "Success!Please transact using Recipientid",
			status: 0,
		},
	},
	{
		id: "ppi-levin-add-recipient-bank",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Recipients",
		name: "Add Recipient Bank",
		slug: "ppi-levin-add-recipient-bank",
		summary: "Register a bank beneficiary for an existing PPI Levin recipient.",
		description:
			"Adds bank details for a recipient, returning a `beneficiary_id` used when initiating NEFT/IMPS transfers to that recipient.",
		relevance: "L",
		bestFor: "Attaching bank details to a PPI Levin recipient.",
		method: "POST",
		path: "/customer/payment/ppi-levin/sender/{customer_id}/bank/recipient",
		docsUrl: "https://developers.eko.in/reference/ppi-levin-add-recipient-bank",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "recipient_id",
				type: "string",
				required: false,
				description: "Recipient ID of the recipient.",
				example: "10017740",
			},
			{
				name: "wallet_token",
				type: "string",
				required: false,
				description: "Wallet authentication token, when applicable.",
				example: "",
			},
		],
		responseData: [
			{
				name: "beneficiary_id",
				type: "string",
				imp: true,
				description:
					"Beneficiary identifier — pass when initiating a transfer.",
				example: "40367",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				beneficiary_id: "40367",
				recipient_name: "",
				ifsc: "",
				account: "",
				recipient_id: "",
			},
			response_type_id: 1741,
			message: "Beneficiary added",
			status: 0,
		},
	},
	{
		id: "ppi-levin-send-transaction-otp",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Transaction",
		name: "Send Transaction OTP",
		slug: "ppi-levin-send-transaction-otp",
		summary:
			"Request an OTP to the sender's mobile to authorise a PPI Levin transfer.",
		description:
			"Dispatches an OTP to the sender for an upcoming transfer to a given recipient and amount. Returns an `otp_ref_id` to pass, with the OTP, into Initiate Transaction.",
		relevance: "M",
		bestFor: "Authorising a PPI Levin transfer with an OTP.",
		method: "POST",
		path: "/customer/payment/ppi-levin/otp",
		docsUrl:
			"https://developers.eko.in/reference/ppi-levin-send-transaction-otp",
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "integer",
				required: true,
				description: "Unique ID generated while adding the recipient.",
				example: 10017740,
			},
			{
				name: "amount",
				type: "integer",
				required: true,
				description: "Amount to be transferred (INR).",
				example: 110,
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "service_code",
				type: "integer",
				required: false,
				description: "Fixed service code. Send 80.",
				example: 80,
			},
			{
				name: "beneficiary_id",
				type: "string",
				required: false,
				description:
					"Beneficiary ID generated when adding the recipient's bank.",
				example: "40367",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Initiate Transaction.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				otp_ref_id:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			response_type_id: 2133,
			message: "Send OTP",
			status: 2133,
		},
	},
	{
		id: "ppi-levin-initiate-transaction",
		productId: "ppi",
		provider: "PPI – Levin",
		group: "Transaction",
		name: "Initiate Transaction",
		slug: "ppi-levin-initiate-transaction",
		summary:
			"Execute a PPI Levin wallet transfer to a recipient after OTP verification.",
		description:
			"Initiates the money transfer from the sender's PPI Levin wallet to the recipient. Returns the financial response envelope with `tx_status`, transaction id (`tid`), bank reference number, fee, and updated balance.",
		relevance: "H",
		bestFor: "Completing a PPI Levin wallet-to-bank transfer.",
		method: "POST",
		path: "/customer/payment/ppi-levin",
		docsUrl:
			"https://developers.eko.in/reference/ppi-levin-initiate-transaction",
		financial: true,
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "integer",
				required: true,
				description: "Unique ID generated while adding the recipient.",
				example: 10017680,
			},
			{
				name: "amount",
				type: "integer",
				required: true,
				description: "Amount to be transferred (INR).",
				example: 110,
			},
			{
				name: "timestamp",
				type: "string",
				required: true,
				description: "Request timestamp (ISO 8601).",
				example: "2025-01-21T07:07:20.562Z",
			},
			{
				name: "currency",
				type: "string",
				required: true,
				description: "Currency. Must be INR.",
				example: "INR",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8999999992",
			},
			{
				name: "channel",
				type: "integer",
				required: true,
				description: "Transfer channel. Defaults to 2 (NEFT); 0 for IMPS.",
				example: 2,
			},
			{
				name: "otp",
				type: "string",
				required: false,
				description: "OTP received from Send Transaction OTP.",
				example: "123456",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: false,
				description: "otp_ref_id received from Send Transaction OTP.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			{
				name: "beneficiary_id",
				type: "string",
				required: false,
				description:
					"Beneficiary ID generated while getting the recipient details.",
				example: "40367",
			},
			{
				name: "latlong",
				type: "string",
				required: false,
				description: "Geographic coordinates of the user's location.",
				example: "28.63,77.22",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "State parameter.",
				example: "1",
			},
			{
				name: "recipient_id_type",
				type: "string",
				required: false,
				description: "Recipient ID type. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				imp: true,
				description: "Eko transaction ID.",
				example: "2886522975",
			},
			{
				name: "tx_status",
				type: "string",
				imp: true,
				description: "Transaction status (0 = success).",
				example: "0",
			},
			{
				name: "txstatus_desc",
				type: "string",
				imp: true,
				description: "Human-readable transaction status.",
				example: "Success",
			},
			{
				name: "bank_ref_num",
				type: "string",
				imp: true,
				description: "Bank/UTR reference number for the transfer.",
				example: "250121123714472002",
			},
			{
				name: "amount",
				type: "string",
				description: "Transferred amount (INR).",
				example: "110.00",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the transfer (INR).",
				example: "4.0",
			},
			{
				name: "balance",
				type: "string",
				imp: true,
				description: "Sender's wallet balance after the transfer (INR).",
				example: "814.0",
			},
			{
				name: "bank",
				type: "string",
				description: "Recipient's bank name.",
				example: "UCO Bank",
			},
			{
				name: "channel_desc",
				type: "string",
				description: "Channel used (IMPS/NEFT).",
				example: "IMPS",
			},
			{
				name: "recipient_name",
				type: "string",
				description: "Recipient's name.",
				example: "Krishna",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				tx_status: "0",
				debit_user_id: "6000000094",
				tds: "0.0",
				txstatus_desc: "Success",
				fee: "4.0",
				total_sent: "",
				channel: "2",
				collectable_amount: "114.0",
				txn_wallet: "0",
				utility_acc_no: "8999999992",
				sender_name: "8999999992",
				ekyc_enabled: "0",
				remaining_limit_before_pan_required: 49678,
				tid: "2886522975",
				bank: "UCO Bank",
				utrnumber: "",
				insurance_acquired: "",
				balance: "814.0",
				totalfee: "",
				next_allowed_limit: "",
				is_otp_required: "0",
				aadhar: "",
				currency: "INR",
				commission: "0.0",
				pipe: 13,
				state: "1",
				bank_ref_num: "250121123714472002",
				recipient_id: 10017680,
				timestamp: "2025-01-21T07:07:20.562Z",
				amount: "110.00",
				pan_required: 2,
				pinNo: "",
				gst_benefit: "0",
				payment_mode_desc: "",
				channel_desc: "IMPS",
				last_used_okekey: "0",
				npr: "",
				insurance_amount: "",
				service_tax: "0.61",
				paymentid: "",
				mdr: "",
				recipient_name: "Krishna",
				customer_id: "8999999992",
				account: "67544100008454",
				kyc_state: "",
			},
			response_type_id: 325,
			message: "Transaction successful",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-get-sender",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Get Sender Information",
		slug: "ppi-digikhata-get-sender",
		summary:
			"Fetch a DigiKhata wallet sender's profile and onboarding/OTP state by mobile number.",
		description:
			"First step of the PPI DigiKhata flow. For an enrolled sender the response returns an `otp_ref_id` and asks you to validate the OTP (call Verify Sender OTP). If the customer is not enrolled (response_type_id 308), proceed to Onboard Sender.",
		relevance: "M",
		bestFor: "Checking DigiKhata sender enrolment before a wallet operation.",
		method: "GET",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/get-sender-information",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description:
					"Intent flag for the next onboarding/validation step (19 = sender onboarding).",
				example: 19,
			},
			{
				name: "kyc_request_id",
				type: "string",
				description: "KYC request reference, when a KYC step is pending.",
				example: "",
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Sender OTP.",
				example:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 2129,
		},
		errorScenarios: [
			{
				scenario: "Customer not enrolled — proceed to Onboard Sender",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { sender_name: "", ekyc_enabled: "" },
					response_type_id: 308,
					message: "Failure!Customer Not Enrolled",
					status: 308,
				},
			},
		],
	},
	{
		id: "ppi-digikhata-onboard-sender",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Onboard Sender",
		slug: "ppi-digikhata-onboard-sender",
		summary:
			"Register a new customer as a PPI DigiKhata wallet sender using basic KYC details.",
		description:
			"Registers a new DigiKhata sender. Provide name, date of birth, and residence address. For a new sender an OTP is dispatched and an `otp_ref_id` returned — call Verify Sender OTP next. If the wallet already exists the response confirms `Wallet opened successfully`.",
		relevance: "M",
		bestFor: "First-time DigiKhata wallet sender registration.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/onboard-sender",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Name of the sender as per ID.",
				example: "Yashwant Basnett",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description: "Date of birth of the sender in YYYY-MM-DD format.",
				example: "1990-05-15",
			},
			{
				name: "residence_address",
				type: "array",
				required: true,
				description: "Sender's address as an array of strings.",
				example: ["123 MG Road", "Bangalore", "Karnataka", "560001"],
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag for the next step (19 = sender onboarding).",
				example: 19,
			},
			{
				name: "kyc_request_id",
				type: "string",
				description: "KYC request reference, when a KYC step is pending.",
				example: "",
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Sender OTP.",
				example:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6hgzp33AcOnMOJNPmRic8dJQazrKttIV3oIOpXKP8OdkARMo2DvP8bWEKK2P3h2dAK",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6hgzp33AcOnMOJNPmRic8dJQazrKttIV3oIOpXKP8OdkARMo2DvP8bWEKK2P3h2dAK",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Wallet already exists for this sender",
				statusCode: 200,
				example: {
					response_status_id: 0,
					data: {
						customer_id_type: "mobile_number",
						state_desc: "Non-Kyc",
						state: "2",
						customer_id: "8617567988",
					},
					response_type_id: 300,
					message: "Wallet opened successfully.",
					status: 0,
				},
			},
		],
	},
	{
		id: "ppi-digikhata-generate-sender-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Generate Sender Verification OTP",
		slug: "ppi-digikhata-generate-sender-otp",
		summary:
			"Send a verification OTP to a DigiKhata sender's registered mobile number.",
		description:
			"Generates and dispatches a verification OTP to the sender. Returns an `otp_ref_id` to pass, with the OTP, into Verify Sender OTP.",
		relevance: "M",
		bestFor: "Re-issuing the DigiKhata sender verification OTP.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/otp",
		docsUrl: "https://developers.eko.in/reference/generate-sender-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag for the next step (19 = sender onboarding).",
				example: 19,
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Sender OTP.",
				example:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6haUuWCwcbJVCWUgeMOoj5vNqXAGuOK+Cro+AqdfLdmm5z5AQ+PGkPdHUQJ9nuLPKS",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6haUuWCwcbJVCWUgeMOoj5vNqXAGuOK+Cro+AqdfLdmm5z5AQ+PGkPdHUQJ9nuLPKS",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-verify-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Verify Sender OTP",
		slug: "ppi-digikhata-verify-otp",
		summary:
			"Verify the sender OTP to authenticate the DigiKhata wallet and return the sender's profile and balance.",
		description:
			"Validates the OTP issued by Get Sender Information / Onboard Sender / Generate Sender OTP. For an existing sender the response returns the full wallet `customer_profile` (limits, balance, KYC state). For a new sender the flow continues to Aadhaar validation (Aadhar Validation Pending).",
		relevance: "M",
		bestFor:
			"Authenticating a DigiKhata sender and retrieving wallet balance and limits.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/otp/verify",
		docsUrl: "https://developers.eko.in/reference/verify-sender-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "otp",
				type: "integer",
				required: true,
				description:
					"OTP received from Get Sender Information, Onboard Sender, or Generate Sender OTP.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"otp_ref_id received from Get Sender Information, Onboard Sender, or Generate Sender OTP.",
				example: 66748392,
			},
		],
		responseData: [
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description:
					"Sender's wallet profile — limits, balance, KYC state, and usage chart.",
				children: [
					{
						name: "name",
						type: "string",
						imp: true,
						description: "Registered name of the sender.",
						example: "Yashwant Basnett",
					},
					{
						name: "mobile",
						type: "string",
						description: "Sender's mobile number.",
						example: "8617567988",
					},
					{
						name: "total_monthly_limit",
						type: "string",
						description: "Total monthly transfer limit (INR).",
						example: "50000.0",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						imp: true,
						description: "Remaining transfer limit for the period (INR).",
						example: "50000.0",
					},
					{
						name: "balance",
						type: "string",
						imp: true,
						description: "Current wallet balance (INR).",
						example: "0.00",
					},
					{
						name: "kyc_state",
						type: "number",
						description: "KYC completion state.",
						example: 1,
					},
				],
			},
			{
				name: "sender_name",
				type: "string",
				imp: true,
				description: "Registered name of the sender.",
				example: "Yashwant Basnett",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				customer_profile: {
					total_monthly_limit: "50000.0",
					mobile: "8617567988",
					kyc_id: "",
					ekyc_enabled: 0,
					kyc_validity: "",
					kyc_remark: "",
					kyc_type: "",
					balance: "0.00",
					next_allowed_limit: "50000.0",
					name: "Yashwant Basnett",
					digital_ekyc: 0,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 0, remaining: 50000 },
							label: "",
						},
					],
					email: "",
					kyc_state: 1,
				},
				wallet_token: "",
				id_proof_type_id: "",
				is_registered: 0,
				id_proof: "",
				otpOptionalSum: "",
				sender_name: "Yashwant Basnett",
				otpNotRequiredSum: "",
				ekyc_enabled: "",
				wallet_id: "",
				otpNotRequiredSumNeft: "",
				next_allowed_limit: 50000.0,
				account: "",
				kyc_state: 0,
				otpOptionalSumNeft: "",
			},
			response_type_id: 309,
			message: "Success!",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "New sender — Aadhaar validation pending",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { otp_ref_id: "" },
					response_type_id: 2136,
					message: "Aadhar Validation Pending",
					status: 2136,
				},
			},
		],
	},
	{
		id: "ppi-digikhata-consent-languages",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Get Aadhaar KYC Consent Languages",
		slug: "ppi-digikhata-consent-languages",
		summary:
			"List the languages available for the DigiKhata Aadhaar eKYC consent.",
		description:
			"Returns the supported consent languages (with their `pkid`) for DigiKhata Aadhaar eKYC. Pass the chosen `pkid` as `consent_language` to Get Aadhaar KYC Consent Details.",
		relevance: "L",
		bestFor: "Presenting Aadhaar eKYC consent in the customer's language.",
		method: "GET",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/aadhaar/consent/languages",
		docsUrl:
			"https://developers.eko.in/reference/get-digikhata-aadhaar-kyc-consent-languages",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "org_id",
				type: "string",
				required: true,
				description: "Organisation identifier. Defaults to 1.",
				example: "1",
			},
			{
				name: "client_ref_id",
				type: "string",
				required: true,
				description: "Unique reference identifier for the request.",
				example: "ref_20250121_001",
			},
		],
		responseData: [
			{
				name: "consent_language_list",
				type: "array",
				imp: true,
				description: "Supported consent languages.",
				children: [
					{
						name: "pkid",
						type: "string",
						imp: true,
						description:
							"Language identifier — pass as consent_language to Get Consent Details.",
						example: "1",
					},
					{
						name: "consentLanguage",
						type: "string",
						description: "Display name of the language.",
						example: "English",
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				consent_language_list: [
					{ pkid: "1", consentLanguage: "English" },
					{ pkid: "2", consentLanguage: "Bengali" },
					{ pkid: "3", consentLanguage: "Gujarati" },
					{ pkid: "4", consentLanguage: "Hindi" },
					{ pkid: "5", consentLanguage: "Kannada" },
					{ pkid: "6", consentLanguage: "Malayalam" },
					{ pkid: "7", consentLanguage: "Marathi" },
					{ pkid: "8", consentLanguage: "Odia" },
					{ pkid: "9", consentLanguage: "Tamil" },
					{ pkid: "10", consentLanguage: "Telugu" },
					{ pkid: "11", consentLanguage: "Urdu" },
					{ pkid: "12", consentLanguage: "Assamese" },
					{ pkid: "13", consentLanguage: "Punjabi" },
				],
			},
			response_type_id: 2444,
			message: "Consent Language Successfully Retrieved",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-consent-details",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Get Aadhaar KYC Consent Details",
		slug: "ppi-digikhata-consent-details",
		summary:
			"Fetch the DigiKhata Aadhaar eKYC consent text and audio for a chosen language.",
		description:
			"Returns the full Aadhaar eKYC consent content, short consent statement, and an audio URL for the language selected (via `consent_language` = the `pkid` from Get Aadhaar KYC Consent Languages). Display/play this consent before collecting Aadhaar OTP.",
		relevance: "L",
		bestFor: "Showing the mandatory Aadhaar eKYC consent before OTP capture.",
		method: "GET",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/aadhaar/consent/details",
		docsUrl:
			"https://developers.eko.in/reference/get-digikhata-aadhaar-kyc-consent-details",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "org_id",
				type: "string",
				required: true,
				description: "Organisation identifier. Defaults to 1.",
				example: "1",
			},
			{
				name: "client_ref_id",
				type: "string",
				required: true,
				description: "Unique reference identifier for the request.",
				example: "ref_20250121_001",
			},
			{
				name: "consent_language",
				type: "string",
				required: true,
				description: "The pkid from Get Aadhaar KYC Consent Languages.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "consent_detail",
				type: "object",
				imp: true,
				description: "Consent content, short statement, and audio URL.",
				children: [
					{
						name: "consentContent",
						type: "string",
						description: "Full Aadhaar eKYC consent text.",
						example: "Use my Aadhaar / Virtual ID details …",
					},
					{
						name: "consent",
						type: "string",
						imp: true,
						description: "Short consent statement to display.",
						example:
							"Consent for Authentication: I, the holder of Aadhaar number, hereby give my consent …",
					},
					{
						name: "audioUrl",
						type: "string",
						description:
							"Audio rendition of the consent in the chosen language.",
						example: "https://paypointindia.co.in/audio/Consent_English.mp3",
					},
					{
						name: "consentId",
						type: "number",
						description: "Consent identifier.",
						example: 1,
					},
					{
						name: "consentLanguage",
						type: "string",
						description: "Language of the returned consent.",
						example: "English",
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				consent_detail: {
					consentContent:
						"Use my Aadhaar / Virtual ID details (as applicable) for the purpose of eKYC for/with PayPoint India to authenticate my identity through the Aadhaar Authentication system (Aadhaar based eKYC services of UIDAI) in accordance with the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 and the allied rules and regulations notified thereunder and for no other purpose.\r\n Authenticate my Aadhaar/Virtual ID through OTP or Biometric for authenticating my identity through the Aadhaar Authentication system for obtaining my eKYC through Aadhaar based eKYC services of UIDAI and use my Photo and Demographic details (Name, Gender, Date of Birth and Address) for the purpose of eKYC for/with PayPoint India.\r\n I understand that Security and confidentiality of personal identity data provided, for the purpose of Aadhaar based authentication is ensured by PayPoint and the data will be stored by PayPoint till such time as mentioned in guidelines from UIDAI from time to time.",
					audioUrl: "https://paypointindia.co.in/audio/Consent_English.mp3",
					consentId: 1,
					consent:
						"Consent for Authentication: I, the holder of Aadhaar number, hereby give my consent to Paypoint India Network Private Limited to perform authentication and obtain my eKYC with UIDAI for the purpose of creating my wallet.",
					consentLanguage: "English",
				},
			},
			response_type_id: 2446,
			message: "Consent Language Successfully Retrieved",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-generate-aadhaar-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Generate Sender Aadhaar OTP",
		slug: "ppi-digikhata-generate-aadhaar-otp",
		summary:
			"Validate a DigiKhata sender's Aadhaar number and trigger an OTP to the linked mobile.",
		description:
			"Submits the sender's Aadhaar number and dispatches an OTP to the Aadhaar-linked mobile for eKYC. Returns an `otp_ref_id` to pass into Validate Sender Aadhaar OTP.",
		relevance: "M",
		bestFor: "Starting DigiKhata Aadhaar eKYC for a sender.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/aadhaar/otp",
		docsUrl: "https://developers.eko.in/reference/generate-sender-aadhaar-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "aadhar",
				type: "string",
				required: true,
				description: "12-digit Aadhaar number of the sender.",
				example: "123456789012",
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag (20 = Aadhaar validation).",
				example: 20,
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description:
					"OTP session reference — pass to Validate Sender Aadhaar OTP.",
				example:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6haUuWCwcbJVCWUgeMOoj5vNqXAGuOK+Cro+AqdfLdmm5z5AQ+PGkPdHUQJ9nuLPKS",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				intent_id: 20,
				kyc_request_id: "",
				otp_ref_id:
					"leSLbMTFJpWWyG+NIDZW1IM6D+1tVJ6haUuWCwcbJVCWUgeMOoj5vNqXAGuOK+Cro+AqdfLdmm5z5AQ+PGkPdHUQJ9nuLPKS",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-verify-aadhaar-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Validate Sender Aadhaar OTP",
		slug: "ppi-digikhata-verify-aadhaar-otp",
		summary:
			"Verify the Aadhaar OTP to complete DigiKhata sender Aadhaar eKYC.",
		description:
			"Validates the OTP dispatched during Generate Sender Aadhaar OTP. On success the Aadhaar identity is confirmed and the flow proceeds to PAN validation (Pan Number Required).",
		relevance: "M",
		bestFor: "Completing DigiKhata sender Aadhaar eKYC.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/aadhaar/otp/verify",
		docsUrl: "https://developers.eko.in/reference/verify-aadhaar-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "otp",
				type: "integer",
				required: false,
				description: "OTP received from Generate Sender Aadhaar OTP.",
				example: 654321,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description: "otp_ref_id received from Generate Sender Aadhaar OTP.",
				example: 66748392,
			},
		],
		responseData: [
			{
				name: "application_id",
				type: "string",
				description: "KYC application identifier, when issued.",
				example: "",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: { application_id: "" },
			response_type_id: 2147,
			message: "Pan Number Required",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-validate-pan",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Validate Sender PAN",
		slug: "ppi-digikhata-validate-pan",
		summary:
			"Validate the sender's PAN to complete DigiKhata KYC and return the updated wallet profile.",
		description:
			"Submits the sender's PAN to finish DigiKhata onboarding KYC. On success the response returns the updated `customer_profile` (verified sender name and recalculated limits).",
		relevance: "M",
		bestFor: "Completing DigiKhata sender KYC with PAN verification.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/pan",
		docsUrl: "https://developers.eko.in/reference/verify-pan",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "pan_number",
				type: "string",
				required: true,
				description: "The PAN number of the sender.",
				example: "ABCDE1234F",
			},
		],
		responseData: [
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description:
					"Updated wallet profile with verified sender name and recalculated limits.",
				children: [
					{
						name: "name",
						type: "string",
						imp: true,
						description: "Verified registered name of the sender.",
						example: "Karan Garg",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						imp: true,
						description: "Remaining transfer limit for the period (INR).",
						example: "5287.0",
					},
				],
			},
			{
				name: "sender_name",
				type: "string",
				imp: true,
				description: "Verified name of the sender.",
				example: "Karan Garg",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				customer_profile: {
					total_monthly_limit: "50000.0",
					mobile: "9444444444",
					kyc_id: "",
					ekyc_enabled: 0,
					kyc_validity: "",
					kyc_remark: "",
					kyc_type: "",
					balance: "0.00",
					next_allowed_limit: "5287.0",
					name: "Karan Garg",
					digital_ekyc: 0,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 44713, remaining: 5287 },
							label: "",
						},
					],
					email: "",
					kyc_state: 0,
				},
				id_proof_type_id: "",
				is_registered: 0,
				id_proof: "",
				otpOptionalSum: "",
				sender_name: "Karan Garg",
				otpNotRequiredSum: "",
				ekyc_enabled: "",
				otpNotRequiredSumNeft: "",
				next_allowed_limit: 5287,
				account: "",
				kyc_state: 0,
				otpOptionalSumNeft: "",
			},
			response_type_id: 309,
			message: "Success!",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-load-wallet",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Sender",
		name: "Load Sender DigiKhata Wallet",
		slug: "ppi-digikhata-load-wallet",
		summary: "Load funds into a DigiKhata sender's prepaid wallet.",
		description:
			"Credits the sender's DigiKhata wallet with the given amount. Returns a transaction id (`tid`) and the fee charged for the load.",
		relevance: "M",
		bestFor: "Topping up a DigiKhata sender's wallet before transfers.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/wallet/loadwallet",
		docsUrl: "https://developers.eko.in/reference/load-digikhata-wallet",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "amount",
				type: "string",
				required: true,
				description: "Amount to load into the wallet (INR).",
				example: "500",
			},
			{
				name: "org_id",
				type: "string",
				required: true,
				description: "Organisation identifier. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				imp: true,
				description: "Eko transaction ID for the wallet load.",
				example: "355419717321",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the wallet load (INR).",
				example: "5.0",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				fee: "5.0",
				description: "",
				customer_id: "",
				bank_ref_num: "",
				tid: "355419717321",
			},
			response_type_id: 2447,
			message: "The Digi Khata wallet has been loaded successfully.",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-get-recipients",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Recipients",
		name: "Get List of Recipients",
		slug: "ppi-digikhata-get-recipients",
		summary: "Retrieve the list of saved beneficiaries for a DigiKhata sender.",
		description:
			"Returns every recipient saved under a DigiKhata sender, with bank/account details, verification status, available channels (IMPS/NEFT), and the sender's remaining limit before PAN becomes mandatory.",
		relevance: "M",
		bestFor: "Listing a DigiKhata sender's beneficiaries before a transfer.",
		method: "GET",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/recipients",
		docsUrl: "https://developers.eko.in/reference/get-all-recipients",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
		],
		responseData: [
			{
				name: "pan_required",
				type: "number",
				description:
					"Whether PAN is required to continue transacting (2 = not yet required).",
				example: 2,
			},
			{
				name: "remaining_limit_before_pan_required",
				type: "number",
				description:
					"Amount the sender can still transfer before PAN is required (INR).",
				example: 50000,
			},
			{
				name: "recipient_list",
				type: "array",
				imp: true,
				description: "Saved beneficiaries for this sender.",
				children: [
					{
						name: "recipient_id",
						type: "number",
						imp: true,
						description: "Unique recipient identifier — use to transact.",
						example: 10018839,
					},
					{
						name: "recipient_name",
						type: "string",
						imp: true,
						description: "Beneficiary's name.",
						example: "Aditya",
					},
					{
						name: "bank",
						type: "string",
						description: "Beneficiary's bank name.",
						example: "Kotak Mahindra Bank",
					},
					{
						name: "account",
						type: "string",
						description: "Masked beneficiary account number.",
						example: "1XXXXXX90657",
					},
					{
						name: "ifsc",
						type: "string",
						description: "Beneficiary branch IFSC.",
						example: "KKBK0000878",
					},
					{
						name: "beneficiary_id",
						type: "number",
						description: "Beneficiary identifier, when bank-registered.",
						example: 40378,
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				pan_required: 2,
				recipient_list: [
					{
						channel_absolute: 0,
						available_channel: 0,
						account_type: "Bank Account",
						ifsc_status: 1,
						is_self_account: "0",
						channel: 0,
						is_imps_scheduled: 0,
						recipient_id_type: "acc_ifsc",
						imps_inactive_reason: "",
						allowed_channel: 0,
						is_verified: 0,
						beneficiary_id: 40378,
						bank: "Kotak Mahindra Bank",
						is_otp_required: "0",
						recipient_mobile: "9999999990",
						recipient_name: "Aditya",
						ifsc: "KKBK0000878",
						account: "1XXXXXX90657",
						pipes: { "3": { pipe: 3, status: 1 } },
						recipient_id: 10018839,
						is_rblbc_recipient: 1,
					},
					{
						channel_absolute: 2,
						available_channel: 2,
						account_type: "Bank Account",
						ifsc_status: 1,
						is_self_account: "0",
						channel: 2,
						is_imps_scheduled: 0,
						recipient_id_type: "acc_ifsc",
						imps_inactive_reason: "",
						allowed_channel: 2,
						is_verified: 0,
						beneficiary_id: null,
						bank: "State Bank of India",
						is_otp_required: "0",
						recipient_mobile: "6888888886",
						recipient_name: "Madness",
						ifsc: "SBIN00005656",
						account: "43XXXXXXXXX45",
						pipes: { "3": { pipe: 3, status: 1 } },
						recipient_id: 10065177,
						is_rblbc_recipient: 1,
					},
				],
				remaining_limit_before_pan_required: 50000,
				is_insured: "",
			},
			response_type_id: 23,
			message: "Success",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-add-recipient",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Recipients",
		name: "Add Recipient",
		slug: "ppi-digikhata-add-recipient",
		summary: "Register a new beneficiary under a DigiKhata sender's account.",
		description:
			"Adds a beneficiary (bank account) to a DigiKhata sender. On success a `recipient_id` is returned — use it to send transaction OTP and initiate the transfer. Maximum 5 recipients per day.",
		relevance: "M",
		bestFor: "Adding a bank beneficiary before a DigiKhata transfer.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/recipient",
		docsUrl: "https://developers.eko.in/reference/paypoint-add-recipient",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "bank_id",
				type: "integer",
				required: true,
				description: "Unique ID assigned to the beneficiary's bank.",
				example: 12,
			},
			{
				name: "recipient_name",
				type: "string",
				required: true,
				description: "Full name of the recipient.",
				example: "Aditya",
			},
			{
				name: "recipient_mobile",
				type: "string",
				required: true,
				description: "Recipient's 10-digit mobile number.",
				example: "9775597777",
			},
			{
				name: "account",
				type: "string",
				required: true,
				description: "Recipient's bank account number.",
				example: "1234567890657",
			},
			{
				name: "bank_code",
				type: "string",
				required: true,
				description: "IFSC code of the recipient's bank branch.",
				example: "KKBK0000878",
			},
		],
		responseData: [
			{
				name: "recipient_id",
				type: "number",
				imp: true,
				description: "Unique recipient identifier — use to transact.",
				example: 10017740,
			},
			{
				name: "recipient_mobile",
				type: "string",
				description: "Recipient's mobile number (echoed back).",
				example: "9775597777",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				initiator_id: "6000000094",
				recipient_mobile: "9775597777",
				recipient_id_type: "",
				customer_id: "9444444444",
				pipes: {},
				recipient_id: 10017740,
			},
			response_type_id: 43,
			message: "Success!Please transact using Recipientid",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-recipient-bank-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Recipients",
		name: "Generate Add Recipient Bank OTP",
		slug: "ppi-digikhata-recipient-bank-otp",
		summary:
			"Generate an OTP to register a recipient's bank for a DigiKhata sender.",
		description:
			"Initiates bank registration for a recipient and dispatches an OTP. Returns a `beneficiary_id` and `otp_ref_id` to pass into Validate OTP to Add Recipient. The bank enforces a one-hour cooling period per recipient before another bank account can be registered.",
		relevance: "L",
		bestFor: "Starting recipient bank registration on DigiKhata.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/recipient/bank/otp",
		docsUrl: "https://developers.eko.in/reference/recipient-bank-registration",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "recipient_id",
				type: "string",
				required: true,
				description: "Recipient ID of the recipient to register a bank for.",
				example: "10017740",
			},
		],
		responseData: [
			{
				name: "beneficiary_id",
				type: "string",
				imp: true,
				description: "Beneficiary identifier created for the recipient bank.",
				example: "4202888",
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description:
					"OTP session reference — pass to Validate OTP to Add Recipient.",
				example: "8617567988~8617567988~Channel4~4202888~4202888",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				beneficiary_id: "4202888",
				recipient_name: "",
				ifsc: "",
				account: "",
				otp_ref_id: "8617567988~8617567988~Channel4~4202888~4202888",
				recipient_id: "",
			},
			response_type_id: 1741,
			message: "Beneficiary added",
			status: 0,
		},
	},
	{
		id: "ppi-digikhata-validate-recipient-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Recipients",
		name: "Validate OTP to Add Recipient",
		slug: "ppi-digikhata-validate-recipient-otp",
		summary:
			"Verify the OTP to complete recipient bank registration for a DigiKhata sender.",
		description:
			"Validates the OTP issued by Generate Add Recipient Bank OTP to confirm the recipient's bank registration.",
		relevance: "L",
		bestFor: "Confirming recipient bank registration on DigiKhata.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/sender/{customer_id}/recipient/bank/otp/verify",
		docsUrl: "https://developers.eko.in/reference/validate-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "otp",
				type: "integer",
				required: false,
				description: "OTP received from Generate Add Recipient Bank OTP.",
				example: 654321,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"otp_ref_id received from Generate Add Recipient Bank OTP.",
				example: 66748392,
			},
		],
		responseData: [
			{
				name: "application_id",
				type: "string",
				description: "Application identifier, when issued.",
				example: "",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: { application_id: "" },
			response_type_id: 2131,
			message: "Validate OTP",
			status: 2131,
		},
	},
	{
		id: "ppi-digikhata-send-transaction-otp",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Transaction",
		name: "Send Transaction OTP",
		slug: "ppi-digikhata-send-transaction-otp",
		summary:
			"Request an OTP to the sender's mobile to authorise a DigiKhata transfer.",
		description:
			"Dispatches an OTP to the sender for an upcoming transfer to a given recipient and amount. Returns an `otp_ref_id` to pass, with the OTP, into Initiate Transaction.",
		relevance: "M",
		bestFor: "Authorising a DigiKhata transfer with an OTP.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata/otp",
		docsUrl: "https://developers.eko.in/reference/send-transaction-otp",
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "integer",
				required: true,
				description: "Unique ID generated while adding the recipient.",
				example: 10017740,
			},
			{
				name: "amount",
				type: "integer",
				required: true,
				description: "Amount to be transferred (INR).",
				example: 110,
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8617567988",
			},
			{
				name: "service_code",
				type: "integer",
				required: false,
				description: "Fixed service code. Send 80.",
				example: 80,
			},
			{
				name: "beneficiary_id",
				type: "string",
				required: false,
				description:
					"Beneficiary ID generated when adding the recipient's bank.",
				example: "4202888",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Initiate Transaction.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				otp_ref_id:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			response_type_id: 2133,
			message: "Send OTP",
			status: 2133,
		},
	},
	{
		id: "ppi-digikhata-initiate-transaction",
		productId: "ppi",
		provider: "PPI – DigiKhata",
		group: "Transaction",
		name: "Initiate Transaction",
		slug: "ppi-digikhata-initiate-transaction",
		summary:
			"Execute a DigiKhata wallet transfer to a recipient after OTP verification.",
		description:
			"Initiates the money transfer from the sender's DigiKhata wallet to the recipient (keep `channel` fixed at 2). Returns the financial response envelope with `tx_status`, transaction id (`tid`), bank reference number, fee, and updated balance. Treat a timeout as initiated, not failed — re-query via Transaction Inquiry with your `client_ref_id`.",
		descriptionFile: "ppi-digikhata-initiate-transaction.md",
		relevance: "H",
		bestFor: "Completing a DigiKhata wallet-to-bank transfer.",
		method: "POST",
		path: "/customer/payment/ppi-digikhata",
		docsUrl: "https://developers.eko.in/reference/initiate-ppi-transaction",
		financial: true,
		extraRequestParams: [
			{
				name: "recipient_id",
				type: "integer",
				required: true,
				description: "Unique ID generated while adding the recipient.",
				example: 10017680,
			},
			{
				name: "amount",
				type: "integer",
				required: true,
				description: "Amount to be transferred (INR).",
				example: 110,
			},
			{
				name: "timestamp",
				type: "string",
				required: true,
				description: "Request timestamp (ISO 8601).",
				example: "2025-01-21T07:07:20.562Z",
			},
			{
				name: "currency",
				type: "string",
				required: true,
				description: "Currency. Must be INR.",
				example: "INR",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Sender's 10-digit mobile number.",
				example: "8999999992",
			},
			{
				name: "channel",
				type: "integer",
				required: true,
				description: "Transfer channel. Defaults to 2 (NEFT); 0 for IMPS.",
				example: 2,
			},
			{
				name: "otp",
				type: "string",
				required: false,
				description: "OTP received from Send Transaction OTP.",
				example: "123456",
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: false,
				description: "otp_ref_id received from Send Transaction OTP.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			{
				name: "beneficiary_id",
				type: "string",
				required: false,
				description:
					"Beneficiary ID generated while getting the recipient details.",
				example: "4202888",
			},
			{
				name: "service_code",
				type: "integer",
				required: false,
				description: "Fixed service code. Defaults to 80.",
				example: 80,
			},
			{
				name: "latlong",
				type: "string",
				required: false,
				description: "Geographic coordinates of the user's location.",
				example: "28.63,77.22",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "State parameter. Defaults to 1.",
				example: "1",
			},
		],
		responseData: [
			{
				name: "tid",
				type: "string",
				imp: true,
				description: "Eko transaction ID.",
				example: "2886522975",
			},
			{
				name: "tx_status",
				type: "string",
				imp: true,
				description: "Transaction status (0 = success).",
				example: "0",
			},
			{
				name: "txstatus_desc",
				type: "string",
				imp: true,
				description: "Human-readable transaction status.",
				example: "Success",
			},
			{
				name: "bank_ref_num",
				type: "string",
				imp: true,
				description: "Bank/UTR reference number for the transfer.",
				example: "250121123714472002",
			},
			{
				name: "amount",
				type: "string",
				description: "Transferred amount (INR).",
				example: "110.00",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee charged for the transfer (INR).",
				example: "4.0",
			},
			{
				name: "balance",
				type: "string",
				imp: true,
				description: "Sender's wallet balance after the transfer (INR).",
				example: "814.0",
			},
			{
				name: "channel_desc",
				type: "string",
				description: "Channel used (IMPS/NEFT).",
				example: "IMPS",
			},
			{
				name: "recipient_name",
				type: "string",
				description: "Recipient's name.",
				example: "Krishna",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				tx_status: "0",
				debit_user_id: "6000000094",
				tds: "0.0",
				txstatus_desc: "Success",
				fee: "4.0",
				total_sent: "",
				channel: "2",
				collectable_amount: "114.0",
				txn_wallet: "0",
				utility_acc_no: "8999999992",
				sender_name: "8999999992",
				ekyc_enabled: "0",
				remaining_limit_before_pan_required: 49678,
				tid: "2886522975",
				bank: "UCO Bank",
				utrnumber: "",
				insurance_acquired: "",
				balance: "814.0",
				totalfee: "",
				next_allowed_limit: "",
				is_otp_required: "0",
				aadhar: "",
				currency: "INR",
				commission: "0.0",
				pipe: 13,
				state: "1",
				bank_ref_num: "250121123714472002",
				recipient_id: 10017680,
				timestamp: "2025-01-21T07:07:20.562Z",
				amount: "110.00",
				pan_required: 2,
				pinNo: "",
				gst_benefit: "0",
				payment_mode_desc: "",
				channel_desc: "IMPS",
				last_used_okekey: "0",
				npr: "",
				insurance_amount: "",
				service_tax: "0.61",
				paymentid: "",
				mdr: "",
				recipient_name: "Krishna",
				customer_id: "8999999992",
				account: "67544100008454",
				kyc_state: "",
			},
			response_type_id: 325,
			message: "Transaction successful",
			status: 0,
		},
	},
	{
		id: "onboard-user",
		productId: "user-management",
		name: "Onboard User",
		slug: "onboard-user",
		summary:
			"Register a new agent/retailer (merchant) on the EPS platform and receive their user_code.",
		description:
			"Onboards a merchant or retailer as a user on the platform. On success a unique `user_code` is returned — save it; every downstream request for that agent passes this `user_code`.",
		relevance: "H",
		bestFor: "Adding a new agent/retailer to your EPS network.",
		method: "POST",
		path: "/user/network/eps-agent",
		docsUrl: "https://developers.eko.in/reference/onboard-user-new",
		extraRequestParams: [
			{
				name: "pan_number",
				type: "string",
				required: true,
				description: "PAN card number of the agent.",
				example: "ABCDE1234F",
			},
			{
				name: "mobile",
				type: "string",
				required: true,
				description: "Verified mobile number of the agent.",
				example: "9876543210",
			},
			{
				name: "first_name",
				type: "string",
				required: true,
				description: "First name of the agent.",
				example: "Ramesh",
			},
			{
				name: "last_name",
				type: "string",
				required: true,
				description: "Last name of the agent.",
				example: "Kumar",
			},
			{
				name: "email",
				type: "string",
				required: true,
				description: "Email ID of the agent.",
				example: "ramesh@example.com",
			},
			{
				name: "residence_address",
				type: "array",
				required: true,
				description: "Residence address of the agent as an array of strings.",
				example: ["123 MG Road", "Bangalore", "Karnataka", "560001"],
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description: "Date of birth of the agent in YYYY-MM-DD format.",
				example: "1990-05-15",
			},
			{
				name: "shop_name",
				type: "string",
				required: true,
				description: "Shop name of the agent (required for AePS onboarding).",
				example: "Ramesh Mobile Store",
			},
		],
		responseData: [
			{
				name: "user_code",
				type: "string",
				imp: true,
				description:
					"Unique code for the onboarded agent — save it and pass on every downstream request.",
				example: "20110002",
			},
			{
				name: "initiator_id",
				type: "string",
				description: "Your registered initiator id (echoed back).",
				example: "9962981729",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: { user_code: "20110002", initiator_id: "9962981729" },
			response_type_id: 1290,
			message: "User onboarding successfull",
			status: 0,
		},
	},
	{
		id: "activate-user-service",
		productId: "user-management",
		name: "Activate Service for User",
		slug: "activate-user-service",
		summary:
			"Activate a specific service (by service code) for one of your agents/retailers.",
		description:
			"Enables a service for the given user (agent/retailer/distributor) so they can begin transacting on it. Activating a service is mandatory before your users can use it in production. The user is identified by their `user_code` and the service by its `service_code`, both supplied as path parameters. Look up service codes via the Get All Services API. After activation, confirm the status with the Get User's Services API.",
		descriptionFile: "activate-user-service.md",
		relevance: "M",
		bestFor:
			"Enabling a new service on an existing agent before their first transaction on it",
		method: "PUT",
		path: "/admin/network/agent/{user_code}/service/{service_code}/activate",
		docsUrl: "https://developers.eko.in/reference/activate-user-service",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "service_code",
				type: "string",
				required: true,
				description:
					"Unique code of the service to activate for the user. See the service codes reference.",
				example: "53",
			},
		],
		// TODO: confirm real response payload with Eko (response pending) — placeholder envelope.
		responseData: [],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Service activated successfully.",
			response_type_id: 0,
			data: {},
		},
	},
	{
		id: "deactivate-user-service",
		productId: "user-management",
		name: "Deactivate Service for User",
		slug: "deactivate-user-service",
		summary:
			"Deactivate a specific service (by service code) for one of your agents/retailers.",
		description:
			"Disables a previously activated service for the given agent. The agent is identified by their `user_code` and the service by its `service_code`, both supplied as path parameters. After deactivation, confirm the status with the Get User's Services API.",
		relevance: "M",
		bestFor:
			"Suspending a service on an agent without removing them from your network",
		method: "PUT",
		path: "/admin/network/agent/{user_code}/service/{service_code}/deactivate",
		docsUrl: "https://developers.eko.in/reference/deactivate-service-for-user",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
			{
				name: "service_code",
				type: "string",
				required: true,
				description:
					"Unique code of the service to deactivate for the user. See the service codes reference.",
				example: "53",
			},
		],
		// TODO: confirm real response payload with Eko (response pending) — placeholder envelope.
		responseData: [],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Service deactivated successfully.",
			response_type_id: 0,
			data: {},
		},
	},
	{
		id: "get-user-services",
		productId: "user-management",
		name: "Get User's Services",
		slug: "get-user-services",
		summary:
			"Check the activation status of every service for one of your agents.",
		descriptionFile: "get-user-services.md",
		relevance: "M",
		bestFor: "Auditing which services are active for an agent.",
		method: "GET",
		path: "/user/account/services",
		docsUrl: "https://developers.eko.in/reference/user-services",
		extraRequestParams: [
			{
				name: "user_code",
				type: "string",
				required: true,
				description:
					"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
				example: "20810200",
			},
		],
		responseData: [
			{
				name: "service_status_list",
				type: "array",
				imp: true,
				description: "Per-service status for the user.",
				children: [
					{
						name: "service_code",
						type: "string",
						imp: true,
						description: "Service code.",
						example: "43",
					},
					{
						name: "status_desc",
						type: "string",
						imp: true,
						description:
							"Human-readable status (ACTIVATED / PENDING / DEACTIVATED).",
						example: "ACTIVATED",
					},
					{
						name: "status",
						type: "number",
						description:
							"Activation status — 0 = deactivated (agent must re-upload documents via Activate Service), 1 = activated, 2 = pending.",
						example: 1,
					},
					{
						name: "verification_status",
						type: "number",
						description:
							"Ops-team verification state — 0 = not applicable, 1 = verified, 2 = rejected (reason in `comments`), 3 = pending.",
						example: 3,
					},
					{
						name: "comments",
						type: "string",
						description:
							"Ops-team remark — holds the rejection reason when `verification_status` is 2, otherwise null.",
						example: null,
					},
					{
						name: "createdAt",
						type: "string",
						description: "When the service was created.",
						example: "2019-11-11 13:21:25.0",
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				user_code: "20110341",
				initiator_id: "9962981729",
				service_status_list: [
					{
						comments: null,
						status_desc: "ACTIVATED",
						city: null,
						user_name: null,
						mobile: null,
						service_provider: null,
						verification_status: 3,
						createdAt: "2019-11-11 13:21:25.0",
						user_code: null,
						service_code: "43",
						state: null,
						status: 1,
						updatedAt: "2019-11-11 13:21:25.0",
					},
					{
						comments: null,
						status_desc: "PENDING",
						city: null,
						user_name: null,
						mobile: null,
						service_provider: null,
						verification_status: 0,
						createdAt: "2019-11-11 13:22:44.0",
						user_code: null,
						service_code: "1",
						state: null,
						status: 2,
						updatedAt: "",
					},
				],
			},
			response_type_id: 1299,
			message: "Status of services for this user",
			status: 0,
		},
	},
	{
		id: "get-all-services",
		productId: "user-management",
		name: "Get All Services",
		slug: "get-all-services",
		summary:
			"List every service available on the platform with its service code and provider.",
		description:
			"Returns the catalogue of services you can activate for your users — each with its `service_code` and provider name. Use the code with Activate Service for User.",
		relevance: "M",
		bestFor: "Discovering service codes before activating a service.",
		method: "GET",
		path: "/tools/catalog/service-codes",
		docsUrl: "https://developers.eko.in/reference/service-codes",
		extraRequestParams: [],
		responseData: [
			{
				name: "service_list",
				type: "array",
				imp: true,
				description: "Available services.",
				children: [
					{
						name: "service_name",
						type: "string",
						imp: true,
						description: "Display name of the service.",
						example: "AEPS",
					},
					{
						name: "service_code",
						type: "string",
						imp: true,
						description: "Service code — pass to Activate Service for User.",
						example: "43",
					},
					{
						name: "provider_name",
						type: "string",
						description: "Service provider.",
						example: "Fingpay",
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				service_list: [
					{
						service_name: "Pan Verification",
						service_code: "4",
						provider_name: "NSDL",
					},
					{
						service_name: "AePS Fund Settlement",
						service_code: "39",
						provider_name: "Yes Bank",
					},
					{
						service_name: "AEPS",
						service_code: "43",
						provider_name: "Fingpay",
					},
					{ service_name: "BBPS", service_code: "53", provider_name: "" },
				],
			},
			response_type_id: 1280,
			message: "List of active services",
			status: 0,
		},
	},
	{
		id: "get-wallet-balance",
		productId: "user-management",
		name: "Get Wallet Balance",
		slug: "get-wallet-balance",
		summary: "Fetch the wallet balance for a user.",
		description:
			"Returns the current wallet (settlement account) balance for the given registered mobile number (for your own account or that of your users/agents).",
		relevance: "M",
		bestFor: "Checking an agent's wallet/settlement balance.",
		method: "GET",
		path: "/user/account/balance",
		docsUrl: "https://developers.eko.in/reference/wallet-balance",
		extraRequestParams: [
			{
				name: "customer_id_type",
				type: "string",
				required: true,
				description: "Identifier type. Fixed value: mobile_number.",
				example: "mobile_number",
			},
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Registered mobile number for the wallet.",
				example: "9910028267",
			},
		],
		responseData: [
			{
				name: "balance",
				type: "string",
				imp: true,
				description: "Settlement-account balance (INR).",
				example: "2.20834002375E9",
			},
			{
				name: "currency",
				type: "string",
				description: "Currency.",
				example: "INR",
			},
			{
				name: "customer_id",
				type: "string",
				description: "Registered mobile number (echoed back).",
				example: "9910028267",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				last_used_okekey: "0",
				balance: "2.20834002375E9",
				currency: "INR",
				customer_id: "9910028267",
			},
			response_type_id: 1,
			message: "SUCCESS",
			status: 0,
		},
	},
	{
		id: "onboard-customer",
		productId: "customer-management",
		name: "Onboard Customer",
		slug: "onboard-customer",
		summary:
			"Register a new customer on the platform; triggers an OTP to verify them.",
		description:
			"Creates a rail-agnostic customer record. An OTP is dispatched and an `otp_ref_id` returned — call Verify Customer OTP next to complete onboarding.",
		relevance: "M",
		bestFor: "Rail-agnostic customer onboarding before a transaction.",
		method: "POST",
		path: "/customer/account/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/onboard-customer",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description: "Name of the customer as per ID.",
				example: "Karan Garg",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description: "Date of birth of the customer in YYYY-MM-DD format.",
				example: "1990-05-15",
			},
			{
				name: "residence_address",
				type: "array",
				required: true,
				description: "Customer's address as an array of strings.",
				example: ["123 MG Road", "Bangalore", "Karnataka", "560001"],
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag for the next step (19 = onboarding).",
				example: 19,
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Customer OTP.",
				example:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94YigSXr5Qr+aS8OTg/e0YrVEoPAbap746K5g==",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94YigSXr5Qr+aS8OTg/e0YrVEoPAbap746K5g==",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 2129,
		},
	},
	{
		id: "get-customer-info",
		productId: "customer-management",
		name: "Get Customer Information",
		slug: "get-customer-info",
		summary:
			"Check whether a customer is already enrolled on the platform by mobile number.",
		description:
			"Looks up a customer by mobile number. For an enrolled customer the response returns an `otp_ref_id` to validate; if not enrolled (response_type_id 308) proceed to Onboard Customer. It also reports KYC state, remaining monthly limits (₹74,500 full-KYC vs ₹25,000 non-KYC), and per-pipe registration (`is_registered`).",
		descriptionFile: "get-customer-info.md",
		relevance: "M",
		bestFor: "Checking customer enrolment before a transaction.",
		method: "GET",
		path: "/customer/profile/{customer_id}",
		docsUrl: "https://developers.eko.in/reference/get-customer-info",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's 10-digit mobile number.",
				example: "9444444444",
			},
		],
		responseData: [
			{
				name: "intent_id",
				type: "number",
				description: "Intent flag for the next step (19 = onboarding).",
				example: 19,
			},
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Verify Customer OTP.",
				example:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				intent_id: 19,
				kyc_request_id: "",
				otp_ref_id:
					"IXrygqm0vTNbN35Lp5AfcbP69ifPhQ1Ee3u74AHY5fA9aMp2d94Yii3g+9fOBmbMsVTuaEQpDOEateP4tSTkQw==",
			},
			response_type_id: 2129,
			message: "Validate the OTP",
			status: 2129,
		},
		errorScenarios: [
			{
				scenario: "Customer not enrolled — proceed to Onboard Customer",
				statusCode: 200,
				example: {
					response_status_id: 1,
					data: { sender_name: "", ekyc_enabled: "" },
					response_type_id: 308,
					message: "Failure!Customer Not Enrolled",
					status: 308,
				},
			},
		],
	},
	{
		id: "verify-customer-otp",
		productId: "customer-management",
		name: "Verify Customer OTP",
		slug: "verify-customer-otp",
		summary:
			"Verify the customer OTP to complete onboarding and return the customer profile.",
		description:
			"Validates the OTP issued by Onboard Customer / Get Customer Information. For an existing customer the response returns the full `customer_profile` (limits, balance, KYC state). For a new customer the flow continues to Aadhaar validation and PAN.",
		relevance: "M",
		bestFor: "Completing customer verification after onboarding.",
		method: "POST",
		path: "/customer/account/{customer_id}/otp/verify",
		docsUrl: "https://developers.eko.in/reference/verify-customer-otp",
		extraRequestParams: [
			{
				name: "customer_id",
				type: "string",
				required: true,
				description: "Customer's 10-digit mobile number.",
				example: "9444444444",
			},
			{
				name: "otp",
				type: "integer",
				required: false,
				description:
					"OTP received from Onboard Customer, Get Customer Information, or Validate Aadhaar.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "integer",
				required: true,
				description:
					"otp_ref_id received from Onboard Customer, Get Customer Information, or Validate Aadhaar.",
				example: 66748392,
			},
		],
		responseData: [
			{
				name: "customer_profile",
				type: "object",
				imp: true,
				description:
					"Customer's profile — limits, balance, KYC state, and usage chart.",
				children: [
					{
						name: "name",
						type: "string",
						imp: true,
						description: "Registered name of the customer.",
						example: "Karan Garg",
					},
					{
						name: "mobile",
						type: "string",
						description: "Customer's mobile number.",
						example: "9444444444",
					},
					{
						name: "next_allowed_limit",
						type: "string",
						imp: true,
						description: "Remaining transfer limit for the period (INR).",
						example: "5287.0",
					},
					{
						name: "balance",
						type: "string",
						imp: true,
						description: "Current balance (INR).",
						example: "0.00",
					},
					{
						name: "kyc_state",
						type: "number",
						description: "KYC completion state.",
						example: 0,
					},
				],
			},
			{
				name: "sender_name",
				type: "string",
				imp: true,
				description: "Registered name of the customer.",
				example: "Karan Garg",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				customer_profile: {
					total_monthly_limit: "50000.0",
					mobile: "9444444444",
					kyc_id: "",
					ekyc_enabled: 0,
					kyc_validity: "",
					kyc_remark: "",
					kyc_type: "",
					balance: "0.00",
					next_allowed_limit: "5287.0",
					name: "Karan Garg",
					digital_ekyc: 0,
					chart: [
						{
							data_type_id: 10,
							data: { unavailable: 0, used: 44713, remaining: 5287 },
							label: "",
						},
					],
					email: "",
					kyc_state: 0,
				},
				id_proof_type_id: "",
				is_registered: 0,
				id_proof: "",
				otpOptionalSum: "",
				sender_name: "Karan Garg",
				otpNotRequiredSum: "",
				ekyc_enabled: "",
				otpNotRequiredSumNeft: "",
				next_allowed_limit: 5287,
				account: "",
				kyc_state: 0,
				otpOptionalSumNeft: "",
			},
			response_type_id: 309,
			message: "Success!",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "New customer — Aadhaar validation pending",
				statusCode: 200,
				example: {
					response_status_id: 1,
					response_type_id: 2136,
					message: "Aadhar Validation Pending",
					status: 2136,
				},
			},
			{
				scenario: "Aadhaar validated — PAN required next",
				statusCode: 200,
				example: {
					response_status_id: 0,
					data: { application_id: "" },
					response_type_id: 2147,
					message: "Pan Number Required",
					status: 0,
				},
			},
		],
	},
	{
		id: "transaction-inquiry",
		productId: "transactions",
		name: "Transaction Inquiry",
		slug: "transaction-inquiry",
		summary:
			"Get the status of any transaction by Eko TID or your client_ref_id.",
		description:
			"Looks up a transaction's status using either Eko's TID or your own `client_ref_id` — useful when a response timed out and you never received the TID. tx_status codes: 0 = Success, 1 = Fail, 2 = Awaited/Initiated (NEFT), 3 = Refund Pending, 4 = Refunded, 5 = Hold. A timeout should never be treated as an automatic failure — always inquire.",
		descriptionFile: "transaction-inquiry.md",
		relevance: "H",
		bestFor: "Reconciling a transaction whose response timed out.",
		method: "GET",
		path: "/tools/reference/transaction/{transaction-reference}",
		docsUrl: "https://developers.eko.in/reference/transaction-inquiry",
		extraRequestParams: [
			{
				name: "transaction-reference",
				type: "string",
				required: true,
				description:
					"Eko TID or your `client_ref_id` that identifies the transaction. Pass a TID as-is; to look up by `client_ref_id`, prefix it — e.g. `client_ref_id:567890`.",
				example: "12971397",
			},
		],
		responseData: [
			{
				name: "tx_status",
				type: "string",
				imp: true,
				description:
					"Transaction status (0 Success, 1 Fail, 2 Awaited, 3 Refund Pending, 4 Refunded, 5 Hold).",
				example: "0",
			},
			{
				name: "txstatus_desc",
				type: "string",
				imp: true,
				description: "Human-readable transaction status.",
				example: "Success",
			},
			{
				name: "tid",
				type: "string",
				imp: true,
				description: "Eko transaction ID.",
				example: "12971397",
			},
			{
				name: "client_ref_id",
				type: "string",
				imp: true,
				description: "Your reference id for the transaction.",
				example: "Settlemet7206123420",
			},
			{
				name: "amount",
				type: "string",
				description: "Transaction amount (INR).",
				example: "1045.0",
			},
			{
				name: "bank_ref_num",
				type: "string",
				description: "Bank/UTR reference number.",
				example: "8761099407",
			},
			{
				name: "recipient_name",
				type: "string",
				description: "Recipient's name.",
				example: "Virender Singh",
			},
			{
				name: "timestamp",
				type: "string",
				description: "Transaction timestamp.",
				example: "2019-11-01 17:50:44",
			},
		],
		sampleSuccessResponse: {
			response_type_id: 1472,
			data: {
				bank_ref_num: "8761099407",
				account: "234243534",
				fee: "5.0",
				client_ref_id: "Settlemet7206123420",
				gst: "0.76",
				sender_name: "Flipkart",
				timestamp: "2019-11-01 17:50:44",
				ifsc: "SBIN0000001",
				beneficiary_account_type: 1,
				txstatus_desc: "Success",
				tx_status: "0",
				tid: "12971397",
				amount: "1045.0",
				payment_mode: 5,
				recipient_name: "Virender Singh",
			},
			message: "Sucess! Enquiry success.",
			status: 0,
			response_status_id: 0,
		},
	},
	{
		id: "get-refund-otp",
		productId: "transactions",
		name: "Get Refund OTP",
		slug: "get-refund-otp",
		summary:
			"Request the refund OTP for a failed transaction (sent to the customer's mobile).",
		description:
			"For a failed transaction (tx_status 3), an OTP is sent to the customer's mobile. Call this to (re)send it and obtain the `otp_ref_id`; pass both into Initiate Refund. The OTP cannot be bypassed.",
		relevance: "M",
		bestFor: "Obtaining the refund OTP before initiating a refund.",
		method: "POST",
		path: "/customer/payment/refund/{tid}/otp",
		docsUrl: "https://developers.eko.in/reference/refund-otp",
		omitCommonParams: ["client_ref_id"],
		extraRequestParams: [
			{
				name: "tid",
				type: "string",
				required: true,
				description: "Transaction ID from the Initiate Transaction call.",
				example: "13192443",
			},
		],
		responseData: [
			{
				name: "otp_ref_id",
				type: "string",
				imp: true,
				description: "OTP session reference — pass to Initiate Refund.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 1,
			data: {
				otp_ref_id:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			response_type_id: 2133,
			message: "Send OTP",
			status: 2133,
		},
	},
	{
		id: "initiate-refund",
		productId: "transactions",
		name: "Initiate Refund",
		slug: "initiate-refund",
		summary: "Refund a failed transaction to the customer after OTP consent.",
		description:
			"Refunds the e-value for a failed transaction back to your account, acting as consent that you have returned the cash to the customer. Requires the OTP (and otp_ref_id) from Get Refund OTP. Returns the financial response envelope with the refund transaction id and reversed amounts.",
		relevance: "M",
		bestFor: "Completing the refund of a failed cash-out transaction.",
		method: "POST",
		path: "/customer/payment/refund/{tid}",
		docsUrl: "https://developers.eko.in/reference/refund",
		financial: true,
		omitCommonParams: ["client_ref_id"],
		extraRequestParams: [
			{
				name: "tid",
				type: "string",
				required: true,
				description: "Transaction ID from the Initiate Transaction call.",
				example: "13192443",
			},
			{
				name: "otp",
				type: "integer",
				required: true,
				description: "OTP sent to the customer's mobile number.",
				example: 123456,
			},
			{
				name: "otp_ref_id",
				type: "string",
				required: false,
				description: "otp_ref_id received from Get Refund OTP.",
				example:
					"zCISyglexo0Pjqp4YrS2ssweuD9v1c3aLKGxjTW8wU7An8Wem1UyNws5830yh7q/sf5J4R3BY=",
			},
			{
				name: "service_code",
				type: "integer",
				required: false,
				description: "Fixed service code. For PayPoint send 80.",
				example: 80,
			},
			{
				name: "state",
				type: "integer",
				required: false,
				description: "Fixed value. Send 1.",
				example: 1,
			},
		],
		responseData: [
			{
				name: "refund_tid",
				type: "string",
				imp: true,
				description: "Transaction ID of the refund.",
				example: "2147591637",
			},
			{
				name: "refunded_amount",
				type: "string",
				imp: true,
				description: "Total amount refunded (INR).",
				example: "5050.00",
			},
			{
				name: "amount",
				type: "string",
				description: "Original transaction amount (INR).",
				example: "5000.00",
			},
			{
				name: "fee",
				type: "string",
				description: "Fee reversed (INR).",
				example: "50.0",
			},
			{
				name: "balance",
				type: "string",
				imp: true,
				description: "Account balance after the refund (INR).",
				example: "2.22263731286E9",
			},
			{
				name: "tid",
				type: "string",
				description: "Original transaction ID.",
				example: "13192443",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				refund_tid: "2147591637",
				amount: "5000.00",
				tds: "7.1",
				balance: "2.22263731286E9",
				fee: "50.0",
				currency: "INR",
				commission_reverse: "28.38",
				tid: "13192443",
				timestamp: "2018-10-30T12:00:14.058Z",
				refunded_amount: "5050.00",
			},
			response_type_id: 74,
			message: "Refund done",
			status: 0,
		},
	},
	{
		id: "get-banks",
		productId: "bank-info",
		name: "Get List of Banks",
		slug: "get-banks",
		summary: "Fetch a list of all banks.",
		description:
			"Returns a list of all banks. Use the [Get Bank Details API](./get-bank-details) to get additional information about a bank.",
		relevance: "L",
		method: "GET",
		path: "/tools/reference/banks",
		docsUrl: "https://developers.eko.in/reference/get-bank-list",
		extraRequestParams: [],
		responseData: [],
		sampleSuccessResponse: {},
	},
	{
		id: "get-bank-details",
		productId: "bank-info",
		name: "Get Bank Details",
		slug: "get-bank-details",
		summary:
			"Fetch a bank's details (id, name, channels) by its Eko bank code.",
		description:
			"Returns metadata for a bank — Eko `bank_id`, display name, supported channels, and whether account verification is available. Optionally pass an IFSC to narrow the lookup.",
		relevance: "L",
		bestFor: "Resolving an Eko bank_id before adding a recipient.",
		method: "GET",
		path: "/tools/reference/bank/{bank_code}",
		docsUrl: "https://developers.eko.in/reference/bank-details",
		extraRequestParams: [
			{
				name: "bank_code",
				type: "string",
				required: true,
				description: "Eko bank code (see the bank list).",
				example: "IDFB",
			},
			{
				name: "ifsc",
				type: "string",
				required: false,
				description: "IFSC code to narrow the lookup.",
				example: "IDFB0080202",
			},
		],
		responseData: [
			{
				name: "name",
				type: "string",
				imp: true,
				description: "Bank display name.",
				example: "IDFC Bank",
			},
			{
				name: "bank_id",
				type: "number",
				imp: true,
				description: "Eko bank identifier — use when adding a recipient.",
				example: 262,
			},
			{
				name: "code",
				type: "string",
				description: "Eko bank code.",
				example: "IDFB",
			},
			{
				name: "ifsc_status",
				type: "number",
				description: "IFSC verification status code.",
				example: 4,
			},
			{
				name: "isverificationavailable",
				type: "string",
				description:
					"Whether account verification is available (1) or not (0).",
				example: "0",
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			data: {
				isverificationavailable: "0",
				code: "IDFB",
				ifsc_status: 4,
				user_code: "20810200",
				bank_id: 262,
				name: "IDFC Bank",
				available_channels: 0,
			},
			response_type_id: 466,
			message: "Bank Detials Found",
			status: 0,
		},
		errorScenarios: [
			{
				scenario: "Invalid bank details",
				statusCode: 200,
				example: {
					response_status_id: 1,
					response_type_id: 467,
					message: "Please provide valid bank details",
					status: 467,
				},
			},
		],
	},
	{
		id: "get-ifsc-details",
		productId: "bank-info",
		name: "Get IFSC Details",
		slug: "get-ifsc-details",
		summary: "Resolve a bank and branch from an IFSC code.",
		description:
			"Returns the bank name, branch, Eko `bank_id`, and verification availability for a given IFSC code.",
		relevance: "L",
		bestFor: "Validating an IFSC and resolving its bank/branch.",
		method: "GET",
		path: "/tools/reference/banks/ifsc/{ifsc}",
		docsUrl: "https://developers.eko.in/reference/get-ifsc-details",
		extraRequestParams: [
			{
				name: "ifsc",
				type: "string",
				required: true,
				description: "IFSC code of the bank branch.",
				example: "IOBA0002248",
			},
		],
		responseData: [
			{
				name: "bank",
				type: "string",
				imp: true,
				description: "Bank name for the IFSC.",
				example: "INDIAN OVERSEAS BANK",
			},
			{
				name: "branch",
				type: "string",
				imp: true,
				description: "Branch for the IFSC.",
				example: "SANGLI",
			},
			{
				name: "ifsc",
				type: "string",
				description: "IFSC code (echoed back).",
				example: "IOBA0002248",
			},
			{
				name: "bank_id",
				type: "number",
				description: "Eko bank identifier.",
				example: 10,
			},
			{
				name: "isverificationavailable",
				type: "string",
				description:
					"Whether account verification is available (1) or not (0).",
				example: "1",
			},
		],
		sampleSuccessResponse: {
			response_status_id: -1,
			data: {
				bank: "INDIAN OVERSEAS BANK",
				isverificationavailable: "1",
				ifsc_status: 3,
				user_code: "20810200",
				bank_id: 10,
				available_channels: 0,
				ifsc: "IOBA0002248",
				branch: "SANGLI",
			},
			response_type_id: 414,
			message: "Success ! Found bank Details for given Ifsc",
			status: 0,
		},
	},
	{
		id: "bbps-operator-code-circle",
		productId: "bbps",
		name: "Get Operator Code and Circle",
		slug: "bbps-operator-code-circle",
		summary:
			"Auto-detect a mobile number's recharge operator code and telecom circle.",
		description:
			"Returns the `phone_operator_code` and `circle_area` for a customer mobile number — returned under `dependent_params`. Pass these into Get Recharge Plans.",
		relevance: "M",
		bestFor: "Resolving operator and circle before fetching recharge plans.",
		method: "GET",
		path: "/customer/payment/bbps/recharge/{customer_mobile}/operator",
		docsUrl: "https://developers.eko.in/reference/operator-and-circle-area",
		extraRequestParams: [
			{
				name: "customer_mobile",
				type: "string",
				required: true,
				description: "Customer's mobile number.",
				example: "9876543210",
			},
		],
		responseData: [
			{
				name: "dependent_params",
				type: "array",
				imp: true,
				description:
					"Resolved operator/circle as name-value pairs (phone_operator_code, circle_area) — returned at the top level, not under data.",
				children: [
					{
						name: "name",
						type: "string",
						description: "Parameter name (phone_operator_code or circle_area).",
						example: "phone_operator_code",
					},
					{
						name: "value",
						type: "number",
						description: "Parameter value.",
						example: 400,
					},
				],
			},
		],
		sampleSuccessResponse: {
			response_status_id: 0,
			dependent_params: [
				{ name: "phone_operator_code", value: 400 },
				{ name: "circle_area", value: "5" },
			],
			data: { updates: "" },
			response_type_id: 1804,
			message: "success",
			status: 0,
		},
	},
	{
		id: "digilocker-create-url",
		productId: "digilocker",
		name: "Create DigiLocker URL",
		slug: "digilocker-create-url",
		summary:
			"Generate a DigiLocker redirect URL to initiate consent-based Aadhaar document retrieval.",
		description:
			"Creates a one-time DigiLocker URL that redirects the customer to the DigiLocker portal for consent-based retrieval of Aadhaar (and other) documents. After the customer authorises access on DigiLocker, they are redirected back to the provided `redirect_url`. The `reference_id` returned is then used to fetch the verified document data via the Get DigiLocker Document API.",
		relevance: "M",
		bestFor:
			"KYC flows that use DigiLocker for government-issued document verification, avoiding manual document uploads.",
		method: "POST",
		path: "/tools/kyc/digilocker",
		docsUrl: "https://developers.eko.in/reference/create-digilocker-url",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/digilocker/create-digilocker-url",
		extraRequestParams: [
			{
				name: "document_requested",
				type: "array",
				required: true,
				description:
					'List of document types requested for verification. Defaults to ["AADHAAR"].',
				example: ["AADHAAR"],
			},
			{
				name: "redirect_url",
				label: "Redirection URL",
				type: "string",
				required: true,
				description:
					"The URL to redirect the customer back to after completing the DigiLocker authorisation journey.",
				example: "https://yourapp.com/kyc/callback",
			},
		],
		responseData: [
			{
				name: "reference_id",
				type: "number",
				description:
					"Unique reference ID for this DigiLocker session. Store this to call Get DigiLocker Document after the customer completes the DigiLocker journey.",
				imp: true,
				example: 7483920,
			},
			{
				name: "url",
				label: "DigiLocker URL",
				type: "string",
				description:
					"DigiLocker redirect URL. Present this URL to the customer to begin document authorisation.",
				imp: true,
				example: "https://digilocker.gov.in/auth?session_id=abc123xyz",
			},
			{
				name: "document_requested",
				type: "array",
				description: "Echo of the document types requested.",
				example: ["AADHAAR"],
			},
			{
				name: "redirect_url",
				label: "Redirection URL",
				type: "string",
				description: "The callback URL provided in the request.",
				example: "https://yourapp.com/kyc/callback",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "DigiLocker URL created successfully",
			response_type_id: 1388,
			data: {
				reference_id: 7483920,
				url: "https://digilocker.gov.in/auth?session_id=abc123xyz",
				document_requested: ["AADHAAR"],
				redirect_url: "https://yourapp.com/kyc/callback",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid redirect_url format",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 301,
					message: "Invalid redirect URL provided.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "digilocker-get-document",
		productId: "digilocker",
		name: "Get DigiLocker Document",
		slug: "digilocker-get-document",
		summary:
			"Retrieve verified Aadhaar details from DigiLocker after the customer completes the consent journey.",
		description:
			"Fetches the verified Aadhaar (or other government document) data from DigiLocker using the `reference_id` obtained from Create DigiLocker URL. Must be called after the customer has completed authorisation on DigiLocker and been redirected back. Returns structured identity data extracted from the verified document.",
		relevance: "M",
		bestFor:
			"Fetching verified identity details from DigiLocker after Aadhaar consent, for use in KYC records and onboarding.",
		method: "POST",
		path: "/tools/kyc/digilocker/document",
		docsUrl: "https://developers.eko.in/reference/get-digilocker-document",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/digilocker/get-document-from-digilocker",
		extraRequestParams: [
			{
				name: "document_type",
				type: "array",
				required: true,
				description: 'List of document types to retrieve (e.g. ["AADHAAR"]).',
				example: ["AADHAAR"],
			},
			{
				name: "verification_id",
				type: "string",
				required: true,
				description:
					"Unique verification ID returned by the Create DigiLocker URL API.",
				example: "vrf_digilocker_abc123",
			},
			{
				name: "reference_id",
				type: "string",
				required: true,
				description:
					"Reference ID from the Create DigiLocker URL API response.",
				example: "7483920",
			},
		],
		responseData: [
			{
				name: "documents",
				type: "array",
				description: "List of verified documents retrieved from DigiLocker.",
				children: [
					{
						name: "document_type",
						type: "string",
						description: "Type of document retrieved (e.g. AADHAAR).",
						imp: true,
						example: "AADHAAR",
					},
					{
						name: "name",
						type: "string",
						description: "Full name as per the verified document.",
						imp: true,
						example: "Vikram Singh",
					},
					{
						name: "dob",
						label: "Date of Birth",
						type: "string",
						description: "Date of birth from the verified document.",
						imp: true,
						example: "12-11-1987",
					},
					{
						name: "gender",
						type: "string",
						description: "Gender as per document: M, F, or T.",
						imp: true,
						example: "M",
					},
					{
						name: "masked_aadhaar",
						type: "string",
						description: "Aadhaar number with first 8 digits masked.",
						imp: true,
						example: "XXXX-XXXX-2345",
					},
					{
						name: "address",
						type: "object",
						description: "Residential address from the verified Aadhaar.",
						imp: true,
						children: [
							{
								name: "house",
								type: "string",
								description: "House or flat number.",
								imp: true,
								example: "15B",
							},
							{
								name: "street",
								type: "string",
								description: "Street or locality name.",
								imp: true,
								example: "Nehru Street",
							},
							{
								name: "village_or_city",
								type: "string",
								description: "Village or city.",
								imp: true,
								example: "Chennai",
							},
							{
								name: "district",
								type: "string",
								description: "District.",
								imp: true,
								example: "Chennai",
							},
							{
								name: "state",
								type: "string",
								description: "State.",
								imp: true,
								example: "Tamil Nadu",
							},
							{
								name: "pincode",
								type: "string",
								description: "6-digit postal code.",
								imp: true,
								example: "600001",
							},
						],
					},
					{
						name: "photo",
						type: "string",
						description: "Base64-encoded photograph from the Aadhaar document.",
						imp: true,
						example: "/9j/4AAQSkZJRgABAQ...",
					},
					{
						name: "issue_date",
						type: "string",
						description: "Date when the document was issued.",
						example: "01-01-2020",
					},
				],
			},
			{
				name: "verification_status",
				type: "string",
				description:
					"Overall DigiLocker verification status: SUCCESS or PENDING.",
				imp: true,
				example: "SUCCESS",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Documents retrieved successfully",
			response_type_id: 1388,
			data: {
				verification_status: "SUCCESS",
				documents: [
					{
						document_type: "AADHAAR",
						name: "Vikram Singh",
						dob: "12-11-1987",
						gender: "M",
						masked_aadhaar: "XXXX-XXXX-2345",
						photo: "/9j/4AAQSkZJRgABAQ...",
						issue_date: "01-01-2020",
						address: {
							house: "15B",
							street: "Nehru Street",
							village_or_city: "Chennai",
							district: "Chennai",
							state: "Tamil Nadu",
							pincode: "600001",
						},
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Customer has not completed DigiLocker authorisation yet",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 327,
					message:
						"Verification pending. Customer has not completed DigiLocker consent.",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Invalid reference_id",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "Invalid reference ID. Please check and retry.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "digilocker-verification-status",
		productId: "digilocker",
		name: "DigiLocker Verification Status",
		slug: "digilocker-verification-status",
		summary:
			"Check whether a user has completed the DigiLocker consent and verification flow.",
		description:
			"Poll this endpoint after redirecting the user to the DigiLocker URL. Returns the user's consent status and basic identity details (name, DOB, gender, mobile) once the consent flow is complete. Use reference_id from the Create DigiLocker URL response.",
		relevance: "M",
		bestFor:
			"Polling for consent completion before fetching the full document data.",
		method: "GET",
		path: "/tools/kyc/digilocker/status",
		docsUrl:
			"https://developers.eko.in/reference/digilocker-verification-status",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/digilocker/get-digilocker-verification-status",
		extraRequestParams: [
			{
				name: "reference_id",
				type: "number",
				required: true,
				description:
					"Unique identifier received from the Create DigiLocker URL API response.",
				example: 12345,
			},
		],
		responseData: [
			{
				name: "user_details",
				type: "object",
				description:
					"Identity details of the individual who completed the DigiLocker consent flow.",
				imp: true,
				children: [
					{
						name: "name",
						type: "string",
						description:
							"Full name of the individual as registered in DigiLocker.",
						imp: true,
						example: "Rahul Sharma",
					},
					{
						name: "dob",
						type: "string",
						description: "Date of birth in DD-MM-YYYY format.",
						imp: true,
						example: "15-08-1990",
					},
					{
						name: "gender",
						type: "string",
						description: "Gender of the individual (M / F / T).",
						imp: true,
						example: "M",
					},
					{
						name: "eaadhaar",
						type: "string",
						description:
							"Indicates whether the individual's e-Aadhaar is available in DigiLocker.",
						imp: true,
						example: "Y",
					},
					{
						name: "mobile",
						type: "string",
						description:
							"Mobile number linked to the individual's DigiLocker account.",
						example: "98XXXXXXXX",
					},
				],
			},
			{
				name: "document_requested",
				type: "array",
				description:
					"List of document types that were requested in the original session.",
				example: ["AADHAAR"],
			},
			{
				name: "document_consent",
				type: "array",
				description:
					"Consent status objects per requested document type. Indicates which documents the user approved for sharing.",
				imp: true,
				example: [
					{
						document_type: "AADHAAR",
						consent: "Y",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Verification status fetched successfully",
			response_type_id: 1389,
			data: {
				user_details: {
					name: "Rahul Sharma",
					dob: "15-08-1990",
					gender: "M",
					eaadhaar: "Y",
					mobile: "98XXXXXXXX",
				},
				document_requested: ["AADHAAR"],
				document_consent: [
					{
						document_type: "AADHAAR",
						consent: "Y",
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Consent flow not yet completed by user",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message:
						"Verification pending. User has not completed DigiLocker consent.",
					data: {},
				},
			},
			{
				scenario: "Invalid or expired reference_id",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid reference_id",
					data: {},
				},
			},
		],
	},
	{
		id: "bank-account-verification",
		productId: "bank",
		name: "Bank Account Verification",
		slug: "bank-account-verification",
		summary:
			"Verify a bank account by transferring ₹1 (penny drop) and retrieve the account holder name, account status, and branch details in real time.",
		description:
			"Performs a live penny-drop transaction of ₹1 to the specified bank account and returns the account holder name as registered with the bank, account status, IFSC details, and the UTR of the debit. Use this before payouts to prevent failures and fraud. The ₹1 is credited to the beneficiary — no refund occurs. Supports all IMPS-enabled banks in India.",
		relevance: "M",
		bestFor:
			"Businesses that disburse funds and need to confirm both account existence and the registered account holder name before transferring money.",
		method: "POST",
		path: "/tools/kyc/bank-account/sync",
		docsUrl: "https://developers.eko.in/reference/bank-account-verification",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/bank-account-verification-sync-v2",
		extraRequestParams: [
			{
				name: "bank_account",
				type: "number",
				required: true,
				description: "Complete bank account number to be verified.",
				example: 1234567890,
			},
			{
				name: "ifsc",
				label: "IFSC Code",
				type: "string",
				required: true,
				description:
					"IFSC code of the bank account to be verified (11-character alphanumeric).",
				example: "SBIN0001234",
			},
		],
		responseData: [
			{
				name: "account_exists",
				label: "Account Exists?",
				type: "boolean",
				description: "Whether the bank account is valid and active.",
				imp: true,
				example: true,
			},
			{
				name: "account_name",
				label: "Account Holder's Name",
				type: "string",
				description:
					"Account holder name as registered with the bank. Use for name matching against provided details.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "ifsc",
				label: "IFSC Code",
				type: "string",
				description:
					"IFSC code confirmed by the bank for the verified account.",
				imp: true,
				example: "SBIN0001234",
			},
			{
				name: "bank",
				type: "string",
				description: "Full name of the bank associated with the account.",
				imp: true,
				example: "State Bank of India",
			},
			{
				name: "branch",
				type: "string",
				description: "Branch name associated with the IFSC code.",
				imp: true,
				example: "MG Road Branch",
			},
			{
				name: "utr",
				label: "Penny-Drop UTR",
				type: "string",
				description:
					"Unique Transaction Reference number of the ₹1 penny-drop credit. Useful for reconciliation.",
				example: "431712345678",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Bank account verification successful",
			response_type_id: 1388,
			data: {
				account_exists: true,
				account_name: "Rajesh Kumar",
				ifsc: "SBIN0001234",
				bank: "State Bank of India",
				branch: "MG Road Branch",
				utr: "431712345678",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid IFSC code — malformed or non-existent IFSC provided",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid IFSC code",
					response_type_id: 1388,
					data: {
						account_exists: false,
						account_name: null,
						ifsc: "INVALID001",
						bank: null,
						branch: null,
						utr: null,
					},
				},
			},
			{
				scenario:
					"Invalid or non-existent bank account number — penny drop failed",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid Account",
					response_type_id: 1388,
					data: {
						account_exists: false,
						account_name: null,
						ifsc: "SBIN0001234",
						bank: "State Bank of India",
						branch: "MG Road Branch",
						utr: null,
					},
				},
			},
			{
				scenario:
					"Bank not supported — not live on IMPS (e.g. Deutsche Bank, Fincare SFB)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Bank not supported for verification",
					response_type_id: 1388,
					data: {
						account_exists: false,
						account_name: null,
						ifsc: null,
						bank: null,
						branch: null,
						utr: null,
					},
				},
			},
		],
	},
	{
		id: "bulk-bank-account-verification",
		productId: "bank",
		name: "Bulk Bank Account Verification",
		slug: "bulk-bank-account-verification",
		summary:
			"Submit multiple bank accounts for penny-drop verification in a single API call; poll a status API for per-account results.",
		description:
			"Accepts an array of bank account + IFSC pairs and enqueues them for asynchronous penny-drop verification. Returns a bulk_reference_id immediately; use the Bulk Bank Account Verification Status API to retrieve per-account results once processing completes. Ideal for batch onboarding, payroll runs, and large-scale disbursement pipelines where sequential single-account calls would be too slow.",
		relevance: "M",
		bestFor:
			"Platforms processing hundreds to thousands of bank account verifications in one go, where results can be retrieved asynchronously.",
		method: "POST",
		path: "/tools/kyc/bank-account/bulk",
		docsUrl:
			"https://developers.eko.in/reference/bulk-bank-account-verification",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/bulk-bank-account-verification-v2",
		extraRequestParams: [
			{
				name: "entries",
				type: "array",
				required: true,
				description:
					"Array of bank account objects to verify. Each entry must contain bank_account and ifsc. Optionally include user_code per entry to attribute verifications to different retailers.",
				example: [
					{
						bank_account: "1234567890",
						ifsc: "SBIN0001234",
					},
					{
						bank_account: "9876543210123",
						ifsc: "HDFC0005678",
					},
				],
			},
			{
				name: "entries[].bank_account",
				type: "string",
				required: true,
				description: "Bank account number for this entry.",
				example: "1234567890",
			},
			{
				name: "entries[].ifsc",
				type: "string",
				required: true,
				description: "IFSC code for this entry's bank account.",
				example: "SBIN0001234",
			},
			{
				name: "entries[].user_code",
				type: "string",
				required: false,
				description:
					"Per-entry retailer user code, if attributing individual verifications to different agents.",
				example: "20810200",
			},
		],
		responseData: [
			{
				name: "bulk_reference_id",
				type: "string",
				description:
					"Unique reference ID for this bulk verification batch. Pass this to the Bulk Bank Account Verification Status API to poll for per-account results.",
				imp: true,
				example: "3356655212",
			},
			{
				name: "reference_id",
				type: "number",
				description:
					"Numeric reference ID for the submitted batch request, used for internal tracking.",
				example: 123456,
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message:
				"Bulk verification request accepted. Poll status API for results.",
			response_type_id: 1388,
			data: {
				bulk_reference_id: "3356655212",
				reference_id: 123456,
			},
		},
		errorScenarios: [
			{
				scenario:
					"Invalid or malformed entries array — missing required fields in one or more entries",
				statusCode: 400,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid request: entries array is missing or malformed",
					data: null,
				},
			},
			{
				scenario:
					"Invalid IFSC in one or more entries — batch accepted but affected entries fail in status poll",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message:
						"Bulk verification request accepted. Poll status API for results.",
					response_type_id: 1388,
					data: {
						bulk_reference_id: "3356655213",
						reference_id: 123457,
					},
				},
			},
		],
	},
	{
		id: "bulk-bank-account-verification-status",
		productId: "bank",
		name: "Check Bulk Bank Account Verification Status",
		slug: "bulk-bank-account-verification-status",
		summary:
			"Poll for per-account results of a Bulk Bank Account Verification batch using the bulk_reference_id returned at submit time.",
		description:
			"Companion to the Bulk Bank Account Verification API. Because the batch runs asynchronously, callers poll this endpoint with the bulk_reference_id from the submit response to retrieve per-account penny-drop results as they complete. The response returns an entries array, one object per submitted account, each carrying the account-holder name at bank, bank/branch/MICR details, UTR, name-match score/result, and account status.",
		relevance: "M",
		bestFor:
			"Fetching individual account results after submitting a batch to the Bulk Bank Account Verification API.",
		method: "GET",
		path: "/tools/kyc/bank-account/bulk/status",
		docsUrl:
			"https://developers.eko.in/reference/bulk-bank-account-verification-status",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/get-bulk-bav-status-v2",
		extraRequestParams: [
			{
				name: "bulk_reference_id",
				type: "string",
				required: true,
				description:
					"Unique id returned by the Bulk Bank Account Verification API for the submitted batch.",
				example: "3356655212",
			},
		],
		responseData: [
			{
				name: "entries",
				type: "array",
				description:
					"Per-account verification results — one object for each account submitted in the batch.",
				imp: true,
				children: [
					{
						name: "reference_id",
						type: "string",
						description:
							"Unique reference id created for this account's verification.",
						example: "983654",
					},
					{
						name: "name_at_bank",
						type: "string",
						description: "Account holder name as per bank records.",
						imp: true,
						example: "JOHN DOE",
					},
					{
						name: "bank_name",
						type: "string",
						description: "Name of the financial institution.",
						imp: true,
						example: "STATE BANK OF INDIA",
					},
					{
						name: "utr",
						type: "string",
						description:
							"Unique transaction reference number for the penny-drop credit.",
						example: "SBIN0123456789",
					},
					{
						name: "city",
						type: "string",
						description: "City where the bank branch is located.",
						example: "BANGALORE",
					},
					{
						name: "branch",
						type: "string",
						description: "Bank branch name.",
						example: "MG ROAD",
					},
					{
						name: "micr",
						type: "string",
						description: "MICR (ECS identification) code of the branch.",
						example: "560002001",
					},
					{
						name: "name_match_score",
						type: "string",
						description:
							"Confidence score for the supplied-name vs name-at-bank match.",
						imp: true,
						example: "100",
					},
					{
						name: "name_match_result",
						type: "string",
						description: "Name match result (e.g. MATCH / NO_MATCH).",
						imp: true,
						example: "MATCH",
					},
					{
						name: "account_status",
						type: "string",
						description: "Current status of the bank account verification.",
						imp: true,
						example: "VALID",
					},
					{
						name: "account_status_code",
						type: "number",
						description: "Numeric code representing the account status.",
						example: 0,
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Success",
			response_type_id: 1388,
			data: {
				entries: [
					{
						reference_id: "983654",
						name_at_bank: "JOHN DOE",
						bank_name: "STATE BANK OF INDIA",
						utr: "SBIN0123456789",
						city: "BANGALORE",
						branch: "MG ROAD",
						micr: "560002001",
						name_match_score: "100",
						name_match_result: "MATCH",
						account_status: "VALID",
						account_status_code: 0,
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Missing bulk_reference_id",
				statusCode: 400,
				example: {
					status: 1,
					message: "Bad request — bulk_reference_id is required",
				},
			},
			{
				scenario: "Unknown or expired bulk_reference_id",
				statusCode: 404,
				example: {
					status: 1,
					message: "No batch found for the supplied bulk_reference_id",
				},
			},
		],
	},
	{
		id: "verify-gstin",
		productId: "gst",
		name: "GST Verification",
		slug: "verify-gstin",
		summary:
			"Verify GSTIN details instantly — legal name, trade name, status, address, and filing metadata — for vendor onboarding and compliance checks.",
		description:
			"The GST Verification API validates a GSTIN against official government records and returns the full registration profile: legal and trade names, taxpayer type, constitution of business, nature of activities, registration and last-update dates, state and centre jurisdiction, and the principal place of address (both as a flat string and as structured address components). Designed for KYB, vendor/merchant onboarding, compliance due diligence, and high-volume B2B verification pipelines.",
		relevance: "M",
		bestFor:
			"Vendor and merchant onboarding flows, KYB pipelines, B2B compliance checks, and any workflow that needs to confirm a business's GST registration status before issuing payouts or onboarding a counterparty.",
		method: "POST",
		path: "/tools/kyc/gstin",
		docsUrl: "https://developers.eko.in/reference/verify-gstin",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/gstin/verify-gstin",
		extraRequestParams: [
			{
				name: "gstin",
				type: "string",
				required: true,
				description:
					"Goods and Services Tax Identification Number of the business to verify (15-character alphanumeric).",
				example: "29ABCDE1234F1Z5",
			},
			{
				name: "business_name",
				type: "string",
				required: true,
				description:
					"Name of the business associated with the GSTIN (max 100 characters). Used for cross-reference in the verification response.",
				example: "Acme Pvt Ltd",
			},
		],
		responseData: [
			{
				name: "gstin",
				label: "GSTIN",
				type: "string",
				description:
					"The GSTIN that was verified, echoed back from the government source.",
				imp: true,
				example: "29ABCDE1234F1Z5",
			},
			{
				name: "valid",
				label: "Is GSTIN Valid?",
				type: "boolean",
				description:
					"True if the GSTIN was found and is a valid registered number; false otherwise.",
				imp: true,
				example: true,
			},
			{
				name: "gst_in_status",
				label: "GSTIN Status",
				type: "string",
				description:
					"Current registration status of the GSTIN (e.g. Active, Cancelled, Suspended).",
				imp: true,
				example: "Active",
			},
			{
				name: "legal_name_of_business",
				type: "string",
				description:
					"Official legal name of the business as registered with GST authorities.",
				imp: true,
				example: "Acme Private Limited",
			},
			{
				name: "taxpayer_type",
				type: "string",
				description:
					"Classification of the taxpayer (e.g. Regular, Composition, Non-resident, Casual Taxable Person).",
				imp: true,
				example: "Regular",
			},
			{
				name: "constitution_of_business",
				type: "string",
				description:
					"Legal structure / constitution of the business (e.g. Private Limited Company, Proprietorship, Partnership).",
				imp: true,
				example: "Private Limited Company",
			},
			{
				name: "date_of_registration",
				type: "string",
				description:
					"Date on which the GSTIN was registered (DD/MM/YYYY format).",
				imp: true,
				example: "01/07/2017",
			},
			{
				name: "last_update_date",
				type: "string",
				description:
					"Date of the most recent update to the GST registration record (DD/MM/YYYY format).",
				imp: true,
				example: "01/02/2022",
			},
			{
				name: "cancellation_date",
				type: "string",
				description:
					"Date of cancellation of the GST registration, if applicable. Empty string or null for active registrations.",
				imp: true,
				example: "",
			},
			{
				name: "nature_of_business_activities",
				type: "string",
				description:
					"Comma-separated list of business activity categories as declared during GST registration (e.g. Wholesale, Supplier of Services, Recipient of Goods or Services).",
				imp: true,
				example:
					"Wholesale, Supplier of Services, Recipient of Goods or Services",
			},
			{
				name: "state_jurisdiction",
				type: "string",
				description:
					"State GST authority / jurisdiction under which the GSTIN is registered.",
				imp: true,
				example: "Karnataka",
			},
			{
				name: "center_jurisdiction",
				type: "string",
				description:
					"Central GST authority / jurisdictional commissionerate for the registered business.",
				example: "Commissionerate of Central Tax, Bangalore",
			},
			{
				name: "principal_place_address",
				type: "string",
				description:
					"Principal place of business address as a single formatted string.",
				imp: true,
				example: "123, MG Road, Bangalore, Karnataka 560001",
			},
			{
				name: "principal_place_split_address",
				type: "object",
				description:
					"Principal place of business address broken into structured components.",
				imp: true,
				children: [
					{
						name: "flat_number",
						type: "string",
						description: "Flat, door, or unit number.",
						example: "123",
					},
					{
						name: "building_name",
						type: "string",
						description: "Name of the building or premises.",
						example: "MG Towers",
					},
					{
						name: "street",
						type: "string",
						description: "Street or road name.",
						example: "MG Road",
					},
					{
						name: "location",
						type: "string",
						description: "Locality or neighbourhood identifier.",
						example: "Bangalore",
					},
					{
						name: "city",
						type: "string",
						description: "City name.",
						example: "Bangalore",
					},
					{
						name: "district",
						type: "string",
						description: "District name.",
						example: "Bangalore Urban",
					},
					{
						name: "state",
						type: "string",
						description: "State name.",
						example: "Karnataka",
					},
					{
						name: "pincode",
						type: "string",
						description: "Postal / ZIP code.",
						example: "560001",
					},
					{
						name: "latitude",
						type: "number",
						description:
							"Geographic latitude of the principal place of business.",
						example: 12.9716,
					},
					{
						name: "longitude",
						type: "number",
						description:
							"Geographic longitude of the principal place of business.",
						example: 77.5946,
					},
				],
			},
			{
				name: "additional_address_array",
				type: "array",
				description:
					"Array of additional registered places of business. Each element has the same structure as principal_place_split_address plus a flat address string.",
				children: [
					{
						name: "flat_number",
						type: "string",
						description:
							"Flat, door, or unit number of the additional address.",
						example: "B-201",
					},
					{
						name: "building_name",
						type: "string",
						description: "Building name of the additional address.",
						example: "Trade Centre",
					},
					{
						name: "street",
						type: "string",
						description: "Street of the additional address.",
						example: "Ring Road",
					},
					{
						name: "location",
						type: "string",
						description: "Locality of the additional address.",
						example: "Whitefield",
					},
					{
						name: "city",
						type: "string",
						description: "City of the additional address.",
						example: "Bangalore",
					},
					{
						name: "district",
						type: "string",
						description: "District of the additional address.",
						example: "Bangalore Urban",
					},
					{
						name: "state",
						type: "string",
						description: "State of the additional address.",
						example: "Karnataka",
					},
					{
						name: "pincode",
						type: "string",
						description: "Pincode of the additional address.",
						example: "560066",
					},
				],
			},
			{
				name: "message",
				type: "string",
				description: "Verification result message from the data source.",
				example: "GSTIN verification successful",
			},
			{
				name: "status_code",
				type: "number",
				description: "Internal status code from the upstream GST data source.",
				example: 1,
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "GSTIN verification successful",
			response_type_id: 1388,
			data: {
				gstin: "29ABCDE1234F1Z5",
				valid: true,
				gst_in_status: "Active",
				legal_name_of_business: "Acme Private Limited",
				taxpayer_type: "Regular",
				constitution_of_business: "Private Limited Company",
				date_of_registration: "01/07/2017",
				last_update_date: "01/02/2022",
				cancellation_date: "",
				nature_of_business_activities:
					"Wholesale, Supplier of Services, Recipient of Goods or Services",
				state_jurisdiction: "Karnataka",
				center_jurisdiction: "Commissionerate of Central Tax, Bangalore",
				principal_place_address: "123, MG Road, Bangalore, Karnataka 560001",
				principal_place_split_address: {
					flat_number: "123",
					building_name: "MG Towers",
					street: "MG Road",
					location: "Bangalore",
					city: "Bangalore",
					district: "Bangalore Urban",
					state: "Karnataka",
					pincode: "560001",
					latitude: 12.9716,
					longitude: 77.5946,
				},
				additional_address_array: [],
				message: "GSTIN verification successful",
				status_code: 1,
			},
		},
		errorScenarios: [
			{
				scenario: "GSTIN not found / does not exist in government records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "GSTIN doesn't exist",
					response_type_id: 1388,
					data: {
						valid: false,
						gst_in_status: "",
					},
				},
			},
			{
				scenario:
					"Missing required field (gstin or business_name not supplied)",
				statusCode: 400,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Bad request: required parameter missing",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Authentication failure — wrong or expired secret-key / timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Forbidden: invalid authentication credentials",
					data: {},
				},
			},
		],
	},
	{
		id: "gstin-with-pan",
		productId: "gst",
		name: "Fetch GSTINs by PAN",
		slug: "gstin-with-pan",
		summary:
			"Retrieve all GSTINs linked to a given PAN — with their state and status — in a single API call.",
		description:
			"The GSTIN with PAN API accepts a PAN (Permanent Account Number) and returns a list of all GSTIN registrations associated with that PAN across every Indian state and union territory. Each entry in the list includes the GSTIN, its active/inactive status, and the state of registration. Ideal for identifying all GST registrations of a counterparty, detecting multi-state business presence, and de-duplicating vendor or merchant records during onboarding.",
		relevance: "M",
		bestFor:
			"KYB and compliance workflows that need to discover all GST registrations of a business from a single PAN — particularly useful for multi-state vendors, pan-India merchant networks, and supplier due diligence.",
		method: "POST",
		path: "/tools/kyc/gstin-with-pan",
		docsUrl: "https://developers.eko.in/reference/gstin-with-pan",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/pan-to-gstin/fetch-gstin-with-pan",
		extraRequestParams: [
			{
				name: "pan",
				type: "string",
				required: true,
				description:
					"10-character alphanumeric PAN of the business or individual (5 letters, 4 digits, 1 letter).",
				example: "ABCDE1234F",
			},
		],
		responseData: [
			{
				name: "pan",
				label: "PAN Number",
				type: "string",
				description:
					"The PAN submitted in the request, echoed back for reference.",
				imp: true,
				example: "ABCDE1234F",
			},
			{
				name: "gstin_list",
				label: "List of GSTINs",
				type: "array",
				description:
					"List of all GSTIN registrations linked to the given PAN. Each element represents one GST registration across a state.",
				imp: true,
				children: [
					{
						name: "gstin",
						label: "GSTIN",
						type: "string",
						description: "A GSTIN number associated with the PAN.",
						imp: true,
						example: "29ABCDE1234F1Z5",
					},
					{
						name: "status",
						label: "GSTIN Status",
						type: "string",
						description:
							"Current registration status of this GSTIN (e.g. Active, Inactive, Cancelled).",
						imp: true,
						example: "Active",
					},
					{
						name: "state",
						label: "State of Registration",
						type: "string",
						description:
							"Indian state or union territory where this GSTIN is registered.",
						imp: true,
						example: "Maharashtra",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "GSTIN fetch successful",
			response_type_id: 1388,
			data: {
				pan: "ABCDE1234F",
				gstin_list: [
					{
						gstin: "29ABCDE1234F1Z5",
						status: "Active",
						state: "Maharashtra",
					},
					{
						gstin: "27ABCDE1234F1Z2",
						status: "Inactive",
						state: "Karnataka",
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "No GSTINs found for the given PAN",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "No GSTIN found for the provided PAN",
					response_type_id: 1388,
					data: {
						pan: "ABCDE1234F",
						gstin_list: [],
					},
				},
			},
			{
				scenario: "Invalid PAN format",
				statusCode: 400,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Bad request: invalid PAN format",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Authentication failure — wrong or expired secret-key / timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Forbidden: invalid authentication credentials",
					data: {},
				},
			},
		],
	},
	{
		id: "upi-validate-vpa",
		productId: "upi",
		name: "UPI ID (VPA) Verification",
		slug: "upi-validate-vpa",
		summary:
			"Validate a UPI Virtual Payment Address (VPA) and retrieve the registered payee name and mobile number in real time.",
		description:
			"Confirms whether a UPI ID (VPA) is active and returns the verified recipient name and registered mobile number. Use this before initiating any UPI transfer to reduce wrong-payee failures and payment fraud.",
		relevance: "H",
		bestFor:
			"Pre-payment UPI ID validation, bulk payout verification, and assisted-payment flows where the agent must confirm the payee before sending funds.",
		method: "POST",
		path: "/customer/payment/upi/validate-vpa",
		docsUrl: "https://developers.eko.in/reference/upi-validate-vpa",
		extraRequestParams: [
			{
				name: "customer_vpa",
				label: "Customer VPA",
				type: "string",
				required: true,
				description:
					"The UPI Virtual Payment Address (VPA / UPI ID) to validate, e.g. rajesh.kumar@okicici.",
				example: "rajesh.kumar@okicici",
			},
			{
				name: "recipient_mobile",
				type: "string",
				required: true,
				description:
					"Mobile number of the recipient linked to the VPA, used for additional verification.",
				example: "9876543210",
			},
			{
				name: "name",
				type: "string",
				required: true,
				description:
					"Name of the recipient as expected — returned for match validation against the bank-verified payee name.",
				example: "Rajesh Kumar",
			},
			{
				name: "latlong",
				type: "string",
				required: true,
				description:
					"Geo-coordinates of the request origination point (latitude,longitude).",
				example: "28.6139,77.2090",
			},
		],
		responseData: [
			{
				name: "vpa",
				label: "VPA (UPI ID)",
				type: "string",
				description:
					"The validated UPI Virtual Payment Address (VPA / UPI ID) exactly as registered.",
				imp: true,
				example: "rajesh.kumar@okicici",
			},
			{
				name: "valid",
				label: "Is VPA Valid?",
				type: "boolean",
				description:
					"Whether the VPA is active and valid. true = valid VPA; false = invalid or inactive.",
				imp: true,
				example: true,
			},
			{
				name: "recipient_name",
				type: "string",
				description:
					"Verified payee name as returned by the UPI network — use this for name-match checks before payment.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "mobile_number",
				type: "string",
				description: "Registered mobile number linked to the VPA.",
				imp: true,
				example: "9876543210",
			},
			{
				name: "transaction_id",
				type: "string",
				description:
					"Unique transaction / verification request ID generated by Eko's system for audit and support reference.",
				example: "3560508954",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "VPA validation successful",
			response_type_id: 1388,
			data: {
				vpa: "rajesh.kumar@okicici",
				valid: true,
				recipient_name: "Rajesh Kumar",
				mobile_number: "9876543210",
				transaction_id: "3560508954",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or non-existent VPA",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "VPA is invalid or does not exist",
					response_type_id: 1388,
					data: {
						vpa: "invalid.user@okicici",
						valid: false,
						recipient_name: null,
						mobile_number: null,
						transaction_id: "3560508955",
					},
				},
			},
			{
				scenario:
					"Authentication failure — wrong secret-key or stale timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Unauthorized — invalid secret-key or secret-key-timestamp.",
					data: {},
				},
			},
			{
				scenario: "User (retailer) not found",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "User not found",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "driving-license",
		productId: "dl",
		name: "Driving License Verification",
		slug: "driving-license",
		summary:
			"Verify driving license details in real time — holder name, DOB, address, validity, COV/badge class, and status.",
		description:
			"The Driving License Verification API validates a DL number against government records and returns structured identity and entitlement data including the holder's name, father/husband name, date of birth, address, license validity windows (transport and non-transport), class of vehicle (COV) details, and badge information. Ideal for KYC, driver onboarding, and compliance workflows.",
		relevance: "M",
		bestFor:
			"Businesses that onboard drivers, delivery agents, or any user whose identity needs to be confirmed against a government-issued driving license.",
		method: "POST",
		path: "/tools/kyc/driving-license",
		docsUrl: "https://developers.eko.in/reference/driving-license",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/driving-license/verify-driving-licence-details",
		extraRequestParams: [
			{
				name: "dl_number",
				type: "string",
				required: true,
				description: "Driving license number to verify (e.g. MH0220190001234).",
				example: "MH0220190001234",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description:
					"Date of birth of the DL holder in YYYY-MM-DD format. Used to cross-validate the license.",
				example: "1994-08-29",
			},
		],
		responseData: [
			{
				name: "dl_number",
				label: "Driving License Number",
				type: "string",
				description: "The driving license number that was verified.",
				imp: true,
				example: "MH0220190001234",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				description:
					"Date of birth of the DL holder as returned by the authority.",
				imp: true,
				example: "1994-08-29",
			},
			{
				name: "status",
				type: "string",
				description:
					"Overall status of the driving license (e.g. Active, Suspended, Expired).",
				imp: true,
				example: "Active",
			},
			{
				name: "details_of_driving_licence",
				type: "object",
				description:
					"Core identity and administrative details extracted from the DL record.",
				children: [
					{
						name: "name",
						type: "string",
						description: "Full name of the driving license holder.",
						imp: true,
						example: "Rajesh Kumar",
					},
					{
						name: "father_or_husband_name",
						type: "string",
						description: "Father's or husband's name as recorded on the DL.",
						imp: true,
						example: "Suresh Kumar",
					},
					{
						name: "date_of_issue",
						type: "string",
						description:
							"Date the driving license was originally issued (YYYY-MM-DD).",
						imp: true,
						example: "2019-03-15",
					},
					{
						name: "date_of_last_transaction",
						type: "string",
						description:
							"Date of the most recent administrative transaction on the license.",
						example: "2023-01-10",
					},
					{
						name: "last_transacted_at",
						type: "string",
						description:
							"RTO or office where the last transaction was processed.",
						example: "Mumbai RTO",
					},
					{
						name: "status",
						type: "string",
						description:
							"Status of the DL as returned in the detailed record (mirrors top-level status).",
						imp: true,
						example: "Active",
					},
					{
						name: "address_list",
						type: "array",
						description: "List of addresses associated with the DL holder.",
						imp: true,
						children: [
							{
								name: "complete_address",
								type: "string",
								description: "Full address string as recorded on the DL.",
								imp: true,
								example: "123, Andheri West, Mumbai, Maharashtra - 400053",
							},
							{
								name: "type",
								type: "string",
								description: "Address type, e.g. permanent or temporary.",
								example: "permanent",
							},
							{
								name: "split_address",
								type: "object",
								description:
									"Address broken into components (street, city, state, pincode) when available.",
							},
						],
					},
					{
						name: "address",
						type: "string",
						description:
							"Single-string address fallback when address_list is unavailable.",
						example: "123, Andheri West, Mumbai",
					},
					{
						name: "photo",
						type: "string",
						description:
							"Base64-encoded photograph of the DL holder as stored in the authority's database.",
						example: "/9j/4AAQSkZJRgAB...",
					},
					{
						name: "cov_details",
						type: "array",
						description:
							"Class of Vehicle (COV) entitlement records — each entry lists a vehicle class and associated validity.",
						imp: true,
						children: [
							{
								name: "cov",
								type: "string",
								description: "Vehicle class code, e.g. LMV, MCWG, TRANS.",
								imp: true,
								example: "LMV",
							},
							{
								name: "issue_date",
								type: "string",
								description: "Date the COV entitlement was granted.",
								example: "2019-03-15",
							},
						],
					},
				],
			},
			{
				name: "dl_validity",
				type: "object",
				description:
					"Validity windows for transport and non-transport license categories.",
				imp: true,
				children: [
					{
						name: "non_transport",
						type: "object",
						description:
							"Validity period for non-transport (personal) vehicle authorisation.",
						imp: true,
						children: [
							{
								name: "from",
								type: "string",
								description: "Non-transport validity start date (YYYY-MM-DD).",
								imp: true,
								example: "2019-03-15",
							},
							{
								name: "to",
								type: "string",
								description: "Non-transport validity end date (YYYY-MM-DD).",
								imp: true,
								example: "2039-03-14",
							},
						],
					},
					{
						name: "transport",
						type: "object",
						description:
							"Validity period for transport (commercial) vehicle authorisation.",
						imp: true,
						children: [
							{
								name: "from",
								type: "string",
								description: "Transport validity start date (YYYY-MM-DD).",
								imp: true,
								example: "2019-03-15",
							},
							{
								name: "to",
								type: "string",
								description: "Transport validity end date (YYYY-MM-DD).",
								imp: true,
								example: "2024-03-14",
							},
						],
					},
					{
						name: "hazardous_valid_till",
						type: "string",
						description:
							"Date until which the hazardous-goods endorsement is valid, if applicable.",
						example: "2024-03-14",
					},
					{
						name: "hill_valid_till",
						type: "string",
						description:
							"Date until which the hill-driving endorsement is valid, if applicable.",
						example: "2024-03-14",
					},
				],
			},
			{
				name: "badge_details",
				type: "array",
				description:
					"Badge/transport endorsement records, each describing a permitted vehicle class group.",
				imp: true,
				children: [
					{
						name: "badge_no",
						type: "string",
						description: "Badge number assigned by the transport authority.",
						imp: true,
						example: "MH-BADGE-001",
					},
					{
						name: "badge_issue_date",
						type: "string",
						description: "Date the badge was issued.",
						example: "2019-03-15",
					},
					{
						name: "class_of_vehicle",
						type: "array",
						description:
							"List of vehicle classes covered under this badge (e.g. LMV, MCWG, TRANS).",
						imp: true,
						example: ["LMV", "MCWG"],
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "DL verification successful",
			response_type_id: 1388,
			data: {
				dl_number: "MH0220190001234",
				dob: "1994-08-29",
				status: "Active",
				details_of_driving_licence: {
					name: "Rajesh Kumar",
					father_or_husband_name: "Suresh Kumar",
					date_of_issue: "2019-03-15",
					date_of_last_transaction: "2023-01-10",
					last_transacted_at: "Mumbai RTO",
					status: "Active",
					address_list: [
						{
							complete_address:
								"123, Andheri West, Mumbai, Maharashtra - 400053",
							type: "permanent",
							split_address: {},
						},
					],
					address: "123, Andheri West, Mumbai",
					photo: "/9j/4AAQSkZJRgAB...",
					cov_details: [
						{
							cov: "LMV",
							issue_date: "2019-03-15",
						},
						{
							cov: "MCWG",
							issue_date: "2019-03-15",
						},
					],
				},
				dl_validity: {
					non_transport: {
						from: "2019-03-15",
						to: "2039-03-14",
					},
					transport: {
						from: "2019-03-15",
						to: "2024-03-14",
					},
					hazardous_valid_till: null,
					hill_valid_till: null,
				},
				badge_details: [
					{
						badge_no: "MH-BADGE-001",
						badge_issue_date: "2019-03-15",
						class_of_vehicle: ["LMV", "MCWG"],
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "DL number not found in government records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "No record found for the provided DL number",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"DOB mismatch — provided DOB does not match authority records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Date of birth does not match DL records",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Invalid DL number format",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Invalid driving license number format",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					message: "Unauthorized: invalid secret-key or timestamp",
				},
			},
			{
				scenario: "Upstream authority service temporarily unavailable",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Source unavailable. Please try again.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "vehicle-rc",
		productId: "rc",
		name: "Vehicle & RC Verification",
		slug: "vehicle-rc",
		summary:
			"Verify a vehicle's registration certificate (RC) in real time — owner details, chassis/engine numbers, insurance validity, blacklist status, permits, fitness, and financier info via the VAHAN national database.",
		description:
			"Send a vehicle registration number and receive a comprehensive RC dataset in a single API call. The response covers ownership (name, father's name, address), registration details (authority, dates, expiry), insurance (company, policy number, validity), compliance (blacklist, challan, PUCC, emission norms), commercial-vehicle specifics (permit type/validity, fitness certificate, national permit, tax status), and financier information. Pan-India coverage via the VAHAN database makes it suitable for driver onboarding, fleet monitoring, motor insurance underwriting, vehicle finance, and used-car platforms. Source (VAHAN) data typically reflects real-world changes within 15–30 days.",
		relevance: "M",
		bestFor:
			"Mobility platforms, logistics companies, fleet operators, motor insurers, vehicle finance and lending platforms, used-car marketplaces.",
		method: "POST",
		path: "/tools/kyc/vehicle-rc",
		docsUrl: "https://developers.eko.in/reference/vehicle-rc",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/vehicle-rc/get-vehicle-rc-details-1",
		extraRequestParams: [
			{
				name: "vehicle_number",
				type: "string",
				required: true,
				description: "Vehicle registration number to verify (e.g. HR26DA8398).",
				example: "HR26DA8398",
			},
		],
		responseData: [
			{
				name: "reference_id",
				type: "string",
				description:
					"Unique reference ID for this verification request returned by Eko.",
				example: "EKO-RC-9876543210-001",
			},
			{
				name: "status",
				type: "string",
				description: "Verification status string (e.g. 'Active', 'Inactive').",
				imp: true,
				example: "Active",
			},
			{
				name: "reg_no",
				label: "Vehicle Registration Number",
				type: "string",
				description:
					"Vehicle registration number as recorded in the VAHAN database.",
				imp: true,
				example: "HR26DA8398",
			},
			{
				name: "rc_status",
				label: "RC Status",
				type: "string",
				description:
					"Current RC status — 'Active', 'Inactive', 'Suspended', etc.",
				imp: true,
				example: "Active",
			},
			{
				name: "status_as_on",
				type: "string",
				description: "Date on which the RC status was last updated.",
				example: "2024-01-01",
			},
			{
				name: "owner",
				type: "string",
				description: "Full name of the registered owner of the vehicle.",
				imp: true,
				example: "Arya Sharma",
			},
			{
				name: "owner_father_name",
				label: "Father's Name of Owner",
				type: "string",
				description: "Father's name of the registered owner.",
				imp: true,
				example: "Rajesh Sharma",
			},
			{
				name: "owner_count",
				type: "number",
				description: "Number of previous owners, including the current one.",
				example: 1,
			},
			{
				name: "mobile_number",
				type: "string",
				description:
					"Mobile number of the owner as registered with the RTO, if available.",
				example: "98XXXXXXXX",
			},
			{
				name: "present_address",
				type: "string",
				description: "Present address of the owner as a single string.",
				imp: true,
				example: "123, Sector 45, Gurgaon, Haryana 122003",
			},
			{
				name: "split_present_address",
				type: "object",
				description: "Present address broken into structured components.",
				imp: true,
				children: [
					{
						name: "house_flat_number",
						type: "string",
						description: "House/flat number.",
						example: "123",
					},
					{
						name: "street",
						type: "string",
						description: "Street or locality.",
						example: "Sector 45",
					},
					{
						name: "city",
						type: "string",
						description: "City name.",
						example: "Gurgaon",
					},
					{
						name: "state",
						type: "string",
						description: "State name.",
						example: "Haryana",
					},
					{
						name: "pincode",
						type: "string",
						description: "PIN code.",
						example: "122003",
					},
				],
			},
			{
				name: "permanent_address",
				type: "string",
				description: "Permanent address of the owner as a single string.",
				imp: true,
				example: "456, MG Road, Gurgaon, Haryana 122001",
			},
			{
				name: "split_permanent_address",
				type: "object",
				description: "Permanent address broken into structured components.",
				imp: true,
				children: [
					{
						name: "house_flat_number",
						type: "string",
						description: "House/flat number.",
						example: "456",
					},
					{
						name: "street",
						type: "string",
						description: "Street or locality.",
						example: "MG Road",
					},
					{
						name: "city",
						type: "string",
						description: "City name.",
						example: "Gurgaon",
					},
					{
						name: "state",
						type: "string",
						description: "State name.",
						example: "Haryana",
					},
					{
						name: "pincode",
						type: "string",
						description: "PIN code.",
						example: "122001",
					},
				],
			},
			{
				name: "reg_authority",
				label: "Registration Authority (RTO)",
				type: "string",
				description: "Regional Transport Office (RTO) that issued the RC.",
				imp: true,
				example: "HR-26 Gurgaon",
			},
			{
				name: "reg_date",
				label: "Date of Registration",
				type: "string",
				description: "Date of first registration of the vehicle (YYYY-MM-DD).",
				imp: true,
				example: "2020-06-15",
			},
			{
				name: "rc_expiry_date",
				label: "RC Expiry Date",
				type: "string",
				description:
					"RC validity expiry date (YYYY-MM-DD). Private vehicles are typically 15 years from registration.",
				imp: true,
				example: "2039-06-14",
			},
			{
				name: "class",
				type: "string",
				description:
					"Vehicle class as registered with the RTO (e.g. 'Motor Car', 'LMV', 'HTV').",
				imp: true,
				example: "Motor Car",
			},
			{
				name: "vehicle_category",
				type: "string",
				description:
					"High-level vehicle category (e.g. 'LMV', 'HMV', 'M-Cycle').",
				example: "LMV",
			},
			{
				name: "type",
				type: "string",
				description: "Ownership type — 'Private' or 'Commercial'.",
				imp: true,
				example: "Private",
			},
			{
				name: "is_commercial",
				label: "Is Commercial Vehicle?",
				type: "boolean",
				description: "True if the vehicle is registered for commercial use.",
				imp: true,
				example: false,
			},
			{
				name: "vehicle_manufacturer_name",
				type: "string",
				description: "Manufacturer / make of the vehicle.",
				imp: true,
				example: "Mahindra & Mahindra",
			},
			{
				name: "model",
				type: "string",
				description: "Vehicle model name.",
				imp: true,
				example: "XUV300",
			},
			{
				name: "body_type",
				type: "string",
				description:
					"Body type of the vehicle (e.g. 'Hard Top', 'Open Body', 'Tipper').",
				example: "Hard Top",
			},
			{
				name: "vehicle_color",
				type: "string",
				description: "Color of the vehicle as registered.",
				example: "Dark Grey",
			},
			{
				name: "fuel_type",
				type: "string",
				description: "Fuel type — 'Petrol', 'Diesel', 'CNG', 'Electric', etc.",
				imp: true,
				example: "Petrol",
			},
			{
				name: "norms_type",
				type: "string",
				description:
					"Emission standard the vehicle complies with (e.g. 'Bharat Stage VI').",
				imp: true,
				example: "Bharat Stage VI",
			},
			{
				name: "emission_norms",
				type: "string",
				description:
					"Human-readable emission norms label returned in some responses.",
				example: "Bharat Stage VI",
			},
			{
				name: "chassis",
				type: "string",
				description: "Chassis number of the vehicle as per RC.",
				imp: true,
				example: "MA1TE2ELXLM123456",
			},
			{
				name: "engine",
				type: "string",
				description: "Engine number of the vehicle as per RC.",
				imp: true,
				example: "N10A1234567",
			},
			{
				name: "vehicle_manufacturing_month_year",
				label: "Manufacturing Month and Year",
				type: "string",
				description: "Month and year of vehicle manufacture.",
				example: "May 2020",
			},
			{
				name: "vehicle_cubic_capacity",
				type: "string",
				description: "Engine cubic capacity in cc.",
				example: "1497",
			},
			{
				name: "vehicle_cylinders_no",
				type: "string",
				description: "Number of cylinders in the engine.",
				example: "4",
			},
			{
				name: "vehicle_seat_capacity",
				type: "string",
				description: "Seating capacity of the vehicle.",
				example: "5",
			},
			{
				name: "vehicle_sleeper_capacity",
				type: "string",
				description: "Sleeper capacity (relevant for transport/bus vehicles).",
				example: "0",
			},
			{
				name: "vehicle_standing_capacity",
				type: "string",
				description: "Standing capacity (relevant for buses).",
				example: "0",
			},
			{
				name: "gross_vehicle_weight",
				type: "string",
				description: "Gross vehicle weight in kg.",
				example: "1680",
			},
			{
				name: "unladen_weight",
				type: "string",
				description: "Unladen (kerb) weight of the vehicle in kg.",
				example: "1230",
			},
			{
				name: "wheelbase",
				type: "string",
				description: "Wheelbase of the vehicle in mm.",
				example: "2600",
			},
			{
				name: "vehicle_insurance_company_name",
				type: "string",
				description:
					"Name of the insurance company that issued the current motor policy.",
				imp: true,
				example: "Tata AIG General Insurance",
			},
			{
				name: "vehicle_insurance_policy_number",
				type: "string",
				description: "Insurance policy number.",
				imp: true,
				example: "0165274682",
			},
			{
				name: "vehicle_insurance_upto",
				type: "string",
				description:
					"Insurance validity date (YYYY-MM-DD). Check against today to flag lapsed policies.",
				imp: true,
				example: "2025-06-14",
			},
			{
				name: "rc_financer",
				label: "RC Financier",
				type: "string",
				description:
					"Name of the financier / lending institution if the vehicle is under a loan.",
				imp: true,
				example: "HDFC Bank Ltd",
			},
			{
				name: "vehicle_tax_upto",
				type: "string",
				description: "Road tax validity date.",
				example: "2024-06-14",
			},
			{
				name: "pucc_number",
				label: "PUCC Number",
				type: "string",
				description: "Pollution Under Control Certificate (PUCC) number.",
				example: "DL-EW-123456",
			},
			{
				name: "pucc_upto",
				type: "string",
				description: "PUCC validity date.",
				example: "2024-12-31",
			},
			{
				name: "blacklist_status",
				type: "string",
				description:
					"Whether the vehicle appears on a blacklist — 'Not Blacklisted' or 'Blacklisted'.",
				imp: true,
				example: "Not Blacklisted",
			},
			{
				name: "blacklist_details",
				type: "object",
				description:
					"Detailed blacklist information; populated only if the vehicle is blacklisted.",
				children: [
					{
						name: "reason",
						type: "string",
						description: "Reason for blacklisting.",
						imp: true,
						example: "Unpaid challan",
					},
					{
						name: "authority",
						type: "string",
						description: "Authority that issued the blacklist order.",
						example: "RTO Gurgaon",
					},
				],
			},
			{
				name: "challan_details",
				type: "object",
				description: "Pending traffic challan information, if any.",
				children: [
					{
						name: "challan_no",
						type: "string",
						description: "Challan number.",
						example: "CH20240001",
					},
					{
						name: "amount",
						type: "string",
						description: "Challan amount in INR.",
						example: "2000",
					},
					{
						name: "status",
						type: "string",
						description: "Challan payment status.",
						example: "Pending",
					},
				],
			},
			{
				name: "noc_details",
				type: "string",
				description: "No Objection Certificate details, if applicable.",
				example: null,
			},
			{
				name: "non_use_status",
				type: "string",
				description: "Indicates if the vehicle has been declared 'non-use'.",
				example: null,
			},
			{
				name: "non_use_from",
				type: "string",
				description: "Start date of the non-use period, if applicable.",
				example: null,
			},
			{
				name: "non_use_to",
				type: "string",
				description: "End date of the non-use period, if applicable.",
				example: null,
			},
			{
				name: "permit_number",
				type: "string",
				description: "State permit number (commercial vehicles only).",
				example: "HR/P/2021/00123",
			},
			{
				name: "permit_type",
				type: "string",
				description:
					"Type of permit — e.g. 'Tourist', 'Contract Carriage', 'Goods'.",
				imp: true,
				example: "Tourist",
			},
			{
				name: "permit_issue_date",
				type: "string",
				description: "Date on which the permit was issued.",
				example: "2021-03-01",
			},
			{
				name: "permit_valid_from",
				type: "string",
				description: "Permit validity start date.",
				example: "2021-03-01",
			},
			{
				name: "permit_valid_upto",
				type: "string",
				description: "Permit validity end date.",
				imp: true,
				example: "2026-02-28",
			},
			{
				name: "national_permit_number",
				type: "string",
				description:
					"National permit number for goods/transport vehicles operating across states.",
				example: "NP/HR/2021/00456",
			},
			{
				name: "national_permit_upto",
				type: "string",
				description: "National permit validity date.",
				imp: true,
				example: "2026-02-28",
			},
			{
				name: "national_permit_issued_by",
				type: "string",
				description: "State authority that issued the national permit.",
				example: "HR-26 Gurgaon",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Vehicle RC verification successful",
			response_type_id: 1388,
			data: {
				reference_id: "EKO-RC-9876543210-001",
				status: "Active",
				reg_no: "HR26DA8398",
				rc_status: "Active",
				status_as_on: "2024-01-01",
				owner: "Arya Sharma",
				owner_father_name: "Rajesh Sharma",
				owner_count: 1,
				mobile_number: "98XXXXXXXX",
				present_address: "123, Sector 45, Gurgaon, Haryana 122003",
				split_present_address: {
					house_flat_number: "123",
					street: "Sector 45",
					city: "Gurgaon",
					state: "Haryana",
					pincode: "122003",
				},
				permanent_address: "456, MG Road, Gurgaon, Haryana 122001",
				split_permanent_address: {
					house_flat_number: "456",
					street: "MG Road",
					city: "Gurgaon",
					state: "Haryana",
					pincode: "122001",
				},
				reg_authority: "HR-26 Gurgaon",
				reg_date: "2020-06-15",
				rc_expiry_date: "2039-06-14",
				class: "Motor Car",
				vehicle_category: "LMV",
				type: "Private",
				is_commercial: false,
				vehicle_manufacturer_name: "Mahindra & Mahindra",
				model: "XUV300",
				body_type: "Hard Top",
				vehicle_color: "Dark Grey",
				fuel_type: "Petrol",
				norms_type: "Bharat Stage VI",
				emission_norms: "Bharat Stage VI",
				chassis: "MA1TE2ELXLM123456",
				engine: "N10A1234567",
				vehicle_manufacturing_month_year: "May 2020",
				vehicle_cubic_capacity: "1497",
				vehicle_cylinders_no: "4",
				vehicle_seat_capacity: "5",
				vehicle_sleeper_capacity: "0",
				vehicle_standing_capacity: "0",
				gross_vehicle_weight: "1680",
				unladen_weight: "1230",
				wheelbase: "2600",
				vehicle_insurance_company_name: "Tata AIG General Insurance",
				vehicle_insurance_policy_number: "0165274682",
				vehicle_insurance_upto: "2025-06-14",
				rc_financer: "HDFC Bank Ltd",
				vehicle_tax_upto: "2024-06-14",
				pucc_number: "DL-EW-123456",
				pucc_upto: "2024-12-31",
				blacklist_status: "Not Blacklisted",
				blacklist_details: {},
				challan_details: {},
				noc_details: null,
				non_use_status: null,
				non_use_from: null,
				non_use_to: null,
				permit_number: null,
				permit_type: null,
				permit_issue_date: null,
				permit_valid_from: null,
				permit_valid_upto: null,
				national_permit_number: null,
				national_permit_upto: null,
				national_permit_issued_by: null,
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or unrecognised vehicle number",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Vehicle number not found in VAHAN database",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Missing required parameter (vehicle_number not supplied)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "vehicle_number is required",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong or expired secret-key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden: invalid secret-key or timestamp mismatch",
				},
			},
			{
				scenario: "VAHAN source temporarily unavailable",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Source temporarily unavailable. Please try again.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "advance-employment",
		productId: "employee",
		name: "Employee Verification (Advance)",
		slug: "advance-employment",
		summary:
			"Verify employment history and employee identity by phone number via EPFO/UAN data.",
		description:
			"Returns a rich, nested profile linked to the employee's Universal Account Number (UAN): basic identity details (name, gender, DOB, Aadhaar link), full employment history per UAN (member ID, establishment, joining/exit dates, leave reason), additional PII (PAN, bank account, email), and a structured recent-employment block that includes EPFO filing health, employer setup date, ownership type, and monthly PF contribution records. Designed for pre-employment checks, lending underwriting, and HR compliance workflows.",
		relevance: "M",
		bestFor:
			"Organizations that need to confirm employment history, tenure, and PF filing status digitally — without manual document collection.",
		method: "POST",
		path: "/tools/kyc/advance-employment",
		docsUrl: "https://developers.eko.in/reference/advance-employment",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/advanced-employment/get-employment-details",
		extraRequestParams: [
			{
				name: "phone",
				type: "string",
				required: true,
				description:
					"Employee's registered mobile number used to look up UAN records from EPFO.",
				example: "9876543210",
			},
		],
		responseData: [
			{
				name: "input",
				type: "object",
				description: "Echo of the input parameters sent in the request.",
				example: {},
			},
			{
				name: "uan_details",
				label: "UAN Records",
				type: "array",
				description:
					"List of UAN records associated with the employee's phone number. One entry per UAN.",
				imp: true,
				children: [
					{
						name: "uan",
						label: "Universal Account Number (UAN)",
						type: "string",
						description:
							"Universal Account Number assigned to the employee by EPFO.",
						imp: true,
						example: "1001234567890",
					},
					{
						name: "source",
						type: "string",
						description: "Data source from which the UAN record was fetched.",
						example: "EPFO",
					},
					{
						name: "source_score",
						type: "number",
						description: "Confidence score of the data source match (0–100).",
						example: 95,
					},
					{
						name: "basic_details",
						type: "object",
						description:
							"Core identity details of the employee linked to this UAN.",
						imp: true,
						children: [
							{
								name: "employee_name",
								type: "string",
								description:
									"Full name of the employee as registered with EPFO.",
								imp: true,
								example: "Rajesh Kumar",
							},
							{
								name: "gender",
								type: "string",
								description: "Gender of the employee.",
								imp: true,
								example: "Male",
							},
							{
								name: "dob",
								label: "Employee's DOB",
								type: "string",
								description:
									"Date of birth of the employee in YYYY-MM-DD format.",
								imp: true,
								example: "1994-08-29",
							},
							{
								name: "phone",
								type: "string",
								description: "Phone number linked to this UAN.",
								example: "9876543210",
							},
							{
								name: "aadhaar_verified",
								label: "Is Aadhaar Verified?",
								type: "boolean",
								description:
									"Whether the employee's Aadhaar is linked and verified against this UAN.",
								imp: true,
								example: false,
							},
							{
								name: "employee_confidence_score",
								type: "number",
								description:
									"Model confidence score for the employee identity match (0–100).",
								example: 88,
							},
						],
					},
					{
						name: "employment_details",
						type: "object",
						description: "Employment record associated with this UAN entry.",
						imp: true,
						children: [
							{
								name: "member_id",
								type: "string",
								description:
									"PF Member ID for this employment record (state/region/establishment/account format).",
								imp: true,
								example: "MH/BOM/12345/000/0000001",
							},
							{
								name: "establishment_id",
								type: "string",
								description: "EPFO establishment ID of the employer.",
								imp: true,
								example: "MHBAN0012345000",
							},
							{
								name: "establishment_name",
								type: "string",
								description:
									"Name of the employer/establishment as registered with EPFO.",
								imp: true,
								example: "Acme Pvt Ltd",
							},
							{
								name: "joining_date",
								type: "string",
								description:
									"Date the employee joined this establishment (YYYY-MM-DD).",
								imp: true,
								example: "2019-04-01",
							},
							{
								name: "exit_date",
								type: "string",
								description:
									"Date the employee exited this establishment (YYYY-MM-DD). Null if currently employed.",
								imp: true,
								example: "2023-06-30",
							},
							{
								name: "leave_reason",
								type: "string",
								description:
									"Reason for exit as recorded in EPFO (e.g., Resignation, Superannuation).",
								imp: true,
								example: "Resignation",
							},
							{
								name: "employer_confidence_score",
								type: "number",
								description:
									"Confidence score for the employer identity match (0–100).",
								example: 90,
							},
						],
					},
					{
						name: "additional_details",
						type: "object",
						description:
							"Supplementary PII and financial details linked to the UAN (may be partially populated).",
						children: [
							{
								name: "pan",
								label: "PAN Number",
								type: "string",
								description: "PAN number linked to the employee.",
								imp: true,
								example: "ABCDE1234F",
							},
							{
								name: "aadhaar",
								type: "string",
								description: "Masked or partial Aadhaar number.",
								example: "XXXX-XXXX-1234",
							},
							{
								name: "email",
								type: "string",
								description: "Email address linked to the UAN.",
								example: "rajesh.kumar@example.com",
							},
							{
								name: "ifsc",
								type: "string",
								description: "IFSC code of the linked bank account.",
								example: "HDFC0001234",
							},
							{
								name: "bank_account",
								type: "string",
								description: "Masked bank account number linked to the UAN.",
								example: "XXXX1234",
							},
							{
								name: "bank_address",
								type: "string",
								description: "Address of the linked bank branch.",
								example: "HDFC Bank, Andheri West, Mumbai",
							},
							{
								name: "relative_name",
								type: "string",
								description: "Name of the declared relative/nominee.",
								example: "Sunita Kumar",
							},
							{
								name: "relation",
								type: "string",
								description: "Relationship of the nominee to the employee.",
								example: "Spouse",
							},
						],
					},
				],
			},
			{
				name: "recent_employment_details",
				type: "object",
				description:
					"Structured summary of the most recent employment, including EPFO health indicators and employer PF filing history.",
				imp: true,
				children: [
					{
						name: "employee_details",
						type: "object",
						description:
							"Latest employment record for the employee with EPFO flags.",
						imp: true,
						children: [
							{
								name: "uan",
								label: "Universal Account Number (UAN)",
								type: "string",
								description: "UAN for the most recent employment.",
								imp: true,
								example: "1001234567890",
							},
							{
								name: "member_id",
								type: "string",
								description: "PF Member ID for the most recent establishment.",
								imp: true,
								example: "MH/BOM/12345/000/0000001",
							},
							{
								name: "joining_date",
								type: "string",
								description:
									"Joining date for the most recent employment (YYYY-MM-DD).",
								imp: true,
								example: "2019-04-01",
							},
							{
								name: "exit_date",
								type: "string",
								description:
									"Exit date for the most recent employment (YYYY-MM-DD). Null if currently active.",
								imp: true,
								example: "2023-06-30",
							},
							{
								name: "employed",
								label: "Is Currently Employed?",
								type: "boolean",
								description:
									"Whether the employee is currently active in this establishment per EPFO records.",
								imp: true,
								example: false,
							},
							{
								name: "exit_date_marked",
								type: "boolean",
								description:
									"Whether the employer has formally marked an exit date in EPFO.",
								imp: true,
								example: true,
							},
							{
								name: "employee_name_match",
								type: "boolean",
								description:
									"Whether the name in EPFO matches the name provided or derived from the phone lookup.",
								imp: true,
								example: true,
							},
							{
								name: "epfo",
								type: "object",
								description:
									"EPFO-level flags indicating data quality and filing health.",
								imp: true,
								children: [
									{
										name: "recent",
										type: "boolean",
										description:
											"Whether EPFO data for this employee was recently updated.",
										imp: true,
										example: true,
									},
									{
										name: "name_unique",
										type: "boolean",
										description:
											"Whether the employee's name appears uniquely in EPFO (no duplicates).",
										imp: true,
										example: true,
									},
									{
										name: "pf_filings_details",
										type: "boolean",
										description:
											"Whether PF filing details are available for this employee.",
										imp: true,
										example: true,
									},
								],
							},
						],
					},
					{
						name: "employer_details",
						type: "object",
						description:
							"Details of the most recent employer including setup date, ownership type, and monthly PF contribution history.",
						imp: true,
						children: [
							{
								name: "establishment_id",
								type: "string",
								description:
									"EPFO establishment ID of the most recent employer.",
								imp: true,
								example: "MHBAN0012345000",
							},
							{
								name: "establishment_name",
								type: "string",
								description:
									"Name of the most recent employer as registered with EPFO.",
								imp: true,
								example: "Acme Pvt Ltd",
							},
							{
								name: "setup_date",
								type: "string",
								description:
									"Date the employer establishment was set up/registered with EPFO.",
								imp: true,
								example: "2005-03-15",
							},
							{
								name: "ownership_type",
								type: "string",
								description:
									"Ownership type of the establishment (e.g., Private, Government, Public Sector).",
								imp: true,
								example: "Private",
							},
							{
								name: "employer_confidence_score",
								type: "number",
								description:
									"Model confidence score for employer identity resolution (0–100).",
								example: 90,
							},
							{
								name: "employer_name_match",
								type: "boolean",
								description:
									"Whether the resolved employer name matches the expected employer name.",
								imp: true,
								example: true,
							},
							{
								name: "pf_filing_details",
								label: "PF Filing History",
								type: "array",
								description:
									"Monthly PF contribution records filed by the employer. Each entry represents one wage month.",
								imp: true,
								children: [
									{
										name: "wage_month",
										type: "string",
										description:
											"The wage month for this PF filing entry (YYYY-MM format).",
										imp: true,
										example: "2023-05",
									},
									{
										name: "total_amount",
										type: "number",
										description:
											"Total PF amount contributed by the employer for this wage month.",
										imp: true,
										example: 1800,
									},
									{
										name: "employees_count",
										type: "number",
										description:
											"Number of employees covered under this PF filing for the wage month.",
										imp: true,
										example: 120,
									},
								],
							},
						],
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Employee verification successful",
			response_type_id: 1388,
			data: {
				input: {
					phone: "9876543210",
				},
				uan_details: [
					{
						uan: "1001234567890",
						source: "EPFO",
						source_score: 95,
						basic_details: {
							employee_name: "Rajesh Kumar",
							gender: "Male",
							dob: "1994-08-29",
							phone: "9876543210",
							aadhaar_verified: false,
							employee_confidence_score: 88,
						},
						employment_details: {
							member_id: "MH/BOM/12345/000/0000001",
							establishment_id: "MHBAN0012345000",
							establishment_name: "Acme Pvt Ltd",
							joining_date: "2019-04-01",
							exit_date: "2023-06-30",
							leave_reason: "Resignation",
							employer_confidence_score: 90,
						},
						additional_details: {
							pan: "ABCDE1234F",
							aadhaar: "XXXX-XXXX-1234",
							email: "rajesh.kumar@example.com",
							ifsc: "HDFC0001234",
							bank_account: "XXXX1234",
							bank_address: "HDFC Bank, Andheri West, Mumbai",
							relative_name: "Sunita Kumar",
							relation: "Spouse",
						},
					},
				],
				recent_employment_details: {
					employee_details: {
						uan: "1001234567890",
						member_id: "MH/BOM/12345/000/0000001",
						joining_date: "2019-04-01",
						exit_date: "2023-06-30",
						employed: false,
						exit_date_marked: true,
						employee_name_match: true,
						epfo: {
							recent: true,
							name_unique: true,
							pf_filings_details: true,
						},
					},
					employer_details: {
						establishment_id: "MHBAN0012345000",
						establishment_name: "Acme Pvt Ltd",
						setup_date: "2005-03-15",
						ownership_type: "Private",
						employer_confidence_score: 90,
						employer_name_match: true,
						pf_filing_details: [
							{
								wage_month: "2023-05",
								total_amount: 1800,
								employees_count: 120,
							},
							{
								wage_month: "2023-04",
								total_amount: 1800,
								employees_count: 118,
							},
							{
								wage_month: "2023-03",
								total_amount: 1750,
								employees_count: 115,
							},
						],
					},
				},
			},
		},
		errorScenarios: [
			{
				scenario: "Phone number not linked to any UAN in EPFO records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "No UAN found for the provided phone number",
					response_type_id: 1388,
					data: {
						uan_details: [],
						recent_employment_details: null,
					},
				},
			},
			{
				scenario: "Missing required parameter (phone)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "phone is required",
					response_type_id: 1388,
					data: null,
				},
			},
			{
				scenario: "Invalid or unauthorized developer key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden: invalid developer_key or secret-key",
				},
			},
		],
	},
	{
		id: "reverse-geocoding",
		productId: "geocoding",
		name: "Reverse Geocoding",
		slug: "reverse-geocoding",
		summary:
			"Convert latitude and longitude coordinates into structured Indian address data including locality, city, state, PIN code, and country.",
		description:
			"The Reverse Geocoding API translates GPS coordinates into a human-readable, structured address. It is designed for address validation during onboarding, geo-compliance checks, field-agent location verification, and location-based fraud detection workflows. Pass a latitude/longitude pair and receive a normalised address broken down by locality, city, district, state, PIN code, and country — along with a confidence score.",
		relevance: "M",
		bestFor:
			"Cross-checking customer-provided addresses against GPS-derived data for onboarding, KYC, and fraud prevention.",
		method: "POST",
		path: "/tools/kyc/reverse-geocoding",
		docsUrl: "https://developers.eko.in/reference/reverse-geocoding",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/reverse-geocoding/reverse-geocoding",
		extraRequestParams: [
			{
				name: "latitude",
				type: "string",
				required: true,
				description:
					"Geolocation latitude of the point to resolve (decimal degrees).",
				example: "19.0760",
			},
			{
				name: "longitude",
				type: "string",
				required: true,
				description:
					"Geolocation longitude of the point to resolve (decimal degrees).",
				example: "72.8777",
			},
		],
		responseData: [
			{
				name: "latitude",
				type: "string",
				description: "Echo of the latitude coordinate supplied in the request.",
				example: "19.0760",
			},
			{
				name: "longitude",
				type: "string",
				description:
					"Echo of the longitude coordinate supplied in the request.",
				example: "72.8777",
			},
			{
				name: "address",
				type: "string",
				description:
					"Full formatted street address resolved from the coordinates.",
				imp: true,
				example: "6/B Mahatyagi Road, Chhatrapati Shivaji Terminus",
			},
			{
				name: "city",
				type: "string",
				description: "City name derived from the coordinates.",
				imp: true,
				example: "Mumbai",
			},
			{
				name: "state",
				type: "string",
				description: "Full state name derived from the coordinates.",
				imp: true,
				example: "Maharashtra",
			},
			{
				name: "statecode",
				type: "string",
				description: "Two-letter ISO / RTO state code.",
				imp: true,
				example: "MH",
			},
			{
				name: "countrycode",
				type: "string",
				description: "Two-letter ISO 3166-1 alpha-2 country code.",
				imp: true,
				example: "IN",
			},
			{
				name: "pincode",
				type: "string",
				description: "Indian 6-digit PIN code for the resolved location.",
				imp: true,
				example: "400001",
			},
			{
				name: "score",
				type: "number",
				description:
					"Geocoding confidence score between 0 and 1; higher values indicate a more precise address match.",
				example: 0.95,
			},
			{
				name: "status",
				type: "string",
				description: "Status of the coordinate resolution (e.g. 'OK').",
				example: "OK",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Reverse geocoding successful",
			response_type_id: 1388,
			data: {
				latitude: "19.0760",
				longitude: "72.8777",
				address: "6/B Mahatyagi Road, Chhatrapati Shivaji Terminus",
				city: "Mumbai",
				state: "Maharashtra",
				statecode: "MH",
				countrycode: "IN",
				pincode: "400001",
				score: 0.95,
				status: "OK",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or out-of-range coordinates",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid latitude or longitude value",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Missing required parameter (latitude or longitude omitted)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Required parameter missing",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden",
				},
			},
		],
	},
	{
		id: "voter-id",
		productId: "voter-id",
		name: "Voter ID Verification",
		slug: "voter-id",
		summary:
			"Validate EPIC (Voter ID) card details in real time against government records — returns name, age, address, constituency, and polling station information.",
		description:
			"The Voter ID Verification API lets you verify an Electoral Photo Identity Card (EPIC) number against government electoral rolls. A single POST call returns the cardholder's full identity profile — name (English and regional language), date of birth, gender, guardian details, structured address, assembly and parliamentary constituency, and polling station — making it suitable for KYC, onboarding, and compliance workflows.",
		relevance: "M",
		bestFor:
			"Businesses that need to verify Indian voter identity documents (EPIC) as part of KYC, onboarding, or fraud-prevention pipelines.",
		method: "POST",
		path: "/tools/kyc/voter-id",
		docsUrl: "https://developers.eko.in/reference/voter-id",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/voter-id/verify-voter-id",
		extraRequestParams: [
			{
				name: "epic_number",
				type: "string",
				required: true,
				description:
					"Unique Electoral Photo Identity Card (EPIC) number to verify.",
				example: "ABC1234567",
			},
			{
				name: "name",
				type: "string",
				required: false,
				description:
					"Name of the Voter ID cardholder. Optional; can be used for cross-verification against returned name.",
				example: "Rajesh Kumar",
			},
		],
		responseData: [
			{
				name: "name",
				label: "Cardholder's Name",
				type: "string",
				description: "Cardholder's full name as recorded on the voter ID.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "name_in_regional_lang",
				label: "Name in Regional Language",
				type: "string",
				description: "Cardholder's name in the regional/vernacular script.",
				imp: true,
				example: "राजेश कुमार",
			},
			{
				name: "age",
				type: "string",
				description: "Age of the cardholder as per voter roll records.",
				imp: true,
				example: "34",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				description: "Date of birth in YYYY-MM-DD format.",
				imp: true,
				example: "1994-08-29",
			},
			{
				name: "gender",
				type: "string",
				description: "Gender of the cardholder.",
				imp: true,
				example: "Male",
			},
			{
				name: "father_name",
				label: "Father's Name",
				type: "string",
				description: "Father's name as on the voter record.",
				imp: true,
				example: "Suresh Kumar",
			},
			{
				name: "relation_type",
				label: "Guardian Relationship",
				type: "string",
				description:
					"Relationship type of the guardian (e.g., Father, Husband).",
				example: "Father",
			},
			{
				name: "relation_name",
				type: "string",
				description: "Guardian's name corresponding to the relation_type.",
				example: "Suresh Kumar",
			},
			{
				name: "relation_name_in_regional_lang",
				label: "Guardian's Name in Regional Language",
				type: "string",
				description: "Guardian's name in the regional/vernacular script.",
				example: "सुरेश कुमार",
			},
			{
				name: "epic_number",
				label: "EPIC Number",
				type: "string",
				description: "The EPIC number that was verified.",
				imp: true,
				example: "ABC1234567",
			},
			{
				name: "address",
				type: "string",
				description: "Full address string as recorded in the electoral roll.",
				imp: true,
				example: "Ward 12, Sector 5, Noida",
			},
			{
				name: "state",
				type: "string",
				description:
					"State name corresponding to the voter's registered address.",
				imp: true,
				example: "Uttar Pradesh",
			},
			{
				name: "split_address",
				type: "object",
				description: "Parsed address broken into individual components.",
				children: [
					{
						name: "district",
						type: "array",
						description: "District(s) extracted from the address.",
						example: ["Gautam Buddha Nagar"],
					},
					{
						name: "city",
						type: "array",
						description: "City/town(s) extracted from the address.",
						example: ["Noida"],
					},
					{
						name: "state",
						type: "array",
						description:
							"State(s) extracted from the address (may be nested arrays).",
						example: [["Uttar Pradesh"]],
					},
					{
						name: "pincode",
						type: "string",
						description: "PIN code extracted from the address.",
						example: "201301",
					},
					{
						name: "country",
						type: "array",
						description: "Country extracted from the address.",
						example: ["India"],
					},
					{
						name: "address_line",
						type: "string",
						description: "Full address reassembled as a single line.",
						example:
							"Ward 12, Sector 5, Noida, Gautam Buddha Nagar, Uttar Pradesh - 201301",
					},
				],
			},
			{
				name: "assembly_constituency",
				type: "string",
				description:
					"Name of the assembly constituency (Vidhan Sabha) for the voter.",
				imp: true,
				example: "Noida (62)",
			},
			{
				name: "assembly_constituency_number",
				type: "string",
				description: "Numerical code of the assembly constituency.",
				imp: true,
				example: "62",
			},
			{
				name: "parliamentary_constituency",
				type: "string",
				description:
					"Name of the parliamentary constituency (Lok Sabha) for the voter.",
				imp: true,
				example: "Gautam Buddha Nagar",
			},
			{
				name: "parliamentary_constituency_number",
				type: "string",
				description: "Numerical code of the parliamentary constituency.",
				imp: true,
				example: "47",
			},
			{
				name: "part_number",
				type: "string",
				description:
					"Part/section number of the electoral roll in which the voter is listed.",
				example: "142",
			},
			{
				name: "part_name",
				type: "string",
				description: "Name of the electoral roll part/section.",
				example: "Sector 5 Ward",
			},
			{
				name: "serial_number",
				type: "string",
				description:
					"Serial number of the voter within the electoral roll part.",
				example: "312",
			},
			{
				name: "polling_station",
				type: "string",
				description: "Name and/or location of the designated polling station.",
				imp: true,
				example: "Govt. School Noida Sec 5",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Voter ID verification successful",
			response_type_id: 1388,
			data: {
				name: "Rajesh Kumar",
				name_in_regional_lang: "राजेश कुमार",
				age: "34",
				dob: "1994-08-29",
				gender: "Male",
				father_name: "Suresh Kumar",
				relation_type: "Father",
				relation_name: "Suresh Kumar",
				relation_name_in_regional_lang: "सुरेश कुमार",
				epic_number: "ABC1234567",
				address: "Ward 12, Sector 5, Noida",
				state: "Uttar Pradesh",
				split_address: {
					district: ["Gautam Buddha Nagar"],
					city: ["Noida"],
					state: [["Uttar Pradesh"]],
					pincode: "201301",
					country: ["India"],
					address_line:
						"Ward 12, Sector 5, Noida, Gautam Buddha Nagar, Uttar Pradesh - 201301",
				},
				assembly_constituency: "Noida (62)",
				assembly_constituency_number: "62",
				parliamentary_constituency: "Gautam Buddha Nagar",
				parliamentary_constituency_number: "47",
				part_number: "142",
				part_name: "Sector 5 Ward",
				serial_number: "312",
				polling_station: "Govt. School Noida Sec 5",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or non-existent EPIC number",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "No record found for the provided EPIC number",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Missing required parameter (epic_number)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "epic_number is required",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong or expired secret-key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden — incorrect secret-key or timestamp",
				},
			},
		],
	},
	{
		id: "passport",
		productId: "passport",
		name: "Passport Verification",
		slug: "passport",
		summary:
			"Verify Indian passport application details using passport file number and date of birth.",
		description:
			"The Passport Verification API enables businesses to validate passport holder details using passport file number and date of birth. Returns holder name, DOB, application type, and application received date — suitable for KYC, employee background verification, travel compliance, and fintech onboarding workflows. Supports Indian passports only; not an OCR or MRZ scan API.",
		relevance: "M",
		bestFor:
			"Employee BGV, travel-platform KYC, fintech onboarding, and immigration-assistance workflows that need structured passport data from the government source.",
		method: "POST",
		path: "/tools/kyc/passport",
		docsUrl: "https://developers.eko.in/reference/passport",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/passport/verify-passport",
		extraRequestParams: [
			{
				name: "file_number",
				type: "string",
				required: true,
				description:
					"Unique alphanumeric code that identifies an individual's passport application (passport file number).",
				example: "J8369854",
			},
			{
				name: "dob",
				type: "string",
				required: true,
				description:
					"Date of birth of the passport holder in YYYY-MM-DD format.",
				example: "1994-08-29",
			},
			{
				name: "name",
				type: "string",
				required: false,
				description:
					"Name of the passport holder. Optional — used for cross-checking in certain verification flows.",
				example: "Rajesh Kumar",
			},
		],
		responseData: [
			{
				name: "file_number",
				type: "string",
				description:
					"Unique alphanumeric code identifying the passport application, echoed back from the source.",
				imp: true,
				example: "J8369854",
			},
			{
				name: "name",
				type: "string",
				description:
					"Full name of the passport holder as recorded in the government source.",
				imp: true,
				example: "Rajesh Kumar",
			},
			{
				name: "dob",
				label: "Date of Birth",
				type: "string",
				description:
					"Date of birth of the passport holder (YYYY-MM-DD) as registered in the passport application.",
				imp: true,
				example: "1994-08-29",
			},
			{
				name: "application_type",
				type: "string",
				description:
					"Type of passport application (e.g. Normal, Tatkal). Indicates the application category used when the passport was applied for.",
				imp: true,
				example: "Normal",
			},
			{
				name: "application_received_date",
				type: "string",
				description:
					"Date on which the passport application was received by the issuing authority (YYYY-MM-DD format).",
				imp: true,
				example: "2023-01-15",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Passport verification successful",
			response_type_id: 1388,
			data: {
				file_number: "J8369854",
				name: "Rajesh Kumar",
				dob: "1994-08-29",
				application_type: "Normal",
				application_received_date: "2023-01-15",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or non-existent passport file number / DOB mismatch",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message:
						"Passport details not found. Please verify the file number and date of birth.",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Missing required field (file_number or dob not supplied)",
				statusCode: 400,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Bad request: required parameter missing",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Authentication failure — wrong or expired secret-key / timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Forbidden: invalid authentication credentials",
					data: {},
				},
			},
		],
	},
	{
		id: "cin",
		productId: "cin",
		name: "CIN Verification",
		slug: "cin",
		summary:
			"Verify Company Identification Numbers (CIN) against MCA records — returns company name, incorporation details, directors, and CIN status.",
		description:
			"The CIN Verification API lets you validate a Company Identification Number (CIN) against Ministry of Corporate Affairs records in real time. It returns the registered company name, registration number, incorporation date, CIN status (active / struck-off / dormant / under liquidation), company email, country of incorporation, and a full list of directors with their DIN, designation, address, and date of birth. Use it for KYB onboarding, vendor due diligence, lending workflows, and corporate compliance checks.",
		relevance: "M",
		bestFor:
			"KYB and corporate due-diligence workflows that need authoritative MCA data on a company before onboarding or credit decisioning.",
		method: "POST",
		path: "/tools/kyc/cin",
		docsUrl: "https://developers.eko.in/reference/cin",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/cin/verify-cin",
		extraRequestParams: [
			{
				name: "cin",
				type: "string",
				required: true,
				description:
					"Alphanumeric Company Identification Number (CIN) assigned by the Ministry of Corporate Affairs, India.",
				example: "U72900KA2015PTC082988",
			},
		],
		responseData: [
			{
				name: "cin",
				label: "Company Identification Number (CIN)",
				type: "string",
				description:
					"The CIN submitted in the request, echoed back for confirmation.",
				imp: true,
				example: "U72900KA2015PTC082988",
			},
			{
				name: "company_name",
				type: "string",
				description: "MCA-registered legal name of the company.",
				imp: true,
				example: "Acme Technologies Pvt Ltd",
			},
			{
				name: "registration_number",
				type: "number",
				description:
					"Numeric company registration number assigned by the Registrar of Companies.",
				imp: true,
				example: 82987,
			},
			{
				name: "incorporation_date",
				type: "string",
				description: "Date the company was incorporated, in YYYY-MM-DD format.",
				imp: true,
				example: "2015-09-23",
			},
			{
				name: "cin_status",
				label: "CIN Status",
				type: "string",
				description:
					"Current status of the CIN as recorded by MCA — e.g. Active, Strike-Off, Dormant, Under Liquidation.",
				imp: true,
				example: "Active",
			},
			{
				name: "email",
				label: "Company Email",
				type: "string",
				description: "Company email address from MCA records.",
				example: "contact@acmetech.in",
			},
			{
				name: "incorporation_country",
				type: "string",
				description: "Country in which the company was incorporated.",
				imp: true,
				example: "India",
			},
			{
				name: "director_details",
				type: "array",
				description: "List of directors of the company as registered with MCA.",
				imp: true,
				children: [
					{
						name: "name",
						type: "string",
						description: "Full legal name of the director.",
						imp: true,
						example: "Rahul Mehta",
					},
					{
						name: "din",
						type: "string",
						description:
							"Director Identification Number (DIN) allotted by MCA.",
						imp: true,
						example: "07168822",
					},
					{
						name: "designation",
						type: "string",
						description: "Role/designation of the director at the company.",
						imp: true,
						example: "Director",
					},
					{
						name: "dob",
						label: "Director's DOB",
						type: "string",
						description: "Date of birth of the director, in YYYY-MM-DD format.",
						example: "1985-03-12",
					},
					{
						name: "address",
						type: "string",
						description:
							"Registered address of the director as filed with MCA.",
						example: "123 MG Road, Bengaluru, Karnataka 560001",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "CIN verification successful",
			response_type_id: 1388,
			data: {
				cin: "U72900KA2015PTC082988",
				company_name: "Acme Technologies Pvt Ltd",
				registration_number: 82987,
				incorporation_date: "2015-09-23",
				cin_status: "Active",
				email: "contact@acmetech.in",
				incorporation_country: "India",
				director_details: [
					{
						name: "Rahul Mehta",
						din: "07168822",
						designation: "Director",
						dob: "1985-03-12",
						address: "123 MG Road, Bengaluru, Karnataka 560001",
					},
					{
						name: "Priya Sharma",
						din: "07168826",
						designation: "Director",
						dob: "1988-07-25",
						address: "45 Residency Road, Bengaluru, Karnataka 560025",
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or malformed CIN",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid CIN. Please provide a valid 21-character CIN.",
					response_type_id: 1388,
					data: null,
				},
			},
			{
				scenario: "CIN not found in MCA records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "No records found for the provided CIN.",
					response_type_id: 1388,
					data: null,
				},
			},
			{
				scenario: "Authentication failure — invalid secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Forbidden: invalid or expired secret-key.",
					data: null,
				},
			},
			{
				scenario: "Missing required body parameter (cin)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "cin is required.",
					response_type_id: 1388,
					data: null,
				},
			},
		],
	},
	{
		id: "ip",
		productId: "ip",
		name: "IP Verification",
		slug: "ip",
		summary:
			"Geo-locate and risk-score an IP address in real time — detect proxies, VPNs, and assess fraud risk.",
		description:
			"Submit any IPv4 address to receive its geolocation (country, region, city), proxy/VPN classification, and dual risk scores (city-level and proxy-type). Use inline during transactions for fraud prevention and geo-compliance enforcement.",
		relevance: "M",
		bestFor:
			"Fintech, lending, e-commerce, and SaaS platforms that need real-time IP intelligence for fraud prevention and geo-compliance.",
		method: "POST",
		path: "/tools/kyc/ip",
		docsUrl: "https://developers.eko.in/reference/ip",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/ip/verify-ip#verify-ip",
		extraRequestParams: [
			{
				name: "ip_address",
				type: "string",
				required: true,
				description:
					"The IPv4 address to verify. Must be a valid, routable IP address.",
				example: "103.21.58.193",
			},
		],
		responseData: [
			{
				name: "ip_address",
				type: "string",
				description: "The IP address that was submitted for verification.",
				example: "103.21.58.193",
			},
			{
				name: "proxy_type",
				type: "string",
				description:
					"Classification of the connection type (e.g. None, VPN, DCH for data-centre hosting, RES for residential proxy, etc.).",
				imp: true,
				example: "None",
			},
			{
				name: "country_code",
				type: "string",
				description: "ISO 3166-1 alpha-2 country code for the IP address.",
				imp: true,
				example: "IN",
			},
			{
				name: "country_name",
				type: "string",
				description: "Full country name corresponding to the country code.",
				imp: true,
				example: "India",
			},
			{
				name: "region_name",
				type: "string",
				description:
					"State or region within the country where the IP is geolocated.",
				imp: true,
				example: "Maharashtra",
			},
			{
				name: "city_name",
				type: "string",
				description: "City within the region where the IP is geolocated.",
				imp: true,
				example: "Mumbai",
			},
			{
				name: "city_risk_score",
				type: "string",
				description:
					"Risk score (0–100) for the geolocated city, based on cybersecurity threat intelligence and historical crime/fraud data for that city. Higher scores indicate greater risk.",
				imp: true,
				example: "12",
			},
			{
				name: "proxy_type_risk_score",
				type: "string",
				description:
					"Risk score (0–100) for the detected proxy type. A score of 0 means a clean residential or direct connection; higher scores indicate proxy/VPN or data-centre traffic associated with fraud.",
				imp: true,
				example: "0",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "IP verification successful",
			response_type_id: 1388,
			data: {
				ip_address: "103.21.58.193",
				proxy_type: "None",
				country_code: "IN",
				country_name: "India",
				region_name: "Maharashtra",
				city_name: "Mumbai",
				city_risk_score: "12",
				proxy_type_risk_score: "0",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or malformed IP address supplied",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid IP address",
					data: {},
				},
			},
			{
				scenario: "Missing required parameter ip_address",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "ip_address is required",
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong or expired secret-key",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Unauthorized",
				},
			},
		],
	},
	{
		id: "name-match",
		productId: "name-match",
		name: "Name Match API",
		slug: "name-match",
		summary:
			"AI-powered name comparison trained on 100M+ Indian name records — returns a match score (0–1) and match category for automated KYC decisions.",
		description:
			"Name Match is an AI-powered name comparison API built for India's complex naming conventions. Trained on over 100 million Indian name records, it handles initials, abbreviations, phonetic and regional spelling variants, salutation patterns (S/O, D/O), subset matching, and name ordering variations — returning a numeric score and match category that let you set rule-based pass/fail thresholds.",
		relevance: "M",
		bestFor:
			"Cross-document name validation — PAN vs Aadhaar, bank account holder vs GST trade name, and any KYC or KYB workflow that needs to tolerate Indian naming variations without manual review.",
		method: "POST",
		path: "/tools/kyc/name-match",
		docsUrl: "https://developers.eko.in/reference/name-match",
		sourceDoc:
			"https://www.cashfree.com/docs/api-reference/vrs/v2/name-match/name-match#verify-name-match",
		extraRequestParams: [
			{
				name: "name_1",
				type: "string",
				required: true,
				description:
					"First name string to compare (e.g. the name from a PAN card or bank record).",
				example: "S K Mishra",
			},
			{
				name: "name_2",
				type: "string",
				required: true,
				description:
					"Second name string to compare against name_1 (e.g. the name from an Aadhaar or GST record).",
				example: "Satish Kumar Mishra",
			},
		],
		responseData: [
			{
				name: "name_1",
				type: "string",
				description: "The first name string as submitted in the request.",
				example: "S K Mishra",
			},
			{
				name: "name_2",
				type: "string",
				description: "The second name string as submitted in the request.",
				example: "Satish Kumar Mishra",
			},
			{
				name: "score",
				type: "number",
				description:
					"Numeric match score between 0 and 1. Thresholds: 1.0 = Direct Match; 0.85–0.99 = Good Partial Match; 0.60–0.84 = Moderate Partial Match; 0.34–0.59 = Poor Partial Match; 0.00–0.33 = No Match.",
				imp: true,
				example: 0.92,
			},
			{
				name: "reason",
				type: "string",
				description:
					"Human-readable explanation of the match result — effectively the match category label along with the AI model's rationale (e.g. initials expansion, phonetic match, subset match).",
				imp: true,
				example: "Names match with initials expanded",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Name match successful",
			response_type_id: 1388,
			data: {
				name_1: "S K Mishra",
				name_2: "Satish Kumar Mishra",
				score: 0.92,
				reason: "Names match with initials expanded",
			},
		},
		errorScenarios: [
			{
				scenario: "One or both name parameters missing or empty",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "name_1 and name_2 are required fields.",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "No match — names are unrelated (score ≤ 0.33)",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Name match successful",
					response_type_id: 1388,
					data: {
						name_1: "Ramesh Gupta",
						name_2: "Priya Sharma",
						score: 0.05,
						reason: "Names do not match",
					},
				},
			},
			{
				scenario: "Invalid / missing developer_key — authentication failure",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden — incorrect developer_key or secret-key.",
				},
			},
		],
	},
	{
		id: "itr-compliance",
		productId: "itr",
		name: "ITR Compliance Check",
		slug: "itr-compliance",
		summary:
			"Check income tax return filing and compliance status for a PAN holder in real time — ideal for lending, credit assessment, and financial due-diligence workflows.",
		description:
			"The ITR Compliance Check API verifies whether a given PAN holder has filed income tax returns and returns their compliance status, ITR filing flag, and the relevant assessment year. Built on the Eko TOURAS network, it gives lenders, NBFCs, and compliance teams an instant signal of a borrower's or vendor's tax-filing behaviour without requiring manual document collection. A single PAN input is all that is needed — no document uploads or consent flows.",
		relevance: "M",
		bestFor:
			"Lending platforms, NBFCs, and compliance teams that need an instant, automated ITR filing signal for a PAN holder during credit assessment or onboarding.",
		method: "POST",
		path: "/tools/kyc/touras/itr-compliance",
		docsUrl: "https://developers.eko.in/reference/itr-compliance",
		sourceDoc:
			"https://docs.touras.in/verification-suite?pageId=ITR-Compliance",
		extraRequestParams: [
			{
				name: "pan_number",
				type: "string",
				required: true,
				description:
					"PAN number of the individual or entity to check for ITR compliance (10-character alphanumeric, e.g. ABCDE1234F).",
				example: "ABCDE1234F",
			},
		],
		responseData: [
			{
				name: "pan_number",
				label: "PAN Number",
				type: "string",
				description:
					"The PAN number that was queried, echoed back from the source for confirmation.",
				imp: true,
				example: "ABCDE1234F",
			},
			{
				name: "itr_filed",
				label: "ITR Filed Flag",
				type: "boolean",
				description:
					"Indicates whether the PAN holder has filed an income tax return for the queried assessment year. true = filed; false = not filed.",
				imp: true,
				example: true,
			},
			{
				name: "assessment_year",
				type: "string",
				description:
					"The income-tax assessment year for which the ITR status is reported (e.g. '2024-25' corresponds to FY 2023-24).",
				imp: true,
				example: "2024-25",
			},
			{
				name: "compliance_status",
				type: "string",
				description:
					"Overall tax compliance standing of the PAN holder as returned by the authority (e.g. Compliant, Non-Compliant, Pending).",
				imp: true,
				example: "Compliant",
			},
			{
				name: "filing_status",
				type: "string",
				description:
					"Granular ITR filing status string as returned by the source — may carry values such as 'Filed', 'Not Filed', 'Under Processing', or 'Defective'.",
				imp: true,
				example: "Filed",
			},
			{
				name: "filing_date",
				type: "string",
				description:
					"Date on which the ITR was filed (YYYY-MM-DD), if available from the source.",
				example: "2024-07-25",
			},
			{
				name: "acknowledgement_number",
				type: "string",
				description:
					"ITR acknowledgement number issued by the Income Tax Department upon successful e-filing, if returned by the source.",
				example: "123456789012345",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "ITR compliance check successful",
			response_type_id: 1388,
			data: {
				pan_number: "ABCDE1234F",
				itr_filed: true,
				assessment_year: "2024-25",
				compliance_status: "Compliant",
				filing_status: "Filed",
				filing_date: "2024-07-25",
				acknowledgement_number: "123456789012345",
			},
		},
		errorScenarios: [
			{
				scenario: "PAN not found in Income Tax Department records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "No ITR record found for the provided PAN number",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "ITR not filed for the queried assessment year",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "ITR compliance check successful",
					response_type_id: 1388,
					data: {
						pan_number: "ABCDE1234F",
						itr_filed: false,
						assessment_year: "2024-25",
						compliance_status: "Non-Compliant",
						filing_status: "Not Filed",
					},
				},
			},
			{
				scenario:
					"Invalid PAN format — must be 10 alphanumeric characters matching AAAAA9999A pattern",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Invalid PAN number format",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Missing required field — pan_number not supplied in the request body",
				statusCode: 400,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Bad request: pan_number is required",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Authentication failure — wrong or expired secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					message: "Unauthorized: invalid secret-key or timestamp",
				},
			},
			{
				scenario: "Upstream ITR source temporarily unavailable",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Source unavailable. Please try again.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "din-verification",
		productId: "din",
		name: "DIN Verification",
		slug: "din-verification",
		summary:
			"Verify Director Identification Numbers (DIN) against MCA records — returns director name, DIN status, designation, and associated company information.",
		description:
			"The DIN Verification API lets you validate a Director Identification Number (DIN) against Ministry of Corporate Affairs (MCA) records in real time. It returns the director's full name, current DIN status (Active / Deactivated / Surrendered), designation, and the associated company name. Use it for corporate KYB onboarding, director background checks, vendor due diligence, lending to corporate borrowers, and compliance workflows that require authoritative director-identity validation.",
		relevance: "M",
		bestFor:
			"Corporate KYB and director due-diligence workflows that need real-time validation of a Director Identification Number against authoritative MCA records before onboarding or credit decisioning.",
		method: "POST",
		path: "/tools/kyc/touras/din-verification",
		docsUrl: "https://developers.eko.in/reference/din-verification",
		sourceDoc: "https://docs.touras.in/verification-suite?pageId=DIN",
		extraRequestParams: [
			{
				name: "din_number",
				type: "string",
				required: true,
				description:
					"The 8-digit Director Identification Number (DIN) assigned by the Ministry of Corporate Affairs to the individual director.",
				example: "06731826",
			},
		],
		responseData: [
			{
				name: "din",
				label: "Director Identification Number (DIN)",
				type: "string",
				description:
					"The DIN submitted in the request, echoed back for confirmation.",
				imp: true,
				example: "06731826",
			},
			{
				name: "director_name",
				label: "Director's Name",
				type: "string",
				description: "Full legal name of the director as registered with MCA.",
				imp: true,
				example: "Abhishek Sagar",
			},
			{
				name: "din_status",
				label: "DIN Status",
				type: "string",
				description:
					"Current status of the DIN as recorded by MCA — e.g. Active, Deactivated, Surrendered, Disqualified.",
				imp: true,
				example: "Active",
			},
			{
				name: "designation",
				type: "string",
				description: "Role or designation of the director as filed with MCA.",
				imp: true,
				example: "Director",
			},
			{
				name: "company_name",
				type: "string",
				description:
					"Name of the company with which the director is associated, as recorded in MCA records.",
				imp: true,
				example: "Eko India Financial Services Pvt Ltd",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "DIN verification successful",
			response_type_id: 1388,
			data: {
				din: "06731826",
				director_name: "Abhishek Sagar",
				din_status: "Active",
				designation: "Director",
				company_name: "Eko India Financial Services Pvt Ltd",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or malformed DIN (not 8 digits)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Invalid DIN. Please provide a valid 8-digit DIN.",
					response_type_id: 1388,
					data: null,
				},
			},
			{
				scenario: "DIN not found in MCA records",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "No records found for the provided DIN.",
					response_type_id: 1388,
					data: null,
				},
			},
			{
				scenario: "Authentication failure — invalid secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Forbidden: invalid or expired secret-key.",
					data: null,
				},
			},
			{
				scenario: "Missing required body parameter (din_number)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: -1,
					message: "din_number is required.",
					response_type_id: 1388,
					data: null,
				},
			},
		],
	},
	{
		id: "e-challan",
		productId: "e-challan",
		name: "E-Challan Verification",
		slug: "e-challan",
		summary:
			"Fetch pending traffic challans for any vehicle using its registration number — challan number, offence, fine amount, date, status, and issuing authority returned in a single API call.",
		description:
			"Send a vehicle registration number to the E-Challan Verification API and receive a complete list of pending traffic violations from the national e-challan system (Parivahan). The response includes each challan's unique number, offence description, fine amount, date of violation, payment status, and issuing state/authority. Use it to automate fleet compliance checks, assess driver risk during onboarding, support motor insurance underwriting, or surface challan data in used-vehicle platforms.",
		relevance: "M",
		bestFor:
			"Fleet operators, logistics and delivery platforms, motor insurers, gig-worker onboarding platforms, and used-vehicle marketplaces that need automated, real-time challan status checks.",
		method: "POST",
		path: "/tools/kyc/touras/e-challan",
		docsUrl: "https://developers.eko.in/reference/e-challan",
		sourceDoc:
			"https://docs.touras.in/verification-suite?pageId=Vehicle-Challan",
		extraRequestParams: [
			{
				name: "registration_number",
				type: "string",
				required: true,
				description:
					"Vehicle registration number to look up challans for (e.g. MH02AB1234).",
				example: "MH02AB1234",
			},
		],
		responseData: [
			{
				name: "vehicle_number",
				type: "string",
				description:
					"Registration number of the vehicle as echoed back from the source system.",
				imp: true,
				example: "MH02AB1234",
			},
			{
				name: "pending_challans",
				type: "number",
				description:
					"Total count of pending (unpaid) challans found for the vehicle.",
				imp: true,
				example: 2,
			},
			{
				name: "total_fine_amount",
				type: "number",
				description:
					"Aggregate fine amount in INR across all pending challans.",
				imp: true,
				example: 3500,
			},
			{
				name: "challans",
				label: "Challan Records",
				type: "array",
				description:
					"List of individual challan records. Each element represents one traffic violation.",
				imp: true,
				children: [
					{
						name: "challan_number",
						type: "string",
						description:
							"Unique challan reference number issued by the traffic authority.",
						imp: true,
						example: "MH2024001234",
					},
					{
						name: "challan_id",
						type: "string",
						description:
							"Internal challan ID in the national e-challan system.",
						example: "EC20241001",
					},
					{
						name: "violation",
						type: "string",
						description:
							"Description of the traffic offence (e.g. 'Overspeeding', 'Red Light Jump', 'No Helmet').",
						imp: true,
						example: "Overspeeding",
					},
					{
						name: "date",
						type: "string",
						description:
							"Date on which the violation was recorded (YYYY-MM-DD).",
						imp: true,
						example: "2024-12-10",
					},
					{
						name: "fine",
						type: "number",
						description: "Fine amount in INR for this individual challan.",
						imp: true,
						example: 2000,
					},
					{
						name: "status",
						type: "string",
						description:
							"Payment status of the challan — typically 'Pending' or 'Paid'.",
						imp: true,
						example: "Pending",
					},
					{
						name: "state",
						type: "string",
						description: "State in which the challan was issued.",
						example: "Maharashtra",
					},
					{
						name: "issuing_authority",
						type: "string",
						description: "Traffic police unit or RTO that issued the challan.",
						example: "Mumbai Traffic Police",
					},
					{
						name: "payment_source",
						type: "string",
						description:
							"Payment channel through which the fine can be paid (e.g. 'Online', 'Court').",
						example: "Online",
					},
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "E-Challan check successful",
			response_type_id: 1388,
			data: {
				vehicle_number: "MH02AB1234",
				pending_challans: 2,
				total_fine_amount: 3500,
				challans: [
					{
						challan_number: "MH2024001234",
						challan_id: "EC20241210",
						violation: "Overspeeding",
						date: "2024-12-10",
						fine: 2000,
						status: "Pending",
						state: "Maharashtra",
						issuing_authority: "Mumbai Traffic Police",
						payment_source: "Online",
					},
					{
						challan_number: "MH2024000987",
						challan_id: "EC20241105",
						violation: "Red Light Jump",
						date: "2024-11-05",
						fine: 1500,
						status: "Pending",
						state: "Maharashtra",
						issuing_authority: "Mumbai Traffic Police",
						payment_source: "Online",
					},
				],
			},
		},
		errorScenarios: [
			{
				scenario:
					"Vehicle registration number not found in the national e-challan system",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "No records found for the given registration number",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario:
					"Missing required parameter — registration_number not supplied",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "registration_number is required",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "No pending challans found for the vehicle (clean record)",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "E-Challan check successful",
					response_type_id: 1388,
					data: {
						vehicle_number: "MH02AB1234",
						pending_challans: 0,
						total_fine_amount: 0,
						challans: [],
					},
				},
			},
			{
				scenario: "Authentication failure — wrong or expired secret-key",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden: invalid secret-key or timestamp mismatch",
				},
			},
			{
				scenario: "E-challan source (Parivahan) temporarily unavailable",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Source temporarily unavailable. Please try again.",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "check-email",
		productId: "email",
		name: "Email Verification",
		slug: "check-email",
		summary:
			"Verify an email address in real time — confirm the domain has live mail infrastructure, detect disposable addresses, and retrieve domain age as a trust signal.",
		description:
			"Validates whether an email address is genuine and deliverable by checking MX (mail exchange) records for the domain. Returns domain age in days, the resolved MX record list, and flags for validity and disposability — giving you the signals needed to block fake signups, catch typos, and assess account trust during onboarding.",
		relevance: "H",
		bestFor:
			"User onboarding flows, registration fraud prevention, contact-database cleaning, and any scenario where an invalid or dummy email address would cause downstream failures or fraud.",
		method: "POST",
		path: "/tools/kyc/touras/check-email",
		docsUrl: "https://developers.eko.in/reference/email-check",
		sourceDoc:
			"https://docs.touras.in/verification-suite?pageId=Email_verification",
		extraRequestParams: [
			{
				name: "email",
				type: "string",
				required: true,
				description:
					"The email address to verify, e.g. rajesh.kumar@example.com.",
				example: "rajesh.kumar@example.com",
			},
		],
		responseData: [
			{
				name: "email",
				type: "string",
				description:
					"The email address that was checked, echoed back for confirmation.",
				example: "rajesh.kumar@example.com",
			},
			{
				name: "domain",
				type: "string",
				description:
					"Domain portion of the email address (part after @). Used to anchor all domain-level checks.",
				imp: true,
				example: "example.com",
			},
			{
				name: "is_valid",
				label: "Is Email Valid?",
				type: "boolean",
				description:
					"Whether the email address is valid and deliverable. true = domain has live MX records and can receive mail; false = domain has no mail server or is otherwise undeliverable.",
				imp: true,
				example: true,
			},
			{
				name: "is_disposable",
				label: "Is Disposable Email?",
				type: "boolean",
				description:
					"Whether the email domain belongs to a known disposable / temporary email provider. true = disposable (high fraud risk); false = regular email domain.",
				imp: true,
				example: false,
			},
			{
				name: "domain_age_days",
				label: "Domain Age (Days)",
				type: "number",
				description:
					"Age of the email domain in days since registration. Newly created domains (< 30 days) are a strong fraud signal; legitimate email providers have domains that are years old.",
				imp: true,
				example: 6970,
			},
			{
				name: "mx_records",
				label: "MX Records",
				type: "array",
				description:
					"List of MX (mail exchange) hostnames discovered for the domain, ordered by priority. An empty array means the domain cannot receive email.",
				imp: true,
				example: [
					"aspmx.l.google.com",
					"alt1.aspmx.l.google.com",
					"alt2.aspmx.l.google.com",
					"alt3.aspmx.l.google.com",
					"alt4.aspmx.l.google.com",
				],
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "Email verification successful",
			response_type_id: 1388,
			data: {
				email: "rajesh.kumar@example.com",
				domain: "example.com",
				is_valid: true,
				is_disposable: false,
				domain_age_days: 6970,
				mx_records: [
					"aspmx.l.google.com",
					"alt1.aspmx.l.google.com",
					"alt2.aspmx.l.google.com",
					"alt3.aspmx.l.google.com",
					"alt4.aspmx.l.google.com",
				],
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid email — domain has no MX records or does not exist",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Email verification failed — domain has no mail server",
					response_type_id: 1388,
					data: {
						email: "test@nonexistentdomain12345.xyz",
						domain: "nonexistentdomain12345.xyz",
						is_valid: false,
						is_disposable: false,
						domain_age_days: null,
						mx_records: [],
					},
				},
			},
			{
				scenario: "Disposable / temporary email address detected",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "Email verification successful",
					response_type_id: 1388,
					data: {
						email: "temp123@mailinator.com",
						domain: "mailinator.com",
						is_valid: true,
						is_disposable: true,
						domain_age_days: 7300,
						mx_records: ["mail.mailinator.com"],
					},
				},
			},
			{
				scenario:
					"Authentication failure — wrong secret-key or stale timestamp",
				statusCode: 403,
				example: {
					status: 1,
					response_status_id: -1,
					message: "Unauthorized — invalid secret-key or secret-key-timestamp.",
					data: {},
				},
			},
			{
				scenario: "User (retailer) not found",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 463,
					message: "User not found",
					response_type_id: 1388,
					data: {},
				},
			},
		],
	},
	{
		id: "fetch-fssai",
		productId: "fssai",
		name: "FSSAI License Verification",
		slug: "fetch-fssai",
		summary: "Verify FSSAI food license details and status in real time.",
		description:
			"Validates a Food Safety and Standards Authority of India (FSSAI) license number and returns the registered food business operator (FBO) details — name, address, license category, status, and expiry date. Use for food marketplace onboarding, delivery platform compliance, and food safety regulatory audits.",
		relevance: "M",
		bestFor:
			"Food delivery and aggregator platforms, e-commerce marketplaces, and compliance teams that need to confirm a vendor or restaurant holds a valid, active FSSAI license before onboarding or order fulfilment.",
		method: "POST",
		path: "/tools/kyc/touras/fetch-fssai",
		docsUrl: "https://developers.eko.in/reference/fssai-verification",
		sourceDoc: "https://docs.touras.in/verification-suite?pageId=FSSAI",
		extraRequestParams: [
			{
				name: "fssai",
				type: "string",
				required: true,
				description:
					"FSSAI license number of the food business operator (FBO) to verify. Typically 14 digits.",
				example: "11521998000045",
			},
		],
		responseData: [
			{
				name: "fssai_number",
				label: "FSSAI License Number",
				type: "string",
				description: "The FSSAI license number that was queried.",
				imp: true,
				example: "11521998000045",
			},
			{
				name: "license_status",
				type: "string",
				description:
					"Current status of the FSSAI license — Active, Expired, Suspended, or Cancelled.",
				imp: true,
				example: "Active",
			},
			{
				name: "license_category",
				type: "string",
				description:
					"Category of the FSSAI license — Registration, State License, or Central License — reflecting the scale of the food business.",
				imp: true,
				example: "State License",
			},
			{
				name: "business_name",
				type: "string",
				description:
					"Registered name of the food business operator (FBO) as on the FSSAI license.",
				imp: true,
				example: "Spice Garden Restaurant",
			},
			{
				name: "address",
				type: "string",
				description:
					"Registered business address of the FBO as on the FSSAI license.",
				imp: true,
				example: "123 Main Street, Mumbai, Maharashtra",
			},
			{
				name: "state",
				type: "string",
				description: "Indian state in which the food business is registered.",
				imp: true,
				example: "Maharashtra",
			},
			{
				name: "pincode",
				type: "string",
				description: "6-digit PIN code of the registered business address.",
				example: "400001",
			},
			{
				name: "expiry_date",
				type: "string",
				description:
					"License validity expiry date in YYYY-MM-DD format. Use to flag expired or soon-to-expire licenses.",
				imp: true,
				example: "2026-03-15",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			message: "FSSAI verification successful",
			response_type_id: 1388,
			data: {
				fssai_number: "11521998000045",
				license_status: "Active",
				license_category: "State License",
				business_name: "Spice Garden Restaurant",
				address: "123 Main Street, Mumbai, Maharashtra",
				state: "Maharashtra",
				pincode: "400001",
				expiry_date: "2026-03-15",
			},
		},
		errorScenarios: [
			{
				scenario: "Invalid or non-existent FSSAI license number",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					message: "Invalid FSSAI license number",
					response_type_id: 1388,
					data: {},
				},
			},
			{
				scenario: "Authentication failure — wrong secret-key or timestamp",
				statusCode: 403,
				example: {
					status: 1,
					message: "Forbidden: invalid authentication credentials",
				},
			},
			{
				scenario: "Expired FSSAI license — license found but no longer valid",
				statusCode: 200,
				example: {
					status: 0,
					response_status_id: 0,
					message: "FSSAI verification successful",
					response_type_id: 1388,
					data: {
						fssai_number: "10012345000012",
						license_status: "Expired",
						license_category: "State License",
						business_name: "Old Dhaba Pvt Ltd",
						address: "45 Ring Road, Delhi",
						state: "Delhi",
						pincode: "110001",
						expiry_date: "2023-08-31",
					},
				},
			},
		],
	},

	// MARK: Mobile / OTP Verification
	{
		id: "mobile-otp-send",
		productId: "mobile-otp",
		name: "Send OTP",
		slug: "mobile-otp-send",
		summary:
			"Send a one-time password (OTP) to a customer's primary mobile number to start mobile verification.",
		description:
			"Triggers an OTP SMS to the supplied mobile number and returns a transaction id plus the OTP expiry timestamp. The customer enters the OTP, which you confirm with the Verify OTP API. By default the SMS is sent with the **Eko India** sender signature; to use your own Sender ID and template, complete telecom DLT registration (see below).",
		descriptionFile: "mobile-otp-send.md",
		relevance: "H",
		bestFor:
			"Confirming a customer owns a mobile number before onboarding, payouts, or any OTP-gated transaction.",
		method: "POST",
		path: "/tools/kyc/mobile/otp",
		docsUrl: "https://developers.eko.in/reference/mobile-otp-send",
		extraRequestParams: [
			{
				name: "csp_id",
				label: "CSP ID",
				type: "string",
				required: true,
				description:
					"Customer Service Point id of the agent/retailer the OTP is being sent on behalf of.",
				example: "9002336768",
			},
			{
				name: "mobile",
				label: "Mobile Number",
				type: "string",
				required: true,
				description:
					"Customer's 10-digit primary mobile number to send the OTP to.",
				example: "9002336768",
			},
		],
		responseData: [
			{
				name: "client_ref_id",
				type: "string",
				description: "Unique reference id for this OTP request, echoed back.",
				example: "211101129871",
			},
			{
				name: "initiator_id",
				type: "string",
				description:
					"Registered mobile number of the API user that initiated the call.",
				example: "1234567891",
			},
			{
				name: "otp_expiry_timestamp",
				label: "OTP Expiry",
				type: "string",
				description:
					"Timestamp until which the OTP stays valid. Verify before this time.",
				imp: true,
				example: "Fri May 22 16:04:04 IST 2026",
			},
			{
				name: "tid",
				label: "Transaction ID",
				type: "string",
				description:
					"Unique transaction id for this OTP send, for tracking and support.",
				example: "2886978474",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			response_type_id: 1623,
			message: "OTP has been sent",
			data: {
				client_ref_id: "211101129871",
				initiator_id: "1234567891",
				otp_expiry_timestamp: "Fri May 22 16:04:04 IST 2026",
				tid: "2886978474",
			},
		},
	},
	{
		id: "mobile-otp-verify",
		productId: "mobile-otp",
		name: "Verify OTP",
		slug: "mobile-otp-verify",
		summary:
			"Verify the OTP entered by the customer and receive a signed verification token for downstream use.",
		description:
			"Validates the OTP sent by the Send OTP API. On success (`status` = 0) it returns a signed JWT `otp_verification_token` containing the verified `mobile` and a unique token id. The token is valid for **5 minutes** and acts as proof that OTP verification was performed — pass it to any transaction that depends on a verified mobile, and use the Validate OTP-Verification-Token API to confirm its authenticity.",
		relevance: "H",
		bestFor:
			"Confirming a customer-entered OTP and obtaining a short-lived proof token for OTP-gated transactions.",
		method: "PUT",
		path: "/tools/kyc/mobile/otp/verify",
		docsUrl: "https://developers.eko.in/reference/mobile-otp-verify",
		extraRequestParams: [
			{
				name: "otp",
				label: "OTP",
				type: "string",
				required: true,
				description:
					"The OTP value the customer received via SMS from the Send OTP API.",
				example: "3643",
			},
			{
				name: "mobile",
				label: "Mobile Number",
				type: "string",
				required: true,
				description: "The same 10-digit mobile number the OTP was sent to.",
				example: "9002336768",
			},
		],
		responseData: [
			{
				name: "client_ref_id",
				type: "string",
				description: "Unique reference id for this OTP flow, echoed back.",
				example: "211101129871",
			},
			{
				name: "otp_verification_token",
				label: "OTP Verification Token",
				type: "string",
				description:
					"Signed JWT proving the OTP was verified. Contains the verified mobile and a unique token id; valid for 5 minutes. Validate it with the Validate OTP-Verification-Token API.",
				imp: true,
				example: "eyJ0eXAiOiJKV1QiLCJ...5aXdrqrNcEbhfYfDsI",
			},
			{
				name: "initiator_id",
				type: "string",
				description:
					"Registered mobile number of the API user that initiated the call.",
				example: "1234567891",
			},
			{
				name: "mobile",
				label: "Verified Mobile",
				type: "string",
				description: "The mobile number that was verified.",
				imp: true,
				example: "9002336768",
			},
			{
				name: "tid",
				label: "Transaction ID",
				type: "string",
				description: "Unique transaction id for this verification.",
				example: "2886978475",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			response_type_id: 1632,
			message: "OTP verification successful.",
			data: {
				client_ref_id: "211101129871",
				otp_verification_token: "eyJ0eXAiOiJKV1QiLCJ...5aXdrqrNcEbhfYfDsI",
				initiator_id: "1234567891",
				mobile: "9002336768",
				tid: "2886978475",
			},
		},
		errorScenarios: [
			{
				scenario: "Incorrect or expired OTP",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					response_type_id: 1632,
					message: "OTP verification failed.",
					data: {},
				},
			},
		],
	},
	{
		id: "mobile-otp-validate-token",
		productId: "mobile-otp",
		name: "Validate OTP-Verification-Token",
		slug: "mobile-otp-validate-token",
		summary:
			"Validate an otp_verification_token as proof that OTP verification happened within the 5-minute time limit.",
		description:
			"Validates the authenticity of an `otp_verification_token` issued by the Verify OTP API, proving the OTP verification was actually performed within its 5-minute validity window. Returns `status` = 0 when the token is valid; a timed-out or tampered/invalid token returns `status` = 1 with a descriptive message.",
		relevance: "M",
		bestFor:
			"Server-to-server proof that a mobile OTP was verified recently, before honouring an OTP-gated action.",
		method: "GET",
		path: "/tools/kyc/mobile/otp/validate-token",
		docsUrl: "https://developers.eko.in/reference/mobile-otp-validate-token",
		extraRequestParams: [
			{
				name: "otp_verification_token",
				label: "OTP Verification Token",
				type: "string",
				required: true,
				description: "The signed JWT received from the Verify OTP API.",
				example: "eyJ0eXAiOiJKV1QiLCJ...5aXdrqrNcEbhfYfDsI",
			},
		],
		responseData: [
			{
				name: "client_ref_id",
				type: "string",
				description:
					"Unique reference id for the original OTP flow, echoed back.",
				example: "211101129871",
			},
			{
				name: "otp_verification_token",
				label: "OTP Verification Token",
				type: "string",
				description: "The token that was validated, echoed back.",
				example: "eyJ0eXAiOiJKV1QiLCJ...5aXdrqrNcEbhfYfDsI",
			},
			{
				name: "initiator_id",
				type: "string",
				description:
					"Registered mobile number of the API user that initiated the call.",
				example: "1234567891",
			},
			{
				name: "mobile",
				label: "Verified Mobile",
				type: "string",
				description: "The mobile number the token certifies as verified.",
				imp: true,
				example: "9002336768",
			},
			{
				name: "tid",
				label: "Transaction ID",
				type: "string",
				description: "Unique transaction id for this validation.",
				example: "2886978475",
			},
		],
		sampleSuccessResponse: {
			status: 0,
			response_status_id: 0,
			response_type_id: 1633,
			message: "OTP verification token is valid.",
			data: {
				client_ref_id: "211101129871",
				otp_verification_token: "eyJ0eXAiOiJKV1QiLCJ...5aXdrqrNcEbhfYfDsI",
				initiator_id: "1234567891",
				mobile: "9002336768",
				tid: "2886978475",
			},
		},
		errorScenarios: [
			{
				scenario: "Token timed out (older than 5 minutes)",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					response_type_id: 1634,
					message: "The OTP verification token has timed out.",
				},
			},
			{
				scenario: "Invalid or tampered token",
				statusCode: 200,
				example: {
					status: 1,
					response_status_id: 1,
					response_type_id: 1634,
					message: "The OTP verification token is invalid.",
				},
			},
		],
	},
];

/** Lookup a spec by its unique id. */
export const API_SPECS_MAP: Record<string, ApiSpec> = Object.fromEntries(
	API_SPECS.map((spec) => [spec.id, spec]),
);

/** All specs for a product, ordered by relevance (H > M > L). */
export const getSpecsForProduct = (productId: string): ApiSpec[] => {
	const order: Record<string, number> = { H: 0, M: 1, L: 2 };
	return API_SPECS.filter((spec) => spec.productId === productId).sort(
		(a, b) =>
			(order[a.relevance ?? "M"] ?? 1) - (order[b.relevance ?? "M"] ?? 1),
	);
};
