# Code Samples (cURL / JavaScript / Python)

Every endpoint page shows request code in three languages. **None of it is stored
statically.** Pure generator functions transform an `ApiSpec` into each language's
snippet on demand — so the samples can never drift from the spec.

## Where the generators live

`src/lib/docs/code-samples.ts` — pure and dependency-free (imports only the spec
types, the resolvers, and `DEFAULT_BASE_URL`), so it unit-tests cleanly and is
SSR-safe.

```typescript
export type SampleLang = "curl" | "javascript" | "python";

export const sampleFor = (spec: ApiSpec, lang: SampleLang): string => {
	switch (lang) {
		case "curl":       return toCurl(spec);
		case "javascript": return toJsFetch(spec);
		case "python":     return toPython(spec);
	}
};
```

| Generator | Output |
| --- | --- |
| `toCurl(spec)` | `curl --request <METHOD> --url '<url>' --header '…' --data '<json>'` |
| `toJsFetch(spec)` | `await fetch('<url>', { method, headers, body: JSON.stringify(…) })` |
| `toPython(spec)` | `import requests … requests.<method>(url, json=payload, headers=headers)` |

## Inputs — all from the single source of truth

The generators pull every value through the shared resolvers, so the common
params and the auth headers appear without being declared per endpoint:

- `resolveHeaders()` → the auth header set.
- `resolveRequestParams(spec)` → common + endpoint params, each with its resolved
  `in` (common params are `query` on a GET, `body` otherwise).
- `resolveEndpointUrl(spec, overrides?)` → substitutes `{path_param}` tokens, appends
  an `in:"query"` query string (so GET URLs carry `?initiator_id=…`), and prefixes
  `DEFAULT_BASE_URL`.
- `hasBody(spec)` → `method !== "GET"` and the generated body is non-empty.
- `buildSampleRequest(spec)` → the request body example (override or generated).

```typescript
export const resolveEndpointUrl = (spec, overrides?) => {
	const params = resolveRequestParams(spec);
	let path = spec.path;
	for (const p of params.filter((p) => p.in === "path"))
		path = path.replace(`{${p.name}}`, urlValue(overrides?.[p.name] ?? p.example, p.name));
	let url = `${DEFAULT_BASE_URL}${path}`;
	const query = params.filter((p) => p.in === "query");
	if (query.length)
		url += "?" + query
			.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(urlValue(overrides?.[p.name] ?? p.example, p.name))}`)
			.join("&");
	return url;
};
```

`pyDict()` renders a JS value as a Python literal (`true`→`True`, `null`→`None`,
nested dicts/lists with indentation) for the Python sample.

## Secrets are never emitted

Auth header values that must be computed/signed per request are rendered as
obvious placeholder tokens, never real secrets:

```typescript
const HEADER_PLACEHOLDER: Record<string, string> = {
	developer_key: "<your_developer_key>",
	"secret-key": "<computed_secret_key>",
	"secret-key-timestamp": "<timestamp_ms>",
	"content-type": "application/json",
};
```

The live "Try it" console substitutes the real, locally-signed values at send
time (see [try-it-now.md](try-it-now.md)) — the static samples stay placeholder-only.

## Where they render

`src/components/docs/CodeSamples.tsx` (the right rail):

1. `DocDetailPage` passes `spec` to `<CodeSamples spec=… />`.
2. State `lang` defaults to `"curl"`; `sampleFor(spec, lang)` produces the string.
3. Language tabs call `setLang()` → re-render with the new snippet.
4. `<NumberedCode>` shows line-numbered code with a copy button; a "Test Request"
   button calls `onTest(path, method)`, which opens the Scalar "Try it" modal
   (see [try-it-now.md](try-it-now.md)).
5. A second card renders `spec.sampleSuccessResponse` as line-numbered JSON.

## When generation happens

- **Runtime:** regenerated client-side on each tab switch — pure functions, no
  fetch, instant.
- **Build time:** the same module is SSR-safe and importable by Node. Note the
  Markdown twins (`../markdown-generation.md`) embed the request/response **JSON
  examples**, not these per-language snippets.

Covered by `code-samples.test.ts` (placeholder-leak guard, URL substitution, etc.).
</content>
