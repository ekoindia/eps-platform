The final step in the one-time AePS Fingpay eKYC flow, called after OTP verification. Submits the agent's Aadhaar and live biometric PID data to UIDAI for identity verification. On success the agent's eKYC is marked complete and they can start performing AePS transactions (subject to completing daily 2FA each day).

> [!WARNING]
> You need to **encrypt the Aadhaar number** before passing it as a parameter. The same RSA-encrypted Aadhaar + PID XML format is used by all AePS transaction APIs.

## Aadhaar encryption

1. Decode the public key using Base64 (the public keys for UAT and production are different).
2. Compute the RSA-encrypted signature using the decoded key and the Aadhaar message.
3. Base64-encode the encrypted signature before sending it on the API.

### Public key for Aadhaar encryption (UAT)

```text
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaFyrzeDhMaFLx+LZUNOOO14Pj9aPfr+1WOanDgDHxo9NekENYcWUftM9Y17ul2pXr3bqw0GCh4uxNoTQ5cTH4buI42LI8ibMaf7Kppq9MzdzI9/7pOffgdSn+P8J64CJAk3VrVswVgfy8lABt7fL8R6XReI9x8ewwKHhCRTwBgQIDAQAB
```

```java
public static String calculateRSA(String salt) throws InvalidKeyException, Exception {
	Cipher encryptCipher = Cipher.getInstance("RSA");
	encryptCipher.init(Cipher.ENCRYPT_MODE, getPublicKey());
	byte[] secretMessageBytes = salt.getBytes("UTF-8");
	byte[] encryptedMessageBytes = encryptCipher.doFinal(secretMessageBytes);
	return Base64.encodeBase64String(encryptedMessageBytes);
}

public static PublicKey getPublicKey() throws Exception {
	String rawPublicKey = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCXa63O/UXt5S0Vi8DM/PWF4yugx2OcTVbc...";
	byte[] keyBytes = Base64.decodeBase64(rawPublicKey);
	X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
	KeyFactory kf = KeyFactory.getInstance("RSA");
	return kf.generatePublic(spec);
}
```

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
