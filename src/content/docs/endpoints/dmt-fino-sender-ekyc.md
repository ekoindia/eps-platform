Performs biometric Aadhaar eKYC for a DMT-Fino sender. The agent captures a live
fingerprint at their terminal; the resulting PID XML and the sender's Aadhaar
number are submitted here. On success an OTP is dispatched for confirmation —
call Validate eKYC OTP next. A successful eKYC raises the sender's monthly limit
from **₹5,000 to ₹25,000**.

## Biometric (PID) capture

Capture is done client-side against an RD-service device on ports
**11100–11112**. Supported RD services include Mantra, Morpho, SecuGen (Level 0),
Precision, Startek FM220, and NEXT.

> [!NOTE]
> New to RDService? The
> [Aadhaar Biometric Authentication guide](/docs/aadhaar-biometric-rdservice)
> covers the full capture flow — driver discovery, `PidOptions`, error codes —
> for Web and Android, and includes an in-browser device tester.

The captured `PidData` XML uses these parameters:

```xml
<PidOptions ver="1.0">
  <Opts fCount="1" fType="2" pidVer="2.0" timeout="10000" env="P" wadh="E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=" />
</PidOptions>
```

> [!IMPORTANT]
> When generating the PID block with custom code, you **must** include the
> `wadh` value above alongside `fCount` and `fType`. Validate the device
> response's `errCode` before submitting.
