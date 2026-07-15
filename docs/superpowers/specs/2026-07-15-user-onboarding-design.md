# User Onboarding (Self-Serve Signup) — Design

**Date:** 2026-07-15
**Branch:** `feature/user-onboarding`
**Status:** Approved, ready for implementation planning

## Problem

New users cannot sign up on this site. `/console` logs in existing users only; unregistered
numbers are refused with `403 NOT_REGISTERED` at `packages/eps-backend/src/http/app.ts:238`,
behind an explicit `TODO(signup)`. New users are sent to the Eloka webapp (`wlc-webapp`)
instead, which runs the same EPS onboarding against the same upstream.

This design brings signup here: OTP → create partial account → verify PAN → set secret PIN →
EPS Admin.

## Scope

In scope:

- Self-serve signup for new users, entered from `/signup`.
- Resume for users who drop off mid-onboarding.
- A step registry that makes adding/removing/reordering steps cheap.

Out of scope (Eloka has these; EPS does not need them):

- Role selection UI — `applicant_type` is fixed at `1`, `business_vertical` at `"EPS"`.
- PAN photo upload, Aadhaar, Digilocker, video KYC, business details, bank account,
  sign agreement, geolocation capture.
- Assisted and gateway onboarding flows.
- Org-metadata step configuration.

## Key architectural finding

`/transactions/do` and `/transactions/upload` are **not Eko endpoints**. They are routes on
Eloka's own BFF (`connect-api`), which forwards to the same single form-encoded SimpliBank
path that `eps-backend` already calls today (`cfg.eko` — `SIMPLIBANK_API_{SCHEME,HOST,PORT,PATH}`).

The `Bearer access_token` Eloka sends is `connect-api`'s own JWT. It never goes upstream. It
exists only so the BFF can derive:

```js
req.body["initiator_id"] = req.user.tokenDetails.user_id;
req.body["user_code"]    = req.user.tokenDetails.code;
req.body["org_id"]       = req.user.tokenDetails.org_id || "1";
delete req.body["user_id"];
// fallbacks when absent (the signup case):
initiator_id ||= DEFAULT_TRXN_INITIATOR_ID
user_code    ||= DEFAULT_TRXN_USER_CODE
```

`eps-backend` is the `connect-api` equivalent and already does this — `eko.ts:98-104`:

```ts
function base(orgId?: number): Record<string, string> {
	return {
		initiator_id: cfg.initiatorId,
		user_code: cfg.userCode,
		org_id: String(orgId ?? cfg.defaultOrgId),
	};
}
```

`cfg.initiatorId` / `cfg.userCode` are the `DEFAULT_TRXN_*` dummy-FOS pair.

**Consequences:** no Eko access token is captured or stored. No KV token storage, no SecretBox
for tokens, no token refresh path, no new upstream base-path config. The existing HttpOnly
cookie session already supplies the logged-in identity (`sub` = normalized mobile).

`developer_key` alone authenticates upstream. `connect-api`'s `getEpsAuthHeaders()` is not
needed — `eps-backend`'s 515/518/151 calls already succeed without it.

## Backend

### Profile gate

`getProfile` in `packages/eps-backend/src/clients/eko.ts:171-182` gains one branch, placed
**before** the `user_type === "23"` check:

```
code === SUCCESS && user_detail exists
  ├─ onboarding === 1 → { kind: "onboarding", profile }   ← NEW
  ├─ org_id !== 1 || user_type !== "23" → not_allowed
  └─ found
```

Ordering matters. `user_type` becomes `23` immediately after partial-account creation, so
`onboarding === 1` is the **only** reliable in-progress signal. It must be checked first, or a
mid-onboarding user with an unexpected `user_type` falls into `not_allowed` and is locked out
on every subsequent login.

`ProfileResult` gains the `onboarding` variant, carrying the mapped profile.

### verify-OTP branches

Replaces the `TODO(signup)` block at `app.ts:232-244`:

| `getProfile` result | Today | New |
|---|---|---|
| `not_found` | 403 `NOT_REGISTERED` | signup session; no steps done yet |
| `onboarding` | *unreachable (fell into `not_allowed`)* | signup session; resume at pending step |
| `found` | developer session | unchanged |
| `inactive` | 403 `ACCOUNT_INACTIVE` | unchanged |
| `not_allowed` | 403 `NOT_ALLOWED` | unchanged |
| `error` | 502 `PROFILE_UNAVAILABLE` | unchanged |

