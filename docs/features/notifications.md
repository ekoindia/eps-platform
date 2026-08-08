# Feature: Notifications

Announcements delivered to a signed-in developer: a **bell** in the site header
with an unread count and a popover list, a **toast** for the newest fresh unread
item, and a **card on Home** (`/console`). All three read one store, refreshed by
one poll per tab.

Ported from Eloka (`wlc-webapp`), `contexts/NotificationContext.js` and
`docs/features/notification.md`, against the same upstream EMS interactions.

> **Flag — off by default.** `VITE_SHOW_NOTIFICATIONS` gates the poll and both
> surfaces; with it unset **nothing calls `/notifications` at all**. It is a
> module constant in `src/lib/config/features.ts`, so tests mock the module
> rather than stubbing `import.meta.env`.

> **Status: built, not yet enabled anywhere.** What has to be true before the
> flag is flipped: interaction 10010 must return **EPS-relevant** notifications
> for a real developer account on production connect-api. This is Eko's shared
> EMS, and the copy authored there today is written for Eloka's _retailers_
> ("Earn with AePS", cashout promos). The backend serves only
> `notification_type: 0` and drops every ad — but a retailer-flavoured
> announcement can still be published as a plain one, so the thing to check is
> the content, not merely that the call succeeds.

## 1. The pull loop

There is **no push and no websocket**. The list is pulled.

- `startNotificationsPolling(userKey)` in [src/lib/notifications.ts](../../src/lib/notifications.ts)
  fetches immediately and then every `POLL_MS` (600 000 — ten minutes, Eloka's
  period).
- **`AuthProvider` owns the timer**, not a component. Three surfaces read the
  list and each mounting its own interval would multiply the requests;
  `AuthProvider` already mounts once per tab in both the client and the
  prerender trees, and already owns session lifecycle. See the effect beside the
  anon-cleanup block in [src/lib/auth/AuthProvider.tsx](../../src/lib/auth/AuthProvider.tsx).
- A tick while `document.hidden` is skipped, and a `visibilitychange` back to
  visible after a missed period catches up. A backgrounded tab is throttled by
  the browser but never stopped, so skipping costs nothing and the catch-up is
  what makes it safe.
- Sign-out (`status === "anon"`) calls `resetNotificationsCache()`, which stops
  the timer and empties the list. So does a change of signed-in identity — an
  OTP verify can swap users inside one tab **without** passing through `anon`,
  and `startNotificationsPolling` compares its key for exactly that case.
- A response that lands after a reset is discarded by a `version` guard, the
  same defence `src/lib/wallet-balance.ts` uses. Both are needed: one stops new
  fetches, the other stops an old one repainting the next user's session.

### Terminal versus transient

| Response                        | What happens                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 501 `NOTIFICATIONS_UNAVAILABLE` | No connect-api on this deployment. List settles empty, timer stops **for good**, bell never renders.           |
| 403 `NOT_DEVELOPER_SESSION`     | Same. An admin session sees nothing rather than an error.                                                      |
| anything else                   | Previous list is kept, polling continues. A blinked request must not blank a bell that was right a minute ago. |

## 2. The endpoints

[packages/eps-backend/src/http/notifications.ts](../../packages/eps-backend/src/http/notifications.ts),
mounted unconditionally in `app.ts` beside `mountDashboard` — so the flag can be
flipped with a frontend-only deploy.

| Route                          | Upstream                                             |
| ------------------------------ | ---------------------------------------------------- |
| `POST /notifications`          | interaction **10010**, plus **10023** delivery marks |
| `POST /notifications/:id/read` | interaction **10012**, `notification_status: 1`      |

**Both are POST, including the list.** Serving the list runs an upstream
transaction _and_ marks delivery, so it is neither safe nor idempotent, and a
link prefetcher or retrying proxy must not be able to trigger it.

CSRF is covered the way every other cookie-authenticated POST here is: `app.ts`
installs `cors({ origin: cfg.corsOrigins, credentials: true })`, and the JSON
content type forces a preflight an unlisted origin fails.

**Not cached in KV**, unlike `/dashboard`, and deliberately: `read` is mutated by
our own POST _and_ by Eloka, so a TTL'd list would keep the unread bubble lit
after the user cleared it, and a cache hit would hide the real `delivery_status`
from the delivery pass. The rate limiter is what protects upstream — 30 list
calls and 60 read calls per `RL_WINDOW_SEC` (600 s), keyed on `claim.sub` rather
than `claim.sid` so a re-login neither resets the quota nor leaves a new key
behind.

### The status interactions do not answer like the list does

`connect.interact` is used for all three, but the **envelope rule differs**, and
getting this wrong made every read return 502:

| Interaction       | Rule                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| 10010 (list)      | `Number(status) !== 0` is a failure. It owes us data, so silence is a fault.                   |
| 10012 (read)      | Only an **explicit non-zero** `status` is a failure. A missing `status` is an accepted update. |
| 10023 (delivered) | Response ignored entirely.                                                                     |

Nothing upstream ever promised a `status: 0` for a status update — Eloka's
`updateEMS` fires 10012 and 10023 and inspects **only the transport error**, never
the envelope. Applying the list's strict rule to 10012 therefore invented a
failure out of an envelope that simply had no `status` field. The route now logs
the envelope's key names whenever a read is refused _or_ answers without a status,
so the real shape is recorded rather than guessed at.

All three also send **`source: "EPS"`**. Eloka's fetcher adds `source` to every
interaction, and the EMS ones read it; the list call had it from the start and the
two status calls did not.

**Delivery marking (10023)** is best-effort and at-most-once: capped at 20 per
poll, ≤5 in flight, started before the response is written and not awaited. A
lost mark costs nothing — upstream re-reports the item as undelivered and the
next poll retries it. This is only safe because eps-backend is a long-lived Node
process on a VM; on a serverless/edge runtime the process can be frozen the
moment the response flushes, and the calls would have to be awaited.

## 3. The view

Normalized server-side in
[notificationsView.ts](../../packages/eps-backend/src/http/notificationsView.ts),
never passed through. `NotificationView`:

```ts
{ id, title, body, preview[], markdown, image?, youtube?, qrCode?,
  link?, linkLabel?, notifyTime, priority, state, read, fresh }
```

Validation rules, each pinned by a test in `notifications.test.ts`:

