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
| 2xx, JSON body                  | return the decoded envelope                                                        |
| non-2xx, JSON body              | fail with the typed HTTP error carrying `status`, `url`, the decoded `body`, `raw` |
| non-2xx, non-JSON body          | same, with a null/nil `body`; `raw` keeps the bytes verbatim                       |
| 2xx, non-JSON body              | fail — **never** a silent `{}`, `[]` or `null`                                     |
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

¹ PHP keeps `\InvalidArgumentException` for **input validation** — SPL already
has the semantically correct class, and it is a `\LogicException`, so it cannot
share a base with the runtime failures. `EpsException` covers transport, surface
and decoding failures only.

### Fixed message strings

- `EPS request to <url> failed with HTTP <status>.`
- `EPS response from <url> was not valid JSON.`

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

Because PHP and Java have no injectable transport, each exposes a pure seam the
conformance tests drive directly: `EpsClient::decodeResponse(status, url, raw)`
and `EpsClient.handleResponse(status, url, raw)`. PHP additionally exposes
`curlOptions(target)` so the timeout wiring is assertable. Node and Go inject a
`fetch` / `http.Client` instead.

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

Exported generator per language: `generateClientRefId(nowMs)` (Node, PHP,
Java), `generate_client_ref_id(now_ms)` (Python), `GenerateClientRefID(nowMs)`
(Go).

## Retry and status-check conformance

An outcome is **indeterminate** when the SDK cannot know whether EPS processed
the request: a transport failure, the per-attempt timeout, HTTP 429, or any
5xx. A 4xx is a decisive answer and is never retried or inquired; a 2xx whose
body is not JSON is decisive too. A cancelled context (Go) or an interrupted
thread (Java) stops everything — no retry, no inquiry.

**GET** — the same request is re-sent up to `retries` extra times (default 2,
three tries in all). Attempt `n` first sleeps a random slice of
`min(base × 2^(n-1), 2s)` (full jitter; base default 200 ms). Every attempt is
**re-signed** with a fresh `secret-key-timestamp`; only the merged params (and
so the ref, if any) are fixed across attempts.

**Non-GET** — never retried: re-sending a debit is how a customer is charged
twice. If the endpoint is `financial` in the surface **and** the call carries a
`client_ref_id`, the SDK makes one Transaction Inquiry:

```
GET transaction-inquiry
    transaction-reference = "client_ref_id:" + <the call's ref>
    initiator_id          = <the initiator the call resolved>
```

The inquiry goes through the ordinary GET path, so it has the GET retry budget
and can never recurse (it is a GET). The call then fails with the language's
indeterminate error, which **never** substitutes the inquiry envelope for the
endpoint's own response — the shapes differ. Outside this path (non-financial
endpoint, no ref, decisive status) behaviour is exactly as before.

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
| `clientRefId`      | the ref the failed call carried (generated or supplied)                 |
| `status`           | HTTP status of the original attempt, or null/nil/0 for a transport failure |
| `statusCheck`      | the decoded inquiry envelope, or null when the inquiry itself failed    |
| `statusCheckError` | the inquiry's own failure, or null — it must never mask the original    |
| cause              | the original failure: `cause` / `__cause__` / `getPrevious()` / `Unwrap()` / `getCause()` |

It extends the base error (`EpsError` / `EpsException`; Go wraps), so existing
`catch` blocks and `errors.As(err, &httpErr)` keep matching. Fixed message:
`EPS request for "<slug>" with client_ref_id "<ref>" has no confirmed outcome.`
(Go: `eps: request for %q with client_ref_id %q has no confirmed outcome`.)

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
| financial POST: 502, inquiry 200                            | 2        | indeterminate error; `status` 502; `statusCheck` = inquiry envelope; inquiry URL contains `client_ref_id:<ref>` and `initiator_id`; the inquiry is a GET |
| financial POST: transport failure, supplied ref, inquiry 200 | 2       | indeterminate error; `status` null; `clientRefId` is the supplied value |
| financial POST: 500, inquiry 503 every attempt              | 1 + 3    | indeterminate error; `statusCheck` null; `statusCheckError` is the 503; cause is the 500 |
| financial POST: 403                                         | 1        | typed HTTP error, no inquiry                                    |
| `initiate-refund` (financial, no ref param): 500            | 1        | typed HTTP error, no inquiry                                    |
| financial POST with auto inquire off: 500                   | 1        | typed HTTP error                                                |

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
