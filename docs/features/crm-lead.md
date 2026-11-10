# CRM Lead read/update

The Zoho CRM Lead record is where a partner's commercial details live —
company, GST, the developer who is actually doing the integration, go-live and
activation-fee state. Until now the only way for a partner to correct any of it
was to email sales. Two eps-backend routes let the console read and write that
record directly:

| Route | What it does |
| --- | --- |
| `GET /crm/lead` | The partner's own Lead, **whitelisted fields only**, as `{ id, fields, picklists }` |
| `PATCH /crm/lead` | Writes whitelisted, writable fields; answers `{ id, updated }` |
| `POST /crm/lead/attribution` | Records marketing attribution derived from the first landing URL — empty fields only; answers `{ id, updated }` |

The frontend never calls these directly: one shared store loads the Lead at
sign-in, caches it for a day, and serves every page through `useCrmLead()`
(see *Using it in the frontend*). `/console/profile` is the first consumer —
its business-details cards read and edit nine fields in place
(`docs/console-roadmap.md` → *My Profile*).

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

- `PATCH` uses `requireDeveloperSession` (`src/http/session-guards.ts`) — access
  cookie, verified claim, role `developer`. Admin and signup sessions get `403`.
- `GET` and `POST /attribution` use `requirePartnerSession`: role `developer`
  **or `signup`**. The Lead appears mid-signup (around the PAN step), and the
  wizard reads it and records attribution before the session is a developer
  one. Admin sessions still get `403`.
- Rate limited **before** the upstream profile call, so a caller cannot spend
  Eko-side capacity before being told to slow down. 60 reads / 20 writes per
  partner per 10-minute window; attribution shares the write bucket.
- CSRF: the access cookie is `SameSite=Lax` (`COOKIE_SAMESITE`), so a cross-site
  `PATCH` never carries it. Deploying with `COOKIE_SAMESITE=None` would make
  these routes forgeable and needs a token first — one more reason the deploy
  notes argue against it.

## The field whitelist

`LEAD_FIELDS` in `packages/eps-backend/src/clients/lead-fields.ts` is the **one
whitelist** for both directions. `GET` returns only these fields (a whitelisted
field the Lead has no value for comes back `null`), so sales-internal fields —
owner, status, notes, scoring — never reach a browser or its cache. `PATCH`
accepts only the writable ones. Each entry carries Zoho's type and length, read
from the live org's field metadata on 2026-11-02.

| Group | Fields | Partner write |
| --- | --- | --- |
| Profile page | Industry, Annual_Turnover, Number_of_Employees, Number_of_Clients, GST_No, Website, Mobile_App_Name, Count_of_Directors, Authorized_Signatory_Full_name | yes |
| Partner details | Description, City, States, Zip_Code | yes |
| Identity, products | Eko_Code, Pro_Required | **never** |
| Activation fee | Activation_Fee_Status, Activation_Fee_Paid_INR, Activation_Fee_Discount, UTR_No | yes — status only as `Payment claimed` |
| Attribution | First_Visited_URL, Source_Website, Ad_ID, SEO_Page_Name, Campaign_Name, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_adgroup, utm_matchtype, utm_device | **once** — only while empty |

Notes on individual fields:

- **`States`**, not `State` — the org's field is plural. Its placeholder
  options `Option 1` / `Option 2` are not offered.
- **`Eko_Code`** links the Lead to the Eko account; a partner rewriting it
  would break that link.
- **`Pro_Required`** is a multi-select (an array of strings). Read-only until
  the accepted list — the EPS products currently live — is settled; the org's
  89 options include near-duplicates.
- **`Activation_Fee_Status`**: Zoho also holds Paid / Unpaid / Partially paid.
  Those are finance's verdict; a partner may only claim. Paid amount, discount
  and UTR are partner-writable — the same trust model as
  `/console/pay-activation-fee`: a claim finance reconciles, not a verified
  fact. **Note `Activation_Fee_Discount` is partner-writable too**, so treat it
  as a claim as well.
