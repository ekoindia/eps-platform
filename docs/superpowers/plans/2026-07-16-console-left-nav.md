# Console Left Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single `/console` page into a left-nav shell with two sub-pages — Home (`/console`) and Credentials (`/console/credentials`).

**Architecture:** A new `ConsoleLayout` owns the auth gate (loading / anon / signup-redirect / admin) and, for a developer session, renders a 16rem left rail plus `<Outlet context={me}>`. Sub-pages read the session via `useConsoleMe()` and contain no auth logic. `src/pages/Console.tsx` is deleted; its two halves become the two sub-pages.

**Tech Stack:** React 18, react-router-dom v6 (nested routes, `NavLink`, `useOutletContext`), Tailwind, shadcn/ui (`Card`, `Sheet`, `Button`, `Skeleton`), lucide-react icons, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-16-console-left-nav-design.md`

## Global Constraints

- **Indentation is tabs.** Every file in `src/` uses tabs. Match it.
- **Console is client-only.** Do NOT add `/console/credentials` to `ssg/routes.ts` or
  `PRERENDER_ROUTES`, and do NOT create a `.md` twin. The console is `noindex,nofollow`
  and behind auth. The existing comment `{/* Auth — client-only (intentionally excluded
  from PRERENDER_ROUTES) */}` marks the block in both route files.
- **Every route goes in BOTH `src/App.tsx` (lazy) and `src/AppServer.tsx` (eager).** The
  two files mirror each other; a route in one and not the other renders a 404 in SSG.
- **The UAT keypair is deliberately public.** It is already published anonymously in
  `llms.txt`. Do not add lifecycle gating around it. See the header comment in
  `src/lib/uat-credentials.ts`.
- **No new dependencies.** `lucide-react`, `react-router-dom`, and every shadcn component
  used here are already installed.
- **JSDoc on every new exported function/component** (per repo convention — see the
  existing docblocks in `src/pages/Console.tsx`).
- Run tests with `npx vitest run <path>`. Lint with `npx eslint <path>`.

---

### Task 1: Console shell — layout, rail, nested routes, sub-pages

Splits `src/pages/Console.tsx` into three files and wires nested routes. The Credentials
page carries the UAT block only; the production block is Task 2. At the end of this task
the console behaves exactly as it does today, except the credentials live at their own URL
and a rail links the two pages.

**Files:**
- Create: `src/components/console/ConsoleLayout.tsx`
- Create: `src/components/console/ConsoleLayout.test.tsx`
- Create: `src/pages/console/ConsoleHome.tsx`
- Create: `src/pages/console/ConsoleHome.test.tsx`
- Create: `src/pages/console/Credentials.tsx`
- Create: `src/pages/console/Credentials.test.tsx`
- Delete: `src/pages/Console.tsx`
- Delete: `src/pages/Console.test.tsx` (its cases are redistributed across the three new test files)
- Modify: `src/App.tsx:42` (lazy import), `src/App.tsx:129` (route)
- Modify: `src/AppServer.tsx:61` (import), `src/AppServer.tsx:149` (route)

**Interfaces:**
- Consumes: `useAuth()` → `{ state: AuthState }` from `@/lib/auth/AuthProvider`, where
  `AuthState = {status:"loading"} | {status:"anon"} | {status:"authed"; role:"developer";
  me: MeView} | {status:"authed"; role:"admin"; me: AdminView} | {status:"authed";
  role:"signup"; me: SignupView}`. `MeView = { state: Lifecycle; mobile: string; profile:
  Profile | null; zohoId: string | null }`. `Lifecycle = "lead" | "onboarded" | "active" |
  "inactive" | "unknown"`. `uatCredentials(): UatCredentials | null` from
  `@/lib/uat-credentials`, where `UatCredentials = { developerKey: string; accessKey:
  string }`. `CopyButton` from `@/pages/ai/CommandBlock` with props `{ text: string; label:
  string }`.
- Produces: `ConsoleLayout` (default export of `@/components/console/ConsoleLayout`);
  `useConsoleMe(): MeView` (named export of the same module) — Task 2 uses this.

- [ ] **Step 1: Write the failing layout test**

Create `src/components/console/ConsoleLayout.test.tsx`. It stubs the sub-pages with
sentinel text so the layout is tested in isolation from page content:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";
import ConsoleLayout from "@/components/console/ConsoleLayout";
import type { AuthState } from "@/lib/auth/AuthProvider";

let mockState: AuthState = { status: "loading" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/components/auth/LoginForm", () => ({
	LoginForm: () => <div>login-form</div>,
}));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
	...(await orig<typeof import("react-router-dom")>()),
	useNavigate: () => mockNavigate,
}));

const DEVELOPER: AuthState = {
	status: "authed",
	role: "developer",
	me: { state: "active", mobile: "999", profile: null, zohoId: null },
};

function renderLayout(state: AuthState, path = "/console") {
	mockState = state;
	return render(
		<HelmetProvider>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/console" element={<ConsoleLayout />}>
						<Route index element={<div>home-page</div>} />
						<Route path="credentials" element={<div>creds-page</div>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</HelmetProvider>,
	);
}

describe("ConsoleLayout", () => {
	it("renders the login form and no rail when anon", () => {
		renderLayout({ status: "anon" });
		expect(screen.getByText("login-form")).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Console" })).toBeNull();
		expect(screen.queryByText("home-page")).toBeNull();
	});

	it("shows a skeleton while loading", () => {
		renderLayout({ status: "loading" });
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});

	it("greets an admin session without a rail", () => {
		renderLayout({
			status: "authed",
			role: "admin",
			me: { role: "admin", login: "octo", sub: "gh:octo" },
		});
		expect(screen.getByText(/octo/i)).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Console" })).toBeNull();
	});

	it("redirects a signup session back to /signup instead of rendering an empty console", () => {
		renderLayout({
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		});
		expect(mockNavigate).toHaveBeenCalledWith("/signup", { replace: true });
		// Not blank: shows the same loading skeleton the `loading` state shows,
		// rather than an empty body while the redirect is in flight.
		expect(screen.getByTestId("console-loading")).toBeInTheDocument();
	});

	it("renders the rail and the child route for a developer", () => {
		renderLayout(DEVELOPER);
		expect(screen.getByText("home-page")).toBeInTheDocument();
		const links = screen.getAllByRole("link", { name: /credentials/i });
		expect(links[0]).toHaveAttribute("href", "/console/credentials");
	});

	it("renders the credentials child route at /console/credentials", () => {
		renderLayout(DEVELOPER, "/console/credentials");
		expect(screen.getByText("creds-page")).toBeInTheDocument();
	});

	it("passes the session to the child route via outlet context", () => {
		mockState = DEVELOPER;
		render(
			<HelmetProvider>
				<MemoryRouter initialEntries={["/console"]}>
					<Routes>
						<Route path="/console" element={<ConsoleLayout />}>
							<Route index element={<ContextProbe />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</HelmetProvider>,
		);
		expect(screen.getByText("state:active")).toBeInTheDocument();
	});
});

function ContextProbe() {
	const me = useConsoleMe();
	return <div>state:{me.state}</div>;
}
```

