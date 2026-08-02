# Developer Console — Feature Roadmap

Future features for the logged-in developer `/console`. Derived from Mobbin
research (Stripe, Vercel, Cohere, OpenAI, WorkOS, Klaviyo, ElevenLabs, Exa,
PandaDoc, Clerk, Coinbase) benchmarked against the current console.

Status today: `/console` is a lifecycle gate (login → state-aware card) behind a
left-nav shell. The UX polish landed (skeletons, empty states, success cards).
The features below turn it into a real developer platform.

## Shipped shape

`ConsoleLayout` (`src/components/console/ConsoleLayout.tsx`) owns every auth
branch — loading skeleton, anon login card, `role: "signup"` → `/signup`
redirect, admin card — and, for a developer session only, renders a 16rem left
rail plus `<Outlet context={me}>`. Sub-pages read the session through
`useConsoleMe()` and carry no auth logic; the rail never renders for an anon or
admin session.

The rail borrows `DocsLayout`'s shape outright so the console and `/docs` read as
one product: a full-bleed 16rem `bg-slate-50` panel with a `border-r`, sticky
under the fixed ~88px header, collapsing into a `Sheet` below `lg` (where the
slate panel and border drop away). Its caption — `DEVELOPER CONSOLE` in the small
uppercase style `DocsLayout` uses — **is** the page's `<h1>`; there is no separate
page title above the grid, and sub-pages start at `<h2>`. Where docs puts its
theme toggle, the console puts the account's lifecycle badge, reading the same
copy as `LifecycleCard` through its exported `lifecycleBadge()`. Only the
developer branch is full-bleed; the anon/admin/loading cards keep the old
container and their own `<h1>`.

Links are grouped under the docs rail's uppercase captions rather than flat:
**Home** alone at the top, then **Account** (Upload Documents, Load Wallet, Sign
Agreement, Credentials, Manage My Account) and **Build & Monitor** (Transactions,
plus the DEV-only Test bench). A group whose items are all unentitled renders
nothing rather than an empty caption. An `API Docs ↗` link closes the rail. Order
within a group is entitlement-independent and pinned by
`ConsoleLayout.nav.test.tsx`, which also guards the single-`h1`/`<main>` contract.

The console's index page (`/console`) is the **Business Dashboard** — call
volume, success rates, most-used services and usage over time, from upstream
interaction 682. The lifecycle-state card that used to be the whole page now
renders in full only for an account that still has something to finish; an
active account gets it as a one-line banner above the widgets. See
`docs/features/business-dashboard.md`, whose status banner is worth reading
before trusting a number on that page.

Pinned above the rail links is `WalletBalance`
(`src/components/console/WalletBalance.tsx`) — the developer's E-value balance,
mirroring Eloka's always-visible `StatusCard`. It sits outside `<nav>`: it is
account state, not navigation. It fetches `GET /wallet/balance` on mount, offers
a manual refresh on a 30s cooldown, and renders **nothing** on a 403 (the
account has no wallet) rather than showing an empty card. Eloka's "Load balance"
(+) action sits beside the refresh button for accounts entitled to the flow, and
links to the same `/console/transaction/:id` route the rail's Load Wallet item
does.

The fetched balance is cached in module scope (`src/lib/wallet-balance.ts`), not
in the component. `AnimatedRoutes` keys the whole route subtree on the pathname
to retrigger its fade, so every console navigation remounts the card; per-mount
state meant a request and a "Loading…" flash on each page change, and a per-mount
cooldown a user could walk past by hopping pages. A balance under 30s old
(`FRESH_FOR_MS`, the cooldown window) paints on the first frame and skips the
fetch, and the card mounts with the rest of that window already on its cooldown.
Concurrent callers share one in-flight request, so a fast navigation before the
first response lands doesn't double up. Only settled answers cache — "ok" and the
403 "no wallet"; a transient failure caches nothing, so a remount retries rather
than showing a stale error for 30s. `AuthProvider` clears the cache whenever the
session goes anon (keyed on the state, so an expired session counts, not just
`logout()`) — otherwise the next user to sign in in that tab would see the
previous one's balance.

The rail column renders once at every width — only the *links* collapse into the
`Sheet` below `lg`, while the caption, badge and balance stay on screen. A balance hidden behind a
hamburger isn't the always-visible one Eloka has. (A second `WalletBalance` in
the `Sheet` would no longer double the round-trips — the shared cache and
in-flight dedupe cover that — but it would still be the wrong shape.) Refresh is
guarded by an in-flight flag as well as the cooldown: a request slower than 30s
would otherwise let a second start, and the later-landing response can be the
staler one.

Backend: `GET /wallet/balance` (`packages/eps-backend/src/http/app.ts`) →
`eko.getWalletBalance` (interaction **9**) acting as the user's own identity.
The identity is re-derived from the session claim's mobile via the 151 profile
on every call, never read from the request, so one developer cannot read
another's wallet. Rate-limited per session. No new env vars — it reuses
`cfg.eko`. Note upstream returns `balance` as a *string*, and a blank one is
rejected rather than coerced to a very convincing `₹0`.

