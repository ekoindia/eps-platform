# Semantics review sheet (agent-readiness Phase 3.1)

_Drafted 2026-10-08. **Signed off 2026-10-15** and applied: every documented spec in `src/lib/data/api-specs.ts` now carries `semantics`, and `assertSemantics` fails the build when one is missing (see §1). Step 3.1 of [agent-readiness-review.md](agent-readiness-review.md#phase-3--semantics-model)._

**Why labels are reviewed by hand.** A wrong label is worse than none. An agent that trusts `idempotent: true` will retry, and a retry on the wrong endpoint sends a second OTP, opens a second recipient or moves money twice. So every value was proposed with evidence and a confidence, and a human signed it off before it became data.

## 1. The field (as implemented)

`ApiSemantics` and `SideEffect` live in `src/lib/data/api-specs-common.ts`:

```ts
interface ApiSemantics {
	readOnly: boolean;       // changes nothing at Eko, the bank or any third party (logging and billing aside)
	idempotent: boolean;     // a repeat with the same arguments causes no further state change; billing NOT counted
	billable: boolean;       // Eko debits your account a per-call charge; commission you EARN is not a charge
	sideEffects?: SideEffect[]; // absent when readOnly; at least one entry otherwise
}

type SideEffect =
	| "moves-money"   // transfers, refunds, settlements, ₹1 penny-drops. Destructive.
	| "sends-otp" | "consumes-otp" | "creates" | "updates"
	| "deactivates"   // turns a service off. Destructive.
	| "enqueues" | "opens-session";
```

**Enforcement.** `assertSemantics(specs)` runs inside `buildAgentBundle` over `getDocumentedSpecs()`, the specs of active products. It throws, naming every offender, when a spec has no `semantics`, a read-only spec lists side effects, or a writing spec lists none. The field is optional in the type only so that specs of disabled products stay unlabelled. Re-enabling a product therefore fails the build until its specs are labelled.

**Not yet consumed.** Nothing reads the field yet. Steps 3.2 (MCP hints), 3.3 (OpenAPI, bundle, SDK retry) and 3.4 (docs badges) emit it.

## 2. Labelling rules

1. **`idempotent: true` only with evidence.** A wrong `false` costs a retry the caller could have made. A wrong `true` duplicates a side effect. Set-state calls and lookups qualify. Creates stay `false` even where a repeat returns an error: the error proves no duplicate, but not that a retry is safe to treat as success.
2. **`readOnly` is about effects, not method.** All 26 documented GET specs are read-only, and so are 24 POST lookups (verification, balance enquiry, mini statement).
3. **`billable` follows the price lists.** `api-pricing.ts` holds verification charges. `dmt-pricing.ts` holds the DMT per-transfer charge and the sender-KYC and recipient-verification add-ons. Commission earned in `payments-pricing.ts` (AePS, BBPS) is not a charge.
4. **`financial` stays separate.** It selects the response envelope, not the risk (see §4).

Proposed retry rule for 3.3: an SDK may auto-retry a call only when `idempotent && !billable && !sideEffects?.includes("moves-money")`. A paid lookup is never retried automatically, because a timed-out call may have succeeded and been charged. This includes the billable GET `digilocker-verification-status`.

## 3. Review answers (2026-10-15)

| Question | Answer | Applied |
|---|---|---|
| Upstream-cost calls | Operator/circle lookup, BBPS fetch bill and refunds are free. DMT sender eKYC is charged. PPI and QR are skipped (products disabled) | Labels |
| `get-ifsc-details` | ₹1 + GST per lookup | Price row `bank-ifsc` restored under Bank & IFSC |
| Bulk status polls | `pan-bulk-status` is free; the provider bills the bulk submit only | Not billable |
| QR webhook | Exempt via a `kind: "webhook"` marker | Deferred: QR is a disabled product, so the guard never sees it. Add the marker when it returns |
| Penny-drops in add-recipient / add-settlement-account | DMT add-recipient does no penny-drop. AePS add-settlement-account does one at Eko's cost | `moves-money` on settlement account, not billable |
| Repeat onboard | Returns an error | Kept not idempotent |
| `ip` | ₹2.5 + GST | Price row `ip` added |
| PPI transfers | Review when PPI is re-enabled | Deferred (§7) |
| DigiLocker | Create URL free; Get Document and each Verification Status call ₹2.5 + GST | Price rows re-keyed (status row has no setup fee) |
| DMT add-on fees | Same for Fino and Levin: sender KYC ₹11 incl. GST, recipient verification ₹3.54 incl. GST, both billed on the API call | `dmt-pricing.ts` updated (was ₹11 + GST and ₹3.25) |

## 4. Data findings

| Finding | Spec | Status |
|---|---|---|
| `financial: true`, but the description says no money moves and the sample response has no `tx_status` | `aeps-fingpay-balance-enquiry`, `aeps-fingpay-mini-statement` | Resolved 2026-10-15: flag dropped (docs show the common envelope, no SDK auto-inquiry, no try-it double-click). Idempotent set to ❌ so `isRetrySafe` stays false: each call spends a single-use biometric PID block |
| Moves money and returns a fee, but `financial` is unset | `ppi-digikhata-load-wallet` | Deferred with PPI |
| `financial: true` on a URL generator | `cms-get-url` | Deferred with CMS |
| GET with its own price row | `pan-bulk-status` | Resolved: free, row removed (74386e75) |
| IFSC lookup unpriced | `get-ifsc-details` | Resolved: ₹1 row added |

## 5. Summary (documented specs)

| Count | Value |
|---|---|
| Specs labelled | 84 |
| Read-only | 50 |
| Idempotent | 50 |
| Billable | 35 |
| Moves money | 9 |
| Sends an OTP | 9 |
| Labelled by analogy, awaiting review | 9 (DMT-Levin) |

## 6. Sheet: documented specs

Grouped by product in `API_SPECS` order. Legend: ✅ true · ❌ false · 💰 spec has `financial: true`. Confidence: **H** price list, reviewer or the spec's own description · **M** inferred from the description or flow. Changing a value means changing it in `api-specs.ts` and here.

### dmt – Fino

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `dmt-get-sender` | GET | ✅ | ✅ | ❌ |  | H | No price row; DMT charge is per transfer |
| `dmt-onboard-sender` | POST | ❌ | ❌ | ❌ | creates | M | A repeat for the same mobile returns an error. Kept not idempotent (conservative) |
| `dmt-fino-sender-ekyc` | PUT | ❌ | ❌ | ✅ | updates, sends-otp | H | ₹11 incl. GST once per new sender (same for Levin); repeat KYC is free. PID single-use |
| `dmt-fino-validate-ekyc-otp` | PUT | ❌ | ❌ | ❌ | consumes-otp, updates | H | Upgrades sender limit ₹5k → ₹25k |
| `dmt-get-recipients` | GET | ✅ | ✅ | ❌ |  | H |  |
| `dmt-add-recipient` | POST | ❌ | ❌ | ✅ | creates | H | No penny-drop. ₹3.54 incl. GST per new recipient (same for Levin) |
| `dmt-send-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `dmt-initiate-transfer` 💰 | POST | ❌ | ❌ | ✅ | moves-money | H | Per-transaction Eko charge (dmt-pricing), same for Levin |

### dmt – Levin

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `dmt-levin-get-sender` | GET | ✅ | ✅ | ❌ |  | M | By analogy with DMT-Fino, review later. |
| `dmt-levin-onboard-sender` | POST | ❌ | ❌ | ❌ | creates, sends-otp | M | By analogy with DMT-Fino, review later. Returns otp_ref_id; description implies an OTP to the sender |
| `aadhaar-dmt-levin-validate` | POST | ❌ | ❌ | ❌ | sends-otp | M | By analogy with DMT-Fino, review later. |
| `aadhaar-dmt-levin-verify-otp` | POST | ❌ | ❌ | ❌ | consumes-otp, updates | M | By analogy with DMT-Fino, review later. |
| `dmt-levin-sender-ekyc` | POST | ❌ | ❌ | ✅ | updates | M | By analogy with DMT-Fino, review later. ₹11 incl. GST once per new sender, same as Fino. PID single-use |
| `dmt-levin-get-recipients` | GET | ✅ | ✅ | ❌ |  | M | By analogy with DMT-Fino, review later. |
| `dmt-levin-add-recipient` | POST | ❌ | ❌ | ✅ | creates, updates | M | By analogy with DMT-Fino, review later. Adds or updates a recipient. ₹3.54 incl. GST per new recipient. Max 5 per day |
| `dmt-levin-send-otp` | POST | ❌ | ❌ | ❌ | sends-otp | M | By analogy with DMT-Fino, review later. |
| `dmt-levin-initiate-transfer` 💰 | POST | ❌ | ❌ | ✅ | moves-money | M | By analogy with DMT-Fino, review later. Per-transaction Eko charge (dmt-pricing), same as Fino |

### aeps

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `activate-aeps-fingpay` | PUT | ❌ | ✅ | ❌ | updates | M | Uploads KYC docs; repeat activation is a no-op (reviewer) |
| `aeps-fingpay-shop-types` | GET | ✅ | ✅ | ❌ |  | H |  |
| `aeps-fingpay-states` | GET | ✅ | ✅ | ❌ |  | H |  |
| `aeps-fingpay-send-otp-kyc` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `aeps-fingpay-verify-otp-kyc` | PUT | ❌ | ❌ | ❌ | consumes-otp | H |  |
| `aeps-fingpay-biometric-ekyc` | PUT | ❌ | ❌ | ❌ | updates | H | One-time eKYC; PID single-use |
| `aeps-fingpay-daily-auth` | PUT | ❌ | ❌ | ❌ | updates | H | Unlocks the agent for the day; PID single-use |
| `aeps-fingpay-cash-withdrawal-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `aeps-fingpay-cash-withdrawal` 💰 | POST | ❌ | ❌ | ❌ | moves-money | H | Partner EARNS commission (payments-pricing), not a charge |
| `aeps-fingpay-balance-enquiry` | POST | ✅ | ❌ | ❌ |  | M | Not financial (no `tx_status`). Not idempotent: single-use PID block. No price row |
| `aeps-fingpay-mini-statement` | POST | ✅ | ❌ | ❌ |  | M | Not financial (no `tx_status`). Not idempotent: single-use PID block. Earns ₹0.75 commission |
| `aeps-add-settlement-account` | POST | ❌ | ❌ | ❌ | creates, moves-money | M | Free to you; Eko does a real ₹1 penny-drop and bears the cost. Max 3 per agent |
| `aeps-get-settlement-accounts` | GET | ✅ | ✅ | ❌ |  | H |  |
| `aeps-initiate-settlement` 💰 | POST | ❌ | ❌ | ✅ | moves-money | M | Response returns a fee |

### bbps

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `bbps-get-categories` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-get-locations` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-get-operators` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-get-operator-parameters` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-district-discome` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-operator-code-circle` | GET | ✅ | ✅ | ❌ |  | M | Free - no charges for this API call |
| `bbps-recharge-plans` | GET | ✅ | ✅ | ❌ |  | H |  |
| `bbps-fetch-bill` | GET | ✅ | ✅ | ❌ |  | M | Hits the biller over BBPS; Bill fetch is free |
| `bbps-pay-bill` 💰 | POST | ❌ | ❌ | ❌ | moves-money | H | Partner EARNS commission per category |

### pan

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `pan-fetch` | POST | ✅ | ✅ | ✅ |  | H |  |
| `pan-lite` | POST | ✅ | ✅ | ✅ |  | H |  |
| `pan-advanced` | POST | ✅ | ✅ | ✅ |  | H |  |
| `pan-bulk-verify` | POST | ❌ | ❌ | ✅ | enqueues | H | Billed per PAN in the batch (₹1.20 + GST) |
| `pan-bulk-status` | GET | ✅ | ✅ | ❌ |  | H | Free. The bulk submit is billed per PAN; polls are not (price row removed in 74386e75) |

### user-management

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `onboard-user` | POST | ❌ | ❌ | ❌ | creates | M | A repeat returns an error. Kept not idempotent (conservative) |
| `activate-user-service` | PUT | ❌ | ❌ | ❌ | updates | M | Set-state op, kept not idempotent per review |
| `deactivate-user-service` | PUT | ❌ | ✅ | ❌ | deactivates | M | Set-state op; destructive (agent loses the service) |
| `get-user-services` | GET | ✅ | ✅ | ❌ |  | H |  |
| `get-all-services` | GET | ✅ | ✅ | ❌ |  | H |  |
| `get-wallet-balance` | GET | ✅ | ✅ | ❌ |  | H |  |

### transactions

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `transaction-inquiry` | GET | ✅ | ✅ | ❌ |  | H |  |
| `get-refund-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `initiate-refund` 💰 | POST | ❌ | ❌ | ❌ | moves-money | M | Free |

### bank-info

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `get-banks` | GET | ✅ | ✅ | ❌ |  | H |  |
| `get-bank-details` | GET | ✅ | ✅ | ❌ |  | H |  |
| `get-ifsc-details` | GET | ✅ | ✅ | ✅ |  | H | ₹1 + GST per lookup (price row `bank-ifsc`) |

### digilocker

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `digilocker-create-url` | POST | ❌ | ❌ | ❌ | opens-session | H | Free |
| `digilocker-get-document` | POST | ✅ | ✅ | ✅ |  | H | ₹2.5 + GST (price row `digilocker-get-document`) |
| `digilocker-verification-status` | GET | ✅ | ✅ | ✅ |  | H | ₹2.5 + GST per check (price row `digilocker-verification-status`, no setup fee). Billable GET: never auto-retry |

### bank

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `bank-account-verification` | POST | ❌ | ❌ | ✅ | moves-money | H | Live ₹1 penny-drop, non-refundable |
| `bank-account-verification-pennyless` | POST | ✅ | ✅ | ✅ |  | H |  |
| `bulk-bank-account-verification` | POST | ❌ | ❌ | ✅ | enqueues, moves-money | H | Billed per account in the batch |
| `bulk-bank-account-verification-status` | GET | ✅ | ✅ | ❌ |  | H |  |

### gst

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `verify-gstin` | POST | ✅ | ✅ | ✅ |  | H |  |
| `gstin-with-pan` | POST | ✅ | ✅ | ✅ |  | H |  |

### upi

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `upi-validate-vpa` | POST | ✅ | ✅ | ✅ |  | H |  |

### dl

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `driving-license` | POST | ✅ | ✅ | ✅ |  | H |  |

### rc

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `vehicle-rc` | POST | ✅ | ✅ | ✅ |  | H |  |

### employee

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `advance-employment` | POST | ✅ | ✅ | ✅ |  | H |  |

### geocoding

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `reverse-geocoding` | POST | ✅ | ✅ | ✅ |  | H |  |

### voter-id

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `voter-id` | POST | ✅ | ✅ | ✅ |  | H |  |

### passport-application

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `passport-application` | POST | ✅ | ✅ | ✅ |  | H |  |

### cin

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `cin` | POST | ✅ | ✅ | ✅ |  | H |  |

### ip

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `ip` | POST | ✅ | ✅ | ✅ |  | H | ₹2.5 + GST (price row `ip`, added 2026-10-15) |

### name-match

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `name-match` | POST | ✅ | ✅ | ✅ |  | H |  |

### itr

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `itr-compliance` | POST | ✅ | ✅ | ✅ |  | H |  |

### din

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `din-verification` | POST | ✅ | ✅ | ✅ |  | H |  |

### e-challan

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `e-challan` | POST | ✅ | ✅ | ✅ |  | H |  |

### email

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `check-email` | POST | ✅ | ✅ | ✅ |  | H |  |

### fssai

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `fetch-fssai` | POST | ✅ | ✅ | ✅ |  | H |  |

### mobile-otp

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `mobile-otp-send` | POST | ❌ | ❌ | ✅ | sends-otp | H |  |
| `mobile-otp-verify` | PUT | ❌ | ❌ | ❌ | consumes-otp | H | Issues the verification token |
| `mobile-otp-validate-token` | GET | ✅ | ✅ | ❌ |  | M |  |

## 7. Deferred: specs of disabled products

These products are disabled, so their specs carry no `semantics` yet and the guard skips them. The rows below are the reviewed proposals, kept for when each product returns. PPI and QR still need a full review.

### cms

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `cms-activate-service` | PUT | ❌ | ✅ | ❌ | updates | M | Set-state op: second call is a no-op |
| `cms-get-url` 💰 | POST | ❌ | ❌ | ❌ | opens-session | M | ⚠ flagged financial but the URL itself moves nothing; money moves in the hosted flow |

### qr-payment

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `qr-generate-static` | POST | ❌ | ✅ | ❓❌ | creates | M | One static QR per sender_id, so a repeat cannot make a second |
| `qr-generate-dynamic` | POST | ❌ | ❌ | ❓❌ | creates | M |  |
| `qr-transaction-inquiry` | GET | ✅ | ✅ | ❌ |  | H |  |
| `qr-transaction-status-callback` | POST | — | — | — |  | H | Inbound webhook Eko calls; not a callable op. Exempt (see Q4) |
| `qr-get-refund-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `qr-initiate-refund` 💰 | POST | ❌ | ❌ | ❓❌ | moves-money | M |  |

### ppi

NOTE: The PPI Products have been disabled. So the semantics of these endpoints are not relevant for now. These can be skipped for now. The semantics of these endpoints will be reviewed once the PPI products are enabled again.

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `aadhaar-ppi-levin-validate` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `aadhaar-ppi-levin-verify-otp` | POST | ❌ | ❌ | ❌ | consumes-otp, updates | H |  |
| `ppi-levin-get-sender` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-levin-onboard-sender` | POST | ❌ | ❌ | ❌ | creates | M |  |
| `ppi-levin-verify-otp` | POST | ❌ | ❌ | ❌ | consumes-otp | H |  |
| `ppi-levin-validate-pan` | POST | ❌ | ❌ | ❌ | updates | M | PAN check may be a paid upstream call |
| `ppi-levin-get-recipients` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-levin-add-recipient` | POST | ❌ | ❌ | ❌ | creates | H |  |
| `ppi-levin-add-recipient-bank` | POST | ❌ | ❌ | ❌ | creates | H |  |
| `ppi-levin-send-transaction-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `ppi-levin-initiate-transaction` 💰 | POST | ❌ | ❌ | ✅ | moves-money | M |  |
| `ppi-digikhata-get-sender` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-digikhata-onboard-sender` | POST | ❌ | ❌ | ❌ | creates | M |  |
| `ppi-digikhata-generate-sender-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `ppi-digikhata-verify-otp` | POST | ❌ | ❌ | ❌ | consumes-otp | H |  |
| `ppi-digikhata-consent-languages` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-digikhata-consent-details` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-digikhata-generate-aadhaar-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `ppi-digikhata-verify-aadhaar-otp` | POST | ❌ | ❌ | ❌ | consumes-otp, updates | H |  |
| `ppi-digikhata-validate-pan` | POST | ❌ | ❌ | ❌ | updates | M | PAN check may be a paid upstream call |
| `ppi-digikhata-load-wallet` | POST | ❌ | ❌ | ✅ | moves-money | M | ⚠ moves money and returns a fee, but NOT flagged financial |
| `ppi-digikhata-get-recipients` | GET | ✅ | ✅ | ❌ |  | H |  |
| `ppi-digikhata-add-recipient` | POST | ❌ | ❌ | ❌ | creates | H |  |
| `ppi-digikhata-recipient-bank-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `ppi-digikhata-validate-recipient-otp` | POST | ❌ | ❌ | ❌ | consumes-otp, creates | H |  |
| `ppi-digikhata-send-transaction-otp` | POST | ❌ | ❌ | ❌ | sends-otp | H |  |
| `ppi-digikhata-initiate-transaction` 💰 | POST | ❌ | ❌ | ✅ | moves-money | M |  |

### customer-management

| Slug | Method | Read-only | Idempotent | Billable | Side effects | Conf | Notes |
|---|---|---|---|---|---|---|---|
| `onboard-customer` | POST | ❌ | ❓❌ | ❌ | creates, sends-otp | M |  |
| `get-customer-info` | GET | ✅ | ✅ | ❌ |  | H |  |
| `verify-customer-otp` | POST | ❌ | ❌ | ❌ | consumes-otp, updates | H |  |
