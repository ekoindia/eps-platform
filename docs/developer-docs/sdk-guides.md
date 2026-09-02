# SDK Guides (`/docs/sdk`)

Five backend SDKs — Node.js, Python, PHP, Go and Java — each get a guide deep
enough to integrate from without reading SDK source. They live in their own
small section rather than the flat `/docs/<slug>` namespace, and their content
is shared with the markdown twins and the context MCP.

## URL model

Unlike guides and endpoints, which share the flat namespace described in
[navigation-and-categories.md](navigation-and-categories.md), SDKs are a section
of their own — the shape `/recipe` already uses:

| URL | Page | Markdown twin |
| --- | --- | --- |
| `/docs/sdk` | `src/pages/sdk/SdkIndexPage.tsx` | `/docs/sdk.md` |
| `/docs/sdk/{nodejs,python,php,go,java}` | `src/pages/sdk/SdkGuidePage.tsx` | `/docs/sdk/<slug>.md` |

React Router ranks static segments above dynamic ones, so `/docs/sdk` wins over
`/docs/:slug` regardless of declaration order. `"sdk"` is nevertheless in
`RESERVED_SLUGS` (`docs-registry.ts`) so a future guide or endpoint of that name
throws at module load rather than silently shadowing the section.

An unknown language renders `NotFound`. Note this still returns HTTP 200 under
the SPA fallback, exactly like every other unknown route on the site.

## The hybrid content model

About 80% of each language page is the same shape with different values, so the
facts are data and only the narrative is authored per language.

**Data — `src/lib/data/sdk-guides.ts`.** Node-safe: no React, no `.mdx`, so
`ssg/routes.ts`, the markdown plugin, the agent-bundle builder and the tests all
load it. `SdkGuideMeta` carries the package name, minimum runtime, dependencies,
source URL, install notes, the client `config` options (with units), every
public `members` entry, the `errorTypes`, the accepted `fileValues` and any
language `notes`.

> `lang` (`javascript`) and `slug` (`nodejs`) are **both** stored. Never derive
> one from the other by string munging.

**Reused, never duplicated:**

| Fact | Source |
| --- | --- |
| install command, registry, registry URL | `SDK_INSTALL` in `src/lib/docs/code-samples.ts` |
| the worked `call()` example | `sdkSampleFor(spec, lang)`, same module |
| base URLs | `API_ENVIRONMENTS` in `src/lib/data/api-auth.ts` |
| HTTP status meanings | `HTTP_STATUS_CODES` in `src/lib/data/api-error-codes.ts` |

**Prose — `src/content/sdk/<slug>.mdx`**, no frontmatter, same convention as
`src/content/docs/*.mdx`. Registered **eagerly** in
`src/content/sdk/sdk-guide-components.tsx` — a lazy import would desync the SSR
and client trees during hydration.

**The bridge — `<SdkFacts section="…" />`** (`src/components/sdk/SdkFacts.tsx`).
One component, seven sections: `install`, `quickstart`, `config`, `members`,
`files`, `errors`, `environments`, `notes`. The language comes from
`SdkGuideContext`, set once by the page, so the MDX never repeats it.

Free-text fields in the data carry markdown-style backticks. `SdkFacts` renders
them as inline `<code>` (`InlineMd`); the twins emit them verbatim. Backticks
only — the data is deliberately not full markdown.

## Markdown twins

`src/lib/markdown/render-sdk.ts` exports `renderSdkIndexMarkdown()` and
`renderSdkGuideMarkdown(guide, rawMdx)`. The guide twin is the raw `.mdx` read
verbatim with `<SdkFacts>`, `<Callout>` and `<Button><a>` substituted.

**The expansion throws** on an unknown section or any unrecognised tag form, so
raw JSX can never reach a `.md`. A new `SdkFacts` section that forgets its entry
in `SECTIONS` fails the build, not production. Covered by
`src/lib/markdown/render-sdk.test.ts`.

Plugin wiring (`vite-plugin-generate-markdown.ts`): the dev middleware matches
`/docs/sdk.md` and `/docs/sdk/<lang>.md` **before** the generic
`/docs/<slug>.md` guide rule, which would otherwise swallow them; the build
writes `docs/sdk.md` plus one file per language (the local `writeFile` already
`mkdir -p`s); `collectBodies` adds them to `search-body.json`.

## Adding an SDK

1. Add an `SdkGuideMeta` entry to `SDK_GUIDES` (set `order`, and both `lang` and
   `slug`).
2. Add its `SDK_INSTALL` row and `SDK_LANGS` entry in `code-samples.ts`, plus a
   `to<Lang>Sdk` generator if the language is genuinely new.
3. Write `src/content/sdk/<slug>.mdx` and register it in
   `SDK_GUIDE_COMPONENTS`.
4. Everything else is automatic: the route, the prerendered page, the sitemap
   entry, the nav link, both markdown twins, the ⌘K entry, the `/docs.md`
   listing, and the `list_sdks` / `get_sdk` MCP tools.

`src/lib/data/sdk-guides.test.ts` asserts `SDK_GUIDES`, `SDK_LANGS` and
`SDK_INSTALL` cover exactly the same languages — `SDK_INSTALL` is a
`Partial<Record<…>>` and `isSdkLang` is `lang in SDK_INSTALL`, so a missing row
would otherwise fall back to Node in silence.

## The MCP surface

`packages/eps-context-mcp` serves `list_sdks` and `get_sdk(language)` from the
same data. The path is:

```
src/lib/data/sdk-guides.ts
  └─ src/lib/agent/build-agent-bundle.ts → AgentBundle.sdks
       └─ dist/agent/eps.json
            └─ packages/eps-context-mcp/data/eps.json   (npm run build → bake:all)
                 └─ list_sdks / get_sdk
```

Two things are load-bearing here:

- **`AgentSdk` must be mirrored byte-for-byte** in
  `packages/eps-context-mcp/src/bundle-types.ts` and named in the `NAMES` list
  of `bundle-types.parity.test.ts`, which compares interface bodies field by
  field.
- **`sdks` is excluded from the `bundleVersion` hash** in
  `build-agent-bundle.ts`. That value is copied into `sdk-surface.json`, whose
  bytes are part of the SDK release fingerprint (`scripts/sdk-release.mjs`), so
  hashing SDK guide *prose* would republish all five packages on every copy edit.
  `build-agent-bundle.test.ts` pins this.

`get_sdk` accepts the language id or the guide slug. Its enum is built from the
bundle and is deliberately **not** `SIGNING_LANGUAGES`, which includes `csharp`
(no SDK) and is pinned to exactly six entries by its own test.

## See also

- [mdx-guides.md](mdx-guides.md) — the `/docs/<slug>` MDX guides this borrows from
- [navigation-and-categories.md](navigation-and-categories.md) — the flat docs namespace
- [../sdk-golden-vector.md](../sdk-golden-vector.md) — the signing, validation and response contract every SDK is held to
