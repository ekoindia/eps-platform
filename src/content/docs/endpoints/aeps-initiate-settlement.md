Settles an agent's collected AePS funds to one of their registered settlement
bank accounts (`recipient_id` from Add Settlement Bank Account). Returns the
financial response envelope with `tx_status`, `tid`, fee, and updated balance.

The settleable amount equals the agent's total AePS business over the last
**7 days** minus any settlements already made in that window.

## Operating window

> [!IMPORTANT]
> Settlement runs **Monday–Friday, 10:00–17:00 IST**, excluding RBI bank
> holidays. A request placed after 17:00 settles on the **next working day**.

- Maximum **₹2,00,000 per transaction**.

## Settlement rail (`payment_mode`)

| `payment_mode` | Rail |
|---|---|
| 4 | NEFT |
| 5 | IMPS |
| 13 | RTGS |

## Status & auto-refund

| `tx_status` | Meaning |
|---|---|
| 0 | Success |
| 2 | Initiated / response awaited |
| 4 | Refunded |
| 5 | Hold (inquiry required) |

If the bank declines the settlement it moves to the **refunded** state and the
balance is auto-reversed — no manual action needed. After initiating, confirm the
outcome with the Transaction Inquiry API using either the Eko `tid` or your
`client_ref_id`.
