Initiates the money transfer from the sender's DigiKhata wallet to the recipient
after OTP verification. Returns the financial response envelope with `tx_status`,
`tid`, bank reference number, fee, and updated balance. Keep `channel` fixed at
**2**.

## Status codes

| `tx_status` | Meaning |
|---|---|
| 0 | Success |
| 1 | Fail |
| 2 | Initiated |
| 3 | Refund pending |
| 4 | Refunded |
| 5 | Hold (inquiry required) |

Treat any unexpected status as **initiated** and follow up with an inquiry.

## Timeouts

> [!CAUTION]
> A transaction can time out from a slow bank response or poor connectivity. Do
> **not** treat a timeout as a failure. Re-query the real status with the
> Transaction Inquiry API using your own `client_ref_id`.

## Failed transactions → refund

When a transaction fails, the system auto-dispatches an OTP to the customer.
Fetch it via Get Refund OTP (this acts as the customer's documented consent for
the refund); the eValue is then refunded back to your account.
