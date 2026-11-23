# SDK golden signing vector

Cross-language conformance fixture. Every SDK core must reproduce this.

- access_key: `TEST_ACCESS_KEY_DO_NOT_USE`
- secret-key-timestamp: `1700000000000`
- expected secret-key (base64): `u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=`

Algorithm: `base64(HMAC-SHA256(message = timestamp, key = base64(access_key)))`.

## Required-param validation conformance

Every SDK core MUST validate inputs against `requiredParams` (baked into
`data/sdk-surface.json` from the API spec — see `requestParams[].required` in
`src/lib/sdk/build-sdk-surface.ts`) **before signing or sending**. A param is
"missing" when absent OR null. On a miss, fail fast with an error and send
nothing.

Conformance fixture — endpoint slug `dmt-get-sender`. Read its
`requiredParams` from the baked surface rather than trusting this line, since
specs evolve; at the time of writing it is
`[initiator_id, customer_id, user_code]`:

| Input params                          | Expected                                        |
| ------------------------------------- | ----------------------------------------------- |
| `{initiator_id}`                      | throw, message lists `customer_id`, `user_code` |
| `{…, initiator_id: null}`             | throw, message lists `initiator_id`             |
| all three present                     | no throw; request is signed and sent            |

The message lists **every** missing name, in the order the surface declares
them — a port that reports only the first one is non-conformant.

Error message format: `Missing required params for "<slug>": <names>.`
Reference implementations: `packages/sdk-js/src/client.ts` (`call`),
`packages/sdk-php/src/EpsClient.php` (`resolveTarget`),
`packages/sdk-python/src/eps_sdk/client.py` (`resolve_target`),
`packages/sdk-go/eps.go` (`ResolveTarget`),
`packages/sdk-java/src/main/java/in/eko/eps/EpsClient.java` (`resolveTarget`).
Port the matching tests when adding
a new language — the full suite, not just the fixtures on this page:
`packages/sdk-php/tests/EpsClientTest.php`,
`packages/sdk-python/tests/test_client.py` and `packages/sdk-go/eps_test.go`
also pin client-level default
injection, explicit-null clearing, GET query/path encoding, the multipart
envelope, and JSON-encoding failures.

## Type validation conformance

After the presence check, every SDK core MUST type-check each **provided** param
(value not null/undefined) whose name appears in `params[]` of the surface,
against its `type`. Params not in the surface pass through untouched. Checks are
**lenient/coercion-aware** because the wire sends everything as strings:

| `type`    | accepts                                                        |
| --------- | -------------------------------------------------------------- |
| `string`  | string, or number (coerces cleanly). NOT boolean/object/array. |
| `number`  | finite number, or string matching `^-?\d+(\.\d+)?$`            |
| `integer` | integer, or string matching `^-?\d+$`                          |
| `boolean` | boolean, or the strings `"true"` / `"false"`                   |
| other     | not enforced (passes) — request specs only emit the four above |

This is **type-only**: no format/range/enum semantics (e.g. a `number` `amount`
accepts `1.5` even where the API wants whole rupees). The regexes are
intentionally narrow — no `+` sign, whitespace, trailing dot, or scientific
notation. JS and PHP MUST use identical regexes. On a miss, fail fast (sign and
send nothing) with: `Invalid param types for "<slug>": <name> (expected <type>), ...`

Conformance fixture — slug `bbps-get-operators` (`category` is an optional
`number`; `initiator_id` is a required string):

| Input `category` (with required strings present) | Expected                                  |
| ------------------------------------------------ | ----------------------------------------- |
| `"5"` or `5`                                     | no throw; sent                            |
| `"abc"`                                          | throw, lists `category (expected number)` |
| `{}`                                             | throw, lists `category`                   |

## Response and error contract conformance

Validation happens before a request is signed; this section covers what every
SDK core MUST do once a response comes back. The **outcome** is identical across
languages; the error **taxonomy** stays language-idiomatic (Go returns an error
value, the rest raise/throw).

| Case                            | Required outcome                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| 2xx, EPS envelope (JSON object with a numeric `status`; on a `financial` endpoint also a numeric `response_status_id`) | return the decoded envelope |
| non-2xx, JSON body              | fail with the typed HTTP error carrying `status`, `url`, the decoded `body`, `raw` |
| non-2xx, non-JSON body          | same, with a null/nil `body`; `raw` keeps the bytes verbatim                       |
| 2xx, body not an EPS envelope (unparseable; JSON `null` / string / number / array; an object without a numeric `status`, e.g. `{}` or a proxy's error object; or, on a `financial` endpoint, one without a numeric `response_status_id`, e.g. a proxy's `{"status":502,"error":"Bad Gateway"}`) | fail with the typed invalid-response error (`status`, `url`, `raw`) — **never** a silent `{}`, `[]` or `null`; indeterminate (see below) |
| no response within the timeout  | fail; default 30s, overridable                                                     |
| transport failure               | fail, surfacing the language's native transport error                              |

