Sends an OTP to the customer's primary mobile number for verification. The
response returns a transaction id and the OTP expiry timestamp; confirm the
code the customer enters with the **Verify OTP** API.

## Sample OTP SMS

```text
134021 is the OTP to verify your mobile number.
- Eko India
```

By default the OTP SMS is sent with the **Eko India** sender signature. To send
it under your own company signature and Sender ID, register on a telecom DLT
platform as described below.

## DLT registration for your own Sender ID

### 1. Register as a Principal Entity

Register on any one telecom DLT platform, such as:

- [Videocon](https://smartping.live/entity/register-with)
- [Jio](https://trueconnect.jio.com/)
- [Vodafone Idea Limited](https://www.vilpower.in)
- [Airtel](https://dltconnect.airtel.in/signup/)

Submit the requested business KYC documents, typically:

- PAN and GST certificate
- Business registration proof
- Registered address proof
- Authorised signatory details

After approval, save your **Principal Entity ID (PE ID)**.

### 2. Register a Sender ID

In the DLT portal, register a new SMS Header or Sender ID.

- Select the **Others/Service** header category — not Promotional.
- Choose a sender name related to your registered entity or authorised brand.
- Provide a justification or brand-authorisation document if the sender name
  differs from your legal entity name.
- Sender IDs are case-sensitive.

Save the approved **Header Name** and **Header ID**.

### 3. Register the OTP content template

Create a content template using:

| Field              | Value                   |
| ------------------ | ----------------------- |
| Communication type | **Service Implicit**    |
| Channel            | **SMS**                 |
| Language           | **English**             |
| Header             | Your approved Sender ID |

Register the following template exactly (just change Eko India to your own
company name):

```text
{#var#} is the OTP to verify your mobile number.
- Eko India
```

> [!NOTE]
> - Use your own company name instead of Eko India.
> - `{#var#}` represents the dynamically generated OTP.
> - Do not select **Transactional** unless the OTP is for a banking transaction performed by a bank.

### 4. Submit the approved details to Eko

Provide the following during API onboarding:

- Principal Entity ID
- Approved Sender ID/Header
- Header ID
- Content Template ID
- Exact approved template text
