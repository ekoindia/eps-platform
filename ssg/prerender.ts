/**
 * Orchestrator: iterates every route in the manifest, renders each to
 * a static HTML file, and writes them into the build output directory.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";

export async function prerenderAllPages(
  outDir: string,
  ssrServer: ViteDevServer,
): Promise<void> {
  // Load modules through Vite's SSR loader so TS + aliases work
  const [routesMod, rendererMod, entryMod, sitemapMod] = await Promise.all([
    ssrServer.ssrLoadModule("/ssg/routes.ts"),
    ssrServer.ssrLoadModule("/ssg/renderer.ts"),
    ssrServer.ssrLoadModule("/src/entry-server.tsx"),
    ssrServer.ssrLoadModule("/ssg/sitemap.ts"),
  ]);

  const routes: string[] = routesMod.PRERENDER_ROUTES;
  const renderRoute: typeof import("./renderer").renderRoute =
    rendererMod.renderRoute;
  const renderPage: typeof import("../src/entry-server").renderPage =
    entryMod.renderPage;
  const generateSitemap: typeof import("./sitemap").generateSitemap =
    sitemapMod.generateSitemap;

  // Read the Vite-built index.html as the base template
  const templatePath = path.join(outDir, "index.html");
  const template = await fs.readFile(templatePath, "utf-8");

  // Build asset replacement map from Vite's build manifest.
  // During SSR, asset imports resolve to source paths (/src/assets/foo.svg)
  // but the production build hashes them (/assets/foo-abc123.svg).
  // We post-process the rendered HTML to swap dev paths → production paths.
  const assetMap = await buildAssetMap(outDir);

  // Save the original SPA shell as a fallback for catch-all rewrites
  const fallbackPath = path.join(outDir, "__spa-fallback.html");
  await fs.writeFile(fallbackPath, template, "utf-8");

  let written = 0;

  for (const route of routes) {
    try {
      let html = renderRoute(route, template, renderPage);
      html = replaceAssetUrls(html, assetMap);

      // Determine output path:
      //   /                     → dist/index.html  (overwrite)
      //   /products/aeps-api    → dist/products/aeps-api.html
      //   /about-us             → dist/about-us.html
      let filePath: string;
      if (route === "/") {
        filePath = path.join(outDir, "index.html");
      } else {
        filePath = path.join(outDir, `${route.slice(1)}.html`);
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, "utf-8");
      written++;
    } catch (err) {
      // Log and continue — don't let one broken page block the rest
      console.error(
        `[ssg] Failed to pre-render ${route}: ${(err as Error).message}`,
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n[ssg] Pre-rendered ${written}/${routes.length} pages to ${path.relative(process.cwd(), outDir)}/`,
  );

  // Generate XML sitemap from the same route manifest
  await generateSitemap(routes, outDir);
}

/* ------------------------------------------------------------------ */
/*  Asset-path helpers                                                  */
/* ------------------------------------------------------------------ */

interface ManifestEntry {
  file: string;
  src?: string;
}

/**
 * Reads `dist/.vite/manifest.json` and builds a map from source paths
 * (as they appear in SSR output) to hashed production paths.
 *
 * e.g. "/src/assets/eps-logo-color.svg" → "/assets/eps-logo-color-D4f2a.svg"
 */
async function buildAssetMap(
  outDir: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const manifestPath = path.join(outDir, ".vite", "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest: Record<string, ManifestEntry> = JSON.parse(raw);

    for (const [key, entry] of Object.entries(manifest)) {
      // The manifest key is the source path relative to project root
      // e.g. "src/assets/eps-logo-color.svg"
      // In SSR output it appears as "/src/assets/eps-logo-color.svg"
      const devUrl = "/" + key;
      const prodUrl = "/" + entry.file;
      map.set(devUrl, prodUrl);
    }

    // eslint-disable-next-line no-console
    console.log(`[ssg] Loaded asset manifest with ${map.size} entries`);
  } catch {
    console.warn(
      "[ssg] Could not read .vite/manifest.json — asset URLs will not be rewritten",
    );
  }

  return map;
}

/**
 * Replaces all occurrences of dev asset URLs in the HTML string with
 * their production (hashed) counterparts from the Vite manifest.
 */
function replaceAssetUrls(
  html: string,
  assetMap: Map<string, string>,
): string {
  if (assetMap.size === 0) return html;

  for (const [devUrl, prodUrl] of assetMap) {
    // Use split+join for a global replace without regex escaping issues
    html = html.split(devUrl).join(prodUrl);
  }

  return html;
}
