# Business Details onboarding step — design

**Date:** 2026-07-16
**Status:** Approved, ready for planning
**Extends:** [2026-07-15-user-onboarding-design.md](./2026-07-15-user-onboarding-design.md)

## Goal

Add a **Business Details** step (role `13300`) to the self-serve signup wizard, so an
EPS applicant supplies company, contact, and registered-address details between PAN
verification and PIN creation.

Role `13300` is confirmed emitted by upstream for the EPS vertical. Order and label
still come from the API at runtime — the registry only answers "can we render role N".

## Reference, not a port

Eloka (`wlc-webapp`) has a `BusinessDetailsStep`, but its stack shares nothing with
this repo:

| Eloka | This repo |
| --- | --- |
| Chakra UI | shadcn/ui + Tailwind |
| `react-hook-form` | plain `useState` |
| `tf-components` `Form` + `parameter_list` | hand-rolled JSX |
| Step config drives an API pipeline executor | Role-keyed registry, one `submit` closure |

So this is a re-implementation against Eloka's **field set and upstream contract**,
not a code port. Eloka remains the source of truth for what interaction 522 expects.

## Upstream contract (verified)

Interaction **522** (`USER_ONBOARDING_BUSINESS`), success `response_type_id` **1567**.

Confirmed from Eloka's code rather than assumed:

- `client_ref_id` is always present — `helpers/apiHelper.js:103` injects it when absent
  and `features/onboarding/utils/executePipeline.ts:289` sets it explicitly. We send
  `randomUUID()`, matching interaction 523's existing treatment in `eko.ts`.
- `latlong` is injected via the step's `preSubmit`. We use the existing
  `ONBOARDING_LATLONG` constant.
- Eloka authenticates as the user via a bearer token; this repo instead identifies the
  actor with `actor(identity)` form fields, exactly as 521 / 523 / 5 already do.

`company_type` values (Eloka `COMPANY_TYPE_OPTIONS`): Private Ltd `1`, LLP `2`,
Partnership `3`, Sole Proprietorship `4`.

Eloka's `FormData` type declares `communication: 1` but never sends it. Dropped.

### State list — probed, then inlined

A read-only probe of interaction **387** against UAT (`dev.simplibank.eko.in`) returned:

```
HTTP 200
envelope: response_status_id: 0, response_type_id: 1309, status: 0, message: "Success"
param_attributes.list_elements: 36 entries, label !== value in 0 entries
```

Findings:

1. 387 needs **no actor identity** — plain `base()` works, no profile required.
2. Values are **plain state names**, identical to their labels. Not ids.
3. The envelope carries both `status` and `response_status_id`, so this repo's
   `response_status_id === 0` convention holds.

Because the value is a name and the list is 36 static entries, **the list is inlined as
a const** rather than fetched. This was a reversal: the BFF route was originally
recommended on the theory that the value might be an opaque upstream id we couldn't
safely guess. It isn't. Inlining drops an eko method, a service method, a route, a
client call, a cache, and a loading state, in exchange for a drift risk that
materialises only if India changes its states.

The const is pasted **verbatim from the probe output**. Upstream matches on these exact
strings, so the quirks are load-bearing and must not be "corrected":

- `"PondiCherry"` — that casing.
- `"National Capital Territory of Delhi (UT)"`.
- `"Andhra Pradesh (New)"` — appears **last** upstream, not alphabetically.
- No `"Ladakh"` entry exists upstream.