A non-2xx envelope is an **error, not a result**: an auth or infrastructure
failure must never be mistaken for a successful call. The decoded envelope is
still carried on the error so callers can inspect `status` / `message`.

### Typed error per language

| SDK    | non-2xx                    | other client-side failure | fields                              |
| ------ | -------------------------- | ------------------------- | ----------------------------------- |
| Node   | `EpsHttpError`             | `EpsError`                | `status`, `url`, `body`, `raw`      |
| Python | `EpsHttpError`             | `EpsError`                | `status`, `url`, `body`, `raw`      |
| PHP    | `Eko\Eps\EpsHttpException` | `EpsException`¹           | `status`, `url`, `body`, `raw`      |
| Go     | `*eps.HTTPError`           | plain `error`             | `StatusCode`, `URL`, `Body`, `Raw`  |
| Java   | `EpsClient.EpsHttpException` | `EpsClient.EpsException` | `status`, `url`, `body`, `raw`      |

A 2xx whose body is not an **EPS envelope** — a JSON object whose `status` is a
number (a bool, string or null `status` does not count) and, on a `financial`
endpoint, whose `response_status_id` is a number too — fails with a subclass of the "other client-side
failure" type, so existing catches still match: `EpsInvalidResponseError` (Node,
Python), `Eko\Eps\EpsInvalidResponseException` (PHP), `*eps.InvalidResponseError`
(Go; `Unwrap` gives the decode error), `EpsClient.EpsInvalidResponseException`
(Java). Each carries the HTTP `status`, `url` and `raw` body.

Why `response_status_id` only on financial endpoints: it is numeric on every
documented 2xx body the SDK can receive (123 of 124 success samples, the gap a
webhook the SDK never calls, and all 135 HTTP-200 error examples), while
`message` is missing on four SDK endpoints (`pan-fetch` and the three bank
account verifications). On a financial call a wrongly rejected body costs only
the status inquiry; on a paid lookup it would fail a call that succeeded and
invite a re-billed retry, so non-financial endpoints keep the `status`-only
check.

¹ PHP keeps `\InvalidArgumentException` for **input validation** — SPL already
has the semantically correct class, and it is a `\LogicException`, so it cannot
share a base with the runtime failures. `EpsException` covers transport, surface
and decoding failures only.

### Fixed message strings

- `EPS request to <url> failed with HTTP <status>.`
- `EPS response from <url> was not valid JSON.` (also used for valid JSON that
  is not an EPS envelope; the message is fixed, the case is wider)

Two sanctioned divergences, both long-standing and idiomatic:

- Go keeps lowercase, package-prefixed messages per Go convention:
  `eps: request to %s failed with HTTP %d` and
  `eps: response from %s was not valid JSON: %w`.
- Python appends a truncated raw payload to the non-JSON message
  (`… was not valid JSON: <raw[:200]!r>`).

### Timeout knob per language

| SDK    | Option                           | Unit             | Default |
| ------ | -------------------------------- | ---------------- | ------- |
| Node   | `timeoutMs`                      | milliseconds     | 30_000  |
| Python | `timeout`                        | seconds (float)  | 30.0    |
| PHP    | `timeout`                        | seconds (float)  | 30.0    |
| Go     | `Config.HTTPClient`              | `time.Duration`  | 30s     |
| Java   | `.httpClient(...)`               | `Duration`       | 30s     |

Node names its knob `timeoutMs` precisely because Python's and PHP's `timeout`
is in seconds — the unit lives in the name so the two can never be confused. A
non-finite or non-positive value MUST fail at construction, not at request time.
The timeout is **per attempt** (see the retry section): a GET's worst case is
`(retries + 1) × timeout` plus backoff, and a financial non-GET's is one attempt
plus the status check's own budget.

Reference implementations of `call()` (and the `resolveTarget` it builds on):
`packages/sdk-js/src/client.ts`, `packages/sdk-python/src/eps_sdk/client.py`,
`packages/sdk-php/src/EpsClient.php`, `packages/sdk-go/eps.go`,
`packages/sdk-java/src/main/java/in/eko/eps/EpsClient.java`.