The `NOT_REGISTERED` error code ceases to exist.

### Session

`SessionClaim.role` (`packages/eps-backend/src/auth/session.ts:9`) gains `"signup"`:

```ts
role: "developer" | "admin" | "signup"
```

Nothing else changes. The claim carries `sub` (mobile) as always. Cookies, TTLs, and refresh
rotation are untouched.

Authorization:

- A signup session authorizes `/signup/*` only.
- `/admin/*` rejects it.
- Developer and admin sessions are rejected by `/signup/*`.

`GET /me` **must not** reject a signup session. It returns a lightweight signup view:

```ts
export interface SignupView {
	role: "signup";
	mobile: string;
}
```

`AuthProvider` boots exclusively from `/me` (`src/lib/auth/AuthProvider.tsx:53-55`). If `/me`
rejected signup sessions, any page reload mid-onboarding would drop the user to `anon` and force
a fresh OTP, defeating resume. The view is deliberately lightweight — no Eko call — mirroring
how the admin branch is handled at `app.ts:321-327`.

`POST /auth/otp/verify` returns `SignupView` (not `MeView`) when it mints a signup session.

On completion the BFF re-fetches 151; if `onboarding === 0` it mints a developer session in
place of the signup session.

### Upstream identity per step

All calls go to the existing `cfg.eko` path with the `developer_key` header, via the existing
`post()` helper. `user_id` is never sent — `connect-api` deletes it.

| Step | `initiator_id` / `user_code` | Extra fields |
|---|---|---|
| 521 create partial account | `cfg.initiatorId` / `cfg.userCode` | `user_identity` = mobile, `user_identity_type` = `"mobile_number"`, `applicant_type: 1`, `business_vertical: "EPS"` |
| 523 PAN, 170 booklet, 10005 pintwin key, 5 set PIN | `profile.ekoUserId` / `profile.code` | `org_id` = `profile.orgId` |

`ekoUserId` and `code` are already mapped from the 151 response at `eko.ts:196-200`.

### Endpoints

All require a signup session. Each re-fetches 151 after a successful upstream call and returns
fresh state, so the client never infers progress — the API is the single source of truth.

| Endpoint | Upstream | Success condition |
|---|---|---|
| `GET /signup/state` | 151 | — |
| `POST /signup/profile` | 521 | `response_type_id === 1566` |
| `POST /signup/pan` `{pan}` | 523 | `response_type_id === 1569` |
| `POST /signup/pin` `{pin1,pin2}` | 170 → 10005 ×2 → encode → 5 | `response_type_id === 9` |

`GET /signup/state` response:

```ts
type SignupState = {
	mobile: string;
	status: "new" | "in_progress" | "done";
	steps: Array<{ role: number; label: string }>;
	currentRole: number | null;
};
```

`status: "new"` means 151 returned `not_found` — the partial account does not exist yet.
`status: "done"` means `onboarding === 0`; the BFF has swapped in a developer session and the
client should navigate to `/console`.

A step call that succeeds returns the same `SignupState` shape, post-refresh.

### PAN (523)

