# API Documentation Rendering

How a single `ApiSpec` becomes a rendered endpoint reference page. The spec data
model and resolvers are covered in
[single-source-of-truth.md](single-source-of-truth.md); this doc is about the
components that consume them.

## Entry point: `DocDetailPage`

`src/pages/docs/DocDetailPage.tsx` handles `/docs/:slug`. It:

1. reads `slug` from the router,
2. resolves a `DocNode` via `getDocBySlug(slug)` (returns NotFound for unknown slugs),
3. branches on `node.kind`:
   - `"guide"` → renders `<MdxGuide slug=… />` with **no** right pane (see [mdx-guides.md](mdx-guides.md)),
   - `"endpoint"` → renders `<EndpointDetail spec=… />` in the centre pane and
     `<CodeSamples spec=… />` in the right rail.
4. emits SEO tags (title, description, canonical, `og:*`) and an `alternate`
   link to the endpoint's `.md` twin.

## `EndpointDetail` — the centre pane

`src/components/docs/EndpointDetail.tsx`. Renders everything about the endpoint,
split by parameter location. It reads via the resolvers, never raw spec fields:

| Section | Source |
| --- | --- |
| Header — method tag + `path`, name, summary, UAT base URL | `spec.method`, `spec.path`, `spec.name`, `DEFAULT_BASE_URL` |
| Description | `spec.description` |
| Path parameters | `resolveRequestParams(spec)` filtered by `in === "path"` |
| Query parameters | `resolveRequestParams(spec)` filtered by `in === "query"` |
| Body parameters | `resolveRequestParams(spec)` filtered by `in === "body"` |
| Headers | `resolveHeaders()` |
| Responses | `<ResponseAccordion spec=… />` |

Because params come from `resolveRequestParams`, the four common params appear
automatically (unless `omitCommonParams` drops them), and the auth headers appear
on every endpoint without being declared per-spec.

## Supporting components

**`Params.tsx`** — responsive param renderer:
- wide (`xl+`): dense 4-column table (Field, Type, Required, Description);
- narrow: stacked field list (`FieldList`);
- shows a required/optional badge and any `example`.

**`ResponseAccordion.tsx`** — collapsible response list:
- row 0 (open by default) = **success**, rendered as a field tree from
  `resolveResponseFields(spec)`;
- one row per `spec.errorScenarios` entry, each showing the error JSON example.

**`ResponseFieldTree.tsx`** — recursive renderer for `ResponseField[]`:
- indented list, left border on nested levels;
- field name + type + description;
- fields flagged `imp: true` get a "verifiable" badge and bold name (this is the
  "what can you verify?" affordance for verification products);
- recurses into `children` for nested objects/arrays.

**`CodeSamples.tsx`** — the right rail. Request card (method/path header, copy
button, cURL/JS/Python tabs, line-numbered code, and a "Test Request" button that
opens the `TryItPanel` dialog) plus a response card showing
`spec.sampleSuccessResponse`. Fully covered in [code-samples.md](code-samples.md)
and [try-it-now.md](try-it-now.md).

## Render timing

Two contexts, same data:

- **Runtime (client/SSR):** the React components above render on navigation and
  during hydration.
- **Build time:** the Markdown-twin plugin reads the same specs to emit `.md`
  equivalents (see [../markdown-generation.md](../markdown-generation.md)). The
  Markdown twin includes the request/response **JSON examples**, not the
  per-language code snippets.
</content>
