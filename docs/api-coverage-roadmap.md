# EPS Developer Portal — API Coverage Roadmap

Master backlog for bringing the new portal (`src/lib/data/api-specs.ts`) to **full parity** with the
legacy EPS docs, on the **master endpoint nomenclature** (`/customer/payment/<rail>/sender/{customer_id}/...`).

`api-specs.ts` is the single source of truth — docs pages, generated markdown, OpenAPI, SDK + Postman,
the agent bundle, and the `eps` MCP mirror are all baked from it via `npm run build` (`bake:all`).

**Authoring rules (every new endpoint):** author from its developers.eko.in reference page; record the
**source URL + fetch date** in the row and the spec's `sourceDoc`. **Do not fabricate** params,
examples, responses, or error codes for financial/KYC rails — if the reference lacks a concrete value
the `ApiSpec` shape needs, mark the row `blocked: source incomplete` and defer rather than ship a
half-spec. Slug renames/deletes get `/docs/<old>` redirects (`netlify.toml` + `vercel.json`). New
specs **omit `category`** (derived from product via `categoryForSpec`). New products go in
`api-products.ts` first.

Status legend: ✅ done · 🔜 next tranche · ⬜ pending · ⛔ blocked (source/backend confirmation).

---

## Phase 1 — Nomenclature alignment ✅ (shipped)

| Capability | Slug | Method | Path | Notes |
| :-- | :-- | :-- | :-- | :-- |
| DMT-Fino Get Sender | `dmt-get-sender` | GET | `/customer/payment/dmt-fino/sender/{customer_id}` | path |
| DMT-Fino Onboard Sender | `dmt-onboard-sender` | POST | `/customer/payment/dmt-fino/sender/{customer_id}` | path |
| DMT-Fino Customer KYC OTP | `dmt-fino-sender-ekyc` | PUT | `/customer/payment/dmt-fino/sender/{customer_id}/otp` | renamed + path + method |
| DMT-Fino Validate KYC OTP | `dmt-fino-validate-ekyc-otp` | PUT | `/customer/payment/dmt-fino/sender/{customer_id}/otp/verify` | renamed + path + method |
| ~~`aadhaar-dmt-fino-ekyc`~~ | — | — | — | deleted dup → redirect to `dmt-fino-sender-ekyc` |
| ~~`aadhaar-dmt-fino-verify-otp`~~ | — | — | — | deleted dup → redirect to `dmt-fino-validate-ekyc-otp` |
| PPI-Levin Validate Aadhaar | `aadhaar-ppi-levin-validate` | POST | `/customer/payment/ppi-levin/sender/{customer_id}/aadhaar/otp` | path |
| PPI-Levin Validate Aadhaar OTP | `aadhaar-ppi-levin-verify-otp` | POST | `/customer/payment/ppi-levin/sender/{customer_id}/aadhaar/otp/verify` | path — **fixed wrong-rail bug** |
| AePS Cash Withdrawal | `aeps-cash-withdrawal` | POST | `/customer/collection/aeps-fingpay/cash-withdrawl/{customer_id}` | split; dropped `service_type`; `customer_id`→path; provider spelling `cash-withdrawl` |
| AePS Balance Enquiry | `aeps-balance-enquiry` | POST | `/customer/collection/aeps-fingpay/balance-enquiry/{customer_id}` | split; dropped `service_type`; `customer_id`→path |
| AePS Mini Statement | `aeps-mini-statement` | POST | `/customer/collection/aeps-fingpay/mini-statement/{customer_id}` | split; dropped `service_type`; `customer_id`→path |
| AePS Aadhaar Pay | `aeps-aadhaar-pay` | POST | `/customer/collection/aeps-fingpay` | ⛔ unchanged — no master path in source table; split pending backend confirmation |
| DMT-Levin Generate Aadhaar OTP | `aadhaar-dmt-levin-validate` | POST | `/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp` | already master ✅ |
| DMT-Levin Validate Aadhaar OTP | `aadhaar-dmt-levin-verify-otp` | POST | `/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp/verify` | already master ✅ |

