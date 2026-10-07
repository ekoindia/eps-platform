The final step in the one-time AePS Fingpay eKYC flow, called after OTP verification. Submits the agent's Aadhaar and live biometric PID data to UIDAI for identity verification. On success the agent's eKYC is marked complete and they can start performing AePS transactions (subject to completing daily 2FA each day).

> [!WARNING]
> **Encrypt the Aadhaar number** before passing it in the `aadhar` parameter —
> never send it as plain text. Encrypt it with Eko's RSA public key using
> PKCS#1 v1.5 padding, then Base64-encode the result. The same encrypted
> Aadhaar + PID XML format is used by all AePS transaction APIs.
>
> The [Aadhaar Number Encryption guide](/docs/aadhaar-number-encryption) has
> the RSA public key, step-by-step instructions and code samples in Node.js,
> Python, PHP, Java and C#.

## E-KYC steps

For Fingpay AePS, it is mandatory to use **e-KYC OTP request**, **e-KYC OTP verification** and **biometric** before any AePS transaction. Make sure you complete these APIs in order:

| Step | API | Purpose |
| --- | --- | --- |
| 1 | Send OTP (eKYC) | OTP to the agent's Aadhaar-linked mobile |
| 2 | Verify OTP (eKYC) | Validate the OTP and start the eKYC session |
| 3 | Biometric eKYC | Submit Aadhaar + live fingerprint PID (this API) |

> [!NOTE]
> eKYC is a **one-time** setup per agent. It is distinct from the daily authentication (2FA) required once per calendar day before transacting.

## Fingerprint capture (`fType`)

> [!NOTE]
> New to RDService? The
> [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice)
> covers the full capture flow — driver discovery, `PidOptions`, error codes —
> for Web and Android, and includes an in-browser device tester.

> [!WARNING]
> Per NPCI's FIR-FMR single-PID-block guidance, capture fingerprints with
> **`fType = 2`** (not `0`). A subset of banks that have not yet completed
> FMR+FIR compliance still require `fType = 0` — check the current bank list
> before going live. The same PID format applies to all AePS transaction APIs.

## PID `wadh` value

> [!WARNING]
> If you generate the PID block with your own code (rather than taking the RD
> service default), you **must** set this `wadh` alongside the other attributes
> such as `fCount` and `fType`:
>
> ```text
> wadh=E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=
> ```
>
> A missing or wrong `wadh` surfaces later as Daily KYC failing with
> `"Authentication Failed. Invalid Biometric data."`