Display sorts by label (so Andhra Pradesh isn't stranded at the bottom); the submitted
`value` is unaffected.

## Step contract change

`StepProps.onSubmit` currently takes `values: string[]` — positional. PAN sends `[pan]`,
PIN sends `[pin1, pin2]`. At ten fields, positional is a bug waiting for the first
reorder. Widen to a named record:

```ts
onSubmit: (values: Record<string, string>) => Promise<void>;
type StepSubmit = (
	client: typeof signupClient,
	values: Record<string, string>,
) => Promise<SignupState>;
```

Registry after the change:

```ts
{ role: 13000, name: "pan",      submit: (c, v) => c.submitPan(v.pan) },
{ role: 13300, name: "business", label: "Business Details",
  Component: BusinessStep, submit: (c, v) => c.submitBusiness(v) },
{ role: 12600, name: "pin",      submit: (c, v) => c.submitPin(v.pin1, v.pin2) },
```

Mechanical, but it touches `resolveSteps.ts`, `steps.ts`, `PanStep`, `PinStep`, and
their tests.

## Fields

| Field | Rule | Required |
| --- | --- | --- |
| `name` | `/^[-a-zA-Z0-9 ,./:]+$/`, 2–100 | yes |
| `company_type` | select, 1–4 | yes |
| `authorized_signatory_name` | `/^[a-zA-Z][a-zA-Z .]{1,49}$/` | yes |
| `contact_person_cell` | `/^[6-9]\d{9}$/` | yes |
| `alternate_mobile` | same, blank allowed | no |
| `current_address_line1` | 10–200 | yes |
| `current_address_line2` | ≤200 | no |
| `current_address_district` | `/^[a-zA-Z ]+$/`, 2–50 | yes |
| `current_address_state` | one of the 36 inlined values | yes |
| `current_address_pincode` | `/^\d{6}$/` | yes |

Rules are Eloka's, with one deliberate deviation: Eloka's `nameValidation` regex is an
unreadable gibberish-detector that also rejects legitimate names (e.g. repeated
letters). Replaced with a plain readable pattern. Upstream validates independently, so
this loosening is not the last line of defence.

## Architecture

### Frontend

- `src/features/signup/businessFields.ts` — one spec array (name, label, placeholder,
  kind, pattern, min, max, required, message) that drives **both** the render loop and
  client validation. Single source; no per-field duplication. Also exports
  `INDIAN_STATES` (the 36 verbatim values) and `COMPANY_TYPES`, since both are just the
  `options` of a field in that same spec.
- `src/features/signup/BusinessStep.tsx` — one `useState<Record<string, string>>`.
  Errors surface on blur, not on every keystroke. Submit disabled until all required
  fields validate. Ten inputs in one column is a wall, so fields are grouped under three
  headings: **Business**, **Contact**, **Address**.
- The two dropdowns use a **native `<select>`**, not shadcn's Radix wrapper. Radix's
  Select renders into a portal, ignores `fireEvent.change`, and needs keyboard simulation
  to test under jsdom — all to reproduce what the platform already provides. The native
  control is keyboard- and screen-reader-accessible by default, is the better mobile
  affordance for a 36-item list, and adds no file. (Superseded during planning: this
  section originally called for generating `src/components/ui/select.tsx`.)
- `src/lib/auth/client.ts` — `submitBusiness(details)` → `POST /signup/business`.

### Backend

- `packages/eps-backend/src/clients/eko.ts` — `submitBusiness(input)`:

  ```ts
  const BUSINESS_DETAILS_OK = 1567;

  async submitBusiness(input) {
    const raw = await post({
      ...actor(input.identity),
      client_ref_id: randomUUID(),
      interaction_type_id: "522",
      ...input.details,
      latlong: ONBOARDING_LATLONG,
      source: "EPS",
    }, input.xRealIp);
    return stepResult(raw, BUSINESS_DETAILS_OK);
  }
  ```

- `packages/eps-backend/src/signup/service.ts` — `submitBusiness(mobile, details, xRealIp)`:
  `requireProfile` → `identityOf` → `eko.submitBusiness` → `refresh(mobile)`. Structurally
  identical to `submitPan`.
- `packages/eps-backend/src/http/signup.ts` — `POST /signup/business`, behind
  `requireSignupSession`, mobile from the session claim and never the body. Validates all
  ten fields **before** any upstream call, then returns through `respond()` so the
  onboarding-complete session upgrade keeps working.

Validation regexes exist on both the client (feedback) and the BFF (trust boundary).
This duplication is the codebase's existing, deliberate stance — see `PAN_PATTERN` in
both `PanStep.tsx:9` and `signup.ts:15`. No cross-package sharing path exists today, and
inventing one for a single step is out of scope.

**Exception — `current_address_state`.** The BFF does *not* re-check it against the
36-value enum. The backend package cannot import `businessFields.ts`, so enforcing the
enum there would mean a second verbatim copy of 36 strings that must stay in lockstep
with the first — a worse trade than the one-line regex duplication above, and a silent
rejection the day the two copies diverge. The BFF validates shape only (non-empty,
≤60 chars); interaction 522 is the real authority on which state names it accepts and
already rejects unknown ones with its own message. The dropdown means a well-behaved
client cannot send an invalid state anyway.

## Data flow

```
BusinessStep (10 named fields, client-validated)
  → onSubmit(Record<string,string>)
  → steps.ts submit closure
  → signupClient.submitBusiness()
  → POST /signup/business   [session guard, re-validate all 10]
  → service.submitBusiness  [requireProfile → identity]
  → eko 522                 [actor + client_ref_id + latlong + source]
  → stepResult(raw, 1567)
  → refresh()               [getProfile 151 — progress never inferred client-side]
  → respond()               [upgrades session if onboarding === 0]
```

## Error handling

Unchanged from the established pattern. A failed 522 throws `SignupStepError` carrying
upstream's own message plus `responseTypeId`; `toAppError` maps it to a 400
`STEP_FAILED`; the wizard's `runStep` surfaces it as the step's `error` prop. Field-level
client errors never reach the server. Invalid input caught at the route returns 400
`INVALID_INPUT` without touching upstream.

## Testing

| Test | Covers |
| --- | --- |
| `BusinessStep.test.tsx` | submit gated until valid; payload is named and complete; blur-not-keystroke errors |
| `businessFields.test.ts` | each rule accepts/rejects representative input |
| `service.test.ts` | 522 success → refresh; failure → `SignupStepError` |
| `signup.test.ts` | route rejects bad input before any upstream call; session guard |
| `eko.test.ts` | 522 field shape: actor, `client_ref_id`, `latlong`, `source` |
| `PanStep` / `PinStep` / `resolveSteps` / `SignupWizard` | updated for the record contract |

## Out of scope

- De-duplicating `PAN_PATTERN` / `PIN_LENGTH` via a shared module. Real debt, unrelated
  to this step.
- Fetching states from 387 at runtime. Documented above as the upgrade path if the
  inlined list ever drifts.
- Any other onboarding step in Eloka's master list (Aadhaar, Digilocker, video KYC, bank
  account, agreement).