Add `useConsoleMe` to the import at the top:

```tsx
import ConsoleLayout, { useConsoleMe } from "@/components/console/ConsoleLayout";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/console/ConsoleLayout.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/console/ConsoleLayout"`.

- [ ] **Step 3: Write ConsoleLayout**

Create `src/components/console/ConsoleLayout.tsx`. The nav array, the rail, and the
skeleton are internal to this file — two nav items do not earn their own module.

```tsx
import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { MeView } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { KeyRound, LayoutDashboard, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
	Link,
	NavLink,
	Outlet,
	useNavigate,
	useOutletContext,
} from "react-router-dom";

/**
 * Console rail items. Flat by design: developer consoles only reach for
 * uppercase group captions past ~5 items, and there are two.
 */
const NAV_ITEMS = [
	{ to: "/console", label: "Home", icon: LayoutDashboard, end: true },
	{
		to: "/console/credentials",
		label: "Credentials",
		icon: KeyRound,
		end: false,
	},
] as const;

/**
 * The signed-in developer, as handed down by `ConsoleLayout` through the router
 * outlet. Console sub-pages render only inside the developer branch of the
 * gate, so this is never null.
 */
export function useConsoleMe(): MeView {
	return useOutletContext<MeView>();
}

/** The rail itself — shared by the desktop aside and the mobile Sheet. */
function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<nav className="flex flex-col gap-0.5 text-sm" aria-label="Console">
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.to}
					to={item.to}
					end={item.end}
					onClick={onNavigate}
					className={({ isActive }) =>
						cn(
							"flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
							isActive
								? "bg-muted font-medium text-eko-navy"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)
					}
				>
					<item.icon className="h-4 w-4 shrink-0" />
					<span>{item.label}</span>
				</NavLink>
			))}
		</nav>
	);
}

/** Placeholder card shown while the session resolves (or a redirect is in flight). */
function ConsoleLoading() {
	return (
		<div data-testid="console-loading" className="max-w-2xl">
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-40" />
					<Skeleton className="mt-2 h-4 w-64" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-9 w-28" />
				</CardContent>
			</Card>
		</div>
	);
}

/**
 * Console shell: owns every auth branch, and renders the left rail plus the
 * active sub-page for a developer session. Sub-pages read the session with
 * `useConsoleMe()` and carry no auth logic of their own.
 */
export default function ConsoleLayout() {
	const { state } = useAuth();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	// A signup session hasn't finished onboarding — it has no console to show.
	// Send it back to `/signup` to resume the wizard. Mirror of the redirect
	// SignupPage.tsx already does in the other direction (`role !== "signup"`
	// → `/console`); the two conditions are disjoint by construction, so
	// neither page can bounce a session straight back to the other.
	useEffect(() => {
		if (state.status === "authed" && state.role === "signup") {
			navigate("/signup", { replace: true });
		}
	}, [state, navigate]);

	// While the redirect above is in flight (or on the loading state that also
	// has nothing to render yet), show the loading skeleton instead of a blank
	// body — no branch below matches role: "signup".
	const showLoading =
		state.status === "loading" ||
		(state.status === "authed" && state.role === "signup");

	const developer =
		state.status === "authed" && state.role === "developer" ? state.me : null;

	return (
		<>
			<Helmet>
				<title>Developer Console — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 min-h-[60vh]">
				<h1 className="text-2xl font-bold text-eko-navy mb-8">
					Developer Console
				</h1>
				{showLoading ? <ConsoleLoading /> : null}
				{state.status === "anon" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Log in</CardTitle>
							<CardDescription>
								Sign in with your mobile number to access your EPS console.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LoginForm />
						</CardContent>
					</Card>
				) : null}
				{state.status === "authed" && state.role === "admin" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Admin</CardTitle>
							<CardDescription>
								Signed in as {state.me.login ?? state.me.sub}.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="self-start">
								<Link to="/admin">Open Admin Console</Link>
							</Button>
						</CardContent>
					</Card>
				) : null}
				{developer ? (
					<div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
						{/* Mobile: the rail collapses behind a Sheet, mirroring DocsLayout. */}
						<div className="lg:hidden">
							<Sheet open={open} onOpenChange={setOpen}>
								<SheetTrigger asChild>
									<Button variant="outline" size="sm" className="gap-2">
										<Menu className="h-4 w-4" />
										Console menu
									</Button>
								</SheetTrigger>
								<SheetContent side="left" className="w-72 p-4 pt-10">
									<ConsoleNav onNavigate={() => setOpen(false)} />
								</SheetContent>
							</Sheet>
						</div>
						{/* Desktop: sticky under the fixed ~88px site header. */}
						<aside className="hidden lg:block">
							<div className="sticky top-28">
								<ConsoleNav />
							</div>
						</aside>
						<div className="min-w-0 max-w-2xl">
							<Outlet context={developer} />
						</div>
					</div>
				) : null}
			</main>
			<Footer />
		</>
	);
}
```

