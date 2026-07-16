# Console left navigation — design

**Date:** 2026-07-16
**Status:** Design approved; not yet built.

## Problem

`/console` is a single page. Everything a signed-in developer can see — the lifecycle card
and the UAT credentials block — is stacked into one card in `src/pages/Console.tsx`. There is
no way to add a second console surface without making that card longer, and no way to link
someone directly to credentials.

The console needs a left navigation rail with sub-pages, starting with **Console Home**
(overview) and **Credentials** (UAT keys today, production keys when they exist).

## Research

Mobbin survey of developer-console navigation ([Exa][exa], [ElevenLabs][11l], [Clerk][clerk],
[Whop][whop], [Lemon Squeezy][ls], [PandaDoc][pd]) shows a strongly converged pattern:

- A ~15–16rem left rail, icon + label rows, active item as a soft filled pill.
- Tiny uppercase group captions (`Build` / `Configure` / `Monitor`) appear only once the rail
  passes roughly five items. Below that the rail is flat.
- Outbound links are marked with `↗`.
- PandaDoc combines a rail with top tabs — two nav axes for one hierarchy. Rejected as more
  machinery than two items justify.

Conclusion: flat rail, no group captions, matching the existing `/docs` rail so the console
and the docs read as one product.

[exa]: https://mobbin.com/screens/bd2e9570-bcb7-4207-b297-c12b4ff349bb
[11l]: https://mobbin.com/screens/20b3576c-0822-4726-9f20-bdc7621f9435
[clerk]: https://mobbin.com/screens/428c1eea-e837-4daa-8d03-5619ecb18ac7
[whop]: https://mobbin.com/screens/2bc7b037-c57d-47d1-9f0c-9bb1fc4e7ba1
[ls]: https://mobbin.com/screens/902af2f1-e6fd-49fc-ba01-6fc9379775e9
[pd]: https://mobbin.com/screens/79d68519-f53a-4cee-af87-32c39727a0dd

## Scope

**In:** two nav items (Home, Credentials), nested routes, the rail, a production-credentials
empty state.

**Out (explicitly):** onboarding-status page, team/profile page, usage/logs page. Each is added
when it has a real page and a real data source behind it. No usage or log backend exists today;
shipping an empty shell for one would be nav that lies.

## Architecture

### Files

| File | Change |
|---|---|
| `src/components/console/ConsoleLayout.tsx` | NEW — auth gate + rail + `<Outlet context={me}>` |
| `src/pages/console/ConsoleHome.tsx` | NEW — lifecycle card, moved out of `Console.tsx` |
| `src/pages/console/Credentials.tsx` | NEW — UAT block (moved) + production empty state |
| `src/pages/Console.tsx` | DELETE — contents split into the two pages above |
| `src/pages/Console.test.tsx` | RENAME → `src/components/console/ConsoleLayout.test.tsx` |
| `src/App.tsx` | nested routes (lazy) |
| `src/AppServer.tsx` | nested routes (eager, mirrors App.tsx) |

There is deliberately no separate `ConsoleNav.tsx`. Two items and a literal array do not earn
a file; the rail lives inside `ConsoleLayout.tsx`. Split it out when the rail grows groups.

`ssg/routes.ts` is untouched: the console is `noindex,nofollow` and behind auth, so it gets no
prerender entry and no `.md` twin.

### Auth gating

`ConsoleLayout` owns **every** non-developer branch, exactly as `Console.tsx` does today:

- `state.status === "loading"` → skeleton (keep `data-testid="console-loading"`).
- `state.status === "authed" && state.role === "signup"` → `navigate("/signup", {replace:true})`,
  render the skeleton while the redirect is in flight. This mirrors the reverse redirect in
  `SignupPage.tsx`; the two conditions stay disjoint by construction.
- `state.status === "anon"` → `LoginForm` card, no rail.
- `state.role === "admin"` → admin card with the `/admin` link, no rail.
- `state.role === "developer"` → rail + `<Outlet context={me} />`.

Child pages call `useOutletContext<MeView>()` and assume an authed developer. They contain no
auth logic and no narrowing. One gate, one place.

