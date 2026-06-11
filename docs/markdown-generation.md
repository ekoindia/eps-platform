## AI Agent Content Delivery

This project also publishes AI-agent-friendly versions of key marketing pages.
The goal is to make the same page content available in a clean Markdown format
for LLMs, coding agents, and tools that work better with low-noise text than
with full rendered HTML.

### What gets published

At build time, the site generates Markdown equivalents for:

- Product listing: `/products.md`
- Product pages: `/products/:slug.md`
- Industry pages: `/industries/:slug.md`
- Solution pages: `/solutions/:slug.md`
- Use cases hub: `/use-cases.md`
- Site index: `/index.md`
- LLM discovery index: `/llms.txt`
- Full-content alias: `/llms-full.txt`

The main HTML pages continue to exist at their normal routes, for example:

- HTML: `/products/aeps-api`
- Markdown: `/products/aeps-api.md`

### Source of truth

The Markdown files are generated from the same TypeScript data used to render the
HTML pages. This avoids maintaining a second content source.

Primary content sources:

- `src/lib/data/api-products.ts`
- `src/lib/data/api-product-pages.ts`
- `src/lib/data/industries.ts`
- `src/lib/data/solutions.ts`

If you want to change the generated Markdown for a product, industry, or
solution page, update the corresponding content/data object first. In most
cases, you should not edit generated Markdown output directly.

### Renderer files

All Markdown generation logic lives in `src/lib/markdown/`.

- `src/lib/markdown/shared.ts`
	Shared helpers for front-matter, headings, bullet lists, tables, canonical
	notices, and common Markdown formatting.

- `src/lib/markdown/render-product.ts`
	Generates Markdown for product detail pages from product page data. Includes
	sections such as overview, benefits, features, use cases, integration steps,
	FAQs, docs link, and related products.

- `src/lib/markdown/render-products-index.ts`
	Generates Markdown for the products listing page (`/products.md`). Lists all
	active API products grouped by category (Verification, Payment, BC Agent).

- `src/lib/markdown/render-industry.ts`
	Generates Markdown for industry pages. Includes challenge text, recommended
	packs, API grid, use-case scenarios, compliance, FAQs, and related
	industries.

- `src/lib/markdown/render-solution.ts`
	Generates Markdown for solution pages. Includes API pack details, workflow,
	industries using the solution, comparison tables, pricing, FAQs, and related
	solutions.

- `src/lib/markdown/render-index.ts`
	Generates the shared top-level AI/LLM files:
	- `/use-cases.md`
	- `/index.md`
	- `/llms.txt`

- `src/components/AiHint.tsx`
	Reusable React component that injects a visually hidden hint into the HTML page
	pointing to the corresponding Markdown URL. This helps AI tools discover the
	Markdown version when they scrape the rendered page.


### Build and dev integration

The file `vite-plugin-generate-markdown.ts` is the core integration point.

It does two jobs:

1. **Build-time generation**
	 During `npm run build`, it loads the data modules and renderer modules using
	 Vite's SSR loader and writes Markdown files into `dist/`.

2. **Dev-time serving**
	 During `npm run dev`, it serves `.md` and `.txt` endpoints dynamically from
	 the same renderer logic, so routes like `/products/aeps-api.md` work locally
	 without needing a production build.

The plugin is registered in `vite.config.ts`:

- `generateMarkdownPlugin()`

This means any change to the renderer logic or content data is visible both in
local development and in production builds.

### Site URL configuration

The canonical base URL used in generated Markdown and AI hint text lives in:

- `src/lib/config/site.ts`

Current value:

- `https://eps.eko.in`

If the production domain changes, update this file so all generated canonical
links and AI-facing references stay correct.

### HTML discovery for AI tools

The HTML pages advertise their Markdown equivalents in two ways:

1. **`<link rel="alternate" type="text/markdown">` in the page head**
	 Added to the main page types so tools parsing HTML can discover the Markdown
	 version.

2. **Visually hidden AI hint in the page body**
	 The reusable component `src/components/AiHint.tsx` injects a hidden message
	 into the DOM that points AI tools to the corresponding `.md` route. This is
	 useful when a human pastes a normal webpage URL into a chat tool that reads
	 rendered page text.

### Hosting configuration

#### Vite

- File: `vite.config.ts`
- Registers `generateMarkdownPlugin()` so Markdown routes work in both build and
	dev modes.

#### Vercel

- File: `vercel.json`

Responsibilities:

- Rewrites `/llms-full.txt` to `/index.md`
- Keeps SPA fallback rewrite to `/__spa-fallback.html` (excluding `/assets/*`,
	which must 404 for stale chunks — see docs/chunk-error-auto-reload.md)
- Sets explicit headers for:
	- `*.md` -> `text/markdown; charset=utf-8`
	- `/llms.txt` -> `text/plain; charset=utf-8`

Because the generated `.md` files exist as static output, Vercel serves those
files directly before the SPA rewrite is applied.

#### Nginx

- File: `nginx.conf`

Responsibilities:

- Serves `.md` files with `text/markdown`
- Serves `/llms.txt` with `text/plain`
- Avoids falling back to the SPA when a `.md` file is missing
- Preserves the usual React SPA `index.html` fallback for normal HTML routes

### How to change generated Markdown content

There are three ways generated Markdown changes:

1. **Change the page content data**
	 Update the objects in:
	 - `src/lib/data/api-product-pages.ts`
	 - `src/lib/data/industries.ts`
	 - `src/lib/data/solutions.ts`

	 This is the most common path. If the content shown on the HTML page changes,
	 the Markdown output changes too.

2. **Change the Markdown structure / section order**
	 Update the relevant renderer file in `src/lib/markdown/`.

	 Examples:
	 - Add a new section heading
	 - Change how lists/tables are rendered
	 - Add or remove fields from front-matter
	 - Change how related links are included

3. **Change shared formatting helpers**
	 Update `src/lib/markdown/shared.ts` if you want to modify common formatting,
	 such as front-matter serialization, tables, heading helpers, or canonical
	 notices.

### How to add support for more page types

If we later want Markdown support for other sections of the site:

1. Add or identify the source data for that page type
2. Create a new renderer in `src/lib/markdown/`
3. Update `vite-plugin-generate-markdown.ts` to:
	 - generate the new file(s) during build
	 - serve the new route(s) during dev
4. Add `<link rel="alternate" ...>` to the HTML page
5. Add `AiHint` to the page body if useful
6. Update `/llms.txt` or `/index.md` if the new content should be discoverable

### How to verify changes

Use these commands when changing AI-agent content behavior:

```sh
# Start local dev server
npm run dev

# Example dev endpoints
open http://localhost:8080/products/aeps-api.md
open http://localhost:8080/llms.txt
open http://localhost:8080/llms-full.txt

# Build production output
npm run build
```

After a build, generated files are available inside `dist/`, for example:

- `dist/products/aeps-api.md`
- `dist/industries/lending-nbfc.md`
- `dist/solutions/lending-kyc-pack.md`
- `dist/index.md`
- `dist/llms.txt`
- `dist/llms-full.txt`