Note: on `<lg` the Sheet trigger and the content are both grid children in a
single-column grid, so the trigger sits above the page content. Rendering the rail in
both places is why `ConsoleNav` is a component and not inline JSX.

- [ ] **Step 4: Run the layout test to verify it passes**

Run: `npx vitest run src/components/console/ConsoleLayout.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write the failing ConsoleHome test**

Create `src/pages/console/ConsoleHome.test.tsx`. It provides the outlet context with a
bare `<Outlet context={me} />` parent, which is exactly how `ConsoleLayout` supplies it:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ConsoleHome from "@/pages/console/ConsoleHome";
import type { MeView } from "@/lib/auth/client";

function renderHome(me: MeView) {
	return render(
		<MemoryRouter initialEntries={["/console"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route index element={<ConsoleHome />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

describe("ConsoleHome", () => {
	it("shows the lead onboarding CTA for a lead developer", () => {
		renderHome({ state: "lead", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText(/start onboarding/i)).toBeInTheDocument();
	});

	it("shows the active integration overview for an active developer", () => {
		renderHome({
			state: "active",
			mobile: "999",
			profile: { name: "Asha" } as never,
			zohoId: null,
		});
		expect(screen.getByText(/integration overview/i)).toBeInTheDocument();
		expect(screen.getByText(/signed in as asha/i)).toBeInTheDocument();
	});

	it("falls back to the mobile number when there is no profile", () => {
		renderHome({ state: "active", mobile: "999", profile: null, zohoId: null });
		expect(screen.getByText(/signed in as 999/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/pages/console/ConsoleHome.test.tsx`
