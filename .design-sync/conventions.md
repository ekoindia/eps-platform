# Eko EPS design system — conventions

These components are the **Eko EPS** brand layer (fintech/payments marketing + docs UI), compiled from the live website. Styling is **Tailwind v4** (CSS-first, `@theme inline`) — style with **utility classes**, not props or inline CSS. Compose layout glue with the same utilities; reach for the brand families below to stay on-brand.

## Wrapping / setup

Components are loaded from the root `_ds_bundle.js` as `window.EkoDS.*`. Several composites (cards, page layouts, sections, breadcrumbs) render react-router `<Link>` and some set `<Helmet>` meta, so they must mount inside a router + helmet context. A ready wrapper ships in the bundle:

```jsx
const { DSProvider, FeatureCard, HeroSection, PricingTable } = window.EkoDS;
ReactDOM.createRoot(el).render(
	<DSProvider>
		{/* <MemoryRouter> + <HelmetProvider> */}
		<HeroSection /* ...props */ />
	</DSProvider>,
);
```

Without `DSProvider`, link- or Helmet-using components throw "useContext"/"useHref" errors. Plain cards (`FeatureCard`, `StatCard`, `ApiChip`) render without it.

## Styling idiom — Tailwind v4 utilities

**Brand families** (defined in `@theme inline`, safe to use anywhere):
| Utility | Meaning |
|---|---|
| `bg-eko-gold` / `bg-eko-gold-hover` / `bg-eko-gold-light` | brand gold surfaces (primary accent) |
| `text-eko-navy` / `bg-eko-navy` / `bg-eko-navy-light` | brand navy (headings, dark sections) |
| `text-eko-slate` | muted body text |
| `text-eko-success` / `bg-eko-success` | success/positive |

**Semantic (shadcn) tokens** — bound to runtime CSS vars, so they flip under the `dark` subtree: `bg-background` / `text-foreground`, `bg-primary` / `text-primary-foreground`, `bg-secondary`, `bg-muted` / `text-muted-foreground`, `bg-accent`, `bg-card` / `text-card-foreground`, `border-border`, `ring-ring`, `bg-destructive`. Radii: `rounded-lg|md|sm` track `--radius`.

**Dark mode**: add `class="dark"` on an ancestor (`@custom-variant dark (&:where(.dark, .dark *))`); semantic tokens switch automatically — brand `eko-*` families do not.

Prefer semantic tokens for structural UI (surfaces, text, borders) and `eko-*` for brand accents. Don't invent token names — only the families above resolve.

## Where the truth lives

- Stylesheet: the bound `_ds/<folder>/styles.css` → `_ds_bundle.css` (every utility + the `--color-*` / `--background`-family token definitions).
- Per-component API: each component's `.d.ts` + `.prompt.md`.

## Idiomatic snippet

```jsx
const { DSProvider, FeatureCard } = window.EkoDS;
<DSProvider>
	<section className="bg-eko-navy-light px-6 py-16">
		<h2 className="text-3xl font-bold text-eko-navy">Why Eko</h2>
		<div className="mt-8 grid gap-6 md:grid-cols-3">
			<FeatureCard title="Instant payouts" description="…" />
		</div>
	</section>
</DSProvider>;
```
