# Developer Documentation Section

This folder documents the **developer docs section** of the EPS website — the
`/docs` portal that renders API references, MDX guides, live code samples, and an
in-browser "Try it" console.

The portal is **spec-driven**: a single source of truth (`api-specs.ts` + its
shared layers) feeds every rendered view, every generated code sample, the left
navigation tree, the static route list, and the build-time Markdown twins. No
endpoint detail, parameter table, or code snippet is hand-authored per endpoint —
all are derived at read time from typed data.

## Read in this order

| Doc | Covers |
| --- | --- |
| [single-source-of-truth.md](single-source-of-truth.md) | The DRY data architecture: `ApiSpec`, shared auth/params/envelope/error layers, resolvers that recompose full views. |
| [api-documentation.md](api-documentation.md) | How an endpoint spec renders into the detail page — params tables, headers, responses, error scenarios. |
| [navigation-and-categories.md](navigation-and-categories.md) | The docs registry, the flat `/docs/<slug>` URL model, slug-collision guard, and how the left-menu categories are built. |
| [mdx-guides.md](mdx-guides.md) | Prose guides (Quickstart, How Auth Works, Error Codes): MDX config, metadata vs component registries, routing. |
| [code-samples.md](code-samples.md) | The pure cURL / JavaScript / Python generators and where they render. |
| [try-it-now.md](try-it-now.md) | The in-browser console, client-side HMAC signing, and the direct-fetch / CORS model (and why there is **no** proxy). |
| [layout-ssg-theming.md](layout-ssg-theming.md) | The 3-pane layout, SSG prerendering, and the docs-local dark theme toggle. |

## High-level data flow

```
                 api-products.ts        docs-guides.ts (+ .mdx components)
                       │                          │
   api-auth.ts ─┐      │                          │
api-error-codes.ts ─┐  │                          │
api-specs-common.ts ─┼─┴──> api-specs.ts          │
   (shared layers)   │       (per-endpoint        │
                     │        deltas only)        │
                     └──────────┬─────────────────┘
                                ▼
                        docs-registry.ts
        (unifies guides + endpoints → DocNode[] ; flat /docs/<slug>)
                                │
          ┌─────────────────────┼───────────────────────┐
          ▼                     ▼                        ▼
   buildNavTree()        getAllDocSlugs()          getDocBySlug()
   (left menu)           (ssg prerender list)      (route → page)
                                                         │
                                          ┌──────────────┴───────────────┐
                                          ▼                              ▼
                                  guide → MdxGuide          endpoint → EndpointDetail
                                                                 + CodeSamples (right rail)
                                                                 + TryItPanel (dialog)
```

## Key directories

| Path | Role |
| --- | --- |
| `src/lib/data/api-specs.ts` | The spec database — one `ApiSpec` object per endpoint (deltas only). |
| `src/lib/data/api-specs-common.ts` | Shared types + `COMMON_REQUEST_PARAMS`, response envelopes, resolvers. |
| `src/lib/data/api-auth.ts` | `AUTH_HEADERS`, `API_ENVIRONMENTS` (sandbox/prod base URLs). |
| `src/lib/data/api-error-codes.ts` | HTTP + transaction status-code tables. |
| `src/lib/data/api-products.ts` | Product/category registry (FK target for specs). |
| `src/lib/data/docs-registry.ts` | Unifies guides + endpoints; routing, nav, slug guard. |
| `src/content/docs/` | MDX guide files + their metadata/component registries. |
| `src/lib/docs/code-samples.ts` | Pure cURL/JS/Python generators + URL resolver. |
| `src/lib/docs/eko-signing.ts` | Web Crypto HMAC-SHA256 request signing (try-it). |
| `src/components/docs/` | Presentational components (layout, nav, detail, samples, try-it). |
| `src/pages/docs/` | `DocsIndexPage` (`/docs`) and `DocDetailPage` (`/docs/:slug`). |
| `ssg/` | Route enumeration + prerender pipeline. |

> **Note on related docs:** [api-specs.md](../api-specs.md) (spec authoring) and
> [markdown-generation.md](../markdown-generation.md) (the build-time `.md` twins)
> are the existing siblings of this folder. This folder is the portal-level view;
> those two stay authoritative for spec-authoring rules and Markdown output.
</content>
</invoke>
