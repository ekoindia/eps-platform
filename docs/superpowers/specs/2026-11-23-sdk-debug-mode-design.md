# SDK debug mode — all 5 SDKs (JS, Python, PHP, Go, Java)

> Normative contract: `docs/sdk-golden-vector.md` → "Debug mode conformance". It supersedes details below where they differ (`text` list added, real clock for `ts`, lowercase key-name rule, depth/size bounds).

## Context
Devs report failures by pasting SDK code + response body. Support can't see the environment (UAT vs prod), the exact request, or the raw upstream reply. This adds an opt-in debug mode to every SDK. It dumps masked request, response, validation and retry detail as JSON lines for the dev to share with Eko support.

Constraints: no breaking change, no new dependencies, and debug output must never change a call's outcome.

## Decisions
**User-picked:**
- **Enable: env var + option.** `EPS_SDK_DEBUG=1|true` (case-insensitive) turns on stderr output with no code edit. A new optional `debug` option overrides it when set: on, off, or a custom sink. If the option is unset, the env var decides. Both are read once, at construction.
- **Masking: keys + PII, always on, no unmask switch.**

**Revised after 2 Codex rounds, flag on review:**
- Masking is now **fail-closed**. Values print raw only for allowlisted keys with a safe shape. Explicitly classified identifiers print as last 4. **Everything else is `****`**, including names, addresses, email, DOB and unknown or response-only keys.
- Free text (non-JSON upstream pages, the `message` field, exception text) is kept, scrubbed and capped, because you asked for the raw upstream reply. Scrubbing cannot be proven complete, so READMEs say: **"Debug output masks credentials and personal data best-effort. Free text (upstream error pages, messages) is scrubbed but may still contain credentials or personal data. Id and status fields print as-is, and they would expose anything an upstream placed inside them. Review the output before sharing, and share it only with Eko support."** The output is not claimed to be "safe to paste anywhere".

## Approaches considered
- **Enable:**
  - A, env var only: output can't be routed into the dev's logger.
  - B, option only: the dev must edit code and redeploy.
  - **C, both: picked.**
- **Masking:**
  - Keys only: leaks Aadhaar and OTPs.
  - Unmask switch: gets left on in prod.
  - PII denylist: misses unknown, variant and response-only keys.
  - **Fail-closed allowlist: picked.**
- **Codex's alternative, a metadata-only envelope with no bodies: rejected.** You explicitly need the request and response bodies.

## Design

### Option shape per SDK (new field, at the END of each option list)
| SDK | Option | Default text sink |
|---|---|---|
| JS | `debug?: boolean \| ((event: EpsDebugEvent) => void)` | `process.stderr.write(JSON + "\n")` |
| Python | `debug: bool \| Callable[[dict], None] \| None = None` (last dataclass field before `base_url`) | `sys.stderr.write(line)` (a single write) |
| PHP | `bool\|\Closure\|null $debug = null`, appended after `$transport` | CLI: `fwrite(STDERR, $json."\n")`, which is pure JSON. Other SAPIs: `error_log($json)`, where the server may add its own prefix and the JSON starts at the first `{` (documented). |
| Go | `Config` is **unchanged**. New `NewWithDebug(cfg Config, w io.Writer) (*Client, error)`; `New` delegates with nil. | nil = use the env var, `os.Stderr` = on, `io.Discard` = off. A **package-level** mutex serializes writes, so clients sharing one writer stay safe. One `Write` per line. |
| Java | `Builder.debug(boolean)` + `Builder.debug(Consumer<Map<String,Object>>)` | `System.err.println` |

**Compatibility:**
- PHP: the argument is appended last, so positional callers are unaffected.
- Python: the new field has a default.
- Java: new Builder overloads only.
- Go: `Config` and `New` are untouched, and the new constructor is purely additive. This means even unkeyed `Config` literals keep compiling. A test proves it.

**Precedence:** explicit option > `EPS_SDK_DEBUG` > off. When debug is off, each emit point is a single `if`, so no masking or serialization cost is paid.