Expected: FAIL — `Failed to resolve import "@/pages/console/ConsoleHome"`.

- [ ] **Step 7: Write ConsoleHome**

Create `src/pages/console/ConsoleHome.tsx`. `STATE_COPY` and the card move over from
`Console.tsx` verbatim; the only change is that `<ApiCredentials />` is gone (it lives on
the Credentials page now) and `me` comes from the outlet instead of a prop.

```tsx
import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Lifecycle } from "@/lib/auth/client";
import { Link } from "react-router-dom";

const STATE_COPY: Record<
	Lifecycle,
	{
		badge: string;
		title: string;
		body: string;
		cta?: { label: string; href: string };
	}
> = {
	lead: {
		badge: "Lead",
		title: "Ready to onboard?",
		body: "Complete onboarding to activate your EPS account and unlock API access.",
		cta: { label: "Start onboarding", href: "/signup" },
	},
	onboarded: {
		badge: "Onboarded",
		title: "Finish setup",
		body: "Your account is created. Finish the remaining steps to go live.",
		cta: { label: "Continue setup", href: "/docs" },
	},
	active: {
		badge: "Active",
		title: "Integration overview",
		body: "Your account is active. Explore the docs and APIs to integrate.",
		cta: { label: "Browse API docs", href: "/docs" },
	},
	inactive: {
		badge: "Inactive",
		title: "Account inactive",
		body: "Your account is currently inactive. Please contact support to reactivate.",
		cta: { label: "Contact support", href: "/grievance" },
	},
	unknown: {
		badge: "Pending",
		title: "Welcome",
		body: "We could not find an EPS profile for this number yet. Onboard to get started.",
		cta: { label: "Start onboarding", href: "/signup" },
	},
};

/** Console Home: the lifecycle-state overview card for a signed-in developer. */
export default function ConsoleHome() {
	const me = useConsoleMe();
	const copy = STATE_COPY[me.state];
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-3">
					<CardTitle>{copy.title}</CardTitle>
					<Badge variant="secondary">{copy.badge}</Badge>
				</div>
				<CardDescription>{copy.body}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">
					Signed in as {me.profile?.name || me.mobile}
				</p>
				{copy.cta ? (
					<Button asChild className="self-start">
						<Link to={copy.cta.href}>{copy.cta.label}</Link>
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/pages/console/ConsoleHome.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 9: Write the failing Credentials test**

Create `src/pages/console/Credentials.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Credentials from "@/pages/console/Credentials";
import type { MeView } from "@/lib/auth/client";

function renderCredentials(me: MeView) {
	return render(
		<MemoryRouter initialEntries={["/console/credentials"]}>
			<Routes>
				<Route path="/console" element={<Outlet context={me} />}>
					<Route path="credentials" element={<Credentials />} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

const ACTIVE: MeView = {
	state: "active",
	mobile: "999",
	profile: null,
	zohoId: null,
};

describe("Credentials", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("shows the UAT keypair", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");
		renderCredentials(ACTIVE);
		expect(screen.getByText("dev-key-123")).toBeInTheDocument();
		expect(screen.getByText("access-key-456")).toBeInTheDocument();
	});

	it("shows the UAT keypair to a pre-onboarding developer too", () => {
		// DELIBERATE: the same keypair is published anonymously in llms.txt, so
		// gating it by lifecycle state would protect nothing.
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");
		renderCredentials({ ...ACTIVE, state: "lead" });
		expect(screen.getByText("dev-key-123")).toBeInTheDocument();
	});

	it("falls back to the placeholder when no UAT keypair is configured", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");
		renderCredentials(ACTIVE);
		expect(
			screen.getByText(/will appear here once issued/i),
		).toBeInTheDocument();
	});
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npx vitest run src/pages/console/Credentials.test.tsx`
Expected: FAIL — `Failed to resolve import "@/pages/console/Credentials"`.

- [ ] **Step 11: Write Credentials (UAT block only)**

Create `src/pages/console/Credentials.tsx`. `CredentialRow` and `ApiCredentials` move over
from `Console.tsx` verbatim. The production block is Task 2 — do not add it here.

```tsx
import { uatCredentials } from "@/lib/uat-credentials";
import { CopyButton } from "@/pages/ai/CommandBlock";

/** One `label / value / copy` row of the UAT credentials block. */
function CredentialRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
				{label}
			</span>
			<code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
				{value}
			</code>
			<CopyButton text={value} label={`Copy ${label}`} />
		</div>
	);
}

