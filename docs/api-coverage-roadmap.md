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
| AePS Cash Withdrawal | `aeps-cash-withdrawal` | POST | `/customer/collection/aeps-fingpay/cash-withdrawal/{customer_id}` | split; dropped `service_type`; `customer_id`→path |
| AePS Balance Enquiry | `aeps-balance-enquiry` | POST | `/customer/collection/aeps-fingpay/balance-enquiry/{customer_id}` | split; dropped `service_type`; `customer_id`→path |
| AePS Mini Statement | `aeps-mini-statement` | POST | `/customer/collection/aeps-fingpay/mini-statement/{customer_id}` | split; dropped `service_type`; `customer_id`→path |
| AePS Aadhaar Pay | `aeps-aadhaar-pay` | POST | `/customer/collection/aeps-fingpay` | ⛔ unchanged — no master path in source table; split pending backend confirmation |
| DMT-Levin Generate Aadhaar OTP | `aadhaar-dmt-levin-validate` | POST | `/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp` | already master ✅ |
| DMT-Levin Validate Aadhaar OTP | `aadhaar-dmt-levin-verify-otp` | POST | `/customer/payment/dmt-levin/sender/{customer_id}/aadhaar/otp/verify` | already master ✅ |

**Dropped:** DMT-Airtel rail — not present in developers.eko.in/reference.
**Flagged for backend confirmation:** AePS `service_type` removal (request); AePS response `service_type`
echo retained pending confirmation; `aeps-aadhaar-pay` split.

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

## Phase 4 — AePS Fund Settlement ⬜ (product `aeps`)

`user_code`-keyed (not `customer_id`).

| Capability | Target slug | Method | Status |
| :-- | :-- | :-- | :-- |
| Initiate Settlement | `aeps-initiate-settlement` | POST | ⬜ |
| Add Settlement Bank Account | `aeps-add-settlement-bank` | POST | ⬜ |
| Add Settlement Bank (offline variant) | `aeps-add-settlement-bank-offline` | POST | ⬜ |
| Get Settlement Bank Accounts | `aeps-get-settlement-banks` | GET | ⬜ |
| Settlement section overview | _guide page_ | — | ⬜ |

---

## Phase 5 — Transaction lifecycle & refunds ⬜ (product `transactions`)

| Capability | Target slug | Method | Status |
| :-- | :-- | :-- | :-- |
| Transaction Inquiry (status by TID / client_ref_id) | `transaction-inquiry` | GET | ⬜ |
| Get Refund OTP | `get-refund-otp` | POST | ⬜ |
| Initiate Refund | `initiate-refund` | POST | ⬜ |
| Saved / scheduled transactions | `scheduled-transactions` | _?_ | ⬜ |
| Transaction Status Callback (webhooks) | _doc page, not a request spec_ | — | ⬜ — decide page-vs-spec representation |

---

## Phase 6 — Helpers, verification extras, BBPS extras ⬜

| Capability | Target slug | Product | Status |
| :-- | :-- | :-- | :-- |
| Get Banks / Bank Details / IFSC Details | `get-banks`, `get-ifsc-details` | `utilities` | ⬜ |
| Mobile OTP — Send / Verify (generic) | `mobile-otp-send`, `mobile-otp-verify` | `utilities` | ⬜ |
| Bulk PAN — Status poll | `pan-bulk-status` | `pan` | ⬜ |
| PAN Comprehensive | `pan-comprehensive` | `pan` | ⬜ |
| Bulk Bank — Status poll | `bank-bulk-status` | `bank` | ⬜ |
| Bank Verification — Pennyless | `bank-pennyless` | `bank` | ⬜ |
| Bank Verification — Pennydrop | `bank-pennydrop` | `bank` | ⬜ |
| DigiLocker — Status poll | `digilocker-status` | `digilocker` | ⬜ |
| Advance GST | `advance-gst` | `gst` | ⬜ |
| BBPS — Get Operator Code & Circle | `bbps-operator-code-circle` | `bbps` | ⬜ |
| BBPS — Get Recharge Plans | `bbps-recharge-plans` | `bbps` | ⬜ |

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