**Dropped:** DMT-Airtel rail — not present in developers.eko.in/reference.
**Flagged for backend confirmation:** `aeps-aadhaar-pay` split.
**Confirmed (2026-07-18, provider AePS transaction docs §6.1–6.3):** `service_type` gone from
both request and response for cash-withdrawal / balance-enquiry / mini-statement (endpoints are now
path-differentiated); cash-withdrawal path is the provider's `cash-withdrawl` spelling; request drops
`pipe`/`notify_customer`/`source_ip` and renames `aadhaar`→`aadhar`; response shapes rewritten with
real `response_type_id`s (1463/1464/1465, 1466, 1527/1528).

---

## Phase 2 — PPI rails to parity 🔜 (next tranche)

New product needed: `ppi-digikhata`. Un-disable `ppi-levin` product once authored.

### PPI-Levin (complete the rail; ~11)
| Capability | Target slug | Method | Path | Source URL | Status |
Inventory below is **sourced** from developers.eko.in (`/reference/<slug>`). Request side is fetchable;
response bodies are JS-walled, so response payloads are **pasted by the user** per endpoint. `*` =
shipped in Phase 1. **PPI-Levin rail ✅ complete** (product `ppi-levin` un-disabled).

| Capability | Target slug | Method | Reference slug | Status |
| :-- | :-- | :-- | :-- | :-- |
| Get Sender Information | `ppi-levin-get-sender` | GET | `ppi-levin-get-sender-profile` | ✅ |
| Onboard Sender | `ppi-levin-onboard-sender` | POST | `ppi-levin-onboard-sender` | ✅ |
| Verify Sender OTP | `ppi-levin-verify-otp` | POST | `ppi-levin-verify-sender-otp` | ✅ |
| Validate Aadhaar* | `aadhaar-ppi-levin-validate` | POST | `ppi-levin-validate-aadhar` | ✅ Phase 1 |
| Validate Aadhaar OTP* | `aadhaar-ppi-levin-verify-otp` | POST | `ppi-levin-validate-sender-aadhaar-otp` | ✅ Phase 1 |
| Validate PAN | `ppi-levin-validate-pan` | POST | `ppi-levin-validate-pan` | ✅ |
| Get List of Recipients | `ppi-levin-get-recipients` | GET | `ppi-levin-get-list-of-recipients` | ✅ |
| Add Recipient | `ppi-levin-add-recipient` | POST | `ppi-levin-add-recipient` | ✅ |
| Add Recipient Bank | `ppi-levin-add-recipient-bank` | POST | `ppi-levin-add-recipient-bank` | ✅ |
| Send Transaction OTP | `ppi-levin-send-transaction-otp` | POST | `ppi-levin-send-transaction-otp` | ✅ |
| Initiate Transaction | `ppi-levin-initiate-transaction` | POST | `ppi-levin-initiate-transaction` | ✅ |

Live-path note: the live API is itself mid-migration — e.g. Verify Sender OTP serves
`/customer/account/{customer_id}/ppi-levin/otp/verify` (legacy) while Add Recipient serves
`/customer/payment/ppi-levin/sender/{customer_id}/recipient` (master). Per the locked "master
nomenclature" decision we encode the master path; the reference slug records live reality and try-it may
need the live path until the backend finishes migrating.