Every SDK accepts an injected transport for tests: Node a `fetch`, Python a
patched `urlopen`, PHP the constructor's `transport` closure, Go an
`http.Client`, Java an `HttpClient`. PHP and Java also expose pure seams the
conformance tests drive directly: `EpsClient::decodeResponse(status, url, raw)`
and `EpsClient.handleResponse(status, url, raw)`. PHP additionally exposes
`curlOptions(target)` so the timeout wiring is assertable.

## Client reference id conformance

`client_ref_id` is the key a partner reconciles a lost response by, so every
non-GET call MUST carry one. Each SDK core injects a generated ref during
`resolveTarget`, **after** the client-default/params merge and **before** the
required-param guard (so a generated ref satisfies the endpoints that require
one), when all three hold:

1. the endpoint's `method` is not `GET` — GETs are retried, not reconciled;
2. the endpoint's `params[]` declares `client_ref_id` — `get-refund-otp` and
   `initiate-refund` omit it and MUST NOT receive one;
3. the merged params have no `client_ref_id`, where "no" means absent or
   null/nil/None only. A supplied value is never overwritten — `""` counts as
   supplied and then fails the `client-ref` format, which is the right outcome.

Generator, identical everywhere: `base36(now_ms)` followed by 7 random base36
characters, then the **last 15** characters: `^[0-9a-z]{15}$`. The stamp comes
first so refs sort and grep against a log line; the tail gives ~7.8e10 distinct
refs per millisecond, so concurrent processes cannot collide in practice. The
random source is the language's CSPRNG (`crypto.randomInt`, `random_int`,
`secrets.randbelow`, `crypto/rand`, `SecureRandom`); the clock is the client's
injected `now`, so tests are deterministic on the stamp.

The 15-char length is deliberate: EPS documents a 20-char maximum, and the
platform's own connect-api client (`packages/eps-backend`) is capped at 10 by
a *different* upstream — the SDKs talk to EPS v3, not to connect-api.

Fixtures (every suite pins all of them):

| Case                                                     | Expected                                             |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `pan-lite` (POST) without `client_ref_id`                | body carries a generated ref matching the regex      |
| `pan-lite` with `client_ref_id: "MY-REF_1"`              | body carries `MY-REF_1` untouched                    |
| `dmt-initiate-transfer` (ref required) without one       | no "missing required" throw; generated ref sent      |
| `bbps-get-operators` (GET)                               | no `client_ref_id` in the query string               |
| `get-refund-otp` (POST, omits the param)                 | no `client_ref_id` in the body                       |
| two successive `pan-lite` calls                          | different refs                                       |
| `pan-lite` with `client_ref_id: ""`                      | throws `… client_ref_id (expected format client-ref)`, nothing sent |
| `dmt-initiate-transfer` (financial, no client-ref format) with `client_ref_id` `""`, `"   "`, `"\t"`, `"\u00A0"`, `"\u2003"`, `"\u3000"`, `"\u200B"`, `"\uFEFF"` or `" \u00A0\t\u2003"` | throws `Invalid param values for "dmt-initiate-transfer": client_ref_id (must not be blank on a financial call).`, nothing sent |

A supplied `client_ref_id` is the caller's to own and is never replaced —
but on a `financial` endpoint a blank one is refused before sending, because the ref is the only key a lost response can
be reconciled by. This holds even where the param declares no `client-ref`
format (`dmt-initiate-transfer`, `dmt-levin-initiate-transfer`,
`bbps-pay-bill`); where it does, the format check fires first with its own
message. Non-financial endpoints are unaffected.

**Blank** means made only of these characters — one explicit class, the same in
every SDK, never the language's own `trim()` / `isBlank()` / `TrimSpace` (they
disagree: PHP's `trim()` is ASCII-only, Java's `isBlank()` skips the no-break
spaces, none of them strips zero-width characters):

```
[\t\n\x0B\f\r \x{85}\x{A0}\x{1680}\x{2000}-\x{200D}\x{2028}\x{2029}\x{202F}\x{205F}\x{2060}\x{3000}\x{FEFF}]*
```

That is Unicode `White_Space` (U+0009–000D, U+0020, U+0085, U+00A0, U+1680,
U+2000–200A, U+2028, U+2029, U+202F, U+205F, U+3000) plus the zero-width
U+200B–200D, U+2060 and U+FEFF. A ref that merely *contains* one of them
(`"A\u00A0B"`) is not blank.

Exported generator per language: `generateClientRefId(nowMs)` (Node, PHP,
Java), `generate_client_ref_id(now_ms)` (Python), `GenerateClientRefID(nowMs)`
(Go).

