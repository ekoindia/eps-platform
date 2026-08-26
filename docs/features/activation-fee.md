# One-time activation fee

Partners who go live in production settle a **one-time activation fee** per API
they put into production. `/console/pay-activation-fee` is where they tell Eko
they have paid; `POST /activation-fee/intimate` on eps-backend mails those
details to Team Eko.

## The bargain this page describes

Production credentials unlock **every** API on the platform — Eko does not gate
them one at a time. The fee is therefore collected on trust: the partner names
the APIs they have actually started using and pays for those.

Nothing in this feature charges, meters or verifies a payment. It carries a
claim, and finance reconciles that claim against the bank statement.

## The flow

**Why we're asking** — the trust framing above, then four numbered steps:

1. **Choose what you're paying for** — the product picker. It comes first
   because everything downstream is derived from it.
2. **Your one-time activation fee** — computed from the selection: undiscounted
   fee, the running discount, GST, and the **amount to transfer** called out on
   its own. No number is hardcoded on the page; see *Fee calculation* below.
3. **Transfer the amount** — Eko's HDFC collection account, as copyable rows.
   Hardcoded in `src/pages/console/PayActivationFee.tsx`: this is the one fact
   that must read identically in UAT, in production, and in an old screenshot.
4. **Tell us about the transfer** — amount (prefilled from step 2), date, mode
   (IMPS / NEFT / RTGS / Intra-Bank Transfer, commonest first), UTR, the name of
   the depositor, and an optional transaction slip.

**Name of depositor** is prefilled with the partner name, but only when that
name contains a letter: upstream defaults a missing name to the mobile number,
so a profile routinely carries `"7200000002"` as its `name`, and prefilling that
would put a phone number where finance expects an account holder. It is
editable and required — a firm often transfers from a director's or a parent
company's account, and finance reconciles against the statement.

Payment modes are normalised server-side through a map keyed by the uppercased
input, so casing from the browser does not matter while the label finance reads
stays `Intra-Bank Transfer` rather than `INTRA-BANK TRANSFER`.

## Fee calculation

`calcActivationFee` in `src/lib/console/feeProducts.ts` quotes a selection using
the same helpers `/pricing` uses, so the console and the rate card cannot
disagree:

- **Verification APIs** → `calcSetupFee` (per API, honours `PricedApi.setupFee`
  overrides and any `SETUP_FEE_PACKS` bundles).
- **BC/Payments families** → `buildSetupFeeQuote(families × BC_SETUP_FEE)`,
  matching `calcPaymentsSetupFee` in `payments-pricing.ts`.

Both halves already carry `SETUP_FEE_DISCOUNT_PERCENT` and GST, and are added.
Quoting each half separately rounds it to whole paise first, so the sum can
differ from one combined quote by at most a paise — immaterial against a fee in
thousands, and worth it to keep each half on its own calculator's code path.

`fee.total` (payable + GST) is what prefills **Transaction amount**, because
that is the real outgo. The partner can overwrite it — they may be settling two
fees at once — and once they type, `amountEdited` stops the suggestion chasing
their selection. What is submitted is always the field's value, never the
suggestion.

A product typed into the free-text box cannot be priced, so the summary says so
and asks the partner to add its fee before transferring, rather than quietly
quoting a total that is short.

## Trust boundary

The mail has two halves, and they come from different places on purpose.

| Half | Source | Why |
| --- | --- | --- |
| Name, EkoCode, mobile, email, PAN | `eko.getProfile` on the backend, from the caller's own session | A partner must not be able to file an intimation in someone else's name |
| Amount, date, mode, UTR, depositor, products, slip | The browser | These are the partner's own claims about a transfer they made |
| GST | The profile, falling back to the browser | Identity where we hold it; a gap-filler where we do not |

Note that **depositor name is browser-supplied on purpose**. It is not a claim
about who the partner is — it is a claim about whose bank account the money left,
which only they can answer and which finance verifies against the statement.

PAN is read from `user_detail.pancardnumber`. **GST has no agreed upstream field
name** — it varies by user type and many profiles carry none — so `findGstNumber`
scans the allowlisted business detail blocks and the flat user detail for a key
matching `/gst/i`. Pin a real field name here if upstream ever commits to one.

When the profile carries no GST number, the form shows an optional input for it,
gated by `profileGstNumber` in `src/lib/auth/identity.ts` — a deliberate mirror
of the backend scan whose only job is deciding whether to *ask*. The backend
stays the authority: a profile that has a GST number always wins, and the typed
value is used only to fill the gap. If the two scans ever drift, the worst case
is a field shown that did not need to be. The mail prints `—` when neither has
one.

The table also carries a **Zoho CRM** row linking straight to the records
finance needs open to confirm anything — `Lead` from `userDetail.crm_lead_id`
and `Contact` from `userDetail.crm_contact_id`, each rendered only when that id
is present. A partner mid-onboarding has a lead and no contact yet, so one link
routinely appears without the other, and upstream sends `""` rather than
omitting the keys. This is the only cell built as markup rather than text, via
`rawRow`, so escaping stays the default everywhere else; the ids are both
percent-encoded into the path and escaped into the attribute.