| Field                         | Rule                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification_type`           | **Fail closed.** Missing → NORMAL (what EMS omits for plain announcements); anything present and not numerically `0`, including unparseable, is dropped. Treating an unknown type as NORMAL is how an ad or a COMMAND would leak in.                                                                                |
| `id`                          | Positive integer, else the row is dropped. Also the **dedupe key** — see below.                                                                                                                                                                                                                                     |
| `notify_time` / `expiry_time` | An **IST wall clock with no zone** (`"2021-03-05 14:00:00"`). `new Date(that)` reads it as the _host's_ local time — a silent 5h30m error between a laptop and the UTC VM. Parsed with `IST_OFFSET_MS` from `dashboardRange.ts`. Unparseable `notify_time` → the fetch time; unparseable `expiry_time` → no expiry. |
| scheduling                    | Expired items are dropped (closing Eloka's open TODO), and so are **future-dated** ones — EMS can hold scheduled announcements, and an early one would both list and toast as if published.                                                                                                                         |
| `link`                        | Absolute `http(s)` only. Eloka's links are Eloka SPA routes (`/transaction/252/626`) that would 404 inside this site; this also blocks `javascript:`. `link_label` survives only with a link.                                                                                                                       |
| `image`                       | **HTTPS only** — an `http:` image is mixed content and an unencrypted beacon. Rendered with `referrerPolicy="no-referrer"`.                                                                                                                                                                                         |
| `youtube`                     | Exactly an 11-character video id. Historically this field has also held URLs and embed snippets.                                                                                                                                                                                                                    |
| `qr_code`                     | Opaque, ≤2048 chars, never interpreted server-side.                                                                                                                                                                                                                                                                 |
| `desc`                        | Kept whole as `body`; `preview` is its first three non-empty lines with markdown syntax stripped, for rows and the toast.                                                                                                                                                                                           |
| `priority` / `state`          | Clamped to 1–3, defaulting to 2 and 1.                                                                                                                                                                                                                                                                              |
| `delivery_status`             | `0` → `fresh: true`, which is what the toast keys on.                                                                                                                                                                                                                                                               |

**Deduped by `id`, not by content.** Eloka compares a content tuple, which
collapses two distinct announcements that happen to share their text — and then
marking one read makes the other reappear next poll. (Eloka's tuple is partly
dead anyway: it compares freshly allocated `poll` arrays with `===`.) Sorted
newest-first **explicitly**, because the toast rule depends on an ordering Eloka
only assumes, then capped at 50.

## 4. The surfaces

- **Bell** — `src/components/notifications/NotificationBell.tsx`, mounted in each
  of `Header.tsx`'s two breakpoint clusters. On desktop it takes the **globe's
  slot**, between the search button and the account menu; the language control
  moves into `UserMenu` for a signed-in user (a `DropdownMenuSub` after Console,
  sharing `@/lib/google-translate` with the standalone `LanguageSelector`, so the
  two cannot disagree about the current language). Two mounts rather than one
  shared node: the clusters are separate DOM branches and the bell has to sit
  _between_ two of the desktop cluster's own children. Radix portals the panel
  only while it is open, so the inactive copy costs one hidden button.
  Renders `null` until the first poll returns something — Eloka's rule, and also
  what keeps the prerendered markup honest (the store's server snapshot is empty,
  so both trees agree and the bell appears after hydration commits). See
  [ssg-hydration.md](../ssg-hydration.md).
- **The panel is the bell's**, and the console card's "View all" opens it through
  `requestNotificationPanel()` / `subscribeNotificationPanel()` in the store — the
  two live in different subtrees, so a channel there beats lifting the popover's
  open state into a context only two components would read.
- **Row, list, detail** — `NotificationList.tsx`, shared by the bell and the card.
- **Rich media** — `NotificationMedia.tsx`, behind `React.lazy`. Markdown, video
  and QR live here so `react-markdown` and `qrcode` stay out of the entry bundle
  the bell would otherwise drag onto every page of the site.
  - _Markdown_ renders through `MarkdownProse`, which runs react-markdown
    **without `rehype-raw`** — raw HTML in the source is inert text. That is what
    makes an upstream-authored string safe to render; keep it that way.
  - _Video_ draws a local poster and only swaps in a `youtube-nocookie` iframe
    after a click. Not even the thumbnail is fetched first: opening a
    notification should not tell Google that this partner opened it.
  - _QR_ encodes the payload client-side and prints the raw string beneath it,
    selectable, for when the code will not scan.
  - _Poster image_ opens in the **full-screen file viewer** — the same
    `FileViewDialog` the KYC upload preview uses, which zooms and pans. It is
    reached through `useOptionalConnectDialogs()`; `ConnectDialogProvider` is
    mounted at the app root (`App.tsx` **and** `AppServer.tsx`) precisely because
    the bell renders in the header, above pages that host no dialog stack of
    their own. Without a host the poster stays a plain picture rather than
    throwing.
- **Console card** — `src/components/console/NotificationsCard.tsx`: the top 5
  **unread** items on Home, with a "View all (n)" link in its header. Home is a
  working page, so the card is a to-do list rather than an archive; the bell's
  panel is where read items still live. Matches Eloka's widget in `unreadOnly`
  mode. Renders nothing when nothing is unread.
  - The link appears whenever the card is hiding something — past the row cap
    **or** as soon as anything has been read, since read items never appear here.
  - Two traps, both pinned by `NotificationsCard.test.tsx`: the open item is
    resolved against the FULL list (opening a row marks it read, which drops it
    out of `unread` on the next render), and the "nothing unread" early return
    also checks that nothing is open — otherwise opening the last unread item
    unmounts the dialog the click just opened.

### Toast

Fired from inside `poll()` — module scope, so it happens once per fetch per tab
however many components are mounted.

- The **newest unread** item, not `items[0]`: Eloka reads index zero and so says
  nothing whenever the newest item is read and an older one is not.
- Only `fresh` items (upstream had never delivered them). Without that, a
  partner's first-ever poll would announce a months-old unread notification as
  though it had just been published.
- Suppressed by `localStorage["eps.notif.last"] = { u: userKey, id }`.
  localStorage, not sessionStorage — surviving a reload is the whole job. A
  different user on the same machine still gets their own toast.
- 30 s for `priority >= 3`, 8 s otherwise. Eloka uses **one hour** for high
  priority; here the toaster is bottom-left, directly above the Zoho SalesIQ
  launcher, and an hour-long toast over it is a bug rather than a signal.

## 5. Deliberately not ported from Eloka

- **Ads and customer-ads** (types 2 and 3) — retailer marketing, no place in a
  developer console, and dropped at the BFF so the copy never reaches the page.
- **COMMAND notifications** (type 1) — a remote "clear cache / reload"
  instruction channel. Handing upstream that lever over this site is a bad idea
  independent of scope.
- **Polls** — Eloka parses them and never renders them, and there is no working
  submit path to port.
- **KBar/CommandBar registration** — this repo has a `CommandPalette`; wiring
  notifications into it is a second feature.
- **`DISMISSED` (status 2)** — no caller, so the route does not accept it.
- **Toast click-through** — informational only for now; opening the detail from a
  toast needs an open-request channel from the store into whichever bell is
  mounted.
- **`intervalId` in React state** — module-scope `let timer` removes Eloka's
  whole `if (!intervalId)` dance.

## 6. Phase 2: web push

Out of scope here, and greenfield in both repos — Eloka has no service worker,
no `web-push` dependency and no VAPID configuration. What it would add: a
service worker, a subscription endpoint on the BFF, and permission UI. What it
would **not** have to add: the normalizer, which already lives server-side in
`notificationsView.ts` precisely so a pushed payload can go through the same
validation as a pulled one.