## Retry and status-check conformance

An outcome is **indeterminate** when the SDK cannot know whether EPS processed
the request: a transport failure, the per-attempt timeout, HTTP 429, or any
5xx, or a 2xx whose body is not an EPS envelope (empty, truncated, a proxy's HTML
page, a bare `null` or array, `{}` or a proxy's error object, or — on a
`financial` endpoint — an object with no numeric `response_status_id` such as a
proxy's `{"status":502,…}` —
EPS may have processed the request, and the SDK cannot read whether it did). A
4xx is a decisive answer and is never retried or inquired. A done context (Go:
deadline or cancel) or an interrupted thread (Java) stops retries and the
inquiry (both would fail on it), but a financial call still fails with the
indeterminate error carrying its ref / `tid`, so a generated ref is never lost —
inquire later. Go sets `StatusCheckErr` = `ctx.Err()`; Java sets
`statusCheckError` to an `InterruptedException`, keeps the thread's interrupt
flag set, and the cause is the `EpsException` wrapping the interrupt.

Which calls may be re-sent is **data, not method**: each surface endpoint
carries `retrySafe`, computed once by `isRetrySafe` in
`src/lib/data/api-specs-common.ts` (idempotent, not billable, moves no money,
not `financial`). A surface without the flag (built before 2026-10-15) falls
back to "GET only". So two billable GETs (`get-ifsc-details`,
`digilocker-verification-status`) are never re-sent, while two idempotent free
PUTs (`activate-aeps-fingpay`, `deactivate-user-service`) are.

**`retrySafe`** — the same request is re-sent up to `retries` extra times (default 2,
three tries in all). Attempt `n` first sleeps a random slice of
`min(base × 2^(n-1), 2s)` (full jitter; base default 200 ms). Every attempt is
**re-signed** with a fresh `secret-key-timestamp`; only the merged params (and
so the ref, if any) are fixed across attempts.

**Not `retrySafe`** — never retried: re-sending a debit is how a customer is
charged twice, and re-sending a paid lookup bills it twice. If the endpoint is
`financial` in the surface, the call **always** fails with the indeterminate
error — auto inquire on or off — after (when on) one Transaction Inquiry keyed
by the call's `client_ref_id` — or,
on a financial endpoint that has no ref param (`initiate-refund`), by the `tid`
it acted on:

```
GET transaction-inquiry          (GET /tools/reference/transaction)
    client_ref_id = <the call's ref>        (or tid = <the call's tid> when there is no ref)
    initiator_id  = <the initiator the call resolved>
```

An inquiry by `tid` reports the **original** transaction, so only `tx_status` 4
(refunded) confirms the refund. 3 (refund pending) does **not**: a failed
transaction already sits in 3 before Initiate Refund is called, so a lost
refund response leaves 3 either way — treat it as unresolved. With neither a ref
nor a `tid`, the indeterminate error is still thrown, with no inquiry.

The inquiry goes through the ordinary GET path, so it has the GET retry budget
and can never recurse (it is a GET). The call then fails with the language's
indeterminate error, which **never** substitutes the inquiry envelope for the
endpoint's own response — the shapes differ. Outside this path (non-financial
endpoint, decisive status) behaviour is exactly as before. Auto inquire off
skips **only** the inquiry: a financial call still fails with the
indeterminate error carrying its ref / `tid` (`statusCheck` and
`statusCheckError` both null), so a generated ref is never lost.

| SDK    | Indeterminate error            | Transport error                | Knobs (retries / backoff base / auto inquire)                       |
| ------ | ------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| Node   | `EpsIndeterminateError`        | native (`TypeError`, `DOMException`) | `retries` 2 / `retryBaseDelayMs` 200 / `autoStatusCheck` true   |
| Python | `EpsIndeterminateError`        | native (`urllib.error.URLError`, `socket.timeout`) | `retries` 2 / `retry_base_delay` 0.2 / `auto_status_check` True |
| PHP    | `EpsIndeterminateException`    | `EpsTransportException`¹       | `$retries` 2 / `$retryBaseDelay` 0.2 / `$autoStatusCheck` true       |
| Go     | `*eps.IndeterminateError`      | `*eps.TransportError`¹         | `Config.Retries *int` nil→2 / `RetryBaseDelay` 0→200ms / `AutoStatusCheck *bool` nil→true |
| Java   | `EpsClient.EpsIndeterminateException` | `EpsClient.EpsTransportException`¹ | `.retries(2)` / `.retryBaseDelay(200ms)` / `.autoStatusCheck(true)` |

