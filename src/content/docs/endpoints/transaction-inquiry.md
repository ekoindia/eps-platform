Get the current status of a transaction using either Eko's TID or your own
`client_ref_id`. This is a generic inquiry endpoint — it works for all Eko
financial transaction types (fund transfer, BBPS, AePS settlement, NEFT, and
more).

The transaction reference goes in the URL path. Pass an Eko **TID as-is**; to
look up by your **`client_ref_id`, prefix it** with `client_ref_id:`:

- By TID — `/tools/reference/transaction/<TID>`
- By client_ref_id — `/tools/reference/transaction/client_ref_id:<your client_ref_id>`

> [!NOTE]
> **Examples**
>
> To check the status of a transaction using TID `2886601782`, call
> `/tools/reference/transaction/2886601782`.
>
> If you never received Eko's TID (say, due to a network timeout) but sent your
> own unique reference `567890`, look it up with
> `/tools/reference/transaction/client_ref_id:567890`.

> [!WARNING]
> **Transaction timeout**
>
> A transaction can time out for many reasons — a slow partner-bank response, or
> network connectivity causing a delayed or missing response.
>
> In such cases the transaction must **not** be treated as declined or failed.
> Inquire about its real status using this API with your own `client_ref_id`,
> instead of retrying the payment.

## `tx_status` values

| `tx_status` | Description |
|---|---|
| 0 | Success |
| 1 | Fail |
| 2 | Response Awaited / Initiated (in case of NEFT) |
| 3 | Refund Pending |
| 4 | Refunded |
| 5 | Hold (Transaction Inquiry required) |