/**
 * UAT keypair block. Shown to every signed-in developer regardless of lifecycle
 * state: the same keypair is already published anonymously in llms.txt, so
 * gating it here would protect nothing (see `uatCredentials`). Falls back to the
 * "not issued yet" note when the build env has no keypair configured.
 */
function ApiCredentials() {
	const credentials = uatCredentials();
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">
					{credentials ? "UAT API credentials" : "API credentials"}
				</p>
				<p className="text-sm text-muted-foreground">
					{credentials
						? "Shared keys for the UAT (test) environment — everyone gets the same pair, so keep test data disposable. Your production keys are issued separately."
						: "Your UAT and production API keys will appear here once issued. Contact your account manager to expedite access."}
				</p>
			</div>
			{credentials ? (
				<div className="flex flex-col gap-2">
					<CredentialRow
						label="developer_key"
						value={credentials.developerKey}
					/>
					<CredentialRow label="access_key" value={credentials.accessKey} />
				</div>
			) : null}
		</div>
	);
}

/** Console Credentials page: the shared UAT keypair for a signed-in developer. */
export default function Credentials() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">Credentials</h2>
				<p className="text-sm text-muted-foreground">
					Keys for signing EPS API requests.
				</p>
			</div>
			<ApiCredentials />
		</div>
	);
}
```

- [ ] **Step 12: Run it to verify it passes**

Run: `npx vitest run src/pages/console/Credentials.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 13: Wire the nested routes in App.tsx**

In `src/App.tsx`, replace the lazy import on line 42:

```tsx
const Console = lazy(() => import("./pages/Console"));
```

with:

```tsx
const ConsoleLayout = lazy(() => import("./components/console/ConsoleLayout"));
const ConsoleHome = lazy(() => import("./pages/console/ConsoleHome"));
const ConsoleCredentials = lazy(() => import("./pages/console/Credentials"));
```

and replace the route on line 129:

```tsx
<Route path="/console" element={<Console />} />
```

with:

```tsx
<Route path="/console" element={<ConsoleLayout />}>
	<Route index element={<ConsoleHome />} />
	<Route path="credentials" element={<ConsoleCredentials />} />
</Route>
```

Leave the `{/* Auth — client-only (intentionally excluded from PRERENDER_ROUTES) */}`
comment above it and the `/admin` route below it untouched.

- [ ] **Step 14: Wire the same routes in AppServer.tsx**

In `src/AppServer.tsx`, replace the eager import on line 61:

```tsx
import Console from "./pages/Console";
```

with:

```tsx
import ConsoleLayout from "./components/console/ConsoleLayout";
import ConsoleHome from "./pages/console/ConsoleHome";
import ConsoleCredentials from "./pages/console/Credentials";
```

and replace the route on line 149:

```tsx
<Route path="/console" element={<Console />} />
```

with the identical nested block from Step 13:

```tsx
<Route path="/console" element={<ConsoleLayout />}>
	<Route index element={<ConsoleHome />} />
	<Route path="credentials" element={<ConsoleCredentials />} />
</Route>
```

- [ ] **Step 15: Delete the old page and its test**

```bash
git rm src/pages/Console.tsx src/pages/Console.test.tsx
```

