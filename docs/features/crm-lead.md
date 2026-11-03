# CRM Lead read/update

The Zoho CRM Lead record is where a partner's commercial details live —
company, GST, the developer who is actually doing the integration, go-live and
activation-fee state. Until now the only way for a partner to correct any of it
was to email sales. Two eps-backend routes let the console read and write that
record directly:

| Route | What it does |
| --- | --- |
| `GET /crm/lead` | The signed-in partner's own Lead, as `{ id, fields, picklists }` |
| `PATCH /crm/lead` | Writes an allow-listed subset of fields back to Zoho |

Both are consumed by `/console/profile`: the business-details cards read the
Lead and edit nine of its fields in place (see `docs/console-roadmap.md` →
*My Profile*).

## Whose record, and how it is found

The record id comes from the partner's **upstream profile**, never from the
request: `profile.userDetail.crm_lead_id`, the same field the activation-fee
mail links from (`src/http/activationFee.ts`). A caller cannot name a record,
so there is no id to tamper with.

**It is not the session's `zohoId`.** That value is `zoho_id ?? crm_contact_id`
— the CRM **Contact**, a different module with a different id. Passing it to
these routes addresses the wrong record or nothing at all. `zohoId` stays what
it has always been: a correlation id carried into Zoho Desk tickets.

A profile with no `crm_lead_id` gets `404 NO_CRM_LEAD`. That is a normal state
for a partner sales has not yet created a Lead for, not an error.

## Auth and limits

- `requireDeveloperSession` (`src/http/session-guards.ts`) — access cookie, verified
  claim, role `developer`. Admin and signup sessions get `403`.
- Rate limited **before** the upstream profile call, so a caller cannot spend
  Eko-side capacity before being told to slow down. 60 reads / 20 writes per
  partner per 10-minute window.
- CSRF: the access cookie is `SameSite=Lax` (`COOKIE_SAMESITE`), so a cross-site
  `PATCH` never carries it. Deploying with `COOKIE_SAMESITE=None` would make
  these routes forgeable and needs a token first — one more reason the deploy
  notes argue against it.

## What may be written

`WRITABLE_LEAD_FIELDS` in `src/clients/zoho.ts` is an **allowlist**, and a key
outside it is refused with `400 FIELD_NOT_WRITABLE` rather than dropped: Zoho
accepts an unknown `api_name` silently, so a dropped key would look to the
console exactly like a successful save.

```
Company, Business_Type, Pro_Required, Website, GST_No,
Activation_Fee_Discount, Activation_Fee_Status, Activation_Fee_Paid_INR, UTR_No,
Go_Live_Disposition, Date_of_Go_live, Integration_Status,
Developer_s_Name, Developer_s_Email, Developer_s_Phone_No,
Programming_Language, Profession,
Authorized_Signatory_Full_name, Authorized_Signatory_Phone_Number,
Industry, Annual_Turnover, Number_of_Employees, Number_of_Clients,
Mobile_App_Name, Count_of_Directors
```

Every name was checked against the live org's field metadata on 2026-11-02.
`Pro_Required` and `Programming_Language` are **multi-select** picklists — Zoho
wants an array — and `parseLeadPatch` refuses arrays, so those two are listed
but cannot actually be written yet.

Note what this includes: **the activation-fee and go-live fields are
partner-writable.** A partner can record their own fee status, amount and UTR.
That is the same trust model as `/console/pay-activation-fee` — the partner
states what they paid and finance reconciles it — but it does mean these fields
are a claim, not a verified fact, and nothing downstream should treat them as
one.

Before adding a field, check its exact `api_name` against
`GET /crm/v2/settings/fields?module=Leads`. A wrong name is accepted by Zoho and
writes nothing.

`parseLeadPatch` (`src/http/crm.ts`) enforces what must never reach the CRM:
an object body, allow-listed keys, scalar values, finite numbers, strings under
500 characters — and **picklist membership** for the four single-selects in
`LEAD_PICKLISTS` (`src/clients/zoho.ts`): Industry, Annual_Turnover,
Number_of_Employees, Number_of_Clients. **Nothing can be cleared**: `null` and
blank strings are refused (`400 FIELD_REQUIRED`) — a value may be replaced with
a valid one, never erased. Date formats,
per-field lengths and URL shape stay Zoho's rules, reported through the update
result.

### Picklists

`LEAD_PICKLISTS` is copied **byte-for-byte** from the live field metadata. The
dashes are EN DASH (U+2013), the rupee is U+20B9, and the irregular spacing
(`₹ 5 – 25 crore` beside `₹1 crore – 5 crore`) is Zoho's. A value one
character off — a hyphen for the en dash, a tidied space — is a different
option, so do not normalise them. To refresh after sales edits a list, read
`pick_list_values[].actual_value` from
`GET /crm/v2/settings/fields?module=Leads`.

`Industry` offers 14 of the org's 30 values; the rest are legacy options. A
Lead already holding one keeps it — the console shows it as the current choice
and only sends fields the partner changed.

Every `/crm/lead` response carries the lists as `picklists`, and the console
builds its dropdowns from that. There is one definition, on the server.

**Reads are not filtered.** `GET` returns every field on the Lead, minus
credential-shaped keys (`stripSensitive`). Sales-internal fields — owner,
status, notes — are included. If that becomes unwanted, the fix is a
`HIDDEN_LEAD_FIELDS` denylist alongside the write allowlist.

## Failure behaviour: closed here, open on the login path

`ZohoClient` serves two callers with opposite needs:

- `findLead(mobile)` decides `lead` vs `unknown` for a profile the Eko side has
  never seen (`src/identity/me.ts`). It runs on `/me`, OTP verify and every
  `/signup/*` call, and **fails open** — a CRM outage returns `false` rather
  than blocking a login.
- `getLead` / `updateLead` **fail closed**. An unreachable CRM is `502
  CRM_UNAVAILABLE`, not an empty record the console would render as "you have
  no details". The upstream message is logged, never returned: it can name CRM
  fields, users and validation rules.

One case is deliberately neither: a `PATCH` whose write succeeds but whose
read-back fails answers `200` with `fields: null`. The change **is** committed,
and a 502 there would invite the console to retry a save that already landed.

## Auth to Zoho

OAuth refresh-token grant, ported from
`eko-business-dashboard/src/lib/crm/client.ts` (`docs/zoho-crm-funnel.md` there
has the token-generation steps). The access token is cached in memory and
refreshed ahead of expiry; a `401` drops the cache and retries once, so a token
revoked in the Zoho console recovers on the next request instead of wedging the
process until restart.

The predecessor used a static `ZOHO_ACCESS_TOKEN`, which Zoho expires after 60
minutes. That only ever went unnoticed because its single consumer was a
fail-open boolean.

| Env var | Notes |
| --- | --- |
| `ZOHO_ENABLED` | `true` makes the three credentials below **required**; a missing one is a boot error, not a silent no-op |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | The grant. Needs `ZohoCRM.modules.leads.ALL` — a READ-only token 401s on `PATCH` |
| `ZOHO_BASE_URL` | REST host, default `https://www.zohoapis.in` |
| `ZOHO_ACCOUNTS_URL` | Derived from `ZOHO_BASE_URL` unless set |
| `ZOHO_CRM_RECORD_BASE_URL` | Unrelated: the **web-app** record URL used for the activation-fee mail links |

With `ZOHO_ENABLED=false` both routes answer `404 CRM_DISABLED` — mounted
unconditionally so the console page they will back is never itself a 404.
