# Feature: Transaction History

The signed-in developer's own transactions, at `/console/transactions`. Ported
from Eloka's (`wlc-webapp`) History feature — see
`docs/features/transaction-history.md` in that repo.

> **Status: the UI is real, the data is not.** The page runs end-to-end through
> the actual auth → cookie → BFF → client path, but serves fixture rows behind
> `EKO_TRANSACTIONS_MOCK=true`. The upstream contract is unverified — see
> [§Unverified](#unverified) — and with the flag off the route returns
> `501 NOT_WIRED` rather than guessing.

## Shape

| Piece | File |
|---|---|
| Types + all pure logic | `src/lib/console/transactions.ts` |
| Page | `src/pages/console/Transactions.tsx` |
| Client method | `transactionsClient.search` in `src/lib/auth/client.ts` |
| BFF route | `packages/eps-backend/src/http/transactions.ts` |
| Upstream adapter + mapper | `getTransactionHistory` / `mapTransactionRows` in `packages/eps-backend/src/clients/eko.ts` |
| Fixture (mock mode) | `packages/eps-backend/src/clients/transactions.fixture.ts` |
| Real captured response | `packages/eps-backend/src/clients/transactions.sample.ts` |

Columns: expand toggle · Summary · Transaction Amount · Debit · Credit · Running
Balance · Date & Time · Status. Expanding a row reveals "Other Details" (status,
amount, TID, and whichever counterparty fields the row carries).

**Not ported:** Export (PDF/Excel), the Columns show/hide toggle, the
network/admin statement view, the multi-wallet account switcher, and the expanded
row's Report Issue / Print / Share actions. All are additive later.

Eloka drives its table from an 918-line `historyParametersMetadata` array. That
engine exists to serve two views with runtime-dynamic columns, export, and print
media — none of which this page has, so the columns here are literal JSX and the
logic is plain functions. (Eloka's array also mutates rows in place, accumulates
across fetches, and carries dead `sorting: true` flags.)

## The money rules

Ported verbatim from Eloka, and the reason `src/lib/console/transactions.ts`
exists as its own tested module:

- **Debit** = `amount_dr + fee + tds + gst + insurance_amount + eko_gst`, each
  counted only when `> 0`.
- **Credit** = `amount_cr + commission_earned + eko_service_charge + bonus`, same.
- **A failed row (`response_status_id === 1`) contributes 0 to both** — no money
  moved. Its Running Balance still renders.
- `debitOf`/`creditOf` return `0`, not `""`. Blanking an empty cell is the
  *renderer's* job (`v || ""`); Eloka folds the blanking into its compute and
  then has to coerce numbers back out of strings everywhere downstream.

`response_status_id`: `0` success · `1` failure · `2` initiated · `3` refund
initiated · `5` hold · `8` scheduled · `9` scheduled expired. If upstream has
other failure-ish codes, the totals above are wrong — they mirror Eloka's known
semantics, no more.

**The status LABEL comes from the row's own `status` string, not from that map**
— the map only picks the Badge colour. One id spans several upstream wordings: a
real row carries `response_status_id: 5` with `status: "Payment received"`, which
the map alone would mislabel "Hold". The map's label is a fallback for when
upstream sends no string.

### Totals are per-page

Upstream returns no grand totals, so the footer sums **only the rows on screen**,
and Closing Balance is the `r_bal` of the newest row on this page under the
active filters — not the account's true closing balance. It is labelled "Totals
for this page" for exactly that reason. Real totals are an API change, not a UI
one.

## Quick search

`inferSearchField` guesses the field from the query's shape: 10 digits starting
6–9 → mobile; ≤7 → amount; 10–11 → TID; 9–18 → account. **The ranges overlap, so
the order of the checks is the spec** — a 10-digit input is both a valid mobile
and a valid TID. That's what `transactions.test.ts`'s boundary table pins.

## Request path

`POST /transactions/search` with `{ start_index, limit, filters }`.

POST, not GET, deliberately: the filters carry mobile numbers, account numbers,
TIDs and amounts. A query string would put all of them into browser history,
proxy logs, and this app's own access log (which records `path`).

The route:
1. `requireDeveloperSession` — 401 without a session, 403 for a signup/admin one.
2. `eko.getProfile(mobile)` for the caller's identity; a non-`found` profile is
   403 `NO_PROFILE`, never an empty list (an empty list reads as "you have none").
3. `parseFilters` — an allow-list mirroring `parseBusiness` in `signup.ts`. Only
   known keys are copied out, each shape-checked, so no extra interaction field
   (`org_id`, `interaction_type_id`, …) can be smuggled upstream. This is a trust
   boundary.
4. `parsePaging` — `limit` clamped to 25, `start_index` to `>= 0`.

`hasNext = rows.length === limit`, a full-page heuristic since upstream reports no
count. On an exactly-full final page that costs one empty page.

The page fetches only when `me.state === "active"`; no other lifecycle state can
have transactions, so it shows an onboarding pointer instead of a call that could
only fail.

## Confirmed by a real response

A genuine interaction-154 response is captured verbatim in
`packages/eps-backend/src/clients/transactions.sample.ts`, and
`mapTransactionRows` is tested against it. It settles:

- **The envelope is `data.transaction_list`** — what the mapper already reads.
  Eloka's `data.data.transaction_list` has an extra layer because that's its own
  `fetcher`'s wrapper, not upstream's.
- **`tx_typeid` arrives as a string** (`"1049"`), and `status_id` mirrors
  `response_status_id`. The mapper coerces.
- **`amount_dr` / `amount_cr` are frequently absent**, not `0` — a QR Collection
  row has only `amount_cr`. The mapper defaults them, so no `NaN` reaches the UI.
- **`datetime` is ISO-8601 with a `+05:30` offset**
  (`2026-04-16T11:49:09.000+05:30`), not `YYYY-MM-DD HH:mm:ss`. It renders in the
  viewer's local zone.
- **Mobiles and accounts arrive pre-masked** (`XXXXXX1732`), so the table shows
  upstream's masking rather than doing its own.
- Fractional charges are real (`fee: 5.91`, `gst: 0.76`).
- Fields upstream sends that this page ignores: `client_ref_id`, `api_txntype`,
  `pipe`, `channel`, `customer_fee`, `ifsc`, `transaction_additional_metadata`,
  and a top-level `asofdate`.

## Unverified

**Everything in this section must still be probed before the flag comes off.**
The sample above proves the response *shape*; it does not prove this backend can
*make the call*. Eloka's path does not exist for this backend:

| | Eloka (`wlc-webapp`) | `packages/eps-backend` |
|---|---|---|
| Server | Connect (`api.beta.ekoconnect.in`) | SimpliBank internal API |
| Call | `POST /transactions/do`, JSON | form-urlencoded interaction |
| Auth | `Authorization: Bearer <jwt>` | `developer_key` header |
| Identity | derived from the JWT | explicit `initiator_id`/`user_code`/`org_id` |
| `account_id` | login response `account_details.evalue_account_id` | **no known source** |

1. **Which server.** This backend has no Connect base URL and no JWT minting. If
   interaction 154 isn't reachable over the SimpliBank form transport, adding
   Connect is a **separate task, not a tweak**.
2. **`account_id` — the blocker.** Eloka reads it from a login response this
   backend never calls; interaction 151 (`getProfile`) is *dead code* in Eloka,
   so nothing proves it returns account ids. Probe: dump 151's raw `user_detail`
   and look for `account_details` / `evalue_account_id`. If present, map it in
   `mapProfile`; if absent, find the interaction that returns it. **Do not invent
   a default.** Encouraging sign: `getWalletBalance` (interaction 9) sends no
   account and gets the default E-value account back, so 154 may be equally
   forgiving — but that is a guess until probed.
3. ~~**Response envelope.**~~ **Resolved** — a real response confirms
   `data.transaction_list`. See [§Confirmed](#confirmed-by-a-real-response).
4. **`source` / `isNetworkTransactionHistory`.** Whether they're required. Note
   this client sends `source: "EPSBACKEND"` elsewhere; Eloka sends `"WLC"`.
5. **`limit` cap**, and whether `start_index` is a row offset or a page index.
6. **Filter date semantics.** `start_date`/`tx_date` are Eloka's From/To names;
   their exact upstream meaning on this transport is assumed, not confirmed.

### Wiring day

1. `curl` SimpliBank with `interaction_type_id=154` + `developer_key` +
   `initiator_id/user_code/org_id` for a known-active UAT developer.
2. Resolve `account_id` per (2) above.
3. The envelope path is already confirmed against a real body — expect no
   mapper change. If the live body disagrees with
   `transactions.sample.ts`, update that sample and let its tests tell you what
   broke.
4. Delete the `transactionsMock` branch, the `EKO_TRANSACTIONS_MOCK` flag, the
   `filterFixture` helper, the `NOT_WIRED` guard in the route, and this section.
   Keep `transactions.sample.ts` and its tests — that's the regression net.
5. Sanity-check against Eloka: Debit / Credit / Running Balance for the same user
   must agree.

The design intent is that only step 3 touches code above the adapter —
`mapTransactionRows` is transport-agnostic on purpose.
