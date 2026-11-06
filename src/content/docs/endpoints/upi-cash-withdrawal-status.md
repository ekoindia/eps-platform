Returns the final outcome of a UPI cash withdrawal started with
[Generate UPI QR for Cash Withdrawal](/docs/upi-cash-withdrawal). The customer's
payment settles asynchronously, so poll this with the `tid` on the schedule the
initiate response returned:

1. First call after `status_check_start_in` seconds.
2. Then every `status_check_gap` seconds.
3. Up to `status_check_attempts` times.

## Reading the outcome

`data.tx_status` is a **numeric code returned as a string**, not a word.
`data.txstatus_desc` carries the matching human-readable word. The envelope and
`data.tx_status` always agree, so you may branch on either:

| Outcome | `tx_status` | `response_status_id` | `response_type_id` | `status` | Terminal? | What the retailer must do |
| --- | --- | --- | --- | --- | --- | --- |
| Paid | `"0"` | 0 | 99013 | 0 | Yes | Money has moved and the wallet is credited. **Dispense the cash.** `bank_ref_num` holds the UPI RRN — store it. |
| Failed | `"1"` | 1 | 99018 | 99018 | Yes | Nothing was debited or credited. **Do not dispense.** Start a fresh transaction if the customer still wants the cash. |
| Pending | `"2"` | 2 | 99019 | 99019 | No | **Do not dispense.** Keep polling on the schedule — see below. |

> [!CAUTION]
> **Only `tx_status == "0"` authorises handing over cash.** Anything else —
> `"1"`, `"2"`, an unrecognised value, a timeout, or a connection error — means
> you must assume no money moved. Build this as a hard rule in your retailer app,
> not a message the operator can dismiss.
>
> Compare on the string `"0"`, and treat any value you do not recognise as *not
> paid*. Do not compare against the words `SUCCESS`, `FAILED` or `PENDING` — this
> API does not return them.

All three responses carry the same fields. `bank_ref_num` is populated only once
the payment has succeeded.

## Still pending after the last scheduled poll

- Stop polling on the published schedule and treat the transaction as **not
  paid**.
- Re-query once after a few minutes. Almost all pending transactions resolve by
  then, either from the acquirer's confirmation or from Eko's reconciliation
  sweep.
- If it is still pending after roughly **30 minutes**, raise it with Eko support
  quoting the `tid`. A small number of cases — for example a payment received for
  an amount different from the one requested — are held deliberately for manual
  review and will not auto-resolve. Nothing is credited while a transaction is
  held.
- Never re-initiate against the same `tid`, and never show the same QR twice.
  Each QR is single-use and amount-specific.

A failed payment's reason arrives in `txstatus_desc`. See
[why an initiation fails](/docs/upi-cash-withdrawal#why-an-initiation-fails) for
the common reasons.