Multipart POST. One part only — `form-data` (hyphenated; `formdata` is `connect-api`'s inbound
field name, not the upstream's). **No file part** — confirmed acceptable.

`form-data` value is a URL-encoded string of:

```
client_ref_id=<generated>&interaction_type_id=523&intent_id=3&doc_type=2
&doc_id=<PAN>&source=EPS&latlong=27.176670,78.008075,7787
&initiator_id=<profile.ekoUserId>&user_code=<profile.code>&org_id=<profile.orgId>
```

`latlong` is a hardcoded constant — this design does not port Eloka's geolocation step, and
Eloka itself falls back to this same value. Define it as a named constant with a comment
explaining why it is fixed.

Success: `response_type_id === 1569`.

### PIN (170 → 10005 → 5)

Pintwin is a digit-substitution cipher over a server-issued key, not encryption. The key is a
10-character permutation of `0-9` delivered to the caller in plaintext. Its only security
property is that it is **single-use and server-invalidated per attempt**, so a captured
`okekey` cannot be replayed.

Encoding runs in the BFF. `packages/eps-backend/src/signup/pintwin.ts`:

```ts
/**
 * Encodes a PIN by substituting each digit through a server-issued pintwin key.
 * @param pin - The raw PIN, digits only.
 * @param key - 10-char permutation of 0-9 from FETCH_PINTWIN (10005).
 * @param keyId - The key's id, appended so the server can invert the substitution.
 * @returns The encoded okekey, e.g. "9748|39".
 */
export function encodePin(pin: string, key: string, keyId: number | string): string;
```

`out[i] = key[Number(pin[i])]`, then append `"|" + keyId`.

Sequence for `POST /signup/pin`:

1. **170** `GET_BOOKLET_NUMBER` — body `{interaction_type_id: 170, document_id: "", latlong, ...identity}`.
   Accept only when `response_status_id === 0 && response_type_id === 1646`.
   Yields `{user_code, booklet_serial_number, is_pintwin_user}`. `user_code` is unused.
2. **10005** `FETCH_PINTWIN` ×2 — one key per PIN, mirroring Eloka's two independent Pintwin
   mounts. Each okekey carries its own `|key_id`. Body includes `alternate_user_id`.
   Yields `{pintwin_key, key_id}`.
3. **5** `USER_ONBOARDING_SECRET_PIN` — body:

```
interaction_type_id: 5
first_okekey:  <encodePin(pin1, key1, keyId1)>
second_okekey: <encodePin(pin2, key2, keyId2)>
is_pintwin_user:        <verbatim from 170>
booklet_serial_number:  <verbatim from 170>
latlong: <the same hardcoded constant>
...identity
```

`is_pintwin_user` is forwarded verbatim. It branches nothing client-side in Eloka either — the
value is interpreted upstream.

Success: `response_type_id === 9`.

Fetching a fresh key on every submit preserves the single-use discipline for free: a failed
attempt re-keys naturally on retry. No refresh signalling is needed.

**Security — log redaction.** The raw PIN never goes upstream (the BFF encodes it), so `ekoLog`
never receives one. The leak is narrower but real: at `EKO_LOG_LEVEL=full`, `ekoLog` logs both
the full request fields and the full response body (`audit/ekoLog.ts:110-113`). That would
capture `first_okekey`/`second_okekey` (request to interaction 5) **and** `pintwin_key` (response
from 10005). Together they make the PIN trivially recoverable, since the encoding is a plain
digit substitution.

`ekoLog` must therefore redact, at every level:

- Request fields: `first_okekey`, `second_okekey`
- Response fields: `pintwin_key`

Redaction belongs in `ekoLog` itself, not at the call sites — a call site that forgets is a
silent leak. Asserted by a test at `full` level.

`basic` (the production default) already logs only a `responseSummary` allowlist and no request
fields, so it is unaffected. The redaction protects `full`, which is development-only but is
exactly where someone debugging the PIN step will be.

### Open item

`10005` takes `alternate_user_id`. Eloka reads it from a `temp_user_id` in `sessionStorage`
whose provenance is not visible in that codebase. This design sends the mobile. Confirm at UAT;
it is a one-line change if wrong.

## Frontend

### `/signup` page

`/signup` is already routed (`App.tsx`) and prerendered (`ssg/routes.ts`), so no routing work.
The existing Zoho lead-capture iframe (`src/pages/SignupPage.tsx`) is **deleted** — `/signup`
becomes signup.

The page is a switch on auth state, mirroring `Console.tsx:100`:

| State | Renders |
|---|---|
| `loading` | skeleton |
| `anon` | `<LoginForm />` — reused as-is |
| `signup` | `<SignupWizard />` |
| `authed` | redirect → `/console` |

`LoginForm` (`src/components/auth/LoginForm.tsx`) needs no changes: mobile entry, 4-digit OTP,
auto-submit, resend cooldown, and masking already exist, and `onSuccess` is already an optional
prop (`LoginForm.tsx:29`). Only its `403 NOT_REGISTERED` error path becomes dead code, since
that code no longer exists.

`AuthProvider.classify()` (`src/lib/auth/AuthProvider.tsx:25-30`) gains the signup role, and
`AuthState` gains a `{status:"authed"; role:"signup"; ...}` variant.

**SSG:** `/signup` prerenders the anon state. The wizard must not render during hydration —
apply the same guard `UserMenu.tsx:22` already uses to avoid a hydration mismatch.

### Partial-account creation is not a screen

`applicant_type` and `business_vertical` are constants, so there is nothing to ask. On wizard
mount, `GET /signup/state` returning `status: "new"` triggers `POST /signup/profile` behind a
*"Setting up your account…"* spinner, then step 1 renders.

Keeping this a separate call — rather than folding 521 into verify-OTP — means a 521 failure is
retryable **without re-sending an OTP**.

### Step registry

The entire configurable surface:

```ts
// src/features/signup/steps.ts
export const SIGNUP_STEPS = [
	{ role: 13000, name: "pan", label: "PAN Details",    Component: PanStep },
	{ role: 12600, name: "pin", label: "Set Secret PIN", Component: PinStep },
] as const;
```

Adding a step = one entry + one component. Removing = delete the entry.

`resolveSteps` (~40 lines, ported from Eloka's `stepGenerator` minus the org-metadata stages):

- Keep registry steps whose `role` appears in the API's `onboarding_steps`.
- Order by the API's order, not the registry's.
- Prefer the API's `label` when present; fall back to the registry's.
- Mark every step before `currentRole` complete; `currentRole` is current; the rest pending.
- A role in the API that the registry does not know is skipped, and logged.

Deliberately not ported: `isVisible`, `isRequired`/skip, `applicableRoles` arrays (one role per
step here), `api.pipeline` arrays, `preSubmit.inject`, `postSubmit.refreshProfile`, org
metadata, pipeline retry/resume state, `callbacks`. Each is a step field Eloka needs for nine
steps and a white-label deployment; none is load-bearing for two fixed steps. Add when a step
actually needs one.

### Layout

Single centered card, matching the regulated-KYC pattern (Coinbase, Remote, Hims) and the
existing `/console` login card. Progress is a segmented bar above the title — scales to 3-4
steps without a redesign.

```
┌─────────────────────────────┐
│  ███████████  ░░░░░░░░░░░   │
│  Step 1 of 2                │
│                             │
│  PAN Details                │
│  Enter your PAN to continue │
│                             │
│  PAN                        │
│  ┌───────────────────────┐  │
│  │ ABCDE1234F            │  │
│  └───────────────────────┘  │
│  🔒 Why do we need this?    │
│                             │
│  ┌───────────────────────┐  │
│  │       Continue        │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

Eloka's vertical sidebar stepper is not ported: it was built for nine steps, and at two it is
mostly empty gutter with no shadcn primitive behind it.

### Steps

**PanStep** — single uppercase text input, `maxLength=10`, live-validated against
`/^[A-Z]{5}[0-9]{4}[A-Z]$/`. A "Why do we need this?" note sits beside the field, per the
Coinbase/PayPal pattern for a sensitive identifier. Submit disabled until valid.

**PinStep** — two masked `InputOTP` fields, "Secret PIN" and "Confirm PIN", 4 digits each.
Submit disabled until both are complete and equal. Match is compared on the raw values. With
BFF encoding there is no key state, no security-status indicator, and no refresh cycle.

`src/components/ui/input-otp.tsx` is added as a shadcn primitive. `input-otp@^1.4.2` is already
a dependency and currently unused; `LoginForm`'s hand-rolled OTP boxes are left alone.

**Completion** — on `status: "done"`, a brief confirmation, then navigate to `/console`.

### Client

`signupClient` on the existing wrapper (`src/lib/auth/client.ts:125-140`), which already
handles `credentials: "include"`, the `{error:{code,message}}` envelope, and 401 refresh:

```ts
signupClient = {
	state(): Promise<SignupState>;
	createProfile(): Promise<SignupState>;
	submitPan(pan: string): Promise<SignupState>;
	submitPin(pin1: string, pin2: string): Promise<SignupState>;
};
```

## Error handling

| Failure | Behaviour |
|---|---|
| Upstream failure on a step | Toast; stay on the step; retry is just re-submit (server holds the truth) |
| `invalid_params` in response | Inline field error from the upstream message |
| PAN format invalid | Client-side inline error; BFF re-validates as the trust boundary |
| PIN mismatch | Client-side; submit stays disabled |
| Session expires mid-wizard | Back to `LoginForm`; progress is server-side, nothing is lost |
| Drop-off, returns later | `GET /signup/state` resumes at `currentRole` |
| 521 fails | Retryable from the wizard without re-sending an OTP |

PAN is validated on both sides. The client-side check is for feedback; the BFF check is the
trust boundary and is not optional.

## Testing

Vitest with mocked `fetch`, matching the existing style (`eko.test.ts`, `app.test.ts`,
`LoginForm.test.tsx`). No new harness.

Backend:

- `encodePin` — golden vector from Eloka's own test: key `"1974856302"`, id `39`, PIN `"1234"`
  → `"9748|39"`. Plus the identity key `"0123456789"`, id `55`, PIN `"0123"` → `"0123|55"`.
- `eko.ts` — the `onboarding` branch fires **before** the `user_type` gate; a mid-onboarding
  profile with `user_type: "23"` and `onboarding: 1` returns `kind: "onboarding"`, not `found`.
- verify-OTP — `not_found` and `onboarding` both mint a signup session; `found` still mints a
  developer session; the 403/502 branches are unchanged.
- Signup routes — the role gate rejects developer, admin, and anonymous callers; each endpoint
  covers success and upstream failure.
- `POST /signup/pin` — asserts no PIN value appears in anything `ekoLog` receives.

Frontend:

- `resolveSteps` — API ordering wins over registry order; resume marks prior steps complete;
  an unknown role from the API is skipped without throwing.
- `SignupPage` — the state switch renders login / wizard / redirect.
- `PanStep` — regex validation gates submit.
- `PinStep` — mismatch keeps submit disabled.

One manual UAT smoke pass before merge, which also settles the `alternate_user_id` open item.

## Files

Backend — `packages/eps-backend/src/`:

| File | Change |
|---|---|
| `clients/eko.ts` | `onboarding` result kind; 5 new methods (521, 523, 170, 10005, 5) |
| `signup/pintwin.ts` | new — pure `encodePin` |
| `signup/service.ts` | new — step orchestration, profile re-fetch, state projection |
| `http/signup.ts` | new — 4 routes + signup-role gate |
| `http/app.ts` | verify-OTP branch; `/me` signup view; `mountSignup` |
| `auth/session.ts` | `role` union gains `"signup"` |
| `identity/me.ts` | `SignupView` type |
| `audit/ekoLog.ts` | redact `first_okekey`/`second_okekey`/`pintwin_key` |

Frontend — `src/`:

| File | Change |
|---|---|
| `pages/SignupPage.tsx` | rewrite; Zoho iframe deleted |
| `features/signup/steps.ts` | new — registry |
| `features/signup/resolveSteps.ts` | new — resolver |
| `features/signup/SignupWizard.tsx` | new |
| `features/signup/PanStep.tsx` | new |
| `features/signup/PinStep.tsx` | new |
| `components/ui/input-otp.tsx` | new — shadcn primitive |
| `lib/auth/client.ts` | `signupClient` |
| `lib/auth/AuthProvider.tsx` | `classify()` handles the signup role |

Docs: this spec, plus a `docs/features/` page covering the flow, the step registry, and how to
add a step.

## Decisions and their reasons

| Decision | Reason |
|---|---|
| No Eko access token | `/transactions/do` is `connect-api`'s route; the Bearer never goes upstream. `eps-backend`'s cookie session already supplies the identity. |
| Check `onboarding === 1` before `user_type` | `user_type` becomes `23` right after partial-account creation, so it cannot distinguish in-progress from complete. |
| PIN encoding in the BFF | Pintwin is a plaintext-key substitution, not encryption — keeping it client-side protects nothing but costs a hook, key lifecycle, refresh signalling, and loader states. |
| Server is the source of truth for progress | Every step re-fetches 151. Resume, retry, and drop-off all fall out for free. |
| Minimal step registry | Eloka's engine serves nine steps and white-label orgs. Its docs have already drifted from its code — that is the maintenance cost of that much config. |
| Centered card, no sidebar | Mobbin's regulated-KYC set is unanimous for short flows; a sidebar at two steps is empty gutter. |
| `/signup` replaces the Zoho iframe | `/signup` should mean signup. The lead funnel is retired. |

## Risks

| Risk | Mitigation |
|---|---|
| `alternate_user_id` for 10005 is a guess | One-line change; settled by the UAT smoke pass |
| Hardcoded `latlong` may be rejected | Named constant in one place; Eloka uses the same fallback value |
| PIN recoverable from `full`-level logs (okekey + pintwin_key) | Redaction inside `ekoLog`, not at call sites, plus a test at `full` level |
| Reload mid-onboarding drops the user to `anon` | `/me` returns `SignupView` for signup sessions |
| `/signup` prerender hydration mismatch | Reuse the existing `UserMenu.tsx:22` guard |
