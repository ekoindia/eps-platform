# Security Policy

EPS Platform powers integrations with live fintech rails, so we take security
reports seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Report privately through either:

- **GitHub Security Advisories** — use the repository's
  **Security → Report a vulnerability** tab (preferred; keeps the report private
  and tracked), or
- **Email** — <eps@eko.in> (mark the subject line `SECURITY`)

Please include:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- affected version / package / endpoint, and
- any suggested remediation.

## Scope

This repository contains the EPS Platform website and the generated developer
artifacts (the `@ekoindia/eps-*` npm packages, the `ekoindia/eps-sdk` Composer
package, and the Claude Code plugin). Of particular interest:

- the request-signing implementations (HMAC-SHA256) in the SDKs and context packs,
- any handling of credentials or secrets, and
- supply-chain integrity of the published packages.

**Out of scope:** the production EPS API backend (`api.eko.in`, `staging.eko.in`)
is a separate system — report issues there through Eko's main security channel,
not this repository.

## Our commitment

- We aim to acknowledge reports within **3 business days**.
- We will keep you informed of progress toward a fix.
- We will credit reporters who wish to be acknowledged once a fix ships.

Please give us a reasonable window to remediate before any public disclosure.
