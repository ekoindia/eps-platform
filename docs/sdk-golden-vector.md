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
No SDK retries; Go and Java expose the HTTP client so a caller can add their own.

Reference implementations of `call()` (and the `resolveTarget` it builds on):
`packages/sdk-js/src/client.ts`, `packages/sdk-python/src/eps_sdk/client.py`,
`packages/sdk-php/src/EpsClient.php`, `packages/sdk-go/eps.go`,
`packages/sdk-java/src/main/java/in/eko/eps/EpsClient.java`.

Because PHP and Java have no injectable transport, each exposes a pure seam the
conformance tests drive directly: `EpsClient::decodeResponse(status, url, raw)`
and `EpsClient.handleResponse(status, url, raw)`. PHP additionally exposes
`curlOptions(target)` so the timeout wiring is assertable. Node and Go inject a
`fetch` / `http.Client` instead.
