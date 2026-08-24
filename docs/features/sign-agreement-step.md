# Sign Agreement Step — EPS portal vs Eloka (`wlc-webapp`)

Reference walkthrough of the e-sign ("Sign Agreement") onboarding step as it is
implemented **here** (`eko-eps-website` + `packages/eps-backend`), followed by a
call-for-call comparison with **Eloka** (`wlc-webapp`, package name
`eloka-webapp`), which is where this flow was ported from.

Scope: role code **12800**, upstream interactions **287** (fetch signing URL) and
**293** (submit signed agreement).

The interaction-level facts (why 287/293 classify on `status`, why
`agreement_id` is per-user) are also summarised in
[`user-onboarding.md`](./user-onboarding.md#interaction-reference-table); this
document is the end-to-end step walkthrough and the Eloka diff.

---

## Part 1 — How it works here (EPS portal)

### 1.1 Files involved

| Layer | File | Role |
| --- | --- | --- |
| Wizard | `src/features/signup/SignupWizard.tsx` | Loads server state, picks the current step, owns `runStep` (busy/error), upgrades to console when `status === "done"` |
| Registry | `src/features/signup/steps.ts` | Maps role `12800` → `SignAgreementStep`, and its submit → `client.submitAgreement(v.document_id)` |
| Resolver | `src/features/signup/resolveSteps.ts` | Server `onboarding_steps` × local registry → ordered steps with `complete`/`current`/`pending` |
| Step UI | `src/features/signup/SignAgreementStep.tsx` | Phase machine, URL fetch, provider open, `STATUS_UPDATE` listener, final submit |
| Provider mechanics | `src/features/signup/esign.ts` | `usesLeegality()`, `loadLeegality()`, `esignOrigin()`, `openEsign()` |
| SDK asset | `public/scripts/leegalityv5.min.js` | Self-hosted Leegality v5 loader (script id `leegality-sdk`), so it loads under `script-src 'self'` |
| API client | `src/lib/auth/client.ts` | `signupClient.getAgreementUrl()`, `signupClient.submitAgreement()`, `SignUrlView`, cookie auth + one-shot 401 refresh |
| BFF routes | `packages/eps-backend/src/http/signup.ts` | `GET /signup/agreement/url`, `POST /signup/agreement`, `requireSignupSession`, `respond()` (session upgrade) |
| BFF service | `packages/eps-backend/src/signup/service.ts` | `getAgreementUrl`, `submitSignAgreement`, `requireProfile`, `requireAgreementId`, `refresh`, `project` |
| Upstream client | `packages/eps-backend/src/clients/eko.ts` | Interactions 287/293, `agreementIdOf()`, `identityOf()`, `actor()`, `post()` |

There is **no** `useSignAgreement`-style hook here: the whole provider lifecycle
lives inside `SignAgreementStep` as a 5-value `Phase`, and only the final
`document_id` crosses the wizard boundary.

### 1.2 State machine

```
loading ──▶ ready ──▶ signing ──▶ signed ──▶ (auto-submit) ──▶ wizard advances
   │           ▲          │
   │           └──────────┘  provider error / popup blocked
   ▼
 error ──(Retry)──▶ loading
```

`alreadySigned` from 287 jumps `loading → signed` directly, skipping the
provider entirely.

`signing` means two different things depending on the provider, and the
component derives which from `pipe` rather than tracking a sixth phase:

```ts
const popupOpen = phase === "signing" && !!signData && !usesLeegality(signData.pipe);
```

- **SDK pipes (1, 3)** — the Leegality modal is up and its callback is the only
  way out. The Sign button is disabled and reads "Signing…".
- **Popup pipes (0, 2)** — `window.open` has fired and *no callback will ever
  come*. The step must not trap the user there, so `signing` renders `Continue`
  alongside a still-enabled Sign button ("Open the signing window again"). Before
  this, closing a popup left the step stuck until a page reload. `Continue` is
  disabled for the first `POPUP_GRACE_SECONDS` — see §1.5.

### 1.3 Call sequence

```
Browser                        eps-backend (BFF)                     Eko / SimpliBank
  │ mount                              │                                    │
  ├─ GET /signup/agreement/url ───────▶│                                    │
  │   (cookie: eps_at, signup role)    ├─ interaction 151 (getProfile) ────▶│
  │                                    │◀── profile (code, org_id,          │
  │                                    │     user_detail.agreement_id)      │
  │                                    ├─ requireAgreementId()              │
  │                                    ├─ interaction 287 ─────────────────▶│
  │                                    │◀── { status, response_type_id,     │
  │                                    │      data:{short_url,document_id,  │
  │◀── { shortUrl, documentId,         │      pipe} }                       │
  │      pipe, alreadySigned } ────────┤                                    │
  │                                                                          │
  ├─ click "Sign Agreement"                                                  │
  │   pipe 1|3 → Leegality SDK modal   ·  else → window.open popup           │
  │   ◀── SDK callback  |  postMessage STATUS_UPDATE (origin-checked)        │
  │                                                                          │
  ├─ click "Continue"                  │                                    │
  ├─ POST /signup/agreement ──────────▶│                                    │
  │   { document_id }                  ├─ interaction 151 (getProfile) ────▶│
  │                                    ├─ requireAgreementId()  (re-read)   │
  │                                    ├─ interaction 293 ─────────────────▶│
  │                                    │◀── { status, response_type_id }    │
  │                                    ├─ interaction 151 (refresh) ───────▶│
  │◀── SignupState (+ Set-Cookie when  │◀── profile (onboarding 0/1)        │
  │     onboarding completed) ─────────┤                                    │
```

Per Sign Agreement step: **2 BFF calls, 5 upstream interactions**
(151 → 287, then 151 → 293 → 151).

### 1.4 Exact upstream payloads

Both go through `post()` in `eko.ts`: `POST {scheme}://{host}:{port}{path}`,
`Content-Type: application/x-www-form-urlencoded`, header
`developer_key: cfg.developerKey`, and a generated `client_ref_id` injected
centrally (never caller-supplied).

**Interaction 287 — `getAgreementUrl`**

| Field | Value |
| --- | --- |
| `initiator_id` | user's **mobile** (from the 151 profile; *not* `eko_user_id`) |
| `user_code` | `profile.code` |
| `org_id` | `profile.orgId` |
| `interaction_type_id` | `287` |
| `document_id` | `""` |
| `agreement_id` | `agreementIdOf(profile)` — `user_detail.agreement_id`, per-user |
| `latlong` | `27.176670,78.008075,7787` (`ONBOARDING_LATLONG` constant) |
| `csp_id` | mobile |
| `user_id` | mobile |
| `client_ref_id` | generated |

**Interaction 293 — `submitSignAgreement`**

| Field | Value |
| --- | --- |
| `initiator_id` / `user_code` / `org_id` | same actor identity, from a **fresh** 151 |
| `interaction_type_id` | `293` |
| `document_id` | the id the client echoed back |
| `agreement_id` | `agreementIdOf(profile)` — re-read, not carried from 287 |
| `agreement_status` | `"success"` — upstream parameter 638; omitting it answers `invalid_params: {agreement_status: …}` |
| `esign_completed` | `"true"` (no upstream definition; Eloka parity) |
| `completion_timestamp` | ISO now (no upstream definition; Eloka parity) |
| `latlong` | the same fixed constant |
| `client_ref_id` | generated |

### 1.5 Business logic — success / failure / proceed

**287 classification (`eko.ts`)**

1. `code = response_type_id ?? -1`; `ok = Number(status ?? 0) === 0` — an
   **absent** `status` reads as success (every observed reply carries it, and
   error replies always carry it non-zero).
2. `ok && code ∈ {1615, 1069}` → `{ alreadySigned: true, shortUrl: "" }`.
3. `ok && data.short_url` matches `^https?://` → `{ alreadySigned: false }`.
   The scheme check keeps a non-http(s) URL out of `window.open`/the SDK.
4. Otherwise → `{ ok: false, message: upstream message, responseTypeId, details }`
   → `SignupStepError` → HTTP `400 STEP_FAILED` carrying the upstream's own
   message.

`documentId = data.document_id || document_id || ""` — the already-signed
replies put the id at the **top level**, not under `data`.
`pipe = data.pipe ?? 0`.

**Provider selection (`esign.ts`)**

| `pipe` | Provider | Behaviour here |
| --- | --- | --- |
| `1` (Karza), `3` (Leegality) | Leegality SDK | Load `/scripts/leegalityv5.min.js` once, `new Leegality({callback}).init()` + `.esign(url)` |
| `0` (DigiO), `2` (Signzy), anything else | popup | `window.open(shortUrl, "SignAgreementWindow")` |

**Signed-ness**

- Leegality/Karza: SDK `callback`. `res.error` → `localError` + back to `ready`
  (retry allowed). Otherwise `documentId = res.documentId || res.document_id`
  and phase → `signed`.
- Popup providers: no callback exists. The only success signal is
  `postMessage({type:"STATUS_UPDATE"})` from the signing page, accepted **only**
  when `event.origin === esignOrigin(shortUrl)` **and** `popupOpen` is true. The
  listener is mounted by the `popupOpen` effect, so it exists only while a popup
  signing window is actually open — an unsolicited message can never advance
  onboarding on its own, which matters now that reaching `signed` auto-submits.
- Popup blocked → `{ error: "Please allow pop-ups to sign the agreement." }` →
  stays on `ready`.

**Proceed gating**

`Continue` renders when `signed || popupOpen`, and reaching `signed` submits on
its own:

```ts
// fires at most once per mount — the manual Continue is what retries a failure,
// so this must NOT reset when 293 fails
useEffect(() => {
    if (!signed || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submit();
}, [signed, submit]);
```

Every completion signal — SDK callback, `STATUS_UPDATE`, or `alreadySigned` from
287 — lands on `signed` and submits **immediately**. The provider has said the
document is signed; making the user click Continue after that, or watch a timer,
adds nothing.

The one thing that *is* delayed is the popup-pipe `Continue`, and it is delayed
for a different reason:

```ts
const POPUP_GRACE_SECONDS = 5;
// in handleSign, popup pipes only:
if (!usesLeegality(signData.pipe)) setGrace(POPUP_GRACE_SECONDS);
// one timeout per remaining second
useEffect(() => {
    if (grace === 0) return;
    const timer = setTimeout(() => setGrace(grace - 1), 1000);
    return () => clearTimeout(timer);
}, [grace]);
const waiting = popupOpen && grace > 0;   // disables Continue
```

`Continue` has to exist for popup pipes (they have no callback), but a
`window.open` tab can take a second or two to paint. A `Continue` that is live in
that gap invites a click *before the user has even seen the signing page*, which
submits an unsigned agreement and earns a 293 failure. So for the first five
seconds it renders disabled under an `aria-live="polite"` line — "Opening the
signing window… you can continue in N seconds." — and a real completion signal
arriving mid-grace still submits at once, because the grace gates only the
button, never the signal.

Note this is **not** what Eloka's `AUTO_ADVANCE_SECONDS` does: there the 5 s is a
countdown *after* success that auto-fires Proceed, and Proceed unlocks with no
delay at all on the click of Sign. Same constant, opposite end of the flow.

Both paths route through one `submit()` with a `submitting` re-entrancy ref:
`busy` only arrives after the wizard re-renders, so it cannot stop a click that
lands in the same tick as the auto-submit, and a duplicate 293 would follow.

`Continue` appearing for an open popup does **not** assert the user signed — it
is the Eloka rule, and 293 is the arbiter: an unsigned agreement fails there with
the upstream's own message.

**293 classification**

`ok` iff `Number(status ?? -1) === 0`. An **absent** `status` **fails** here
(deliberately stricter than 287: there is no payload to corroborate it, and
passing an unsigned agreement would advance the user past the step). Not
classified by `response_type_id` at all — 293 has answered both `1043` and
`1069` on success.

**Advancing**

The step never decides progression. After a successful 293 the service calls
`refresh()` → interaction 151 → `project()`:

- `profile.onboarding === 0` → `status: "done"`, `currentRole: null`.
- else `currentRole` = first `onboarding_steps` entry still present in the
  pending `role_list`.

`respond()` then, on `status === "done"`, mints a **developer** session in place
of the signup session (access + refresh cookies, carrying the `sid`), and calls
`auth.refreshEntitlements(sid)` so the upstream token stops carrying the
pre-onboarding roles. The wizard sees `status === "done"`, calls `refresh()` on
`/me`, and routes to the console.

Failure of the upgrade is non-fatal: the request still returns the `done` state
and the next `/signup/state` retries the upgrade.

**Error surfaces**

| Failure | User sees |
| --- | --- |
| 287 fails / network | Row 1 flips to "Failed to prepare document" + the upstream message, with an inline **Retry** link that re-runs `initialize()`. Row 2 dims to 40%, and **neither Sign Agreement nor Continue renders** |
| Missing `agreement_id` on profile | `SignupStepError("Couldn't start the agreement signing right now…", -1)` → same `error` state (no fallback id is ever guessed) |
| SDK load failure / SDK missing | inline `localError`, phase back to `ready` |
| Popup blocked | inline `localError`, phase back to `ready` (Sign stays live) |
| 293 fails | wizard's `error` prop rendered under the rows; phase stays `signed`, `Continue` stays clickable. `autoSubmitted` is deliberately **not** reset, so the retry is the user's click and never an auto-retry loop |

Both calls are wrapped in `withRetries` (`src/lib/retry.ts`): the 287 URL fetch
in `initialize`, and the 293 submit through the wizard's `runStep`. Two retries,
1s then 3s apart, silent behind the phase's existing spinner. A failure that
names a bad field — or any of the deny-listed codes — still surfaces at once. See
[`user-onboarding.md`](./user-onboarding.md#retrying-transient-failures).

### 1.6 What the step renders

One return, no separate loading/error screens — `loading` and `error` are states
of the first checklist row:

| Element | Rendered when | Content |
| --- | --- | --- |
| Blurb | always | "Review and digitally sign the terms and conditions to activate your account and start using our services." |
| Row 1 — document | always | spinner "Preparing your document…" / ✗ "Failed to prepare document" + **Retry** / ✓ "Document is generated for **{name}**" with "Document ID: {id}" beneath |
| Row 2 — e-sign | always (40% opacity on `error`) | ✓ or ○, "Document Esign", `Badge` **Completed**/**Pending** |
| **Sign Agreement** | `!signed && !loading && !error` | disabled only while the SDK modal is up; reads "Open the signing window again" for an open popup |
| Steps box | `!signed && !loading && !error` | the 3 numbered instructions |
| Grace line | `popupOpen && grace > 0` | `aria-live` "Opening the signing window… you can continue in N seconds." |
| **Continue** | `signed \|\| popupOpen` | disabled during the popup grace; "Finishing…" while `busy` |

The name is `useSignupProfile().name` — the same context `BusinessStep` prefills
from, sourced from the interaction-151 profile via `SignupState.name`. It is
`.trim()`ed and the whole "for …" clause is dropped when absent, rather than
substituting a placeholder: a legal agreement should not claim to be generated
for "your business". The document id is the one already held for the 293 submit;
it was simply never displayed before.

### 1.7 Trust boundary

Every signup route reads the mobile from the **session claim**
(`requireSignupSession` → `claim.sub`), never from the body, and rejects any
claim whose `role !== "signup"` with `403 NOT_SIGNUP_SESSION`. The browser never
composes an interaction payload, never holds an Eko token, and cannot choose its
own `agreement_id`, `initiator_id`, `org_id` or `user_code`.

---

## Part 2 — How Eloka (`wlc-webapp`) does it

### 2.1 Files involved

| Layer | File | Role |
| --- | --- | --- |
| Step UI | `features/onboarding/components/custom/SignAgreementStep.tsx` | Renders progress rows, Sign/Proceed buttons, countdown, watches `pipelineResults` |
| Hook | `features/onboarding/hooks/useSignAgreement.ts` | `initialize`/`openSigning`/`retry`, `EsignStatus`, Android pubsub listener, `STATUS_UPDATE` listener |
| Service | `features/onboarding/services/esign/esignService.ts` | `getSignUrl()` (287), `getProvider()`, `ESIGN_RESPONSE_TYPES` |
| Providers | `services/esign/providers/{leegality,karza,signzy}.ts` | SDK load + open; Karza delegates to Leegality; Signzy = `window.open` |
| Types | `services/esign/types.ts` | `EsignProviderType {DIGIO:0, KARZA:1, SIGNZY:2, LEEGALITY:3}`, `EsignStatus`, `IEsignProvider` |
| Step config | `features/onboarding/constants.ts` | Step id `12`, `applicableRoles:[12800]`, `localRenderer.component:"SignAgreementStep"`, `api.pipeline:[{293, successResponseTypeIds:[1615]}]`, `postSubmit.refreshProfile: true` |
| Renderer | `features/onboarding/components/ContentRenderer.tsx` | `CUSTOM_COMPONENTS["SignAgreementStep"]`, passes `onSubmit`/`onAdvance`/`onSkip` |
| Context | `features/onboarding/context/OnboardingContext.tsx` | `handleStepDataSubmit` → `executePipeline`, `pipelineResults`, `advanceToNextStep`, `agreementId`, `mobile` |
| Pipeline | `features/onboarding/utils/executePipeline.ts` | Sequential stop-on-fail runner with smart retry (`existingResult` resume index) |
| Transport | `helpers/apiHelper.js` (`fetcher`) | JSON `POST`, `Authorization: Bearer <accessToken>`, `source: "WLC"`, `client_ref_id`, 120 s default timeout, 401 → `generateNewToken` |
| BFF | `connect-api` `routes/transactions.js` → `POST /transactions/do` | Deletes `user_id`, injects `initiator_id`/`user_code`/`org_id` from the JWT, forwards to SimpliBank |

`agreementId` reaches the provider as a prop
(`OnboardingSteps.tsx` → `OnboardingProvider agreementId={…}`), sourced from
`getAgreementIdFromData()` = `data.userDetails.agreement_id`.

### 2.2 State machine

`EsignStatus`: `idle → loading → ready → signing → success | already_signed | error`
(plus a declared-but-never-set `verifying`).

The component layers its own flags on top: `hasOpenedSigning`, `notSignedError`,
`timeoutError`, `isSubmittingStep`, `countdown`.

### 2.3 Call sequence

```
Browser (wlc-webapp)            connect-api (BFF)                 Eko / SimpliBank
  │ mount → status idle                │                                 │
  ├─ initialize()                      │                                 │
  ├─ POST /transactions/do ───────────▶│ delete user_id                  │
  │   Bearer <accessToken>             │ initiator_id = token.user_id    │
  │   {interaction_type_id:287, …}     │ user_code = token.code          │
  │                                    │ org_id = token.org_id           │
  │                                    ├─ interaction 287 ──────────────▶│
  │◀── {response_type_id, data:{…}} ───┤◀───                             │
  ├─ getProvider(pipe).loadScript()                                       │
  ├─ status ready                                                         │
  │                                                                        │
  ├─ click "Sign Agreement" → status signing                               │
  │   web: Leegality SDK  |  Signzy popup                                  │
  │   android: doAndroidAction(LEEGALITY_ESIGN_OPEN, {signing_url,…})      │
  │   ◀── SDK callback | pubsub ANDROID_RESPONSE | postMessage STATUS_UPDATE│
  │                                                                        │
  ├─ "Proceed" (or 5 s auto-advance)   │                                 │
  ├─ onSubmit → executePipeline        │                                 │
  ├─ POST /transactions/do ───────────▶│                                 │
  │   {interaction_type_id:293, …}     ├─ interaction 293 ──────────────▶│
  │◀── {response_type_id, …} ──────────┤◀───                             │
  ├─ pipelineResults[12] = success/failed                                  │
  ├─ onAdvance(12) → advanceToNextStep → refreshAgentProfile() (151)       │
```

### 2.4 Exact payloads

**287 — `getSignUrl()`** (JSON body to `/transactions/do`):

```jsonc
{
  "source": "WLC",                    // DEFAULT_DATA
  "client_ref_id": "<ts><rand>",      // injected by fetcher
  "interaction_type_id": 287,
  "document_id": "",
  "agreement_id": config.agreementId ?? 5,   // ← fallback 5
  "latlong": config.latLong || "27.176670,78.008075,7787",
  "csp_id": mobile,
  "user_id": mobile                   // ← deleted by connect-api
}
```

`connect-api` then adds `initiator_id` (= JWT `user_id`, i.e. the mobile),
`user_code` (= JWT `code`), `org_id` (= JWT `org_id`, default `"1"`), and only
defaults `source` to `NEWCONNECT` when the client did not send one.

**293 — pipeline `submit` step** (`executeFormCall`):

```jsonc
{
  "source": "WLC",
  "client_ref_id": "<ts><rand>",
  "interaction_type_id": 293,
  "user_id": mobile,                  // deleted by connect-api
  "csp_id": mobile,
  // ...spread of form_data built by SignAgreementStep:
  "esign_completed": true,
  "completion_timestamp": "<ISO>",
  "document_id": documentId,
  "agreement_id": agreementId
}
```

No `agreement_status`, and no `latlong` — the Sign Agreement step config has no
`preSubmit.inject` (unlike, e.g., the Secret PIN step).

### 2.5 Business logic

**287 classification (`esignService.getSignUrl`), by `response_type_id`:**

```
1615 (ALREADY_SIGNED) or 1069 (AGREEMENT_ALREADY_SIGNED)
    → { ...data, alreadySigned: true, short_url: "",
        document_id: data.document_id || response.document_id || "",
        pipe: data.pipe ?? 0 }
response_type_id !== 1613 && !data.short_url
    → throw new Error(response.message || "E-sign initialization failed…")
otherwise → response.data
```

i.e. `1613` **or** any reply carrying a `short_url` passes. No `status` check,
no URL-scheme check.

**Provider selection (`getProvider`)**

| `pipe` | Provider returned |
| --- | --- |
| `3` | `leegalityProvider` |
| `1` | `karzaProvider` (delegates to Leegality) |
| `2` | `signzyProvider` (`window.open`) |
| `0` / unknown | `leegalityProvider` + `console.warn` |

**Signed-ness — three independent channels in `useSignAgreement`:**

1. **SDK callback** — `result.error` → `setStatus("ready")` (retry); else
   `setStatus("success")`.
2. **Android** — `pubsub.subscribe(TOPICS.ANDROID_RESPONSE)`, action
   `ANDROID_ACTION.LEEGALITY_ESIGN_RESPONSE`. Payload may be a JSON string
   (parsed defensively). Success when
   `agreement_status === "success" || status === "success" || documentId || document_id`;
   `response.error` → toast + `ready`.
3. **`window.message`** — any `event.data.type === "STATUS_UPDATE"`, **no origin
   check**, gated only on `signData?.document_id` being truthy → `success`.

Android open path: `doAndroidAction(ANDROID_ACTION.LEEGALITY_ESIGN_OPEN,
JSON.stringify({signing_url, document_id}))`, taken when
`options.isAndroid || isAndroidApp()`.

**Proceed gating (`SignAgreementStep.tsx`)**

```
isProceedDisabled = (!hasOpenedSigning && !timeoutError) || isAgreementLoading
                    || isVerifying || isSubmitting || notSignedError
isSignDisabled    = (hasOpenedSigning && !notSignedError) || isAgreementLoading
                    || isVerifying || isSubmitting || timeoutError
```

So **Proceed unlocks as soon as the user clicks Sign** — actual signing is not
required client-side; 293 is the arbiter. On `status === "success"` (or
`already_signed`) a **5-second countdown** starts and auto-fires
`handleProceedClick()` once (`hasAutoSubmittedRef`).

**293 classification (`executePipeline.isApiSuccess`)**

```
successIds        = pipelineStep.successResponseTypeIds ?? [0]      // here: [1615]
responseTypeId    = response.response_type_id ?? response.status
success           = successIds.includes(responseTypeId)
                    && !(checkInvalidParams && Object.keys(response.invalid_params||{}).length)
```

**Result handling** — the component watches `pipelineResults[stepConfig.id]`:

- `success` → toast `success_message` → `onAdvance(stepConfig.id)`.
- `failed` → toast with `failedStep.response.message`, then
  `setNotSignedError(true)`, `setHasOpenedSigning(false)`,
  `setIsSubmittingStep(false)` — which **re-enables Sign and disables Proceed**,
  forcing a fresh signing attempt. (The comment names the `1657` "user didn't
  sign" case as the driver.)

**Advancing (`advanceToNextStep`)**

Local: mark the step `COMPLETED` in `stepperData`, find the next incomplete
applicable step, and call `refreshAgentProfile()` when
`postSubmit.refreshProfile` (true for this step) **or** it is the last step.
Progression is client-computed; the profile refresh is a side-effect, not the
source of truth.

**Retry semantics** — `executePipeline` supports smart retry: on a repeat
submit with a failed `existingResult`, already-succeeded pipeline entries are
skipped and execution resumes at the first non-success entry. With a
single-entry pipeline this is a no-op here.

### 2.6 Dead / unreachable code in Eloka's step

- `timeoutError` is only ever set to `false` (lines 145, 192) — the `Retry`
  label, the `!hasOpenedSigning && !timeoutError` bypass and the
  `timeoutError`-driven Sign-disable are unreachable.
- `EsignStatus["verifying"]` is never assigned; `isAgreementVerifyingStatus` is
  always `false`, so `isVerifying === isSubmittingStep`.
- `useSignAgreement.retry()` is exported but not used by the component (it calls
  `initialize()` directly for the retry link).
- `documentId` from `signData` is passed to the SDK as a fallback in
  `leegalityProvider`, but the hook's `openSigning` never re-reads the SDK's
  returned id into state (`documentId` stays the 287 value).

---

## Part 3 — Side-by-side comparison

### 3.1 API calls

| # | EPS portal | Eloka |
| --- | --- | --- |
| Fetch URL | `GET /signup/agreement/url` → BFF → **151** → **287** | `POST /transactions/do` (287) direct from browser |
| Profile read before 287 | **yes**, every time (fresh `agreement_id`, `code`, `org_id`) | no — `agreementId` is a prop captured at page load |
| Open provider | client-side only | client-side only |
| Submit | `POST /signup/agreement` → BFF → **151** → **293** → **151** | `POST /transactions/do` (293) direct |
| Profile read after 293 | **yes**, always (`refresh()` → 151) — authoritative | `refreshAgentProfile()` because `postSubmit.refreshProfile: true` — advisory |
| Upstream interactions per step | 5 (151, 287, 151, 293, 151) | 2 (287, 293) + 1 profile refresh |
| Transport to upstream | `application/x-www-form-urlencoded`, header `developer_key` | JSON to `connect-api`, which re-forms it upstream |
| Browser auth | HttpOnly session cookie (`credentials: "include"`), one-shot 401 refresh | `Authorization: Bearer <accessToken>`, 401 → `generateNewToken` |

### 3.2 Field-by-field payload diff

**287**

| Field | EPS portal | Eloka | Note |
| --- | --- | --- | --- |
| `interaction_type_id` | `287` | `287` | same |
| `document_id` | `""` | `""` | same |
| `agreement_id` | `agreementIdOf(profile)`, **refuses** the step when absent | `config.agreementId ?? 5` | **differs** — Eloka falls back to `5`; a wrong id either earns 1083 or signs the wrong agreement |
| `latlong` | fixed `27.176670,78.008075,7787` | `state.latLong` from the geolocation step, same constant as fallback | differs (EPS never captures location) |
| `csp_id` | mobile | mobile | same |
| `user_id` | mobile (**survives**, direct upstream) | mobile (**deleted** by connect-api) | same intent, different fate |
| `initiator_id` | mobile, set by BFF from the 151 profile | mobile, set by connect-api from the JWT | equivalent |
| `user_code` | `profile.code` | JWT `code` (else `DEFAULT_TRXN_USER_CODE`) | equivalent |
| `org_id` | `profile.orgId` | JWT `org_id` else `"1"` | equivalent |
| `source` | not sent | `"WLC"` | differs |
| `client_ref_id` | server-generated | client-generated in `fetcher` | differs (EPS: not caller-supplied by design) |

**293**

| Field | EPS portal | Eloka | Note |
| --- | --- | --- | --- |
| `interaction_type_id` | `293` | `293` | same |
| `document_id` | echoed from the client, forwarded verbatim | from `useSignAgreement().documentId` (the 287 value) | same |
| `agreement_id` | re-read from a fresh 151 profile | context prop | differs in freshness only |
| **`agreement_status`** | **`"success"`** | **absent** | **material difference** — upstream parameter 638; omitting it answers `invalid_params: {agreement_status: …}` |
| `esign_completed` | `"true"` | `true` (boolean) | parity field, no upstream definition |
| `completion_timestamp` | ISO now (server) | ISO now (client) | same |
| `latlong` | fixed constant | **absent** (no `preSubmit.inject` on this step) | differs |
| `user_id` / `csp_id` | not sent on 293 | both = mobile | differs |
| `source` | not sent | `"WLC"` | differs |

### 3.3 Success classification

| Interaction | EPS portal | Eloka |
| --- | --- | --- |
| 287 success | `status === 0` (absent ⇒ 0) **and** `data.short_url` matching `^https?://` | `response_type_id === 1613` **or** any `data.short_url` present |
| 287 already-signed | `status === 0` **and** `response_type_id ∈ {1615, 1069}` | `response_type_id ∈ {1615, 1069}` |
| 287 `document_id` | `data.document_id \|\| document_id \|\| ""` | same fallback, but only inside the already-signed branch |
| 287 URL scheme check | **yes** (keeps a non-http(s) URL out of `window.open`/SDK) | no |
| 293 success | `status === 0`; **absent `status` fails** | `response_type_id ?? status` ∈ `[1615]`, and no `invalid_params` |

**Risk flagged by our own field data:** a live 293 has answered
`response_type_id` **1043** and **1069** on success (see
`user-onboarding.md`). Eloka's `successResponseTypeIds: [1615]` would classify
those as *failed* — the user is told signing failed and is pushed back to
"Sign Agreement" even though the agreement went through. This is exactly the
stale-id trap that made us classify 287/293 on `status` instead.

### 3.4 Providers

| `pipe` | EPS portal | Eloka |
| --- | --- | --- |
| `0` DigiO | popup (`window.open`) | **Leegality SDK** (default branch + warn) |
| `1` Karza | Leegality SDK | Leegality SDK (via `karzaProvider`) |
| `2` Signzy | popup | popup |
| `3` Leegality | Leegality SDK | Leegality SDK |
| unknown | popup | Leegality SDK |
| Script | `/scripts/leegalityv5.min.js`, id `leegality-sdk`, guard on `window.Leegality \|\| #leegality-sdk` | same file, id `legality`, guard on `#legality` only |
| `logo` option | not passed | passed through `options.logo` (never populated by the hook) |
| Android | **not supported** (no wrapper for this site) | `doAndroidAction(LEEGALITY_ESIGN_OPEN)` + pubsub response |

### 3.5 Completion signals and gating

| Aspect | EPS portal | Eloka |
| --- | --- | --- |
| SDK callback error | inline error, back to `ready` | toast-less, `setStatus("ready")` |
| Popup completion | `STATUS_UPDATE` **only** from `new URL(shortUrl).origin`, **and only while `popupOpen`** | `STATUS_UPDATE` from **any** origin, listener always installed, gated only on `signData.document_id` |
| Android completion | n/a | pubsub `ANDROID_RESPONSE`, accepts `agreement_status`/`status`/`documentId`/`document_id` |
| Can user proceed without signing? | **yes, for popup pipes only** — `Continue` renders from `popupOpen`, since those providers have no callback, but stays disabled for `POPUP_GRACE_SECONDS` so it cannot be clicked before the signing tab paints. SDK pipes still require the callback | **yes** — Proceed unlocks on the *click* of Sign; 293 rejects it and the UI resets |
| Auto-advance | **immediate** on any completion signal (SDK callback, `STATUS_UPDATE`, `alreadySigned`), ref-guarded to once per mount | 5 s countdown → auto `handleProceedClick()` (once) |
| Already-signed | phase `signed`, "Your agreement is already signed", auto-submits at once | `already_signed` status, Sign button hidden, success banner + countdown auto-proceeds |
| Retry after provider error | Sign button stays live | Sign re-enabled only via `notSignedError` from a failed pipeline, or the retry link after a load error |
| Retry after submit failure | `Continue` still clickable, wizard shows the error; no auto-retry | Sign re-enabled, Proceed disabled, `notSignedError` true |
| Loading/progress UI | two-row checklist (document / Document Esign) with badge, doc id, inline retry, steps box | same shape (this is where it was ported from) |
| Skip | not offered | offered when `!stepConfig.isRequired` (this step sets `isRequired: true`, so effectively off) |

### 3.6 Progression authority

| | EPS portal | Eloka |
| --- | --- | --- |
| Who decides the next step | the server: every step call returns `SignupState` re-projected from a fresh interaction 151 (`role_list` ∩ `onboarding_steps`) | the client: `advanceToNextStep` scans local `stepperData` for the next incomplete applicable step |
| Step list source | API `onboarding_steps` × local registry (`resolveSteps`); unknown roles are skipped with a `console.warn` | `masterOnboardingSteps` in `constants.ts`, filtered by `applicableRoles` against `roleList` |
| Completion detection | `profile.onboarding === 0` → `status: "done"` → session upgrade | last step reached; `refreshAgentProfile()` observes `onboarding 1→0` |
| Session change on completion | signup session swapped for a developer session (cookies re-minted, `sid` carried, upstream entitlements rotated) | none — the same Eloka session continues |
| Resume after drop-off | identical code path (state is always refetched) | depends on the reconstructed `stepperData` |

### 3.7 Architecture

| | EPS portal | Eloka |
| --- | --- | --- |
| Where interaction payloads are built | BFF (`clients/eko.ts`) | browser (`esignService.ts`, `executePipeline.ts`) |
| Step config | code registry (`steps.ts`), 4 steps | declarative `masterOnboardingSteps` with `api.pipeline`, `preSubmit.inject`, `postSubmit`, `localRenderer` |
| Multi-call steps | not modelled (one submit per step) | first-class (`api.pipeline` array, sequential stop-on-fail, smart retry) |
| Provider lifecycle | inline in the step component (`Phase`) | dedicated `useSignAgreement` hook + provider strategy objects |
| Provider abstraction | two branches in one function | `IEsignProvider` interface, 3 implementations |
| Error text to user | upstream `message` via `AppError(400, "STEP_FAILED")`, plus `invalid_params` details | upstream `message` off `failedStep.response.message`, toast |
| Host coupling | none (own backend) | `OnboardingServices` contract (`accessToken`, `generateNewToken`, `isAndroid`, `pubsub`) |

### 3.8 What we deliberately dropped from Eloka

- Android WebView bridge and pubsub plumbing (this site never runs in the
  wrapper).
- Geolocation capture (interaction 298) — the fixed `ONBOARDING_LATLONG` is what
  Eloka itself falls back to when its capture step is skipped.
- `logo` branding option on the Leegality SDK.
- The `1613` success-id allowlist (replaced with `status`-based classification).
- The `agreement_id ?? 5` fallback (replaced with a hard refusal).
- The skip button, and the auto-advance **countdown** (auto-advance itself is
  ported, but immediate). The multi-row progress checklist *was* ported — see
  §1.6 and §3.9.

### 3.9 What Eloka does that is worth porting or fixing

| Item | Where | Verdict |
| --- | --- | --- |
| `successResponseTypeIds: [1615]` on 293 | `constants.ts` | **Bug risk in Eloka** — 1043/1069 are observed successes; would report false failure |
| Missing `agreement_status` on 293 | `constants.ts` pipeline | **Bug risk in Eloka** — upstream answers `invalid_params: {agreement_status}` |
| `agreement_id ?? 5` | `esignService.ts` | **Bug risk in Eloka** — a guessed id signs the wrong agreement |
| `STATUS_UPDATE` with no origin check | `useSignAgreement.ts` | **Security gap in Eloka**; ours pins to `esignOrigin(shortUrl)` and to `popupOpen` — **not ported** |
| Proceed unlocked by clicking Sign | `SignAgreementStep.tsx` | **Ported, narrowed** — only for popup pipes, which genuinely have no callback. SDK pipes still wait for theirs |
| Document-id echo + doc-id display | both | **Ported** — row 1 shows the id and the profile name |
| Two-row progress checklist + Steps box | `SignAgreementStep.tsx` | **Ported** — §1.6 |
| Inline Retry replacing both buttons on a doc-gen failure | `SignAgreementStep.tsx` | **Ported** |
| Auto-advance countdown | `SignAgreementStep.tsx` | **Auto-advance ported, countdown not** — signals submit at once. The 5 s was repurposed as a popup-open grace on `Continue`, which is the gap that actually misleads users |
| Dead `timeoutError` / `verifying` | `SignAgreementStep.tsx` / `types.ts` | Dead code in Eloka |

---

## Appendix — constants

| Name | EPS portal | Eloka |
| --- | --- | --- |
| Fetch-URL interaction | `287` | `TransactionIds.USER_ONBOARDING_GET_AGREEMENT_URL = 287` |
| Submit interaction | `293` | `TransactionIds.USER_ONBOARDING_SUBMIT_SIGN_AGREEMENT = 293` |
| Role code | `12800` (`steps.ts`) | `applicableRoles: [12800]` |
| Step id | n/a (role-keyed) | `ONBOARDING_STEP_IDS.SIGN_AGREEMENT = 12` |
| Already-signed ids | `AGREEMENT_ALREADY_SIGNED = {1615, 1069}` | `ALREADY_SIGNED = 1615`, `AGREEMENT_ALREADY_SIGNED = 1069` |
| URL-generated id | not used for classification | `SUCCESS_URL_GENERATED = 1613` |
| 293 success id | not used (`status === 0`) | `RESPONSE_TYPE_IDS.SIGN_AGREEMENT = 1615` |
| Pipe values | `1,3` → SDK; else popup | `DIGIO 0, KARZA 1, SIGNZY 2, LEEGALITY 3` |
| Default latlong | `27.176670,78.008075,7787` | same string as fallback |
| Endpoints | `/signup/agreement/url`, `/signup/agreement` | `Endpoints.TRANSACTION = "/transactions/do"` |
