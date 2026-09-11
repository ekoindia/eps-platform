Lets a customer withdraw cash from any Aadhaar-linked bank account using a live
fingerprint scan — no card or PIN. The agent's biometric device produces a PID
XML blob that is forwarded verbatim, and the customer's Aadhaar number is
RSA-encrypted before transmission.

## Prerequisites

The agent must have completed, in order:

1. AePS Fingpay activation
2. One-time eKYC (Send OTP → Verify OTP → Biometric eKYC)
3. **Daily KYC** for the current day

> [!IMPORTANT]
> Due to NPCI compliance, the agent's Daily KYC must succeed for the current
> calendar day before any cash-withdrawal is attempted.

## Amounts above ₹5,000 — transaction OTP

Fingpay requires a fresh, transaction-scoped OTP for every withdrawal above
**₹5,000**. For ₹5,000 or less there is no OTP step — skip this section.

1. Call [Cash Withdrawal OTP](/docs/aeps-fingpay-cash-withdrawal-otp) with the
   same `aadhar`, `bank_code`, `latlong` and `amount`. It returns
   `data.fp_transaction_id`, and the customer receives a 6-digit OTP by SMS on
   their Aadhaar-linked mobile.
2. Put that SMS OTP in the `otp` attribute of the `PidOptions` you send to the
   RD-service device, then capture the customer's fingerprint.
3. Call Cash Withdrawal with the resulting `piddata`, plus
   `txn_otp_request_id` set to the `fp_transaction_id` from step 1.

> [!IMPORTANT]
> `txn_otp_request_id` and the `otp` inside PidOptions are two different values,
> and both are required: the first is the `fp_transaction_id` reference, the
> second is the 6-digit OTP from the customer's SMS.

```xml
<PidOptions ver="1.0">
  <Opts fCount="1" fType="2" format="0" pidVer="2.0" timeout="30000"
        otp="123456" posh="UNKNOWN" env="P" />
</PidOptions>
```

An `fp_transaction_id` belongs to one withdrawal attempt — generate a new one,
and capture again, for every attempt. Never reuse it.

> [!WARNING]
> If you skip the OTP call for an amount above ₹5,000, Cash Withdrawal does
> **not** withdraw anything. It generates the OTP itself and returns
> `response_type_id` `1459` with `data.fp_transaction_id` instead of a
> transaction result. Always call Cash Withdrawal OTP explicitly. If you do get
> `1459`, recover by capturing the fingerprint with the OTP the customer just
> received and calling Cash Withdrawal again with that `fp_transaction_id` —
> do not generate another OTP.

> [!NOTE]
> An expired, invalid or already-used OTP has no error code of its own — it
> returns the generic `1464` Transaction Fail. Once a failure is final,
> generate a fresh OTP and capture again before retrying. A `1465` Pending, a
> timeout or a dropped connection is **not** a failure: reconcile via
> [Transaction Inquiry](/docs/transaction-inquiry) before any retry, to avoid a
> double debit.

## Aadhaar encryption

Encrypt the Aadhaar number before sending it (the same scheme used by all AePS
transaction APIs):

1. Base64-decode the public key.
2. RSA-encrypt the Aadhaar number with the decoded key.
3. Base64-encode the result and send that as the `aadhar` parameter.

Production public key:

```text
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaFyrzeDhMaFLx+LZUNOOO14Pj9aPfr+1WOanDgDHxo9NekENYcWUftM9Y17ul2pXr3bqw0GCh4uxNoTQ5cTH4buI42LI8ibMaf7Kppq9MzdzI9/7pOffgdSn+P8J64CJAk3VrVswVgfy8lABt7fL8R6XReI9x8ewwKHhCRTwBgQIDAQAB
```

## Biometric (PID) capture

> [!NOTE]
> New to RDService? The
> [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice)
> covers the full capture flow — driver discovery, `PidOptions`, error codes —
> for Web and Android, and includes an in-browser device tester.

The `PidData` XML from the RD-service device must use:

- `Data type="X"` (XML), base64-encoded
- a `DeviceInfo` `mc` value carrying the device public-key certificate signed by
  the Device Provider Key
- fingerprint quality of at least **35** `nmPoints`

> [!WARNING]
> Per NPCI's FIR-FMR single-PID-block guidance, capture fingerprints with
> **`fType = 2`** (not `0`). A subset of banks that have not yet completed
> FMR+FIR compliance still require `fType = 0` — check the current bank list
> before going live.