### Output contract
- **Callback sinks** (JS, Py, PHP, Java) get the event object, already masked.
- **Text sinks** get one complete JSON object per line, with no prefix, except PHP under a non-CLI SAPI (see above). The first key is `"logger":"eps-sdk"`, which keeps the lines greppable.
- **Common fields:**
  - every event: `logger`, `ts` (ISO-8601 UTC, from the injected `now`), `event`, `sdk` (`js|python|php|go|java`), `sdk_version` (best effort, falls back to `"unknown"`), `surface` (the surface's `bundleVersion`), `env` (`sandbox|production`).
  - per-call events also: `call_id` (8 random hex chars) and `slug`.

| event | when | extra fields |
|---|---|---|
| `init` | constructor, once (not part of any call) | `base_url`, `runtime` (e.g. `node v20.11.0`), `developer_key` (last 4), `timeout_ms`, `retries`, `auto_status_check`, `source` (`env\|option`) |
| `request` | each attempt, just before send | `attempt`, `method`, `url` (masked), `headers` (masked), `body` (masked). For multipart, `body` is `{fields:{…}, files:[{param, ext, bytes}]}`. |
| `response` | each attempt that got any HTTP status | `attempt`, `status`, `ms`, `body` (masked JSON, or scrubbed free text) |
| `transport_error` | an attempt with no HTTP response (timeout, DNS, reset) | `attempt`, `ms`, `error` (class name), `message` (scrubbed) |
| `retry` | before a backoff sleep | `attempt` (the failed one), `delay_ms` |
| `error` | `call()` is about to throw (validation, unknown slug, HTTP error, invalid response, indeterminate outcome) | `error` (class name), `message` (scrubbed), `client_ref_id` / `tid` (each through the safe-shape rule) |

- A validation failure gives an `error` event with no `request` before it, which shows that nothing was sent. An `init` line may appear earlier, at construction time.
- The auto status-check inquiry re-enters `call()`, so it logs under its own `call_id` with slug `transaction-inquiry`.

### Log only already-materialized data (no side effects, no refactor of the send path)
- **Request body:** parse the exact wire bytes the SDK is about to send (the encoded JSON string), then mask. This never re-walks user objects, getters or custom serializers.
- **Multipart:** each SDK's existing multipart builder also returns debug metadata, built from values it already holds: the `form-data` JSON string it encoded, and for each file `{param, ext, bytes}`. Streams are not consumed and files are not re-read.

  | SDK | Where the metadata comes from |
  |---|---|
  | JS | `buildFormData`: the `JSON.stringify(payload)` string and `Blob.size` |
  | Python, Go, Java | the encoder's in-memory parts |
  | PHP | the `$target['body']` array: the `form-data` string, plus `CURLFile` name → extension, with a `filesize()` stat. The stat runs only in debug mode, is warning-suppressed, and is best-effort: on failure `bytes` is null. The injected `$transport` sees the same `$target`, so both paths log identically. |
- **URL:** taken from the final URL string, with strict validation.
  - The URL must start with the client's `baseUrl`.
  - The path is split on raw `/`. Encoded `%2F` inside a param stays within its segment.
  - Segment count must equal the template's, and every literal template segment must match exactly. Only then is each `{param}` segment masked by its key class.
  - Query params are parsed and masked per key.
  - Any mismatch fails closed: the field is `"[unavailable]"`.
  - The existing URL building is **not** refactored.
- **Response:** parse the raw text the SDK already read.

### Masking policy (identical in all 5; normative in the golden-vector doc)
**Key classes.**
- Keys are normalized before matching: lowercase, and the leaf name of `entries[].x` is used.
- The lists ship in the surface as a new top-level field, `redact: { safe: string[], last4: string[], nest: string[] }`, built in `src/lib/sdk/build-sdk-surface.ts`.
- All three lists are added to:
  - the TS type,
  - the Go `surface` struct and the Java `Surface` record,
  - the Py and PHP readers,
  - the missing-field fallback (any absent list counts as empty, so values fall to `****`),
  - the guard test,
  - the package checks.
- **Key names are output too.** Inside a recursed object, a key name prints only if it is in `safe`, `last4` or `nest`, or matches the identifier shape `^[A-Za-z][A-Za-z0-9_]{0,39}$`. Any other key name, such as an email or a number used as a map key, is replaced by `"#1"`, `"#2"`, … in order. Its value is `****` under the default rule.

| Class | Output | Keys |
|---|---|---|
| `safe` | raw, **only if** the value matches the safe shape `^[A-Za-z0-9_.:\-]{0,64}$` (also numbers and booleans). Otherwise the value is free-text-scrubbed. Exception: `message`-type keys are always free-text-scrubbed. | **Request:** ids, codes and enums (`amount`, `bank_code`, `bank_id`, `beneficiary_id`, `bulk_reference_id`, `bulk_verification_id`, `category`, `channel`, `circleid`, `client_ref_id`, `currency`, `customer_id_type`, `document_requested`, `document_type`, `ifsc`, `intent_id`, `kyc_request_id`, `operator_id`, `otp_ref_id`, `payment_mode`, `phone_operator_code`, `recipient_id`, `recipient_id_type`, `recipient_type`, `reference_id`, `reference_tid`, `service_code`, `shop_type`, `source`, `state`, `tid`, `timestamp`, `txn_otp_request_id`, `type`, `user_code`, `verification_id`, `account_type`, `modelname`). **Response:** envelope and status keys (`status`, `response_status_id`, `response_type_id`, `message`, `tx_status`, `txstatus_desc`, `fee`, `utr`, …), curated from the specs' `responseData`. |
| `last4` | `"****" + last 4` of the string form. A value of ≤ 8 chars becomes `"****"`. | Classified identifiers only: `aadhar`, `aadhaar`, `pan_number`, `account`, `bank_account`, `utility_acc_no`, `customer_id`, `customer_mobile`, `mobile`, `recipient_mobile`, `confirmation_mobile_no`, `initiator_id`, `customer_vpa`, `gstin`, `cin`, `dl_number`, `epic_number`, `vehicle_number`, `registration_number`. Also any param whose `format` ∈ {`aadhaar`,`pan`,`mobile`}. |
| **default** (everything else) | `"****"` | OTPs (including variants like `otp_code`), `piddata`, tokens, names, addresses, DOB, email, lat/long, IP, unknown or pass-through keys, response-only keys. |

**Precedence and value handling.**
- **Precedence:** the guard test forbids a key from being in both lists, and `last4` wins if one ever is.
- Booleans and null stay raw under any key.
- **Objects and arrays recurse only at the root, or under a key in `safe` or in the new third list `nest`.** `nest` holds structural envelopes such as `data` and `entries`, curated from object and array fields in the specs' `responseData`.
  - An object or array under any other key (unknown or sensitive parent) becomes `****` whole, so `{"otp_code":{"reference_id":"x"}}` → `{"otp_code":"****"}`.
  - Array elements inherit their parent's decision.
- **Strings are decided by their own key class:**
  - `default` → `****`, with no recursion into JSON-in-string. A sensitive parent can never be bypassed this way.
  - `last4` → last 4.
  - `safe` → raw if the value is safe-shaped. A safe-key string that parses as a JSON object or array is masked recursively, then re-serialized.
- **The known-values scrub runs on every emitted string**, safe values included. This catches request secrets echoed under an allowlisted key.
- **What makes `safe` defensible:** each entry must be an Eko-issued id, a status or code, an enum, or an amount. It must never be a free-form caller or customer field. Each entry carries a one-line justification comment in `build-sdk-surface.ts`, and the guard test enforces the sensitive-stem ban.
- **Field-specific rule for `client_ref_id`** (the one caller-supplied id): it prints raw only if it matches the surface's `client-ref` format, which the SDK already validates on financial calls. Otherwise it becomes `****`. This applies in requests and in response echoes.
- **Residual risk (documented in the README warning, together with the free-text risk):** an upstream that put a response-only secret inside an Eko-issued id field would print it.
- **Missing surface `redact`** (an older or broken package): every key falls to default `****`. This is fail-closed.

**Free-text scrub** (non-JSON response bodies, `message`-type keys, exception and transport messages, safe-key values with a bad shape):
1. **Known-values scrub:** every original request value that was not printed raw (string form, ≥ 4 chars, plus its URL-encoded form), plus the `developer_key` and `secret-key` values, is replaced by `****` anywhere it appears.
2. **Regex scrub:** runs of 6 or more digits → `****` + last 4. PAN-shaped strings → `****`. Emails → `****@****`.
3. **Caps:** a non-JSON body is capped at 512 chars (proxy pages identify themselves at the top), and a message at 1024 chars.
4. **Documented limitation:** response-only names and addresses inside free text, and base64 or otherwise re-encoded echoes, can survive. This is why the README says "review before sharing".

**Headers** are an allowlist, matched case-insensitively.
- `secret-key-timestamp` and `content-type` print raw.
- `developer_key` becomes last 4.
- Every other header, including `secret-key` and any unknown header, becomes `****`.
- `access_key` is never sent, so it never appears.

**Files** are logged as `{param, ext, bytes}` only. File names and file bytes never appear.

**Guard test** (`src/lib/sdk/build-sdk-surface.test.ts`):
- `safe` ∩ `last4` = ∅.
- No `safe` key matches the sensitive stems `aadha`, `pan`, `mobile`, `phone`, `otp` (except `otp_ref_id` and `txn_otp_request_id`), `pid`, `dob`, `name` (except `modelname`), `address`, `email`, `vpa`, `ip`, `lat`, `long`, `token`, `acc` (except `account_type`).

### Isolation (debug can never change an outcome)
- `emit()` wraps building, masking, serialization and sink delivery in one try/catch that swallows everything. A sink that throws, a writer error, a parse failure or a cycle all become a no-op.
- Only SDK-materialized strings and bytes are inspected (see above). Real params, URL, body and headers are never mutated, and no user-defined serialization runs for debug.
- Tested: a sink that throws on every event, on (a) a validation failure, (b) a successful financial call, (c) an indeterminate financial call. Each result or exception must be identical to the debug-off run, with the same request count.

### Where it hooks (line refs from recon)
Same three touch points in every SDK:
1. **ctor:** resolve the sink and emit `init`.
2. **`call()`:** wrap resolve and the retry loop to emit `retry` and `error`.
3. **`send()`:** emit `request` from the wire data before the HTTP call, then `response` or `transport_error` after it.

Per SDK:
- **JS** `packages/sdk-js/src/client.ts` (reference implementation, first):
  - ctor ~401, `call` 451, `resolve` 543, `send` 644.
  - The masking helpers live in a new `src/debug.ts`.
- **Python** `packages/sdk-python/src/eps_sdk/client.py`:
  - dataclass 420–452, `call` 626, `_send` 693.
  - The `HTTPError` branch at 708 must also emit `response`.
  - Raw `urlopen` errors (705) emit `transport_error`.
- **PHP** `packages/sdk-php/src/EpsClient.php`:
  - ctor 32–98, `call` 420, `send` 490.
  - Log at the `send` level so the injected `$transport` path is covered too.
- **Go** `packages/sdk-go/eps.go`:
  - `New` 317 becomes a delegate to the new `NewWithDebug`.
  - `Call` 804, `send` 903, `encodeMultipart` 557.
  - The `surface` struct at 115 gains `BundleVersion` and `Redact`.
- **Java** `packages/sdk-java/src/main/java/in/eko/eps/EpsClient.java`:
  - Builder 364–440, ctor 325, `call` 803, `send` 878.
  - The `Surface` record at 261 gains `bundleVersion` and `redact`. JSON goes through the existing Gson.

### SDK version (best effort, no release-pipeline change)
| SDK | Source |
|---|---|
| JS | `../package.json`, relative to `dist/`. ESM-only; same resolution as the existing `../data/` path. |
| Py | `importlib.metadata.version("eps-sdk")` |
| PHP | `\Composer\InstalledVersions::getPrettyVersion('ekoindia/eps-sdk')`, only if the class exists |
| Go | `debug.ReadBuildInfo()` dep lookup |
| Java | `getImplementationVersion()` |

- Fallback is `"unknown"`. The `surface` (bundleVersion) field is always reliable.
- ponytail: if Java or PHP always report unknown, stamp a VERSION constant in `release.yml` later.

## Phases (pickable)
| # | Step | Touches | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 0 | Contract: add a "Debug mode conformance" section to `docs/sdk-golden-vector.md` (event schema, field policy, masking classes, scrub rules, per-runtime text-sink contract, isolation rule, adversarial fixtures). Fix stale lines 165–169 (PHP now has an injectable `$transport`). Copy the design to `docs/superpowers/specs/2026-11-23-sdk-debug-mode-design.md`. | docs | S | low | — |
| 1 | Add the surface `redact` lists in `build-sdk-surface.ts` (plus the type) and the guard test. Run `npm run build`, not `bake:all` alone. Confirm `npm pack --dry-run` and the other packages ship a surface that contains `redact`. | website lib | S | low | 0 |
| 2 | JS reference implementation plus fixture tests, using the injected `fetch`, `now` and a sink callback. | sdk-js | M | med | 1 |
| 3 | Python, PHP, Go and Java ports, each with the same fixtures. They are independent, so 4 parallel subagents. | 4 SDKs | M each | med | 2 |
| 4 | Add a "Debugging" section to each README: env var, option, sample output, what is masked, and the free-text warning quoted in Decisions. Add a Python CHANGELOG entry. | READMEs | S | low | 3 |

Release: `feat:` per SDK, a minor bump on the shared version line. Commit only after an explicit "commit" (memory), and stage only my own files.

## Adversarial fixtures (shared, in golden-vector doc; every SDK runs all)
**Inputs:**
- Credentials: dev key `abcd1234wxyz` → `****wxyz`; the `secret-key` value; an exception message containing the dev key.
- Classified ids: `aadhar` `123456789012`, also as `AADHAR` and `Aadhar`; nested `entries[].bank_account`; `customer_id` `9876543210` as a path param.
- Short secrets: `otp` `4321` and `otp_code` `654321`, both → `****`.
- Unknown keys: pass-through `foo_bar`.
- Opaque data: `piddata` XML; a 5 KB base64 photo in the response.
- Response-only PII: `name`, `email` and `dob` under unknown keys.
- A `client_ref_id` with an unsafe shape: `KUMAR 123456789012`.
- A response `message` with an email and a 10-digit number.
- A response field holding a JSON string with `aadhar` inside it.
- A non-JSON 502 HTML page that echoes the aadhar (raw and URL-encoded) and the dev key.
- The multipart filename `KUMAR_123456789012.jpg`, sent as a path in every SDK, as a JS `Blob`/`File`, and through PHP's injected `$transport`.
- A request secret echoed in the response under the allowlisted `reference_id`.
- Secrets nested under unknown and sensitive parents: `{"otp_code":{"reference_id":"x"}}` and `{"foo":[{"tid":"x"}]}` → parent `****`.
- `client_ref_id` that fails the `client-ref` format, in the request and echoed in the response → `****`.
- PHP: `filesize()` failing on a missing temp file → `bytes: null`, no warning, call unaffected.
- Response with PII and secrets used as object keys: `{"data":{"john@example.com":"x","123456789012":"y"}}` → `{"data":{"#1":"****","#2":"****"}}`.
- An `aadhar` value inside a JSON string under an unknown key: the whole string becomes `****`.
- URL edge cases: a path param containing `/` (encoded `%2F`), a query value with `&`/`=` escapes, and a URL whose base or literal segment does not match the template → `"[unavailable]"`.
- Go only: an unkeyed `Config{…}` literal still compiles; `NewWithDebug(cfg, io.Discard)` beats `EPS_SDK_DEBUG=1`.

**Assertions:**
- Neither the raw bytes delivered to the text sink nor the JSON of any callback event contains a fixture secret.
- Safe ids with a safe shape (`tid`, a normal `client_ref_id`, `response_status_id`) print raw.

## Verification
- Run each SDK's full existing test file, because the instrumentation sits on signing, retry, multipart and financial paths:
  - `npx vitest run packages/sdk-js`
  - `python -m unittest packages/sdk-python/tests/test_client.py`
  - `vendor/bin/phpunit tests/EpsClientTest.php`
  - `go test ./...` in sdk-go
  - `mvn -q test` in sdk-java
- New tests in each SDK:
  - off by default: the sink is never called and nothing is written to stderr
  - env var on → lines on stderr
  - option `false` beats the env var
  - the adversarial fixtures
  - sink-throws isolation (3 cases)
  - validation failure → only an `error` event
  - transport error event
  - concurrent calls: every line is parseable JSON
  - Go only: two clients sharing one writer
  - PHP only: the CLI sink writes pure JSON
- `npx vitest run src/lib/sdk` for the surface guard test.
- UAT smoke with **synthetic PII**: `EPS_SDK_DEBUG=1` with the public sandbox keypair, one GET (`bbps-operator-code-circle`, with `customer_mobile` as a path param) and one POST with PII params, from the JS and Python SDKs.
  - Every line must parse as JSON.
  - Grep for each synthetic value. There must be no hits.
- Run `graphify update .` after the code changes.
