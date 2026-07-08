---
name: eps-verify
description: Use when running an EPS verification (PAN, Aadhaar, bank account, GSTIN, driving license, …) through the eps-transact MCP tools — covers credential setup, tool selection, and UAT-vs-production safety.
---

# Run an EPS verification (eps-transact MCP)

Tools are named `eps_<slug>` — e.g. `eps_pan_lite`, `eps_bank_account_verification`,
`eps_verify_gstin`. Pick the narrowest tool for the task; each tool's description
names required params and, for multi-step flows (OTP, DigiLocker, bulk), which
tool comes next and which field carries over.

## Before the first call — check credentials

The server connects and lists its tools even when no credentials are set, so the
tools appearing does **not** mean you are ready to call them — a call without
credentials returns a `MISSING_CREDENTIALS` error. The server reads credentials
from environment variables. Verify they are set (check presence only —
**never print their values**):

```bash
[ -n "$EKO_DEVELOPER_KEY" ] && [ -n "$EKO_ACCESS_KEY" ] && [ -n "$EKO_INITIATOR_ID" ] && echo OK || echo MISSING
```

If missing, ask the user to export them (from https://eps.eko.in signup):

```bash
export EKO_DEVELOPER_KEY=…   # required
export EKO_ACCESS_KEY=…      # required, server-side secret
export EKO_INITIATOR_ID=…    # needed for most verification calls
export EKO_ENV=uat           # optional: uat (default) | production
export EKO_ALLOWED_APIS='*'  # optional: comma-separated tool allowlist
export EKO_USER_CODE=…       # optional
```

GUI-launched harnesses (e.g. Cursor opened from the dock) may not see shell
exports — use the hosted endpoint `https://mcp.eko.in/transact/mcp` instead. It
is not a no-auth shortcut: the same credentials go in as `X-Eko-*` request
headers, so the client must support custom MCP headers (see the plugin README).

## Safety rules

- **UAT is the default. Never set `EKO_ENV=production` without the user's
  explicit confirmation** — production calls are billed and hit real data.
- Never echo, log, or commit credentials; never write verified PII (PAN,
  Aadhaar, bank details) into files or logs beyond the user's immediate task.