Every case from `Console.test.tsx` now lives in one of the three new test files: the gate
and redirect cases in `ConsoleLayout.test.tsx`, the lifecycle-copy cases in
`ConsoleHome.test.tsx`, and the keypair cases in `Credentials.test.tsx`. The old
"never leaks credentials to an anonymous visitor" case is covered by the layout's
"renders the login form and no rail when anon" — an anonymous visitor never reaches the
outlet, so no sub-page (and therefore no keypair) renders.

- [ ] **Step 16: Verify nothing still imports the deleted page**

Run: `grep -rn "pages/Console" src/`
Expected: no output. If anything matches, it is a stale import — fix it before committing.

- [ ] **Step 17: Run the full test suite and the linter**

Run: `npx vitest run && npx eslint src/components/console src/pages/console src/App.tsx src/AppServer.tsx`
Expected: all tests PASS, no lint errors.

- [ ] **Step 18: Commit**

```bash
git add src/components/console src/pages/console src/App.tsx src/AppServer.tsx
git commit -m "feat(console): add left-nav rail with Home and Credentials sub-pages

Splits the single /console card into nested routes behind a 16rem rail.
ConsoleLayout owns the auth gate and hands the session to sub-pages via
the router outlet, so pages carry no auth logic. Credentials get their
own shareable URL."
```

---

### Task 2: Production credentials block

Adds the production-keys section to the Credentials page. There is no button: the
credential-issuance API does not exist yet (the SimpliBank issuance contract is unknown),
and a button that cannot issue a key is worse than an honest empty state. This block is
where the fetch goes when an endpoint lands.

**Files:**
- Modify: `src/pages/console/Credentials.tsx`
- Modify: `src/pages/console/Credentials.test.tsx`

**Interfaces:**
- Consumes: `useConsoleMe(): MeView` from `@/components/console/ConsoleLayout` (Task 1);
  `Lifecycle = "lead" | "onboarded" | "active" | "inactive" | "unknown"` from
  `@/lib/auth/client`.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the failing production-copy tests**

Append these cases inside the existing `describe("Credentials", ...)` block in
`src/pages/console/Credentials.test.tsx`:

```tsx
	it("points an active developer at their account manager for production keys", () => {
		renderCredentials(ACTIVE);
		expect(screen.getByText(/production api credentials/i)).toBeInTheDocument();
		expect(screen.getByText(/issued separately/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /contact your account manager/i }),
		).toHaveAttribute("href", "/grievance");
	});

	it("tells a lead to finish onboarding before requesting production keys", () => {
		renderCredentials({ ...ACTIVE, state: "lead" });
		expect(screen.getByText(/finish onboarding/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /continue onboarding/i }),
		).toHaveAttribute("href", "/signup");
	});

	it("tells an inactive account to contact support", () => {
		renderCredentials({ ...ACTIVE, state: "inactive" });
		expect(screen.getByText(/account is inactive/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /contact support/i }),
		).toHaveAttribute("href", "/grievance");
	});

	it("never renders a production key request button", () => {
		// There is no issuance API yet. A button that cannot issue a key is a lie.
		renderCredentials(ACTIVE);
		expect(screen.queryByRole("button", { name: /fetch|request/i })).toBeNull();
	});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/pages/console/Credentials.test.tsx`
Expected: FAIL — 4 failures, `Unable to find an element with the text: /production api credentials/i`.
The 3 UAT tests from Task 1 still PASS.

- [ ] **Step 3: Add the production block**

In `src/pages/console/Credentials.tsx`, add these imports:

```tsx
import { useConsoleMe } from "@/components/console/ConsoleLayout";
import type { Lifecycle } from "@/lib/auth/client";
import { Link } from "react-router-dom";
```

Add the copy map and the block above the `Credentials` default export:

```tsx
/**
 * Production-key copy per lifecycle state. `Lifecycle` has exactly these five
 * members, so the map is total and needs no fallback branch.
 */
const PRODUCTION_COPY: Record<
	Lifecycle,
	{ body: string; cta: { label: string; href: string } }
> = {
	active: {
		body: "Production keys are issued separately from the UAT pair, once your account is provisioned.",
		cta: { label: "Contact your account manager", href: "/grievance" },
	},
	lead: {
		body: "Finish onboarding to request production keys.",
		cta: { label: "Continue onboarding", href: "/signup" },
	},
	onboarded: {
		body: "Finish onboarding to request production keys.",
		cta: { label: "Continue onboarding", href: "/signup" },
	},
	unknown: {
		body: "Finish onboarding to request production keys.",
		cta: { label: "Continue onboarding", href: "/signup" },
	},
	inactive: {
		body: "Your account is inactive, so production keys cannot be issued.",
		cta: { label: "Contact support", href: "/grievance" },
	},
};

/**
 * Production keypair block — deliberately an empty state with no request
 * button: no credential-issuance API exists yet, and a button that cannot
 * issue a key is worse than honest copy. When an endpoint lands, the fetch
 * goes here.
 */
function ProductionCredentials() {
	const me = useConsoleMe();
	const copy = PRODUCTION_COPY[me.state];
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">Production API credentials</p>
				<p className="text-sm text-muted-foreground">{copy.body}</p>
			</div>
			<Link
				to={copy.cta.href}
				className="self-start text-sm font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
			>
				{copy.cta.label}
			</Link>
		</div>
	);
}
```

Then render it in the page, below the UAT block:

```tsx
/**
 * Console Credentials page: the shared UAT keypair, plus the production-key
 * status for this account.
 */
export default function Credentials() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">Credentials</h2>
				<p className="text-sm text-muted-foreground">
					Keys for signing EPS API requests.
				</p>
			</div>
			<ApiCredentials />
			<ProductionCredentials />
		</div>
	);
}
```

Note: the `active` body says "issued separately", which the test matches with
`/issued separately/i`. The UAT block's fallback copy also contains the phrase "issued" —
the tests use distinct enough substrings (`/will appear here once issued/i` vs
`/issued separately/i`) that they do not collide.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/pages/console/Credentials.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Run the full suite and the linter**

Run: `npx vitest run && npx eslint src/pages/console`
Expected: all tests PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/console/Credentials.tsx src/pages/console/Credentials.test.tsx
git commit -m "feat(console): add production-credential status to the credentials page

Lifecycle-driven empty state, deliberately with no request button: no
issuance API exists yet, so the copy points at the account manager or
at onboarding depending on account state."
```

---

### Task 3: Verify in the browser and prune the spec

**Files:**
- Modify: `docs/superpowers/SUMMARY.md`
- Delete: `docs/superpowers/specs/2026-07-16-console-left-nav-design.md`
- Delete: `docs/superpowers/plans/2026-07-16-console-left-nav.md`

- [ ] **Step 1: Run the dev server and check the console by hand**

Run: `npm run dev`

Sign in as a developer, then confirm:
- `/console` shows the rail with Home active and the lifecycle card beside it.
- Clicking Credentials navigates to `/console/credentials`, the pill moves, and the UAT
  keys render with working copy buttons.
- Reloading `/console/credentials` lands back on Credentials, not Home. (This is the whole
  point of real routes — check it.)
- The rail is not clipped by the fixed site header, and it sticks while the page scrolls.
- Below `lg` (narrow the window), the rail collapses into the "Console menu" Sheet and
  picking an item closes it.
- Signed out, `/console/credentials` shows the login card and no rail or keys.

- [ ] **Step 2: Verify the production build**

Run: `npm run build`
Expected: build succeeds. `/console` must NOT gain a prerendered entry — the console is
client-only.

- [ ] **Step 3: Prune the spec and plan, update the index**

This repo keeps only active, not-yet-implemented designs in `docs/superpowers/`; shipped
work is pruned and the code becomes the source of truth (see `SUMMARY.md`).

Remove the Active entry for this design from `docs/superpowers/SUMMARY.md`:

```markdown
- `specs/2026-07-16-console-left-nav-design.md` — console left-nav rail + nested routes
  (`/console` Home, `/console/credentials`), production-credential empty state.
  Design only; not yet built.
```

and add a row to the Delivered table:

```markdown
| Console left nav (rail + Home/Credentials sub-pages) | (this branch) | `docs/console-roadmap.md` |
```

Then update `docs/console-roadmap.md` to describe the shipped shape: the rail, the two
routes, and the production-credential empty state as the placeholder awaiting an issuance
API. Read that file first and match its existing structure.

- [ ] **Step 4: Delete the pruned files and commit**

```bash
git rm docs/superpowers/specs/2026-07-16-console-left-nav-design.md docs/superpowers/plans/2026-07-16-console-left-nav.md
git add docs/superpowers/SUMMARY.md docs/console-roadmap.md
git commit -m "docs(console): record the left-nav shape, prune the spec and plan"
```
