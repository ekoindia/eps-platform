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

  // Save the original SPA shell as a fallback for catch-all rewrites
  const fallbackPath = path.join(outDir, "__spa-fallback.html");
  await fs.writeFile(fallbackPath, template, "utf-8");

  let written = 0;

  for (const route of routes) {
    try {
      const html = renderRoute(route, template, renderPage);

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
