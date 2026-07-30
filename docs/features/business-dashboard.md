# Feature: Business Dashboard

The signed-in partner's own API usage and business numbers, at `/console` — the
page you land on after signing in. Ported from Eloka's (`wlc-webapp`) Admin
Business Dashboard, `page-components/Admin/Dashboard/BusinessDashboard/`.

> **Status: built, upstream scope UNVERIFIED.** Every layer is wired and tested,
> but interaction 682's server-side scope has never been run against an EPS
> partner account. It is implemented in SimpliBank — not in any repo here — and
> Eloka only ever calls it as an *admin* whose scope is a downline. An EPS
> partner has no downline. Run the probe in
> [§First live run](#first-live-run) before believing any number on this page.

## Shape

| Piece | File |
|---|---|
| Types, cache and all pure logic | `src/lib/console/dashboard.ts` |
| Page | `src/pages/console/ConsoleHome.tsx` |
| Container (window state + fetch) | `src/components/console/dashboard/BusinessDashboard.tsx` |
| Widgets | `OverviewWidget` · `SuccessRatesWidget` · `MostUsedServicesWidget` · `UsageAnalyticsWidget` in the same folder |
| Window picker | `src/components/console/dashboard/DashboardDateFilter.tsx` |
| Lifecycle card (extracted) | `src/components/console/LifecycleCard.tsx` |
| Client method | `dashboardClient.load` in `src/lib/auth/client.ts` |
| BFF route | `packages/eps-backend/src/http/dashboard.ts` |
| Upstream normalizer | `packages/eps-backend/src/http/dashboardView.ts` |
| Date-window maths | `packages/eps-backend/src/http/dashboardRange.ts` |
| Upstream transport | `interactJson` in `packages/eps-backend/src/clients/connect.ts` |
| Synthetic payload fixture | `packages/eps-backend/src/http/dashboard.sample.ts` |
| Live UAT probe (skipped) | `packages/eps-backend/src/clients/connect.uat-dashboard.test.ts` |

Layout: Business Overview (full width) → Most Used Services (2 col) + Success
Rates (1 col) → Usage Analytics (full width). One column on mobile, same order,
so the primary metric is first on every screen.

## What an EPS partner sees, and what Eloka's version showed

**Total Transactions is the headline**, at roughly double the visual weight of
anything else. An EPS partner is billed per API call, so call volume is the
number they signed in for; GTV is context and sits in a muted row with charges.
Eloka leads with GTV because its users move other people's money for a
commission — the inverse business, hence the inverse ordering.

**Dropped, and not merely hidden:** Transacting Agents, Onboarded Agents,
Commission Due, and the whole GTV-wise Top Retailers / Network Leaderboard
widget. An EPS partner has no downline, so a leaderboard of their merchants
degenerates to empty or a single self-row, and an "active agents" count is
structurally meaningless. These are dropped in `buildDashboardView`, at the
backend boundary, so they never reach the browser and nobody is tempted to
render one.

**Also not ported:** the draggable/resizable widget grid
(`react-grid-layout` + `localStorage`), the waffle/dot-matrix chart, and the
per-widget product dropdown. The backend accepts a `typeId` filter already; add
the control when a partner actually has more services than the list comfortably
shows.

## Upstream contract

One interaction, four datasets, over connect-api's JSON transport:

```jsonc
POST {connect-api}/transactions/dojson     Authorization: Bearer <FULL upstream token>
{
  "source": "EPS",
  "client_ref_id": "<20 digits, minted server-side>",
  "interaction_type_id": 682,
  "requestPayload": {
    "products_overview":   { "datefrom": "...", "dateto": "...", "typeid": "81" },
    "most_used_services":  { "datefrom": "...", "dateto": "...", "typeid": "81" },
    "success_rate":        { "datefrom": "...", "dateto": "..." },
    "verification_trends": { "datefrom": "...", "dateto": "..." }
  }
}
```

`typeid` goes only on the two per-service datasets; upstream takes dates alone
for the other two.

**The request keys are snake_case; only one of the response keys is.** This
asymmetry is real, and it is stated exactly once, in `RESPONSE_KEYS`:

| Request key | Response key |
|---|---|
| `products_overview` | `data.dashboard_object.products_overview` |
| `success_rate` | `data.dashboard_object.successRate` |
| `most_used_services` | `data.dashboard_object.mostUsedServices` |
| `verification_trends` | `data.dashboard_object.verificationTrends` |

Other upstream quirks the normalizer absorbs:

- **`gtv.typeBreakdown` is an object on some accounts and a JSON-encoded STRING
  on others.** Both are handled; malformed JSON yields an empty split rather
  than throwing, because one bad field must not cost the whole page.
- **`gtv.revenuelastPeriod`** really is spelled with a lowercase `l`.
- Numbers arrive as numeric strings on some branches, so everything goes
  through a finite-checked coercion.
- Absent blocks become zeros in the view — but the route logs *which* datasets
  were absent (see [§Zero versus absent](#zero-versus-absent)).

**Service names** come from a second interaction, **1044**, on
`/transactions/do` (not `dojson`), read from `param_attributes.list_elements[]`
at the **top level** — not under `data` like the dashboard payload. Every
`tx_typeid` in the response is joined against it, falling back to
`Service <id>`; the browser never does a lookup and never sees a bare id.

## Windows

| Preset | Range |
|---|---|
| Today | IST midnight today → now |
| Yesterday | all of yesterday |
| Last 7 Days | start of `today − 7` → yesterday 23:59:59 |
| Last 30 Days | start of `today − 30` → yesterday 23:59:59 |
| Last 365 Days | start of `today − 365` → yesterday 23:59:59 |

**Every window except Today ends yesterday** — ported from Eloka, so the numbers
agree with what a partner sees there. The "Showing stats from … to …" line names
the actual dates precisely because that rule is the part people misread.

Eloka calls the last one **"Year Till Yesterday"**, which is a lie: it is
`today − 365`, not the calendar year to date. Renamed here to **Last 365 Days**;
the maths is identical, only the label is honest.

### Why the range is computed server-side, in IST

Eloka computes these in the *browser's* local time. This backend runs UTC on
Vercel, and the data upstream is Eko's, stamped in IST. Computing "today" in UTC
would open a Delhi partner's window 5h30m late and close it 5h30m early — an
empty dashboard every morning, a truncated one every night. `dashboardRange.ts`
therefore does the arithmetic at a fixed `+05:30` (India has never observed DST)
and its tests run under `TZ=UTC` to pin exactly that.

The browser sends **only a preset**. A `datefrom`/`dateto` pair in the body is
ignored, never forwarded: an arbitrary window is an unbounded upstream scan, the
enum validates in one `Set.has`, and the cache key is derivable from it.

## Caching

| Key | TTL | Why |
|---|---|---|
| `dash:<scope>:<mobile>:<preset>:<typeId>` | 60s for `today`, 900s otherwise | Every window but `today` ends at yesterday 23:59:59 — a closed window whose numbers cannot change |
| `dash:svc:<scope>:<mobile>` | 3600s | The 1044 name list changes when Eko adds a product |
| module-scope map in `src/lib/console/dashboard.ts` | 30s | `AnimatedRoutes` remounts the page on every console navigation; without it each hop refetches and flashes skeletons |

The two upstream calls — 682 for the numbers, 1044 for the names — are
independent, so the unfiltered request runs them **concurrently** and the partner
waits for the slower one rather than for their sum. A `typeId` filter is the one
case that stays sequential: the name list is what says the id is real, and it has
to say so before the id is forwarded.

`<scope>` is the first eight hex of a SHA-256 of the connect-api base URL.
Without it, a UAT and a production instance sharing one Redis would collide on
`dash:<mobile>:<preset>` and serve UAT numbers to a live partner — the mobile is
the same person in both. `<mobile>` comes from the session claim, never from the
request. Only a **non-empty** service list is cached: caching `[]` would pin
degraded `Service <id>` labels in place for an hour.

## Degradation

| Situation | Answer |
|---|---|
| Deployment runs the `eko` provider (no `CONNECT_API_BASE_URL`) | **501 `DASHBOARD_UNAVAILABLE`** → a muted note, not a red box. It is a configuration fact, not a fault |
| Sealed upstream session aged out | 401 `CONNECT_SESSION_EXPIRED`; the client retries once via `/auth/refresh` first |
| Upstream envelope `status !== 0` | 502 `DASHBOARD_FAILED`, carrying upstream's message |
| Interaction 1044 fails | **Non-fatal.** The page renders with `Service <id>` labels; a `typeId` filter is still accepted on the regex alone, because refusing it would turn a cosmetic outage into a broken filter |
| Account is not `active` | No dashboard and no fetch — the lifecycle card, exactly as before |
| Everything is zero | The zeros are **rendered**, plus a line pointing at `/console/transactions` |

Unlike the Connect-widget routes, `/dashboard` is mounted unconditionally and
answers 501 rather than being absent. Those routes hand out *credentials*, so not
existing is right there; this one hands out aggregate counts, and a named 501
lets the console say "not on this deployment" instead of guessing at a 404.

### Zero versus absent

A quiet week and an out-of-scope account both look like zeros in the UI, so:

- The UI **never hides a zero.** Hiding it would make "you had no traffic"
  indistinguishable from "we cannot see your account", and the link to the
  transaction history is how a partner tells the two apart in one click.
- The route **logs which datasets were absent** rather than present-and-zero
  (`[dashboard] absent datasets: …`, from `buildDashboardView`'s `absent`). That
  log is where an upstream contract change, or the 682 scope problem, shows up
  first.

## Charts

`recharts` (^3.10), the same library Eloka uses. The three chart widgets are
**`React.lazy()`** — and must stay that way:

`src/AppServer.tsx` imports `ConsoleHome` **eagerly** for the static build, so a
plain import would drag ~250KB of charting into the SSG bundle and the console's
entry chunk. Behind `lazy()` the built `ConsoleHome` chunk is ~10KB with zero
recharts in it, the charts land in their own chunks, and no prerendered HTML
references them. Business Overview renders with no chart code at all, so the
primary metric paints before the chart chunk is even requested.

Do not "simplify" those into static imports. Two smaller notes: per-datum `fill`
is used instead of `<Cell>` (deprecated in recharts 3, removed in 4), and
`<Legend position=…>` instead of the deprecated `align`/`verticalAlign` pair.

Each chart also renders a one-line text summary. That is not a test crutch: an
SVG chart is invisible to a screen reader, and in jsdom `ResponsiveContainer`
measures zero and renders nothing, so the summary is also the only assertable
surface.

## Still unconfirmed

1. **682's scope for a downline-less partner.** The headline risk. Zeros here
   mean "the query cannot see this account", not "no traffic". Fallback if so:
   interaction **206**, the older dashboard interaction on
   `/ekoicici/v1/request` reachable through the direct `eko` client (see
   `docs/features/transaction-history.md`), or aggregating interaction 154.
2. **What `transactions.transactions` counts.** It is labelled "Total
   Transactions" here, matching Eloka, and it is described above as API call
   volume — but whether upstream counts every API call or only completed business
   transactions is assumed, not verified. Check it before anyone bills against
   this number.
3. **A multi-key `requestPayload`.** All four datasets go up in one call. If
   upstream only honours the first key, the route must split into four parallel
   calls.
4. **`source: "EPS"` and `client_ref_id`.** Eloka's dashboard calls send
   neither; connect-api defaults `source` to `NEWCONNECT`. Both are sent here for
   consistency with the rest of this backend. Untested on this interaction.
5. **Bucket granularity of `verification_trends`.** Upstream chooses it and does
   not announce it; `isHourlyRange` infers it from the first bucket's own span.

## First live run

1. Run the probe against UAT and read the raw bodies:
   ```
   CONNECT_UAT_BASE_URL=https://api.beta.ekoconnect.in \
   CONNECT_UAT_MOBILE=<a known-active UAT developer> \
   npm run backend:test -- uat-dashboard
   ```
2. If `dashboard_object` is missing or every dataset is zero for an account you
   know has traffic, **stop** — that is item 1 above, and no amount of UI work
   fixes it. Compare against Eloka's dashboard for an admin on the same upstream
   to confirm 682 itself is alive.
3. If the shapes differ from `dashboard.sample.ts`, update that file (keep it
   synthetic — no real partner's numbers in the repo) and let its tests say what
   broke.
4. Sign in on `/console` and cross-check Total Transactions and the per-service
   success rates for one window against `/console/transactions` for the same
   window. They will only agree if 682 counts the same rows interaction 154
   returns — if they disagree, that is item 2, and the label needs to change
   rather than the code.