Two failure modes are deliberately distinct: an ineligible account answers **403**
(the console hides the card for good), while any upstream failure — including
`profile.kind === "error"` — answers **502**, which keeps the card retryable. A
502 mapped to 403 would silently retire the balance of an account that has one.

| Route | Page | Contents |
|---|---|---|
| `/console` | `pages/console/ConsoleHome.tsx` | Lifecycle overview card (`STATE_COPY`) |
| `/console/profile` | `pages/console/Profile.tsx` | My Profile — identity, onboarding progress, personal details |
| `/console/documents` | `pages/console/Documents.tsx` | Upload Documents — KYC pack, see [`features/kyc-documents.md`](./features/kyc-documents.md) |
| `/console/credentials` | `pages/console/Credentials.tsx` | Shared UAT keypair + production-key status |
| `/console/transactions` | `pages/console/Transactions.tsx` | Transaction history — see [`features/transaction-history.md`](./features/transaction-history.md) |

Every route is registered in `App.tsx` (lazy) and `AppServer.tsx` (eager), and
deliberately excluded from prerendering — the console is `noindex` and behind
auth.

The layout caps no width: each sub-page sets its own (`max-w-2xl` on Home and
Credentials), because the transactions table needs the full column. A layout that
legislates width for pages it doesn't know about forces the next wide page to
fight it.

The production block on the Credentials page is an empty state with **no request
button**: no credential-issuance API exists yet, so its copy points at the
account manager or at onboarding depending on `me.state`. When the issuance
endpoint lands (see "API keys management" below), the fetch goes there.

Self-serve signup now exists at `/signup` (OTP → partial account → PAN → PIN),
feeding new users into this same lifecycle gate. See
[`docs/features/user-onboarding.md`](./features/user-onboarding.md).

### My Profile

`/console/profile` ports Eloka's profile page (`wlc-webapp/page-components/Profile`)
to the console. It is reached from **My Profile** in the header account dropdown
(`components/auth/UserMenu.tsx`), shown only for a developer session — an admin's
`/me` carries no Eko profile. There is no rail entry.

The page issues no request of its own; it reads the `MeView` the layout already
fetched, via `useConsoleMe()`. Three blocks:

- **Identity card** — name, user type, user code and mobile, over the brand
  gradient. Initials come from `accountIdentity()`, the same derivation the
  header menu uses, so a session with no profile still renders.
- **Profile completeness** — onboarding progress, NOT Eloka's shop+personal field
  checklist (those fields are opaque to us, and Eloka's own count treats an
  absent key as complete). `profileCompleteness()` in `lib/auth/identity.ts`
  reads `onboardingSteps` (the full ordered list) against `roleList` (the steps
  still pending) — the same projection `eps-backend/src/signup/service.ts` makes.
- **Manage My Account** — the children of interaction 536, read from the cached
  interaction list with `groupChildren()`. The rows are upstream's and follow the
  user's role; each deep-links to `/console/transaction/536/<childId>`.
- **Personal details** — gender, DOB, qualification, marital status, from the
  `personal_detail` block (below). Editing links out to `/console/transaction/401`
  when the user is entitled to that flow, rather than reimplementing upstream's
  form: the BFF exposes no profile-write endpoint.

#### Profile detail blocks

Interaction 151 returns `personal_detail` / `shop_detail` / `business_detail`
beside `user_detail`. `EkoProfile.detailBlocks` forwards them, and `/me` serves
them to the page. The block names are an **allowlist**
(`PROFILE_DETAIL_BLOCKS` in `clients/eko.ts`), not a passthrough of every sibling
key: whatever lands there is readable by anything running in the page, so a block
upstream adds later must be reviewed before it ships. Contents stay untyped and
are read with `detailField()`, which tolerates upstream's singular/plural spelling.

#### Session cache

`lib/auth/session-cache.ts` parks the resolved `/me` view in `sessionStorage`
(`eps.session.me`) so a tab reload paints the signed-in shell immediately instead
of the skeleton. `AuthProvider` hydrates from it in an **effect** — never in the
`useState` initializer, because `main.tsx` hydrates prerendered HTML built with
`status: "loading"`, and a synchronous read would trip a hydration mismatch.

