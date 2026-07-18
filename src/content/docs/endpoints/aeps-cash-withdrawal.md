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