The rail renders **only** in the developer branch. An anonymous visitor sees the login card
alone, with no navigation to pages they cannot open.

### Routes

Identical tree in `App.tsx` (lazy) and `AppServer.tsx` (eager):

```tsx
<Route path="/console" element={<ConsoleLayout />}>
  <Route index element={<ConsoleHome />} />
  <Route path="credentials" element={<ConsoleCredentials />} />
</Route>
```

`/console` continues to render Home, so every existing link keeps working.

### The rail

Reuses the shape proven by `DocsLayout`, not its code. `DocsNavTree` is a tree over spec data
rendered at 11px inside a docs-local dark theme — the right pattern, the wrong component.

- `grid lg:grid-cols-[16rem_minmax(0,1fr)]` inside the normal page container.
- Rail is `sticky` under the fixed ~88px site header.
- Below `lg`, the rail collapses into a `Sheet` behind a "Console menu" trigger, matching the
  docs mobile toolbar.
- Items are `text-sm` (the console is not as dense as the docs tree), icon + label:
  `Home` → `LayoutDashboard`, `Credentials` → `KeyRound` (both lucide, already a dependency).
- Active pill mirrors `itemClass` in `DocsNavTree.tsx:79`:
  `bg-muted font-medium text-eko-navy`; inactive `text-muted-foreground hover:bg-muted
  hover:text-foreground`.
- `NavLink` supplies the active state from the URL. No local selection state.
- Site header and `Footer` stay. The console is part of the marketing site, consistent with
  `/docs` and `/admin`. A full-height app shell was considered and rejected: it needs new
  chrome and a route that escapes the site layout, for a two-item rail.

### Console Home

The existing `STATE_COPY` map and `DeveloperConsole` card move over unchanged, minus the
`<ApiCredentials />` call — credentials now live on their own page. Home keeps the lifecycle
badge, the "Signed in as …" line, and the state's CTA.

### Credentials page

**UAT block:** `ApiCredentials` and `CredentialRow` move over unchanged, including the current
behaviour of showing the keypair to every signed-in developer regardless of lifecycle state.
That is deliberate and stays: the same keypair is already published anonymously in `llms.txt`,
so gating it here would protect nothing. The "not issued yet" fallback for a build env with no
keypair configured is retained.

**Production block:** a section below the UAT block, driven by `me.state`. No button — the
credential-issuance API does not exist yet (the SimpliBank issuance contract is still unknown),
and a button that cannot issue a key is worse than an honest empty state.

| `me.state` | Copy | Link |
|---|---|---|
| `active` | Production keys are issued separately — contact your account manager. | `/grievance` |
| `lead`, `onboarded`, `unknown` | Finish onboarding to request production keys. | `/signup` |
| `inactive` | Your account is inactive — contact support to reactivate. | `/grievance` |

`Lifecycle` has exactly these five members, so the map is total and needs no fallback branch.

When an issuance endpoint lands, this block is where the fetch goes; nothing else changes.

## Testing

`Console.test.tsx` already mocks `useAuth`, `LoginForm`, and `Footer`, and renders the page
bare inside a `MemoryRouter`. It becomes `ConsoleLayout.test.tsx` with the same mocks:

- anon → login form renders, rail does not
- loading → `console-loading` skeleton
- `role: "signup"` → `navigate` called with `/signup`
- `role: "admin"` → admin card, rail does not render
- `role: "developer"` → rail renders with both items; the Credentials link points at
  `/console/credentials`

One new `Credentials.test.tsx`: with the UAT env keypair stubbed, the `developer_key` and
`access_key` rows render; the production copy matches the state for at least `active` and one
pre-onboarding state.

No new test infrastructure. Routing tests use `MemoryRouter initialEntries`.

## Consequences

- Every existing `/console` link keeps working; `/console/credentials` becomes shareable.
- Adding a third console page becomes an array entry plus a route, not a longer card.
- `Console.tsx` disappearing means anything importing it breaks loudly at build time, which is
  the intent — there are no such importers today beyond `App.tsx`/`AppServer.tsx`.