¹ PHP, Go and Java wrap the native transport failure in a typed error so the
retry logic can tell it from a decode failure; the native error stays reachable
(`getPrevious()`, `Unwrap()`/`errors.As`, `getCause()`). Node and Python throw
the native error itself — their base error type already separates the two.

Go's two pointer knobs mirror its existing `HTTPClient == nil → default` idiom,
because their "off" values (`0`, `false`) are the zero values. Node's
`retryBaseDelayMs` carries its unit for the same reason `timeoutMs` does. A
negative `retries`, or a negative/non-finite backoff base, MUST fail at
construction. Setting the base to 0 retries immediately — how the suites run.

The indeterminate error carries, under each language's naming:

| field              | holds                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `slug`             | the endpoint that failed                                                |
| `clientRefId`      | the ref the failed call carried (generated or supplied); null/"" on an endpoint without one |
| `tid`              | the `tid` inquired by when there was no ref; null/"" otherwise          |
| `status`           | HTTP status of the original attempt, or null/nil/0 for a transport failure |
| `statusCheck`      | the decoded inquiry envelope, or null when the inquiry itself failed    |
| `statusCheckError` | the inquiry's own failure, or null — it must never mask the original    |
| cause              | the original failure: `cause` / `__cause__` / `getPrevious()` / `Unwrap()` / `getCause()` |

It extends the base error (`EpsError` / `EpsException`; Go wraps), so existing
`catch` blocks and `errors.As(err, &httpErr)` keep matching. Fixed message:
`EPS request for "<slug>" with client_ref_id "<ref>" has no confirmed outcome.`
(Go: `eps: request for %q with client_ref_id %q has no confirmed outcome`.)
Without a ref: `… on tid "<tid>" has no confirmed outcome.`, and with neither
`… without a client_ref_id or tid has no confirmed outcome.`

Fixtures — `bbps-get-operators` is the GET, `pan-lite` the non-financial POST,
`dmt-initiate-transfer` the financial POST, `initiate-refund` the financial
POST that omits `client_ref_id`. Every suite pins the exact request counts:

| Case                                                        | Requests | Expected                                                        |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| GET: 500 then 200                                           | 2        | returns the 200 envelope; the two attempts carry different timestamps |
| GET: transport failure / timeout / 429 / 503 every attempt  | 3        | throws that failure                                             |
| GET: 400                                                    | 1        | typed HTTP error, no retry                                      |
| GET with `retries` = 0: 500                                 | 1        | typed HTTP error                                                |
| non-financial POST: 500                                     | 1        | typed HTTP error, no inquiry                                    |
| financial POST: 502, inquiry 200                            | 2        | indeterminate error; `status` 502; `statusCheck` = inquiry envelope; inquiry URL is `/tools/reference/transaction` with query `client_ref_id=<ref>` and `initiator_id`, and no `transaction-reference`; the inquiry is a GET |
| financial POST: transport failure, supplied ref, inquiry 200 | 2       | indeterminate error; `status` null; `clientRefId` is the supplied value |
| financial POST: 500, inquiry 503 every attempt              | 1 + 3    | indeterminate error; `statusCheck` null; `statusCheckError` is the 503; cause is the 500 |
| financial POST: 401                                         | 1        | typed HTTP error, no inquiry                                    |
| `initiate-refund` (financial, no ref param): 500 or 2xx `null`, inquiry 200 | 2 | indeterminate error; `clientRefId` null/""; `tid` the call's tid; inquiry query `tid=<tid>`, no `client_ref_id`; message `… on tid "<tid>" …` |
| financial POST with auto inquire off: 500                   | 1        | indeterminate error with the generated `clientRefId`, `status` 500, no inquiry, `statusCheck` and `statusCheckError` null |
| Go only — financial POST, ctx deadline expires in flight    | 1        | `*IndeterminateError` with the generated `ClientRefID` (refund: `TID`), no inquiry, `StatusCheckErr` is `DeadlineExceeded`; non-financial: plain error |
| Java only — financial POST, thread interrupted mid-send     | 1        | `EpsIndeterminateException` with the generated `clientRefId` (refund: `tid`), no inquiry, `statusCheckError` an `InterruptedException`, interrupt flag still set; non-financial: plain `EpsException` |

## Value validation conformance

After presence and type, every SDK core MUST check each **provided** (non-null)
scalar param (`string` / `number` / `integer` / `boolean`) against the optional
constraints the surface carries on it, in this order, stopping at the first
problem per param: `enum` → `format` → `min` / `max` → `maxLength`. Every
offending param is collected, in surface order, and the request fails before
anything is signed — nothing is sent:

`Invalid param values for "<slug>": <name> (<reason>), <name> (<reason>).`

Reasons, verbatim: `expected format <name>` · `not one of: a, b` ·
`below min <n>` · `above max <n>` · `longer than <n> bytes`.

Every check runs on the **wire string** — the same `String(value)` the request
puts on the wire (lowercase booleans, no trailing `.0`) — so `5` and `"5"`
behave alike. `enum` compares wire strings; `min`/`max` compare numerically and
are inclusive; `maxLength` counts **UTF-8 bytes** (`Buffer.byteLength`,
`len(s.encode())`, `strlen`, `len(s)`, `getBytes(UTF_8).length`) — the one
length every language agrees on without an ICU dependency.

Formats are **syntactic**: the surface's `formats` table maps a name to a
portable regex source (see `src/lib/data/api-formats.ts` for the subset:
anchored, ASCII, no lookaround/backreferences/named groups). Each SDK compiles
the table once at load and MUST fail loudly there if a pattern does not
compile — that is corrupt package data, never a validation to skip. Matching is
**whole-string**: `RegExp` without `m` (Node), `re.fullmatch` (Python), the
`D` modifier (PHP), RE2's default `$` (Go), `matcher().matches()` (Java) — so
`"2026-01-01\n"` is rejected for `date` everywhere. `date` checks shape, not
the calendar; `lat-long` checks shape, not range.

Fixtures — slug `pan-lite` (`pan_number` has format `pan`, `dob` has `date`,
`client_ref_id` has `client-ref` + `maxLength` 20, `name` is unconstrained):

| Input (with the other required params valid) | Expected                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| `dob: "01-01-1990"`                          | throws `… dob (expected format date).`, nothing sent            |
| `pan_number: "bad", dob: "1990-1-1"`         | message lists `pan_number (expected format pan), dob (expected format date)` in that order |
| `dob: "1990-01-01\n"`                        | throws — whole-string match                                     |
| `name: "anything at all \n"`                 | sent — unconstrained params are untouched                       |
| `client_ref_id` of 20 × `x` / 21 × `x`       | sent / throws (`client-ref` format caps at 20)                  |

The checker itself is a pure seam in every language (`valueProblem` /
`value_problem`), pinned directly: `enum [1, 2]` accepts `"1"` and rejects `3`
with `not one of: 1, 2`; `min 1, max 5` accepts `"1"` and `5`, rejects `0.5`
(`below min 1`) and `"6"` (`above max 5`); `maxLength 3` accepts `abc` and
rejects `é€` (`longer than 3 bytes`); `enum` wins over `format`, `format` over
`maxLength`; a non-scalar type (`object`) is never checked.

## Debug mode conformance

Opt-in diagnostics a developer can switch on and share with Eko support. It is
**off by default** and purely additive: no existing option, method or output
changes. Debug output must never change a call's outcome.

### Switching it on

| SDK    | Option (new, optional, last in its option list)                                   |
| ------ | --------------------------------------------------------------------------------- |
| Node   | `debug?: boolean \| ((event) => void)`                                            |
| Python | `debug: bool \| Callable[[dict], None] \| None = None`                            |
| PHP    | `bool\|\Closure\|null $debug = null` (after `$transport`)                         |
| Go     | `NewWithDebug(cfg Config, w io.Writer)`; `New(cfg)` = `NewWithDebug(cfg, nil)`    |
| Java   | `Builder.debug(boolean)` / `Builder.debug(Consumer<Map<String,Object>>)`          |

Precedence, resolved once at construction: an explicit option wins (`true` /
a sink / Go non-nil writer = on, `false` / Go `io.Discard` = off); otherwise
the env var `EPS_SDK_DEBUG` set to `1` or `true` (case-insensitive, trimmed)
turns on the default text sink; otherwise off. Off means every emit point is a
single `if`: no masking, no serialization.

### Sinks

- **Callback** (Node, Python, PHP, Java): receives one freshly built event
  object per event, already masked. It is called synchronously on the calling
  thread; a slow or re-entrant callback delays the call that emitted it
  (documented: keep sinks fast, do not call the client from a sink).