- **`Count_of_Directors`** is limited to 1–15 (`range` on its spec), the
  console's picker range. The Documents page writes it from the director picker,
  and writes `1` into an empty field for a One Person Company — see
  [KYC document upload](kyc-documents.md#director-count-and-per-director-documents).
- **Attribution** fields are write-once: the frontend may capture them, but a
  partner cannot later rewrite their own marketing attribution. They are
  normally written by `POST /crm/lead/attribution`, not `PATCH` — see
  *Marketing attribution*.

Adding a field: check the exact `api_name`, `data_type` and `length` in
`GET /crm/v2/settings/fields?module=Leads` first — Zoho accepts an unknown
`api_name` silently and writes nothing — then add one entry to `LEAD_FIELDS`.
The frontend needs no change: it caches whatever `GET` returns.

## Writes

`parseLeadPatch` (`src/http/crm.ts`) refuses — never drops — anything that must
not reach the CRM:

| Refusal | When |
| --- | --- |
| `400 FIELD_NOT_WRITABLE` | Not on the whitelist, or read-only |
| `400 FIELD_REQUIRED` | `null` or blank — **nothing can be cleared**; a value may be replaced with a valid one, never erased |
| `400 INVALID_FIELD_VALUE` | Wrong JSON type for the Zoho type, over Zoho's length, picklist value not exactly listed, integer/currency/percent out of range |
| `409 FIELD_ALREADY_SET` | A write-once field the Lead already holds |

The write-once check needs the current Lead, so a PATCH touching one of those
fields costs one Zoho read before the write. Every other PATCH is a single Zoho
call: the response is `{ id, updated }` — the fields just written — and the
client merges them into its cache rather than the server re-reading the record.

### Picklists

Options are copied **byte-for-byte** from the live field metadata. The dashes
are EN DASH (U+2013), the rupee is U+20B9, and the irregular spacing
(`₹ 5 – 25 crore` beside `₹1 crore – 5 crore`) is Zoho's. A value one
character off — a hyphen for the en dash, a tidied space — is a different
option, so do not normalise them. To refresh after sales edits a list, read
`pick_list_values[].actual_value` from
`GET /crm/v2/settings/fields?module=Leads`.

`Industry` offers 14 of the org's 30 values; the rest are legacy options. A
Lead already holding one keeps it — the console shows it as the current choice
and only sends fields the partner changed.

Every `GET` carries the writable options as `picklists`, so dropdowns are built
from the server's list. There is one definition, on the server.

## Marketing attribution

Leads created through the Zoho Form / SalesIQ chat got their attribution from
the form plus a Deluge function (`update_seo_utm_info_from_visitor_url`) that
runs on Lead creation and derives the UTM fields from `First_Visited_URL`.
Signups through the console pass neither — upstream creates the Lead itself —
so the console records the same fields directly.

**What the browser keeps.** `captureFirstVisit`
(`src/hooks/use-tracking-params.ts`) records the document's landing URL in
localStorage `eps_first_visit` for 30 days: first-touch, except an organic
first landing is replaced by a later ad-attributed one, so a paid click is not
lost to an earlier unattributed visit. Only a real document landing counts —
never the URL the app rewrites when it re-appends stored tracking params.

**When it is sent.** The lead store calls `POST /crm/lead/attribution` whenever
it serves a Lead (fetched or cached) with no `First_Visited_URL` or no
`Source_Website`, and the browser holds a landing URL — at most once per Lead
per page load. Body:

| Key | Value |
| --- | --- |
| `url` | the stored first landing URL → `First_Visited_URL` and the derived fields |
| `sourceWebsite` | `buildLeadWebsiteUrl()` → `Source_Website` — the exact value the Zoho Form sends as `Website`: current page + stored tracking params + pricing-calculator selection, budgeted to 450 chars |

**Derivation** (`attributionFromUrl`, `src/clients/lead-attribution.ts`) is a
rule-for-rule port of the Deluge function:

| Field | From the URL |
| --- | --- |
| `SEO_Page_Name` | path after the domain, no leading `/` (root → skipped) |
| `utm_source` | `utm_source`, else `fbclid` → `fb`, `li_fat_id` → `linkedin`, `gclid` → `google` |
| `utm_campaign` | `utm_campaign`, else `gad_campaignid` |
| `Ad_ID` | `gclid` > `fbclid` > `li_fat_id` (the click id, not the creative) |
| `Campaign_Name` | `campaign_name` |
| `utm_medium`, `utm_term`, `utm_content`, `utm_adgroup`, `utm_matchtype`, `utm_device` | same-named param |

Deliberate departures: values arrive URL-decoded, and every field is derived
from the **full** URL. A value longer than its Zoho field is handled by kind:

- **URL fields** (`First_Visited_URL` 3000, `Source_Website` 450) are
  **trimmed**, not dropped (`truncateUrl`): cut to the field's length with
  `…` (U+2026) as the last character, never splitting a `%XX` escape. The
  page and the first query params survive; the `…` marks the last param's
  value as incomplete — don't treat it as a real value. Zoho's website-type
  fields accept the `…` (confirmed against the live org, 2026-11-04). Params past the cut
  are still derived into their own fields. The route accepts URLs up to 8,192
  chars (400 above) before trimming.
- **Every other field** is dropped (`utm_matchtype`/`utm_device` hold 2
  chars): a truncated campaign or click id would look valid and mean nothing.

`buildLeadWebsiteUrl` applies the same `…` mark on its own last-resort cut,
so the Zoho Form's `Website` value follows the same convention.

**Fill-empty, never 409.** The route reads the Lead and writes only the fields
it does not already hold, so the call is idempotent and repeating it every
onboarding step is harmless. `updated` lists what was written and may be `{}`.
Values sales or upstream set are never touched. **Not atomic**: Zoho has no
conditional update, so a value another writer sets between that read and the
write is overwritten — a one-round-trip window over equivalent data, accepted.

The store overlays what a sync wrote onto any later read still missing it, so
a refresh that raced the write cannot cache the Lead without it for a day.

## Onboarding refresh

Upstream edits the Lead as each signup step lands. `SignupState` carries
`crmLeadId` once the profile has one, and the wizard calls
`refreshCrmLead(mobile, crmLeadId)` on every fresh state — first load and
after each step — which re-reads the Lead ignoring the 24h TTL. When signup
completes and the session becomes a developer one, `AuthProvider`'s
`startCrmLead` sees the same partner already loaded and keeps that read.

## Using it in the frontend

```ts
import { useCrmLead } from "@/lib/crm/use-crm-lead";

const { state, fields, update } = useCrmLead();
fields?.City;                       // null until loaded, or when unset
await update({ City: "Pune" });     // send only what changed
```

- `state.status`: `idle` (no developer session) · `loading` · `ok` · `none`
  (no Lead / Zoho off — render empty, not an error) · `error` (CRM unreachable).
- `update()` rejects with the API's `ApiError` (400/409 messages are written
  for display; 502 is generic). On success every reader re-renders.
