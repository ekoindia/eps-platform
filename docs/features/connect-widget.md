# Embedded Eko Connect widget

The console can render Eko Connect transaction flows inline, instead of
hand-building a form per product. First use: **Load E-value** — the `＋` on the
E-value card opens `/console/transaction/491`.

Eko Connect is a no-code transaction-flow builder. `<tf-wlc-widget>` is its
Polymer v1 renderer, the same component Eloka (`wlc-webapp`) embeds at
`/transaction/[...id]`.

Status: **off by default** (`VITE_SHOW_CONNECT_WIDGET=false`). One prerequisite
is unverified — see [Blockers](#blockers).

## Why this needed a token endpoint

The widget authenticates by reading `sessionStorage` in the host page's own
realm. From its shipped bundle (`TfApiBehavior._getAPIDefaultHeaders`):

```js
t = e.crmtoken  ? sessionStorage.getItem("access_token_crm")
  : e.fulltoken ? sessionStorage.getItem("access_token")
  :               sessionStorage.getItem("access_token_lite");
if (t === "undefined" || !t) t = sessionStorage.getItem("access_token");
headers = { Authorization: "Bearer " + t };
```

It has no token prop and no postMessage API. It works in Eloka because HTML
imports execute in the importing document's realm — same origin, same
`sessionStorage`. An iframe on `ekoconnect.in` would have a *different*
`sessionStorage` we cannot write.

This app's posture is the opposite: the session is an HttpOnly cookie (`eps_at`)
that browser JS never sees. So supporting the widget required deliberately
publishing an upstream credential to the browser.

### What is exposed, and what is not

Grepping the 1.4 MB bundle narrowed this considerably:

| Token | Occurrences | Exposed? |
| --- | --- | --- |
| `access_token_lite` | every transaction call | **yes** |
| `access_token_crm` | one `/crm/updateProdDeal` ping | **yes** |
| `access_token` (full) | `fulltoken` flag appears **once** — its own definition; no call site passes it | **no** |
| `refresh_token` | never read by the widget | **no** |

Because setting `access_token_lite` means the full-token fallback never fires,
the full access token and the refresh token stay server-side. `access_token_lite`
carries `{org_id, is_org_admin, user_id, code, eko_user_id, user_type, email}`;
`access_token_crm` carries `{org_id, zoho_id}`.

**Accepted trade-off:** those two tokens are XSS-readable while a flow is on
screen. They are written on widget mount and removed on unmount, on sign-out, and
on session expiry (`AuthProvider`).

## Moving parts

| Piece | File |
| --- | --- |
| Token endpoint | `packages/eps-backend/src/http/connect.ts` |
| Upstream read seam | `AuthProvider.getUpstream` (`src/auth/provider.ts`) |
| Token storage | `src/lib/connect/token.ts` |
| Interaction list → `role_trxn_list` | `src/lib/connect/interactions.ts` |
| Polyfill + HTML import loader | `src/lib/connect/runtime.ts` |
| Widget events → console | `src/lib/connect/widget-events.ts` |
| The component | `src/components/connect/ConnectWidget.tsx` |
| Route | `src/pages/console/ConnectTransaction.tsx` |

### Backend

`/connect/*` is mounted **only when `CONNECT_API_BASE_URL` is set**, so under the
`eko` auth provider the token-bearing routes do not exist at all.

- `GET /connect/token` → `{ accessTokenLite, accessTokenCrm, expiresAt }`,
  `Cache-Control: no-store`, rate-limited per `sid`.
  - `401 NO_SESSION` · `403 NOT_DEVELOPER_SESSION` · `501 CONNECT_UNAVAILABLE`
    (no `sid`, i.e. the `eko` provider) · `401 CONNECT_SESSION_EXPIRED` (sealed
    session gone) · `502 CONNECT_TOKEN_MISSING` (upstream minted no lite token).
- `GET /connect/interactions` → `{ interactions }`. Proxied rather than called
  from the browser **because it needs the full token**.

### Frontend ordering

Tokens are written *before* the runtime loads. The widget starts calling
connect-api the moment it upgrades, and a request that beats the token into
storage goes out as `Bearer null`.

`iron-signal` events are mapped in `widget-events.ts`:

| Event | Effect |
| --- | --- |
| `update-status` | `resetWalletBalanceCache()` — the flow moved the balance |
| `login-again` | `POST /auth/refresh` (re-seals upstream) then republish the lite token |
| `goto-transaction` / `goto-history` | in-app navigation |
| `open-url` | internal route, or `window.open(…, "noopener,noreferrer")` |

## Configuration

Backend and frontend must point at the **same environment** — the widget's API
host is compiled into its bundle and is never told where to call.

```
# eps-backend
CONNECT_API_BASE_URL=https://api.beta.ekoconnect.in

# frontend
VITE_CONNECT_WIDGET_URL=https://beta.ekoconnect.in
VITE_SHOW_CONNECT_WIDGET=true
```

## Blockers

1. **connect-api CORS must allowlist the console origin.** Every widget request
   is a cross-origin browser call from `eko.in` to `api.beta.ekoconnect.in`.
   Eloka works because *its* origin is allowlisted. **Unverified** — this needs a
   change on connect-api and cannot be fixed from this repo. Until then the flag
   stays false.
2. ~~CSP~~ — not an issue: this repo sets no Content-Security-Policy
   (`vercel.json` carries only cache and content-type headers).

## Not built

Eloka's wrapper also handles camera capture, image editing, file viewing, print
receipts and raise-issue ticketing. Those are follow-on work. KBar/command-bar
actions and the Android PubSub bridge are explicitly out of scope — neither has a
counterpart here.

## Gotcha: `id` vs `interaction_type_id`

`/connect/interactions` rows carry **both**, and they are different things.

```json
{ "id": 491, "interaction_type_id": 0, "behavior": 7, "label": "Load E-value" }
```

`id` is the interaction id — what routes use, and what `group_interaction_ids`
references. `interaction_type_id` is the *type*, and is `0` for every composite
interaction (491, 240, 536, 7775 …). `role_trxn_list` must be keyed by `id`;
keying by the type collapses every composite onto `"0"` and the entitlement
lookup finds nothing.

Rows are passed through whole rather than narrowed to a modelled subset. The
widget reads more than a label from them — `behavior`, `group_interaction_ids`,
`icon`, `uri` — and Load E-value (491) is `behavior: 7`, a grid whose children
come from `group_interaction_ids`, so a trimmed row renders an empty grid.

Entitlement is *presence* in the list, not `is_visible`: both 491 and 240 arrive
with `is_visible: "0"`, exactly as Eloka sees them.

## Gotcha: React 19 sets properties, not attributes

Do **not** pass the widget's inputs through JSX, and do not `JSON.stringify` them.

React 19 assigns *properties* on an upgraded custom element where older React set
attributes. Polymer only JSON-parses values that arrive as **attributes**, so a
stringified object lands on the property as a raw string and the widget throws:

```
TypeError: Cannot use 'in' operator to search for '491' in {"22":{...},"24":{...}}
```

…from its own `interaction_id in role_trxn_list`. Eloka stringifies safely only
because it runs an older React.

`syncWidgetProps` in `ConnectWidget.tsx` therefore assigns real objects as DOM
properties through a ref, with `interaction_id` set **last** — it is the observed
property that starts the flow, so everything else must already be in place.

## Verifying

```bash
npm run backend:test -- src/http/connect.test.ts
npx vitest run src/lib/connect src/hooks/use-app-link.test.ts \
  src/components/console/WalletBalance.connect.test.tsx
```

jsdom cannot load an HTML import, so the widget itself is only testable in a real
browser: sign in to `/console` on a UAT mobile, confirm the `＋`, open the flow,
and check DevTools for a `Bearer` header with **no CORS error**. Complete a UAT
load and the E-value card should update without a manual refresh.