- **Text** (the default sink, and Go's writer): one complete JSON object plus
  `\n` per event, in a single write. Node `process.stderr.write`, Python
  `sys.stderr.write`, PHP CLI `fwrite(STDERR, …)`, PHP under any other SAPI
  `error_log()` (the server may prefix the line; the JSON starts at the first
  `{`), Go the writer behind a package-level mutex (it serializes this SDK's own
  writes only), Java `System.err.println`.
- **Isolation**: building, masking, serializing and delivering an event sit in
  one catch-all. A throwing sink, a writer error, a cycle or a parse failure is
  swallowed; the call proceeds exactly as with debug off. Debug never reads
  the injected signing clock (`now`): `ts` uses the real wall clock and `ms` a
  monotonic clock.
- **Bounds**: structured values deeper than 8 levels become `"****"`; if a
  serialized event exceeds 64 KiB its `body` is replaced by
  `"[N bytes omitted]"`.

### Events

Every event starts with these keys, in this order: `logger` (`"eps-sdk"`),
`ts` (ISO-8601 UTC, milliseconds, `Z`), `event`, `sdk` (`js` · `python` ·
`php` · `go` · `java`), `sdk_version` (package metadata, else `"unknown"`),
`surface` (the surface's `bundleVersion`), `env` (`sandbox` · `production`).
Per-call events add `call_id` (8 random lowercase hex chars, one per `call()`)
and `slug`.

| `event`           | When                                         | Extra keys                                                                                         |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `init`            | construction, once                           | `base_url`, `runtime`, `developer_key` (masked), `timeout_ms`, `retries`, `auto_status_check`, `source` (`option` \| `env`) |
| `request`         | each attempt, just before sending            | `attempt`, `method`, `url`, `headers`, `body`                                                       |
| `response`        | each attempt that got an HTTP status         | `attempt`, `status`, `ms`, `body`                                                                   |
| `transport_error` | an attempt with no usable response           | `attempt`, `ms`, `error` (class name), `message`, plus `status` if one arrived before the body failed |
| `retry`           | before each backoff sleep                    | `attempt` (the one that failed), `delay_ms`                                                         |
| `error`           | `call()` is about to throw                   | `error` (class name), `message`, `client_ref_id` / `tid` when the error carries them                |

A pre-send failure (unknown slug, missing / bad param) yields an `error` with
no `request` before it: nothing was sent. The automatic status-check inquiry
re-enters `call()`, so it logs under its own `call_id`, slug
`transaction-inquiry`.

### Masking

Masking is fail-closed and identical in every SDK. The surface carries the
classification as a top-level `redact` object, built by
`src/lib/sdk/sdk-redact.ts`; any list that is absent counts as empty.

| List    | Meaning                                                                                       |
| ------- | --------------------------------------------------------------------------------------------- |
| `safe`  | Eko-issued ids, status codes, enums, amounts, timestamps: printed raw when safe-shaped        |
| `last4` | classified identifiers (Aadhaar, PAN, account, mobile, VPA, …): `****` + last 4               |
| `text`  | free-text fields (`message`, `invalid_params`, `reason`, …): printed after the text scrub     |
| `nest`  | structural containers (`data`, `entries`, `recipient_list`, …): walked into                   |

A key's class is looked up by its lowercased name (`last4` first, then
`safe`, `text`, `nest`); anything else is **default** — `"****"`.

`mask(value, class)`:

1. `null` and booleans: unchanged, under any key.
2. Object or array: walked only at the root or when the class is `nest`,
   `safe` or `text`; otherwise the whole value is `"****"`. Array elements take
   the array's class. Children of a `text` container are `text`; other
   children take their own key's class. A child key name is printed if it is
   in any list or matches `^[a-z][a-z0-9_]{0,39}$`; otherwise it is replaced by
   `#1`, `#2`, … in iteration order (its value is then default-masked).
3. Scalar (string or number), by class, on its wire string `s`:
   - `last4`: `"****"` if `s` has 8 characters or fewer, else `"****"` + its
     last 4.
   - `safe`: `client_ref_id` must also match the surface's `client-ref`
     format, else `"****"`. When `s` matches `^[A-Za-z0-9_.:\-]{0,64}$` it is
     printed raw (numbers stay numbers) unless it contains a known value (then
     `"****"`); otherwise it gets the text scrub, capped at 256.
   - `text`: the text scrub, capped at 1024.
   - default: `"****"`.

**Text scrub** (also used for non-JSON response bodies, capped at 512, and for
every `message` of `transport_error` / `error`, capped at 1024):

1. Digit runs: 6–8 digits → `****`; 9 or more → `****` + last 4. This runs
   first so a short known value cannot match inside a longer number and
   leave its ends visible.
2. Replace every **known value** and its percent-encoded form with `****`,
   longest first. Known values are the developer key, the `secret-key` of the
   attempt, and every scalar wire string of 4+ characters in the request that
   masking did not print unchanged — in the JSON body, the multipart
   `form-data` part, the query string and the path segments (the request is
   masked first, against the developer key and `secret-key` only). Before
   anything is sent (validation errors) only the developer key is known.
   An empty string is never a known value.
3. PAN shape `[A-Z]{5}[0-9]{4}[A-Z]` → `****`; e-mail shape → `****@****`.
4. Cap at N code points, appending `…(+M chars)`.

**Headers** (case-insensitive allowlist): `secret-key-timestamp` and
`content-type` raw; `developer_key` → `last4`; every other header, including
`secret-key`, → `"****"`. `access_key` never goes on the wire.

**URL**: taken from the URL actually sent. It must start with the client's
base URL and its path must have as many `/`-separated segments as the
endpoint's template, with every literal segment equal; otherwise `url` is
`"[unavailable]"`. Each `{param}` segment, and each query value, is masked by
its key's class (decoded first; a `last4` result keeps its last 4 only when
they are `[A-Za-z0-9]`, else `"****"`; a raw `safe` value keeps its original
encoding). Query keys follow the key-name rule above.

