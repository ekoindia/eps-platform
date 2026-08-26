# Error handling & debugging without server logs

The goal of everything here is one thing: **a screenshot of a console error
should be enough to act on the failure**, without SSHing to the VM or reading
container logs.

If you are triaging a report right now, skip to [Reading an error](#reading-an-error).

## The wire contract

`eps-backend` answers every failure with the same envelope
(`packages/eps-backend/src/http/errors.ts`, rendered by `app.onError`):

```json
{
  "error": {
    "code": "KYC_LIST_FAILED",
    "message": "Document service is temporarily unavailable",
    "details": { "invalid_params": { "agreement_status": "Required" } },
    "source": "api"
  },
  "rid": "3f2a1b7c-8d4e-4f21-9a0b-77c1e2d5a900",
  "ts": "2026-08-25T09:12:44.180Z",
  "version": "74c5eb3",
  "trace": [
    {
      "path": "/transactions/do",
      "clientRefId": "m9k2xq4b0f",
      "status": 200,
      "durMs": 412,
      "error": null,
      "response": { "response_status_id": 1, "message": "…" }
    }
  ]
}
```

- `error.details` is **omitted rather than null**, so a client can branch on its
  presence alone. It carries `invalid_params` / `dependent_params` /
  `list_items` — the fields upstream actually rejected.
- `rid` duplicates the `x-request-id` header **on purpose**: a screenshot shows
  the body, never the headers.
- `trace` is omitted entirely when nothing was recorded.
- `cause` appears only on the unhandled-error branch, and only for a verified
  session.

### `source` — who owns this failure

| `source` | Meaning | Route the ticket to |
| --- | --- | --- |
| `api` | The upstream call failed; `message` is its envelope message | Eko |
| `proxy` | eps-backend produced it — a guard, a validation, or no usable upstream answer | Backend team |
| `client` | Never reached the network at all | Frontend / the user's connection |

Backend: `new AppError(...)` defaults to `proxy`; use `AppError.fromUpstream(...)`
wherever the message is `envelope.message`. Frontend: `ApiError.source` mirrors
this and adds `client` for `NETWORK_ERROR` and for anything thrown before a
request went out.

An envelope-less HTTP failure stays `proxy`, not `client` — a server answered,
it just answered badly, and blaming the browser sends ops to the wrong team.
That includes `PARSE_ERROR`, which is what a response that is not JSON becomes:
an nginx or Vercel error page, an SPA fallback serving `index.html`, a captive
portal. Every one of those is an intermediary. It said `client` until a KYC
upload refused by nginx's `client_max_body_size` reached the user as
`client · PARSE_ERROR` and pointed the whole investigation at the browser.

The imprecision that buys: a non-JSON body from eps-backend itself would be
filed as `proxy` too. Hono's `onError` always answers JSON, so it does not
happen — and a fourth `source` to name it would have to be threaded through
`errors.ts` and both docs to describe nothing that occurs.

Because `PARSE_ERROR` withholds its message (it is a raw error page) and its
code says only "unreadable", `diagnosticsLine` prints the HTTP status for it
alone: `proxy · PARSE_ERROR · HTTP 502 · EkoCode 12345`. Every other code names
its own cause, where a status would be noise.

## Reading an error

Every console error renders through `ErrorNotice`
(`src/components/console/ErrorNotice.tsx`) and shows one mono line beneath the
message:

```
api · KYC_LIST_FAILED · ref m9k2xq4b0f · EkoCode 12345 · rid 3f2a1b7c-…
```

Read it left to right:

1. **`api`** — whose failure it is. See the table above.
2. **`KYC_LIST_FAILED`** — grep the code to find the exact throw site.
3. **`ref m9k2xq4b0f`** — the upstream `client_ref_id`. **This is the field Eko
   support can look a transaction up by.** Quote it to them verbatim.
4. **`EkoCode 12345`** — the account, as the user knows it.
5. **`rid …`** — the correlation id. `grep` it in the backend logs and you get
   the access-log line *and* every upstream call under it, because
   `createEkoLogger` now stamps the same `rid` on `eko_upstream` lines.

Empty fields are dropped rather than shown blank — an anonymous caller has no
EkoCode, and a network failure has no rid.

**Copy diagnostics** puts the whole thing on the clipboard as JSON: everything
above, plus `details`, the full `trace`, and the last 20 API calls this tab made.
**Raise issue** opens the existing dialog with all of it attached — it lands in
the Zoho ticket's `technical_notes` under `diagnostics`.

It is offered only to an account whose `profile.accountStateId` is
`LIVE_ACCOUNT_STATE_ID` (16), via `canRaiseIssue` in
`src/lib/console/lifecycle.ts`. A ticket is filed against the partner's Zoho
**contact**, and the lead is converted into one only when the account goes fully
live; before that the console holds a lead id and ticket creation fails
upstream. Offering the button earlier promises a support channel that cannot
exist yet.

Note this is a *different* question from the `Lifecycle` value `"active"`, which
fails OPEN — every state id except the KYC-pending one reads as active, `null`
included, so an unmapped id never blocks a working partner. `canRaiseIssue`
fails CLOSED for the opposite reason: a missing escape hatch is a smaller harm
than one that errors while the partner is already looking at an error. Both
defaults are deliberate; do not collapse them into one check.

**Copy diagnostics** is never gated — it works in every state, and is the
fallback whenever the ticket route is closed.

## Debugging without server access

Ranked by how often it resolves things:

1. **The recent-call buffer.** `src/lib/auth/client.ts` keeps the last 20 calls
   in memory — `{ts, method, path, status, code, requestId, durMs}`. The failing
   call rarely explains a bug; the five before it usually do. Metadata only: no
   bodies, so it never becomes a place PII accumulates. Cleared on sign-out, so
   one account's activity cannot ride along on the next user's ticket.
2. **`x-eps-version`.** On every response. Settle "is prod running this code?"
   first, not last — the deploy poller can latch a stale image silently.
3. **`x-eps-debug: 1`.** Adds `_diag` (rid + upstream trace) to *successful*
   JSON responses too. On automatically in dev; in production set
   `sessionStorage["eps.debug"] = "1"` (or call `setDebugEnabled(true)`).
   Use it for "it succeeded but returned the wrong data".
4. **The Network tab.** Error responses carry the upstream body inline, so a
   failing call is diagnosable without touching the backend at all.
5. **`details.invalid_params`.** Rendered as a field list. "Please provide the
   value of the field" names nothing on its own — this is what names it.

## What is deliberately withheld

`trace[].response` bodies and `cause` go **only to a verified session**.
Redaction (`REDACTED_RESPONSE_FIELDS`) strips credentials, not personal data, so
the gate is what protects PII. Anonymous callers — OTP failures, rate limits —
still get `rid`, `ts`, `version` and the upstream `path` / `clientRefId` /
`status` / `durMs` / `error`: enough to correlate, nothing about the account.

Two messages are captured but never rendered: a raw non-`ApiError` (a render
crash reads "Cannot read properties of undefined") and `PARSE_ERROR` (whose
message is the first 200 characters of an HTML error page). `errorDiagnostics`
decides this once via `safeMessage`; both still reach the copy blob and the
ticket.

> **Known residual risk.** The upstream echo uses a **denylist**
> (`redact()` in `src/audit/ekoLog.ts`), so a credential upstream introduces
> under a new field name would reach the browser. This is the same risk
> `userDetail` already carries and `packages/eps-backend/src/types.ts` documents.
> The caps and the authenticated-only gate narrow the blast radius; an allowlist
> was considered and rejected as too costly to author. `ekoLog.test.ts` covers
> the known keys — treat that test as security-critical.

## Where things live

| Concern | File |
| --- | --- |
| Error envelope, `source`, `fromUpstream` | `packages/eps-backend/src/http/errors.ts` |
| Request trace, caps, auth gate, `debugEcho` | `packages/eps-backend/src/http/trace.ts` |
| Trace capture + `rid` on upstream logs | `packages/eps-backend/src/audit/ekoLog.ts` |
| Build stamp | `packages/eps-backend/src/version.ts` |
| `ApiError`, recent-call buffer, `x-eps-debug` | `src/lib/auth/client.ts` |
| Diagnostics assembly and formatting | `src/lib/console/diagnostics.ts` |
| The error UI | `src/components/console/ErrorNotice.tsx` |
| Boundary copy button | `src/components/CopyDiagnosticsButton.tsx` |

## Adding a new error

1. Throw `AppError` (`proxy`) or `AppError.fromUpstream` (`api`). Never build an
   error envelope in a route — `errorBody`'s five call sites in `app.ts` are
   what attach the diagnostics.
2. Forward upstream `details` when there are any; the UI renders them.
3. On the frontend, keep the `ApiError` **object** in state and pass it to
   `ErrorNotice`. Do not flatten to `err.message` at the catch — that is what
   threw away `code`, `details` and `rid` before this existed.
