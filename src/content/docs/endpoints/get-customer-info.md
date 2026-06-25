Looks up a customer by mobile number to decide the next step in a transaction
flow. For an enrolled customer the response returns an `otp_ref_id` to validate;
if the customer is not enrolled (`response_type_id` 308) proceed to Onboard
Customer. The response also reports the customer's KYC state, remaining limits,
and which payment pipes they are registered on.

## Monthly limits by KYC state

| KYC state | Monthly limit per customer |
|---|---|
| Full KYC verified | ₹74,500 *(temporarily on hold)* |
| Non-KYC | ₹25,000 |

For KYC customers the wallet pipe (`wallet_available_limit`) opens at ₹49,500 and
draws down with each transaction; `bc_available_limit` is the remaining capacity
across the BC rails. Non-KYC customers have a wallet limit of 0.

## Customer `state` values

| `state` | Meaning |
|---|---|
| 1 | OTP verification pending |
| 2 | OTP verified, non-KYC / rejected |
| 3 | KYC verification pending |
| 4 | Verified full-KYC customer |
| 5 | Name-change verification pending |
| 8 | Partial KYC |

## Pipe registration

Each payment pipe carries an `is_registered` flag: `0` = the customer is not yet
registered on that pipe, `1` = registered. This decides whether a transaction
routes through the wallet or BC channel, which in turn affects commission.