**Body**: the JSON body is parsed from the exact string sent and masked from
the root. A multipart body is `{"fields": <masked form-data JSON>, "files":
[{"param", "ext", "bytes"}]}` — `ext` the lowercased extension when it matches
`^[a-z0-9]{1,5}$` else `null`, `bytes` the size already in hand (PHP: a
warning-free `filesize()` stat, `null` on failure). File names and file bytes
never appear. A GET has `body: null`. A response body is the parsed JSON
masked from the root, or the text-scrubbed raw text when it is not JSON.

### Fixtures

Developer key `abcd1234wxyz`, sandbox. Every SDK asserts, over the bytes
written by the text sink and over every callback event, that none of the
**secrets** below appears and the **expected** outputs do.

| Input                                                                   | Expected                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| any request                                                             | header `developer_key: "****wxyz"`, `secret-key: "****"`       |
| `init`                                                                   | `developer_key: "****wxyz"`, `source: "env"` under `EPS_SDK_DEBUG=1` |
| `aadhar: "123456789012"` (also as key `AADHAR`)                          | `"****9012"`                                                   |
| `otp: "4321"`, unknown `otp_code: "654321"`, unknown `foo_bar: "x"`       | each `"****"`                                                  |
| `entries: [{bank_account: "000111222333", ifsc: "SBIN0000001"}]`         | `[{"bank_account":"****2333","ifsc":"SBIN0000001"}]`           |
| GET path param `customer_mobile: "9876543210"`                           | URL segment `****3210`                                         |
| `client_ref_id: "KUMAR 123456789012"` (non-financial call)               | `"****"` in request, response echo and `error`                 |
| response `{"status":0,"response_status_id":0,"data":{"tid":"2611230001","name":"Kumar","email":"k@x.in","dob":"1990-01-01","photo":"<5 KB base64>"}}` | `tid` raw; `name`, `email`, `dob`, `photo` → `"****"`          |
| response `{"data":{"john@example.com":"x","123456789012":"y"}}`         | `{"data":{"#1":"****","#2":"****"}}` (either order)           |
| response `{"otp_code":{"reference_id":"r1"},"foo":[{"tid":"t1"}]}`      | `{"otp_code":"****","foo":"****"}`                            |
| response `{"data":{"reference_id":"123456789012"}}` for a request that sent `aadhar: "123456789012"` | `"****"` (known value)           |
| response `message: "sent to k@x.in, ref 9876543210"`                     | `"sent to ****@****, ref ****3210"`                            |
| non-JSON 502 page echoing `123456789012`, its percent-encoded form, and `abcd1234wxyz` | none of the three appears; capped at 512        |
| multipart `pan_card` from path `KUMAR_123456789012.JPG`                  | `{"param":"pan_card","ext":"jpg","bytes":<size>}`             |
| `call("no-such-slug")`                                                    | one `error`, no `request`                                       |
| transport failure                                                         | `transport_error` with `ms`, then `error`                       |
| sink that throws on every event: a validation error, a successful financial call, an indeterminate financial call | outcome and request count identical to debug off |
| explicit off option with `EPS_SDK_DEBUG=1`                                | no event                                                        |
| debug off, `EPS_SDK_DEBUG` unset                                          | no event, nothing written to stderr                            |

Values for the byte scan: the developer key above, the full `secret-key`,
`123456789012`, `9876543210`, `000111222333`, `654321`, `k@x.in`,
`john@example.com`, `Kumar`, `KUMAR_123456789012` (the 4-character `otp` is
asserted by field, not by scan, so a random `call_id` cannot flake the test).