The cached view is display data only. Every request still carries the session
cookie, so a cache outliving the cookie shows a name for one paint and then drops
to `anon` when `/me` 401s; `refresh()` runs unconditionally on every boot. The
blob is versioned and validated on read (a primitive would throw inside
`classify()`'s `"role" in me`), and cleared whenever the state reaches `anon`,
which covers expiry as well as explicit logout.

Picking up where signup stops, `/console/documents` ("Upload Documents") is the
KYC document pack — the checklist a user uploads to get the account activated.
It appears in the rail directly after Home, and only for accounts entitled to
both upstream interactions (586 list, 587 upload). Every listed document is
treated as mandatory; upstream's `is_required` is deliberately ignored. See
[`docs/features/kyc-documents.md`](./features/kyc-documents.md).

Complexity: **S** ≈ frontend-only / static · **M** ≈ needs a backend endpoint ·
**L** ≈ needs a new backend subsystem (telemetry, billing, etc.).

---

## P0 — Table stakes

### API keys management — **M**
View, one-time reveal, copy, and revoke UAT + production keys. Table:
Name / masked key / created / last used / actions. Blocked on the Eko
credential-issuance API contract (see the eps-backend roadmap). UI is a
`Table` + `Dialog` (both present). The core reason a developer logs in.
`/console/credentials` is the page this lands on — it already shows the shared
UAT pair and a production empty state awaiting exactly this contract.
_Pattern: Cohere, OpenAI, WorkOS API keys._

### Environment toggle (UAT / Production) — **S**
Persistent `Tabs` at the console top level that scopes all credentials and
logs to the selected environment; defaults to UAT. Without it, developers
can't tell which key/data they're viewing. Frontend-only state.
_Pattern: WorkOS Staging/Production tab._

---

## P1 — Core value after first login

### Onboarding / setup checklist — **S**
Numbered, checkable steps: generate UAT key → first API call → test a
settlement → request production access. Persist to localStorage (later
backend). Gives every new developer a path from login to first call.
_Pattern: Vercel production checklist, PandaDoc quick start._

### Integration docs quick-links — **S**
Card grid linking into EPS docs: auth guide, Connect API reference, test your
integration, go-live checklist. Keeps developers in flow (no context switch).
_Pattern: ElevenLabs quick links, Exa get-started strip._

### Webhook configuration — **M**
Register HTTPS endpoints for settlement events; "send test event" button.
EPS is a payments API — event-driven integration is the primary pattern for
partners. `Table` + `Dialog` form; needs a backend registration endpoint.
_Pattern: PandaDoc webhooks, Klaviyo webhook events._

### API usage / request metrics — **DONE** (as the Business Dashboard)
Shipped at `/console` from upstream interaction 682, not from a telemetry
pipeline: call volume, per-service counts, success rates and usage over time,
across five preset windows. What is still missing is the *per-endpoint* and
error-rate view this line originally asked for — 682 aggregates by product
(`tx_typeid`), not by HTTP endpoint, and nothing upstream reports a 4xx/5xx rate.
That remains an **L** and still needs a telemetry pipeline.
_Pattern: Klaviyo developer tools, Exa usage strip._

---

## P2 — Account maturity & enterprise

### Profile & account settings — **S**
Name, contact email, linked mobile, "sign out all sessions". Basic hygiene;
there is no in-console way to manage the account today.
_Pattern: Vercel account settings._

### Team / members management — **M**
Invite colleagues by mobile/email, assign roles (viewer / developer), remove
members. EPS partners (banks, fintechs) have multiple developers needing
access. Needs a backend invite/role model.
_Pattern: Cohere team, WorkOS users._

### Support / escalation shortcut — **S**
In-console "Contact support" that pre-fills `/grievance` with session context
(account id, lifecycle state). Today `/grievance` carries no context.
_Pattern: Vercel feedback link._

### Audit log — **M**
Timestamped key issuances, revocations, propose/deploy events, logins. For
compliance + incident debugging. Date-sorted `Table`; needs backend events.
Aligns with the eps-backend Production-Hardening audit-log work.
_Pattern: WorkOS audit logs._

### Billing / plan overview — **L**
Plan, quota, quota consumed, billing contact, upgrade link. Partners track
consumption against contract. Needs billing-system integration.
_Pattern: Cohere billing & usage, WorkOS billing._

### Sandbox / API playground — **L**
Interactive endpoint explorer pre-authenticated with the UAT key. Reduces
time-to-first-call. Could start as an embedded Scalar instance scoped to the
developer's UAT key (small dep surface). Today this lives only in `/docs`
behind a CORS proxy — the console should own it.
_Pattern: Exa playground, OpenAI platform playground._

---

## Login polish backlog (LoginForm)

- **Segmented OTP boxes — M.** Six auto-advancing single-digit inputs with
  auto-submit at 6 digits (~35 lines, no new dep). _Pattern: Coinbase, Clerk,
  Upwork._ Current form uses a single OTP input (masked-number echo, resend
  cooldown, change-number, maxLength + autofocus already shipped).

## Admin console polish backlog

- **Cross-doc unsaved-changes guard.** Editor remounts per doc via `key=`, so
  switching docs silently discards edits. A true guard needs dirty state lifted
  to `AdminConsole` + a confirm before switching. (Intra-doc "Unsaved changes"
  badge already shipped.)
