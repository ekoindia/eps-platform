Lets a retailer dispense cash to a customer who pays over UPI. You request a
withdrawal for an amount; the API returns a UPI QR valid for about 60 seconds.
The customer scans it from any UPI app and authorises with **their own UPI PIN**.
Once the payment succeeds the retailer's wallet is credited (amount + commission
− TDS) and the retailer hands over the cash.

It is a two-step flow:

1. **Generate QR** (this API) — send the amount and location, receive a QR image
   and a transaction id (`tid`).
2. **[Status](/docs/upi-cash-withdrawal-status)** — poll with that `tid` for the
   final outcome.

> [!IMPORTANT]
> The customer's payment settles asynchronously. **A successful response here
> does not mean the customer has paid** — `tx_status` is `PENDING` and no money
> has moved. Hand over cash only when the Status API returns `tx_status` `"0"`.

## Key facts

- **Amount:** ₹100 – ₹5,000, in multiples of ₹100, whole rupees only (no paise).
  Validate in your app before calling.
- **Daily caps:** ₹10,000 / ₹30,000 per merchant per day, set by the acquiring
  bank.
- **Blocked window:** no transactions between **23:30 and 00:05 IST**.
- Caps and the window are NPCI / acquirer rules, not Eko's.
- **No biometric, Aadhaar or daily eKYC** for the customer — they authorise with
  their UPI PIN.
- **Retailer prerequisite:** the retailer must be onboarded and eKYC-complete for
  UPI Cash Withdrawal. Until then the API returns `response_type_id` 99016.
- **Location:** send a real, current GPS fix in decimal degrees. Geo-fencing is
  enforced; zeros, stale values and coarse network locations are rejected.
- **Sandbox:** not yet available on UAT.

## Showing the QR

`qr_string` is a **base64-encoded PNG**, not a `upi://pay` deep link. Render it
as an image:

```html
<img src="data:image/png;base64,{qr_string}" alt="UPI QR" />
```

The customer scans it from a **second device** — there is no same-device app
handoff. Show `qr_expiry_note` next to it and a countdown from `qr_expiry_in`.
Each QR is single-use and amount-specific: **never show the same QR twice** and
never re-initiate against the same `tid`.

## Polling the status

The response tells you when to poll the
[Status API](/docs/upi-cash-withdrawal-status):

1. First call after `status_check_start_in` seconds.
2. Then every `status_check_gap` seconds.
3. Up to `status_check_attempts` times.

If it is still pending after the last scheduled poll, stop, treat it as **not
paid**, and re-query once after a few minutes.

## If this call times out

If you get no response (and so no `tid`), the customer has not seen a QR and
cannot have paid against it. Wait for the QR validity window (~60 seconds) to
pass, then start a new transaction.

## Why an initiation fails

A `99014` response carries the acquirer's reason in `data.description`. Log it
and show it to the retailer — `message` is generic. The list below is not
exhaustive; always surface the field you actually received.

| Reason | What it means and what to do |
| --- | --- |
| QR not scanned | The QR expired before the customer paid. Normal. Start a new transaction. |
| Account is being validated | The retailer's onboarding is still in progress at the acquirer. Retry later; it is not a request error. |
| Merchant's daily transaction limit exceeded | The ₹10,000 / ₹30,000 per-day cap is hit. No further transactions until the next day. |
| Transaction restricted from 23:30 to 00:05 | Acquirer maintenance window. Retry after 00:05 IST. |
| Please complete eKYC before initiating | The retailer's product eKYC is incomplete. A provisioning task, not a retry. |
| Invalid latitude/longitude · geo-fencing invalid · service restricted in this area | Send a real GPS fix as decimal degrees. Zeros, stale values and coarse network locations are rejected. |
| Amount exceeded limit · less than minimum · not a multiple of ₹100 · paise not allowed | Validate the amount in your app before calling. |
| Account blocked · agent in NPCI negative registry | The retailer cannot transact. Route to your distributor; retrying will not help. |
| Temporarily suspended / unable to process | An upstream outage. Retry with backoff; if it persists, raise it with Eko support. |
