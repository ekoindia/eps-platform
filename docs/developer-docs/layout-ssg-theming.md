# Layout, SSG & Docs-Local Theme

How the docs section is laid out, statically generated, and themed independently
of the rest of the site.

## The 3-pane layout

`src/components/docs/DocsLayout.tsx` — a responsive grid:

| Pane | Desktop (`lg+`) | Mobile (`<lg`) |
| --- | --- | --- |
| Left nav | fixed 16rem column (`DocsNavTree`) | collapses into a Sheet behind a menu button |
| Center content | `minmax(0,1fr)`, wrapped in a `.prose` container | full width |
| Right rail | 23rem (`xl`: 28rem) — endpoint pages only (`CodeSamples`) | stacks below content |

```tsx
<div className={cn(
	"mx-auto grid max-w-[100rem] gap-0",
	rightPane
		? "lg:grid-cols-[16rem_minmax(0,1fr)_23rem] xl:grid-cols-[16rem_minmax(0,1fr)_28rem]"
		: "lg:grid-cols-[16rem_minmax(0,1fr)]",
)}>
```

The nav tree and theme toggle are injected as props/children, not hard-wired —
guides render without a right pane, endpoints render with one. A sticky mobile
toolbar sits below the fixed site header.

## SSG / prerendering

Every docs page is prerendered to static HTML at build time; the client hydrates.

**Route enumeration** — `ssg/routes.ts` builds `PRERENDER_ROUTES`, pulling every
docs slug from the registry:

```typescript
export const PRERENDER_ROUTES: string[] = [
	"/", "/products", …,
	"/docs",
	...getAllDocSlugs().map((slug) => docsHref(slug)),  // every guide + endpoint
	…
];
```

So adding a guide or endpoint (via the registry) automatically yields a
prerendered page — no manual route list to maintain.

**Pipeline** — `vite.config.ts` runs `prerenderPlugin()` after `vite build` (skipped
in dev). It (`ssg/plugin.ts`, `ssg/prerender.ts`):

1. spins up a temporary Vite SSR server, loads `ssg/prerender.ts`;
2. for each route, renders the React tree via the SSR entry (`AppServer.tsx`);
3. post-processes the HTML — rewrites dev asset paths to hashed prod paths,
   injects `<link rel="modulepreload">` for the route's chunk (via
   `ROUTE_CHUNK_MAP`), extracts critical CSS (Beasties), minifies;
4. writes `dist/docs/<slug>/index.html`.

**Route → chunk map** (`ssg/routes.ts`) lets the prerenderer preload the right page
module per route, avoiding a bundle→chunk waterfall:

```typescript
{ pattern: /^\/docs\/.+/,  src: "src/pages/docs/DocDetailPage.tsx" },
{ pattern: /^\/docs\/?$/,  src: "src/pages/docs/DocsIndexPage.tsx" },
```

The server renders **light mode**; the client applies any saved docs theme after
mount, so there's no hydration mismatch.

## Docs-local dark theme

The docs section has its **own** dark mode, scoped to the `DocsLayout` subtree —
the rest of the site (header, footer) stays light regardless. (Commit `8b251cc`.)

**State** — `DocsLayout` holds `theme`, hydrates from `localStorage` (`THEME_KEY`),
and persists on toggle:

```tsx
const [theme, setTheme] = useState<DocsTheme>("light");
useEffect(() => {
	const saved = localStorage.getItem(THEME_KEY);
	if (saved === "dark" || saved === "light") setTheme(saved);
}, []);
const toggleTheme = () => setTheme((t) => {
	const next = t === "dark" ? "light" : "dark";
	try { localStorage.setItem(THEME_KEY, next); } catch {}
	return next;
});
```

**Scoping** — the `.dark` class is applied to the `DocsLayout` root only (not
`<html>`), so Tailwind dark utilities resolve only inside the docs subtree:

```tsx
<div className={cn("min-h-screen bg-background text-foreground", theme === "dark" && "dark")}>
```

**The `@theme inline` requirement** (`src/index.css`) — this is the load-bearing
detail. The directive keeps the semantic `--color-*: var(--token)` bindings *live*
so utilities resolve the runtime CSS vars at use-site. Without `inline`, Tailwind
would inline the `:root` value at build time and the scoped `.dark` class would
have no effect.

**Overscroll tint** — a `docs-dark` class is toggled on `<html>` (cleaned up on
unmount) so the Safari overscroll bounce area matches the docs theme instead of
flashing the light site background:

```tsx
useEffect(() => {
	const root = document.documentElement;
	root.classList.toggle("docs-dark", theme === "dark");
	return () => root.classList.remove("docs-dark");
}, [theme]);
```

**Toggle UI** — `DocsThemeToggle.tsx` is a stateless sun/moon button
(`{ theme, onToggle }`); placed in the left-nav header on desktop and the sticky
toolbar on mobile.
</content>