The link base comes from `ZOHO_CRM_RECORD_BASE_URL` (e.g.
`https://crm.zoho.in/crm/org60006414357`), not from `ZOHO_BASE_URL` — that one
is the REST host lead enrichment calls, and the two differ by host *and* path,
so conflating them yields 404s. Unset, the row still renders and the links are
simply omitted: a missing convenience link is not worth refusing to boot over,
unlike a missing mail recipient.

**Subject line**: `EPS One-Time Activation Fee Received | #<ekocode> | <partner>`
— built by `buildEmailSubject`, so finance can triage from the inbox list and
search a thread by the code they reconcile against. An identity part that is
blank is omitted rather than printed as an empty gap.

Every interpolated value is escaped with `escapeHtml` (shared with
`support-ticket.ts`) before it reaches the mail body.

## Product picker

`src/lib/console/feeProducts.ts` derives the picker from **`PRICING_GROUPS` in
`api-pricing.ts`**, not from the product catalogue, because the fee is charged
the way pricing is charged: **per verification API**, not per product page. A
partner using PAN Lite and PAN Advanced owes two fees, so the picker offers two
rows. APIs the registry exempts (`setupFee: 0`) are omitted — there is nothing
to pay for them.

The BC/Payments families (DMT, AePS, BBPS) are named as three literals: they are
charged per *family*, and no per-family fee data exists in `api-pricing.ts` to
derive them from. They **lead** the picker — three rows against the verification
catalogue's dozens, carrying the largest fee per row, so burying them under a
long scroll is the wrong default for the partner most likely to be paying.

`filterFeeProducts` backs the picker's search box. It matches an option label
*or* a group caption (so "identity" surfaces everything filed under that group),
drops groups left with nothing, and preserves picker order. Search is a view
concern only: a selection made before the query is narrowed stays selected and
stays priced, it is simply not on screen.

The form holds ids; `labelsForFeeProducts` resolves them to display names at
submit time, dropping any id the module does not know. `BC_SETUP_FEE` is
imported from `payments-pricing.ts` rather than restated, so the per-family fee
cannot drift from the payments calculator.

> The backend caps and escapes the product labels rather than whitelisting them.
> The catalogue lives in the website bundle, and duplicating it in eps-backend
> to police a partner's description of their own payment buys nothing. Revisit
> if these labels ever drive billing rather than a human's inbox.

## Configuration

| Env var | Default | Notes |
| --- | --- | --- |
| `ACTIVATION_FEE_WEBHOOK_URL` | _(unset — feature dark)_ | https required off loopback. **Secret** — never ship to the browser |
| `ACTIVATION_FEE_RECIPIENTS` | _(none — required with the URL)_ | Comma-separated. Absent, empty or malformed = boot error |
| `ACTIVATION_FEE_TIMEOUT_MS` | `20000` | Abort for the webhook call |

Unset means the route still mounts but answers `503 ACTIVATION_FEE_DISABLED`, so
the page a partner was linked to still renders the bank details and explains
itself rather than 404-ing.

The two vars are a pair: setting the webhook without recipients fails at boot.
There is **no default recipient list in source** on purpose — who gets told
about a partner's payment is a deployment decision, and a baked-in default would
mail whoever was on the team the day this was written from every environment
that arms the feature, long after they moved on. Naming the mailboxes is part of
arming it.

> **n8n gotcha:** a `/webhook-test/...` URL only fires while the workflow editor
> is open and listening. Production must use the `/webhook/...` URL, or every
> intimation is silently dropped.

### Diagnosing a failed send

`ACTIVATION_FEE_SEND_FAILED` now names the status the webhook answered with, so
the partner-visible message distinguishes the two failures that matter:

- *"the mail service answered 404"* — we reached n8n and it refused. On a
  `/webhook-test/` URL this almost always means the workflow editor is not
  listening; press **Test workflow** in n8n, or move to the production
  `/webhook/` URL.
- *"Couldn't reach the mail service"* — transport failure: DNS, TLS, refused
  connection, or the `ACTIVATION_FEE_TIMEOUT_MS` abort.

The call is also written into the request trace as `activation-fee webhook`, so
it shows up in **Copy diagnostics** beside the upstream profile lookup. The
trace deliberately carries **only** the label, status and duration: the URL is
the secret this proxy exists to keep, and n8n's own error text repeats it back
("the requested webhook … is not registered"). The full body is logged
server-side under `[eps-backend] activation-fee webhook failed` and never
returned to the browser.

## Files

| Path | Role |
| --- | --- |
| `src/pages/console/PayActivationFee.tsx` | The page |
| `src/lib/console/feeProducts.ts` | Picker options, derived from pricing |
| `src/lib/auth/client.ts` | `authClient.activationFee.intimate` |
| `src/components/console/NextStepsCard.tsx` | The Console Home CTA into this page |
| `packages/eps-backend/src/http/activationFee.ts` | Route, validation, mail body |
| `packages/eps-backend/src/config.ts` | `activationFee` config block |

The route is registered in **both** `src/App.tsx` (lazy) and
`src/AppServer.tsx` (eager). `/console` is never prerendered, so `ssg/routes.ts`
needs no entry.

## Known gaps

- No payment gateway. This is a bank-transfer intimation, not a checkout.
- No duplicate detection beyond the in-flight button guard and the per-partner
  rate limit — two genuine intimations with the same UTR would both be mailed.
- No rail item in the console nav; the entry point is the Console Home
  "Next Steps" card.
