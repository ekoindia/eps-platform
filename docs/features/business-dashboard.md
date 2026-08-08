# Feature: Business Dashboard

The signed-in partner's own API usage and business numbers, on **Home**
(`/console`). The page itself is not the dashboard — it leads with the Next
Steps card and the lifecycle state, and the widgets are the block below them.
Ported from Eloka's (`wlc-webapp`) Admin Business Dashboard,
`page-components/Admin/Dashboard/BusinessDashboard/`.

> **Flags — both off by default.** `VITE_SHOW_BUSINESS_DASHBOARD` renders the
> widget block at all; `VITE_SHOW_DASHBOARD_LAST_365` adds the year window to the
> picker and is for local testing only. Both are module constants in
> `src/lib/config/features.ts`, so tests mock the module rather than stubbing
> `import.meta.env`. Do not flip the first until the numbers below are reconciled
> against Eloka for a real account.

> **Status: live; Usage Analytics still blank on at least one account.** A
> multi-key `requestPayload` returned only two of the four datasets, so the route
> now issues **one call per dataset** as Eloka does — but `verificationTrends`
> stayed empty afterwards. 682's aggregation is SimpliBank's; connect-api merely
> proxies it (`routes/transactions.js`, which never reads `requestPayload`) and
> **ships a mock of 682 that implements only three keys** — the first thing to
> rule out, see [§Zero versus absent](#zero-versus-absent). The log's `raw=` and
> `echo=` fields are the instrument; read them before debugging any number here.
>
> Untested difference against Eloka, kept deliberately: Eloka's dashboard sends no
> `source`, so connect-api defaults it to `NEWCONNECT`; this route sends `EPS`.
> Token type is not a factor — connect-api forwards only `initiator_id`,
> `user_code` and `org_id` upstream, which both token types carry.

## Shape

| Piece | File |
|---|---|
| Types, cache and all pure logic | `src/lib/console/dashboard.ts` |
| Page (Home — owns both gates) | `src/pages/console/ConsoleHome.tsx` |
| Next Steps card | `src/components/console/NextStepsCard.tsx` |
| Flags | `SHOW_BUSINESS_DASHBOARD` · `SHOW_DASHBOARD_LAST_365` in `src/lib/config/features.ts` |
| Container (window state + fetch) | `src/components/console/dashboard/BusinessDashboard.tsx` |
| Widgets | `OverviewWidget` · `SuccessRatesWidget` · `MostUsedServicesWidget` · `UsageAnalyticsWidget` in the same folder |
| Window picker | `src/components/console/dashboard/DashboardDateFilter.tsx` |
| Profile card (identity + state badge) | `src/components/console/ProfileCard.tsx` |
| Lifecycle badge labels | `src/lib/console/lifecycle.ts` |
| Client method | `dashboardClient.load` in `src/lib/auth/client.ts` |
| BFF route | `packages/eps-backend/src/http/dashboard.ts` |
| Upstream normalizer | `packages/eps-backend/src/http/dashboardView.ts` |
| Date-window maths | `packages/eps-backend/src/http/dashboardRange.ts` |
| Upstream transport | `interactJson` in `packages/eps-backend/src/clients/connect.ts` |
| Synthetic payload fixture | `packages/eps-backend/src/http/dashboard.sample.ts` |
| Live UAT probe (skipped) | `packages/eps-backend/src/clients/connect.uat-dashboard.test.ts` |

Page layout: `Home` heading → Next Steps card → lifecycle state → the dashboard.
Within the dashboard: Business Overview (full width) → Most Used Services (2 col)
+ Success Rates (1 col) → Usage Analytics (full width). One column on mobile,
same order, so the primary metric is the first number on every screen.

The widget gate lives in `ConsoleHome`, on the `<BusinessDashboard />` element
rather than inside the component. The flagged-off boundary is then exactly the
requested one — the date-filter row and everything under it — and
`BusinessDashboard.test.tsx` stays a test of the widgets instead of a test of a
flag.

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
(`react-grid-layout` + `localStorage`) and the waffle/dot-matrix chart.

### The service filter

Business Overview's header carries a **service dropdown** — Eloka's "All
Products", renamed — replacing what used to be a static "GTV by service" list
under the tiles. Picking a service refetches the window scoped to it; the default
is All Services.

- **Options** are the 1044 master list NARROWED to the `tx_typeid`s this window
  actually has data for, from all three datasets (`serviceOptions` in
  `src/lib/console/dashboard.ts`). The bare master list would offer forty
  services a partner has never called. Hidden entirely when there is ≤1 option.
- **Sticky:** options are only ever recomputed from an *unfiltered* view. A
  filtered response carries one service, so recomputing would collapse the
  dropdown to whatever is already selected — the trap Eloka works around with a
  cached full list.
- **Reset on window change**, as Eloka does: the selected service may have no
  activity in the new window, which reads as "this service is broken".
- **Scope:** `typeid` reaches `products_overview` and `most_used_services` only,
  so Business Overview and Most Used Services narrow while Success Rates and
  Usage Analytics stay all-services. Same as Eloka. Both caches key on the
  filter (`dash:…:<preset>:<typeId|all>` server-side, `<preset>:<typeId|all>` in
  the browser).
- It is a **native `<select>`**, not the Radix one. Keyboard, mobile wheel and
  screen-reader behaviour come free, and it is ten lines against a hundred and
  fifty of `components/ui/select.tsx` that does not exist yet.

## Upstream contract

One interaction, four datasets, **one call each**, over connect-api's JSON
transport:

```jsonc
POST {connect-api}/transactions/dojson     Authorization: Bearer <FULL upstream token>
{
  "source": "EPS",
  "client_ref_id": "<10 chars, minted by the connect client>",
  "interaction_type_id": 682,
  "requestPayload": {
    "verification_trends": { "datefrom": "...", "dateto": "..." }
  }
}
```

**One `requestPayload` key per call — never four in one payload.** This route
originally sent all four together, and upstream answered `products_overview` and
`success_rate` while silently omitting `mostUsedServices` and
`verificationTrends`: two widgets blank on a perfectly healthy account, no error
anywhere. Eloka — where all four widgets work — issues a separate call per key
(`UsageAnalytics.tsx` sends `verification_trends` alone). The four calls run
concurrently, so wall-clock is the slowest not the sum, and a cache miss costs
four upstream calls at 60s/900s TTL. The table lives in `DATASETS`
(`dashboardView.ts`); adding a dataset there adds its call.

Each response is read for **its own key only**, via `pickDataset`
(`dashboardView.ts`). Spreading whole `dashboard_object`s together would let
whichever call settled last overwrite another's block.

`pickDataset` tolerates a renamed key, because upstream's naming is already
inconsistent — three of the four datasets convert snake to camel on the way back
and one does not, so `verification_trends` instead of `verificationTrends` is a
live possibility that would otherwise present as a blank widget. It tries every
**exact** candidate first (response name, then request name) before any
normalized (lowercased, separator-free) matching, so an exact hit can never lose
to a fuzzy one; an **ambiguous** normalized match — two keys collapsing to the
same form — resolves to nothing rather than to whichever upstream serialized
first, and the `raw=` log line shows the collision.

A real capture (`verification_trends`, a one-year window):

```jsonc
{ "response_status_id": 0, "status": 0, "message": "Dashboard Displayed!",
  "data": {
    "client_ref_id": "1785471135464865", "user_code": "99027178", "org_id": 3, "source": "",
    "dashboard_object": {
      "verificationTrends": [
        { "startDate": "2025-08-12", "endDate": "2025-08-12", "totalCount": 1 },
        { "startDate": "2025-12-29", "endDate": "2025-12-29", "totalCount": 63 }
      ] } } }
```

Two things that matters for: usage buckets are **date-only** with
`startDate === endDate` (not the `T`-separated stamps the hand-written fixture
uses), and the envelope echoes `user_code` / `org_id` / `source` — which is what
the log's `echo` field reports. A bucket with no usable `startDate` is dropped
rather than rendered as a nameless bar.

Failures are per-call: only `products_overview` failing is worth a 502 — it is
the headline. Any other dataset failing costs its own widget and a
`[dashboard] <key> unavailable: …` line, because one blinking call should not
take down a page that is three-quarters fine.

`typeid` goes only on the two per-service datasets (`perService` in `DATASETS`);
upstream takes dates alone for the other two.

**The request keys are snake_case; only one of the response keys is.** This
asymmetry is real, and it is stated exactly once, in `RESPONSE_KEYS`:

| Request key | Response key |
|---|---|
| `products_overview` | `data.dashboard_object.products_overview` |
| `success_rate` | `data.dashboard_object.successRate` |
| `most_used_services` | `data.dashboard_object.mostUsedServices` |
| `verification_trends` | `data.dashboard_object.verificationTrends` |

Other upstream quirks the normalizer absorbs:

- **Any block may arrive as a JSON-encoded STRING.** `gtv.typeBreakdown`
  demonstrably does on some accounts; nothing says the others are exempt, so
  every block goes through one `decode` helper. Malformed JSON yields an empty
  dataset rather than throwing, because one bad field must not cost the whole
  page.
- **A service map that arrives as an ARRAY is rejected, not accepted.**
  `Object.entries` on an array yields `"0","1","2"` as service ids, so the widget
  would render rows named `Service 0` — data-shaped nonsense, worse than an empty
  state. The shape log is what says it happened.
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
| Last 365 Days | start of `today − 365` → yesterday 23:59:59 — **hidden unless `VITE_SHOW_DASHBOARD_LAST_365=true`** |

**Every window except Today ends yesterday** — ported from Eloka, so the numbers
agree with what a partner sees there. The "Showing stats from … to …" line names
the actual dates precisely because that rule is the part people misread.

Eloka calls the last one **"Year Till Yesterday"**, which is a lie: it is
`today − 365`, not the calendar year to date. Renamed here to **Last 365 Days**;
the maths is identical, only the label is honest.

That window is also **capped out of production**: a year of upstream aggregation
is a slow, expensive 682 query, and 30 days answers the question a partner
actually asks. The cap is a client-side filter in `DashboardDateFilter.tsx`, not
a removal — `last365` stays in `DASHBOARD_PRESETS`, in the `DatePreset` union and
in `dashboardRange.ts`, so the list still mirrors the backend's `DATE_PRESETS`
and the range maths keeps its tests. Nothing can select a hidden preset: the
default is `last7` and the window is not read from the URL or persisted.

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
| `VITE_SHOW_BUSINESS_DASHBOARD` unset | No widgets and **no fetch** — Home is the profile card beside the Next Steps card. The gate is on the element, so the request is never issued rather than issued and discarded |
| Account is not provisioned (`isProvisioned` — neither `active` nor `kyc-pending`) | No dashboard and no fetch — the profile card and Next Steps card alone |
| Account is `kyc-pending` | **Dashboard still loads** — it is a post-onboarding account that can have transacted. The state itself reads only as the profile card's badge |
| Everything is zero | The zeros are **rendered**, plus a line pointing at `/console/transactions` |

Unlike the Connect-widget routes, `/dashboard` is mounted unconditionally and
answers 501 rather than being absent. Those routes hand out *credentials*, so not
existing is right there; this one hands out aggregate counts, and a named 501
lets the console say "not on this deployment" instead of guessing at a 404.
`VITE_SHOW_BUSINESS_DASHBOARD` does not change that: it is a **client** flag that
decides whether anything asks, and the route stays mounted and answerable either
way — which is what keeps the backend tests and the UAT probe meaningful while
the widgets are hidden.

## Next Steps card

`NextStepsCard.tsx` is what Home leads with, in every lifecycle state. Four
steps: finish KYC, integrate against UAT credentials, receive production
credentials, pay the one-time integration fee.

Only the **KYC step carries a status** — Done once `me.state === "active"`, else
Pending — because it is the only one this session can answer. This is the one
place that must test for `active` alone rather than `isProvisioned`: the state it
exists to report is precisely `kyc-pending`, which the helper folds in with
`active` everywhere else. Note what the status actually means: upstream accepted
the account, not that any specific document was verified. `/console/documents`
knows the per-document truth and can disagree. The other steps are a route, not a checklist; nothing here knows
whether a partner has finished integrating, and a step that reads "Pending"
forever is worse than one that reads nothing.

The KYC step links to `/console/documents` only when `useKycEnabled()` says so,
mirroring the rail — never link at a page the rail is hiding. The hook returns
`null` while the entitlement is loading, so the step is plain text for a tick and
then becomes a link, exactly as the rail's own item appears late.

**Only the KYC step's button is primary-coloured** (`cta.primary`); the rest stay
outline. Two filled buttons in one card is two next steps, which is none — and
the KYC one is the only thing the partner is actually being asked to do now. The
others are references they can reach whenever they want.

The **fee step is shown to everyone**, with no link and no action.

> **Known imprecision, accepted deliberately.** The step was first gated on
> `me.profile.dateOfJoining >= 2026-08-03`, so only post-cutover accounts saw it.
> That gate came out: `dateOfJoining` has **no format contract and no other
> consumer** — it reaches the client as a bare `String(date_of_joining)`
> (`clients/eko.ts`) — so a non-ISO shape made the gate hide the step from every
> account, including the ones that do owe the fee. Ungated is the lesser error
> while the field is untrusted, but it does mean **a partner who joined before
> 2026-08-03 is shown a fee that does not apply to them**. Re-gate as soon as
> upstream offers a join date, or an eligibility flag, in a shape worth trusting.

### Zero versus absent

A quiet week and an out-of-scope account both look like zeros in the UI, so:

- The UI **never hides a zero.** Hiding it would make "you had no traffic"
  indistinguishable from "we cannot see your account", and the link to the
  transaction history is how a partner tells the two apart in one click.
- The route **logs the shape** whenever any dataset comes out absent *or* empty:

  ```
  [dashboard] preset=last365 typeId=all absent=[verificationTrends] empty=[usage]
              view={products_overview:object{9}, successRate:object{11}, mostUsedServices:object{12}}
              raw=[verification_trends→{somethingElse:object{1}} [user_code:…7178, org_id:3, source:]]
  ```

  `absent` (from `buildDashboardView`) catches only `undefined`/`null`; `empty`
  catches the shapes an upstream change actually arrives as — `{}`, `[]`, a
  JSON-encoded block, a wrongly-typed one.

  `view=` is the merged object the view was built from. **`raw=` is the
  diagnostic one**: the `dashboard_object` each *dry* call actually received,
  before its expected key was lifted out. Without it the log could only ever
  print names this service already recognizes, so an upstream that answered under
  a name nobody asked for would be invisible — `view=` would simply lack the key,
  exactly as if nothing came back. Dry calls only, so a healthy page logs nothing.

  `shapeOf` reports **keys and kinds only, never values**: a real body is one
  partner's revenue and service mix, and that does not belong in a log line. Kinds
  are reported after `decode`, so `verificationTrends:string→array[12]`
  distinguishes "encoded" from "missing".

  The bracketed `echo` is what upstream says it answered *as* — `user_code`
  (masked to its last four), `org_id`, `source`, all echoed back by connect-api
  from the bearer token. It is recorded **per call**, never merged: two calls can
  disagree, and one shared echo would report whichever settled last as if it spoke
  for all four.

  Reading it — these are *consistent with*, not proof of:

  | Log says | Consistent with | Do |
  |---|---|---|
  | `echo` shows `user_code:…7178, org_id:3` | connect-api's **682 mock** (`routes_mock/mock_responses/682.js`, active when `DUMMY_API_RESPONSE=true`), which implements `products_overview`, `gtv_top_merchants` and `success_rate` and silently ignores the other two | check that flag on the connect-api the backend points at before suspecting anything here |
  | a differently-named key in `raw=` carrying data | upstream renamed the block | already handled — `pickDataset` accepts it; confirm the widget filled |
  | the key present in `raw=` as `array[0]` / `object{0}` | genuinely no data for this account and window | cross-check `/console/transactions` for the same range |
  | no recognisable key in `raw=` at all | upstream omitted the dataset even on its own dedicated call — scope, `source`, or an upstream defect; the log cannot tell these apart | run the UAT probe (it prints the per-key and multi-key bodies side by side) and raise with the Connect team quoting both |
  | `string→unparseable` | upstream sent a broken encoding | upstream bug; the widget stays empty by design |

  **A cached view logs nothing**, because it never reaches upstream (60s for
  `today`, 900s otherwise). Restart the backend or wait out the TTL before reading
  the log — switching preset is *not* equivalent, it changes the window too.

### Most Used Services falls back to Success Rates

Kept as a belt-and-braces net after the per-dataset split: upstream returned
`mostUsedServices` **empty for EPS partner accounts** on a shared payload, while
`successRate` carries a `totalCount` for every service — which is the same
per-service call volume this widget charts. So when `mostUsedServices` is empty,
`buildDashboardView` derives the rows from `successRates` (`totalRevenue: 0`,
filtered to the active `typeId` because `success_rate` never gets one upstream).

It is an **approximation, not a second source of truth**: if upstream ever scopes
the two blocks differently — success rates omitting a service with no successes,
say — the counts drift. The shape log says which one is being rendered. Delete
the fallback once `mostUsedServices` is reliable.

Usage Analytics has no such stand-in: a per-bucket time series exists only in
`verificationTrends`. If that stays empty, the widget stays empty.

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
   consistency with the rest of this backend — `client_ref_id` by the connect
   client itself, for every call it makes. Untested on this interaction.
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