### PPI-DigiKhata ✅ complete (new rail; 16) — product `ppi-digikhata` (responses pasted by user)
| Capability | Target slug | Method | Reference slug | Status |
| :-- | :-- | :-- | :-- | :-- |
| Get Sender Information | `ppi-digikhata-get-sender` | GET | `get-sender-information` | ✅ |
| Onboard Sender | `ppi-digikhata-onboard-sender` | POST | `onboard-sender` | ✅ |
| Generate Sender Verification OTP | `ppi-digikhata-generate-sender-otp` | POST | `generate-sender-otp` | ✅ |
| Verify Sender OTP | `ppi-digikhata-verify-otp` | POST | `verify-sender-otp` | ✅ |
| Get Aadhaar KYC Consent Languages | `ppi-digikhata-consent-languages` | GET | `get-digikhata-aadhaar-kyc-consent-languages` | ✅ |
| Get Aadhaar KYC Consent Details | `ppi-digikhata-consent-details` | GET | `get-digikhata-aadhaar-kyc-consent-details` | ✅ |
| Generate Sender Aadhaar OTP | `ppi-digikhata-generate-aadhaar-otp` | POST | `generate-sender-aadhaar-otp` | ✅ |
| Validate Sender Aadhaar OTP | `ppi-digikhata-verify-aadhaar-otp` | POST | `verify-aadhaar-otp` | ✅ |
| Validate Sender PAN | `ppi-digikhata-validate-pan` | POST | `verify-pan` | ✅ |
| Load Sender DigiKhata Wallet | `ppi-digikhata-load-wallet` | POST | `load-digikhata-wallet` | ✅ |
| Get List of Recipients | `ppi-digikhata-get-recipients` | GET | `get-all-recipients` | ✅ |
| Add Recipient | `ppi-digikhata-add-recipient` | POST | `paypoint-add-recipient` | ✅ |
| Generate Add Recipient Bank OTP | `ppi-digikhata-recipient-bank-otp` | POST | `recipient-bank-registration` | ✅ |
| Validate OTP to Add Recipient | `ppi-digikhata-validate-recipient-otp` | POST | `validate-otp` | ✅ |
| Send Transaction OTP | `ppi-digikhata-send-transaction-otp` | POST | `send-transaction-otp` | ✅ |
| Initiate Transaction | `ppi-digikhata-initiate-transaction` | POST | `initiate-ppi-transaction` | ✅ |

> **Phase 2 ✅ DONE** — both PPI rails shipped (25 new specs; `ppi-levin` un-disabled, `ppi-digikhata`
> product added). Response payloads were user-pasted (ReadMe "Try It!" responses aren't machine-fetchable;
> no public OpenAPI/Postman export). Same paste workflow applies to Phases 3–6.

---

## Phase 3 — User/Agent + Customer management ⬜

New products: `user-management`, `customer-management` (confirm whether customer folds into user-management).

Products `user-management` + `customer-management` added. Responses user-pasted.

| Capability | Target slug | Method | Path | Product | Status |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Onboard User (agent/merchant) | `onboard-user` | POST | `/user/network/eps-agent` | `user-management` | ✅ |
| Get User's Services | `get-user-services` | GET | `/user/account/services` | `user-management` | ✅ |
| Get All Services (codes) | `get-all-services` | GET | `/tools/catalog/service-codes` | `user-management` | ✅ |
| Get Settlement Account Balance | `get-wallet-balance` | GET | `/user/account/balance` | `user-management` | ✅ |
| Activate Service for User | `activate-user-service` | PUT | `/admin/network/agent/{user_code}/service/{service_code}/activate` | `user-management` | ⛔ response pending |
| Deactivate Service for User | `deactivate-user-service` | PUT | `/admin/network/agent/{user_code}/service/{service_code}/deactivate` | `user-management` | ⛔ response pending |
| Onboard Customer | `onboard-customer` | POST | `/customer/account/{customer_id}` | `customer-management` | ✅ |
| Get Customer Information | `get-customer-info` | GET | `/customer/profile/{customer_id}` | `customer-management` | ✅ |
| Verify Customer OTP | `verify-customer-otp` | POST | `/customer/account/{customer_id}/otp/verify` | `customer-management` | ✅ |
| Get Agent Network (list) | `get-agent-network` | GET | `/user/network/eps-agent` | `user-management` | ⛔ deferred — no distinct reference page (path documents only the POST Onboard User) |

Open Phase-3 items: **Activate / Deactivate Service** await response samples (generic
`/service/{service_code}/` paths captured; distinct from the AePS/BBPS service-specific activation
specs, so no contract is fabricated). **Get Agent Network (GET)** has no separate reference page —
confirm it exists (vs. being only the POST onboarding path) before authoring.

---

## Phase 4 — AePS Fund Settlement ✅ (product `aeps`; all v3)

| Capability | Target slug | Method | Path | Status |
| :-- | :-- | :-- | :-- | :-- |
| Add Settlement Bank Account | `aeps-add-settlement-account` | POST | `/user/payment/aeps/settlement/account` | ✅ |
| Get Settlement Bank Accounts | `aeps-get-settlement-accounts` | GET | `/user/payment/aeps/settlement/accounts` | ✅ |
| Initiate Settlement (financial) | `aeps-initiate-settlement` | POST | `/user/payment/aeps/settlement` | ✅ |

