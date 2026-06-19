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

Conformance fixture — endpoint slug `dmt-get-sender`
(`requiredParams = [initiator_id, user_code, customer_id]`):

| Input params                                           | Expected                                      |
| ------------------------------------------------------ | --------------------------------------------- |
| `{initiator_id}`                                       | throw, message lists `user_code, customer_id` |
| `{customer_id, initiator_id, user_code: null}`         | throw, message lists `user_code`              |
| `{customer_id, initiator_id, user_code}` (all present) | no throw; request is signed and sent          |

Error message format: `Missing required params for "<slug>": <names>.`
Reference implementations: `packages/sdk-js/src/client.ts` (`call`),
`packages/sdk-php/src/EpsClient.php` (`resolveTarget`). Port the matching tests
when adding a new language.

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
`number`; `initiator_id`, `user_code` required strings):

| Input `category` (with required strings present) | Expected                                  |
| ------------------------------------------------ | ----------------------------------------- |
| `"5"` or `5`                                     | no throw; sent                            |
| `"abc"`                                          | throw, lists `category (expected number)` |
| `{}`                                             | throw, lists `category`                   |