- Any page can use the hook; mounting it also starts the store if sign-in has
  not already.

The store is `src/lib/crm/lead-store.ts`, mirroring the notifications store:
module-level state read through `useSyncExternalStore`. `AuthProvider` starts
it as soon as a developer session resolves (so the Lead is loaded on the public
homepage too) and resets it whenever the session ends. When the profile has no
`crm_lead_id`, no request is made at all. During signup the wizard drives it
instead (`refreshCrmLead`, see *Onboarding refresh*).

## Cache

| | |
| --- | --- |
| Where | `localStorage`, key `eps.crm.lead` |
| Contents | `{ v, owner (mobile), leadId, fetchedAt, result }` — only whitelisted fields |
| Lead TTL | 24h from the last read |
| "No CRM data" TTL | 1h — usually a deployment without Zoho; nobody should wait a day once credentials go in |
| Errors | Never cached; the next start retries |
| On save | The changed fields are patched in place. The TTL is **not** restarted — the record as a whole is still as old as its last read |
| Cross-tab | The `storage` event: a save or fetch in one tab updates the others |
| Invalidated by | owner or Lead id mismatch, older `v`, malformed blob, sign-out, an expired session detected at boot |

**Why localStorage, not IndexedDB.** The payload is a few KB. IndexedDB's
strengths — async access, large quotas, indexes — buy nothing at that size, its
API wants a library (a new dependency) or ~40 hand-rolled lines, and it has no
cross-tab change event. Both are equally readable by any script on the origin.

**The trade.** Unlike the `/me` cache (sessionStorage), this survives closing
the browser: GST number, signatory name and UTR stay on disk until the next
visit to the site detects the ended session, or the TTL lapses. Acceptable for
the read saving; the owner tag, sign-out clearing and TTL bound it.

**Staleness.** A change sales makes in Zoho can take up to a day to appear, and
an edit can start from day-old values. Only changed fields are sent, so the
worst case is overwriting the one field sales just changed.

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