The "offline variant" in the original report is not a distinct endpoint in the live reference (only the
3 above). Section overview is a docs guide, not an `ApiSpec`.

---

## Phase 5 — Transaction lifecycle & refunds ✅ (product `transactions`)

| Capability | Target slug | Method | Path | Status |
| :-- | :-- | :-- | :-- | :-- |
| Transaction Inquiry (status by TID / client_ref_id) | `transaction-inquiry` | GET | `/tools/reference/transaction/{transaction-reference}` | ✅ |
| Get Refund OTP | `get-refund-otp` | POST | `/customer/payment/refund/{tid}/otp` | ✅ |
| Initiate Refund (financial) | `initiate-refund` | POST | `/customer/payment/refund/{tid}` | ✅ |
| Transaction Status Callback (webhook) | — | — | `transaction-status-callback` | ⬜ doc/guide, not an `ApiSpec` (you receive it) — defer to a guide page |
| Saved / scheduled transactions | — | — | — | ⬜ not a distinct endpoint in the live reference — dropped |

---

## Phase 6 — Helpers, verification extras, BBPS extras (partial)

Utilities product added. Some "extras" already existed pre-Phase-6 (`pan-bulk-status`,
`digilocker-verification-status`, `pan-advanced` → done). Existing `bank-account-verification` is the
`/bank-account/sync` penny-drop; pennydrop/pennyless `/touras/…` are distinct new endpoints.

| Capability | Target slug | Method | Path | Product | Status |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Get Bank Details | `get-bank-details` | GET | `/tools/reference/bank/{bank_code}` | `utilities` | ✅ |
| Get IFSC Details | `get-ifsc-details` | GET | `/tools/reference/banks/ifsc/{ifsc}` | `utilities` | ✅ |
| Get Operator Code & Circle | `bbps-operator-code-circle` | GET | `…/bbps/recharge/{customer_mobile}/operator` | `bbps` | ✅ (group: Recharge Lookups) |
| Bulk Bank Verification — Status | `bulk-bank-account-verification-status` | GET | `/tools/kyc/bank-account/bulk/status` | `bank` | ✅ |
| Send OTP (generic) | `mobile-otp-send` | POST | `/tools/kyc/mobile/otp` | `utilities` | ⛔ response pending |
| Verify OTP (generic) | `mobile-otp-verify` | PUT | `/tools/kyc/mobile/otp/verify` | `utilities` | ⛔ response pending |
| Get Banks | `get-banks` | GET | `/tools/reference/banks` | `utilities` | ⛔ response pending |
| Get Recharge Plans | `bbps-recharge-plans` | GET | `…/operator/plans` | `bbps` | ✅ |
| Get District Discome (UPPCL) | `bbps-district-discome` | GET | `…/bbps/operators/190/district-discome` | `bbps` | ✅ |
| PAN Comprehensive | `pan-comprehensive` | POST | `/tools/kyc/touras/pan-verification` | `pan` | ⛔ response pending |
| Bank Verification — Pennydrop | `bank-pennydrop` | POST | `/tools/kyc/touras/bank-acc-verify-pennydrop` | `bank` | ⛔ response pending |
| Bank Verification — Pennyless | `bank-account-verification-pennyless` | POST | `/tools/kyc/bank-acc-verify-pennyless` | `bank` | ✅ |
| Advance GST | `advance-gst` | POST | `/tools/kyc/touras/advance-gst` | `gst` | ⛔ response pending |

All ⛔ rows have **request side captured**; awaiting user-pasted responses to author without fabrication.

## Outstanding (blocked on user-pasted responses; request side captured)
- **Phase 3:** Activate / Deactivate Service for User; Get Agent Network (GET — confirm it exists).
- **Phase 5:** Transaction Status Callback (webhook → guide page, not an `ApiSpec`).
- **Phase 6:** Send/Verify OTP, Get Banks, PAN Comprehensive, Bank Pennydrop, Advance GST.
  (Get Recharge Plans is done — the 2026-08 BBPS reference supplied the response.)

---

## BBPS re-authored from the 2026-08 reference

The whole BBPS block was rewritten against Eko's updated BBPS guide. The previous entries had been
authored from guesswork and did not match the live API. Do not reintroduce the old shapes:

| Was (wrong) | Is (per the reference) |
| :-- | :-- |
| `data.categories[]` / `data.locations[]` / `data.operators[]` | `param_attributes.list_elements[]` |
| `5 = Electricity`, `1 = Prepaid` | `8 = Electricity`, `1 = Broadband Postpaid` |
| `operator_id` on Fetch Bill / Pay Bill | **`phone_operator_code`** (still `operator_id` in the Get Operators *response*) |
| `bill_amount` in **paise** | `amount` in **rupees** (`"2870.0"`) |
| `due_date`, `bill_number`, `customer_name` | `billDueDate` (`YYYYMMDD`), `customer_id`, `utilitycustomername` |
| fetch→pay carryover = `billfetchresponse` token | carryover = `amount` + `utilitycustomername` |
| `latlong`, `hc_channel`, `dob`, `cycle_number`, `authenticator`, `postalcode` | not in the reference — removed |
| error codes `131`, `151`, `347`, `148` | `97`, `208`, `319`, `1468` |

Also note:
- `operator_location_id` is a zero-padded **string** (`"06"`), not a number.
- Fetch Bill returns `response_status_id: -1` on success — branch on `status` / `response_type_id`.
- District Discome (`2434`) and Recharge Plans (`1805`) signal failure while still returning
  `status: 0` — branch on `response_type_id` for those two.
- `circle_area` (Get Operator Code and Circle) is passed as **`circleid`** to Get Recharge Plans.
- Per-operator fields come from Get Operator Parameters and must go to **both** Fetch Bill and
  Pay Bill. The documented params are only the common set.

**Resolved (2026-08-05):** the reference marks Pay Bill's `utilitycustomername` required, but its
only source is Fetch Bill — which a prepaid recharge skips. Confirmed with Eko: the field is
**optional**, and mandatory only for bill payments where Bill Fetch was done. `bbps-pay-bill` now
carries `required: false` with that condition in the param description, and the
`bbps-mobile-recharge` recipe tells the integrator to omit it.

### Retired BBPS specs (2026-08)

Both are `disabled: true` rather than deleted, per the `ApiSpec.disabled` convention — the
researched request/response data survives in `api-specs.ts` if they are ever needed again.

| Spec | Why | Use instead |
| :-- | :-- | :-- |
| `bbps-transaction-status` | Only ever aliased the generic endpoint — same path, same contract | `transaction-inquiry` (now the final step of `bbps-bill-payment`) |
| `bbps-activate-service` | Agent onboarding is not BBPS-specific | `activate-user-service`, passing the BBPS `service_code` |

Removing `bbps-transaction-status` left `transaction-inquiry` alone on
`GET /tools/reference/transaction/{transaction-reference}`, so the OpenAPI "non-`-status` spec wins
primary" test no longer had a production collision to assert on. It now builds a synthetic pair
instead — the same idiom the neighbouring body-discriminated-variant test already used.

### BBPS docs nav order

BBPS specs carry a `group` tag, so the docs nav renders as: **Bill Payment Lookups** (categories,
locations, operators, operator parameters, district discome) → **Recharge Lookups** (operator code
and circle, recharge plans) → ungrouped **Fetch BBPS Bill**, **Pay BBPS Bill**.

Two ordering rules drive this and are easy to trip over when editing:
- **Groups render in first-appearance file order**, so the spec array order in `api-specs.ts` is
  load-bearing — the ungrouped fetch/pay pair must stay *after* both grouped blocks to hoist last.
- **Leaves within a group sort by `relevance`**, not file order (stable, so equal relevance falls
  back to file order). District Discome is `relevance: "L"`, which is what keeps it last inside
  Bill Payment Lookups.

---

## Cross-cutting flagged decisions
- Un-disable `ppi-levin`; visibility (`disabled`) of new `ppi-digikhata` / `user-management` /
  `customer-management` / `transactions` / `utilities` products (disabled → no product-index card, docs
  still render).
- `customer-management` standalone vs folded into `user-management`.
- Generic Activate Service vs existing AePS/BBPS activation specs — reconcile, don't fabricate.
- Transaction Status Callback — doc page vs callable spec representation.
- `operationId` rename break for the two Fino specs — alias vs accept (redirects added for docs URLs).
- Whether `ApiSpec.sourceDoc` is the agreed home for source provenance (already an optional field).
