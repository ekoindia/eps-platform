import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { createServer } from "vite";

/**
 * Vite plugin: after `vite build`, generate markdown versions of every
 * product / industry / solution page plus root indices (`/index.md`,
 * `/use-cases.md`, `/llms.txt`) and write them into the build output dir.
 *
 * Data modules are loaded via Vite's own SSR loader so TS, path aliases
 * (`@/`), and asset imports are handled transparently — no extra runtime
 * deps required.
 */
export function generateMarkdownPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: "eko:generate-markdown",
    configResolved(c) {
      resolvedConfig = c;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = req.url?.split("?")[0] ?? "";
          const bundle = await loadRenderBundle(server);
          const body = renderDevRoute(url, bundle);
          if (body === null) {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader(
            "Content-Type",
            url.endsWith(".txt") ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8"
          );
          res.setHeader("Cache-Control", "no-cache");
          res.end(body);
        } catch (err) {
          server.config.logger.error(`[eko:markdown] ${(err as Error).message}`);
          next(err);
        }
      });
    },
    async closeBundle() {
      if (!resolvedConfig) return;
      if (resolvedConfig.command !== "build") return;
      if (resolvedConfig.build.ssr) return; // skip SSR builds if ever added
      const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);

      // Spin up a minimal Vite SSR server to load our TS source files.
      const ssrServer = await createServer({
        root: resolvedConfig.root,
        configFile: false,
        logLevel: "warn",
        server: { middlewareMode: true, hmr: false },
        appType: "custom",
        // Avoid the dep-optimize warmup whose pending esbuild context emits a
        // noisy "The build was canceled" on close().
        optimizeDeps: { noDiscovery: true, include: [] },
        // Reuse the same aliases as the build config.
        resolve: { alias: resolvedConfig.resolve.alias },
      });

      try {
        const bundle = await loadRenderBundle(ssrServer);

        let written = 0;

        // -- Products -------------------------------------------------------
        for (const product of bundle.API_PRODUCTS) {
          const page = bundle.API_PRODUCT_PAGES[product.id];
          if (!page) {
            this.warn(`No page data for product id="${product.id}" — skipping`);
            continue;
          }
          const related = bundle.API_PRODUCTS.filter(
            (p) => p.category === product.category && p.id !== product.id
          ).slice(0, 5);
          const md = bundle.renderProductMarkdown(product, page, related);
          await writeFile(path.join(outDir, "products", `${product.slug}.md`), md);
          written++;
        }

        // -- Industries -----------------------------------------------------
        for (const ind of bundle.INDUSTRIES_LIST) {
          const md = bundle.renderIndustryMarkdown(ind);
          await writeFile(path.join(outDir, "industries", `${ind.slug}.md`), md);
          written++;
        }

        // -- Solutions ------------------------------------------------------
        const industryNames: Record<string, string> = Object.fromEntries(
          bundle.INDUSTRIES_LIST.map((i) => [i.slug, i.name])
        );
        for (const sol of bundle.SOLUTIONS_LIST) {
          const md = bundle.renderSolutionMarkdown(sol, industryNames);
          await writeFile(path.join(outDir, "solutions", `${sol.slug}.md`), md);
          written++;
        }

        // -- Use-cases hub --------------------------------------------------
        await writeFile(
          path.join(outDir, "use-cases.md"),
          bundle.renderUseCasesHubMarkdown(bundle.INDUSTRIES_LIST, bundle.SOLUTIONS_LIST)
        );
        written++;

        // -- Site index -----------------------------------------------------
        await writeFile(
          path.join(outDir, "index.md"),
          bundle.renderSiteIndexMarkdown(
            bundle.API_PRODUCTS,
            bundle.INDUSTRIES_LIST,
            bundle.SOLUTIONS_LIST
          )
        );
        written++;

        // -- llms.txt -------------------------------------------------------
        await writeFile(
          path.join(outDir, "llms.txt"),
          bundle.renderLlmsTxt(bundle.API_PRODUCTS, bundle.INDUSTRIES_LIST, bundle.SOLUTIONS_LIST)
        );
        written++;

        // -- llms-full.txt --------------------------------------------------
        await writeFile(
          path.join(outDir, "llms-full.txt"),
          bundle.renderSiteIndexMarkdown(
            bundle.API_PRODUCTS,
            bundle.INDUSTRIES_LIST,
            bundle.SOLUTIONS_LIST
          )
        );
        written++;

        // eslint-disable-next-line no-console
        console.log(`\n[eko:markdown] wrote ${written} markdown files to ${path.relative(resolvedConfig.root, outDir)}/`);
      } finally {
        await ssrServer.close();
      }
    },
  };
}

interface MarkdownBundle {
  API_PRODUCTS: Array<{
    id: string;
    name: string;
    slug: string;
    href: string;
    category: "bc" | "payment" | "verification";
    shortDesc: string;
  }>;
  API_PRODUCT_PAGES: Record<string, unknown>;
  INDUSTRIES_LIST: Array<{ slug: string; name: string; category: string }>;
  SOLUTIONS_LIST: Array<{ slug: string; name: string }>;
  renderProductMarkdown: (p: unknown, d: unknown, r: unknown[]) => string;
  renderIndustryMarkdown: (d: unknown) => string;
  renderSolutionMarkdown: (d: unknown, n: Record<string, string>) => string;
  renderUseCasesHubMarkdown: (i: unknown[], s: unknown[]) => string;
  renderSiteIndexMarkdown: (p: unknown[], i: unknown[], s: unknown[]) => string;
  renderLlmsTxt: (p: unknown[], i: unknown[], s: unknown[]) => string;
}

async function loadRenderBundle(
  server: Pick<ViteDevServer, "ssrLoadModule">
): Promise<MarkdownBundle> {
  const [
    productsMod,
    productPagesMod,
    industriesMod,
    solutionsMod,
    renderProductMod,
    renderIndustryMod,
    renderSolutionMod,
    renderIndexMod,
  ] = await Promise.all([
    server.ssrLoadModule("/src/lib/data/api-products.ts"),
    server.ssrLoadModule("/src/lib/data/api-product-pages.ts"),
    server.ssrLoadModule("/src/lib/data/industries.ts"),
    server.ssrLoadModule("/src/lib/data/solutions.ts"),
    server.ssrLoadModule("/src/lib/markdown/render-product.ts"),
    server.ssrLoadModule("/src/lib/markdown/render-industry.ts"),
    server.ssrLoadModule("/src/lib/markdown/render-solution.ts"),
    server.ssrLoadModule("/src/lib/markdown/render-index.ts"),
  ]);

  return {
    API_PRODUCTS: productsMod.API_PRODUCTS,
    API_PRODUCT_PAGES: productPagesMod.API_PRODUCT_PAGES,
    INDUSTRIES_LIST: industriesMod.INDUSTRIES_LIST,
    SOLUTIONS_LIST: solutionsMod.SOLUTIONS_LIST,
    renderProductMarkdown: renderProductMod.renderProductMarkdown,
    renderIndustryMarkdown: renderIndustryMod.renderIndustryMarkdown,
    renderSolutionMarkdown: renderSolutionMod.renderSolutionMarkdown,
    renderUseCasesHubMarkdown: renderIndexMod.renderUseCasesHubMarkdown,
    renderSiteIndexMarkdown: renderIndexMod.renderSiteIndexMarkdown,
    renderLlmsTxt: renderIndexMod.renderLlmsTxt,
  };
}

function renderDevRoute(url: string, bundle: MarkdownBundle): string | null {
  if (url === "/llms.txt") {
    return bundle.renderLlmsTxt(bundle.API_PRODUCTS, bundle.INDUSTRIES_LIST, bundle.SOLUTIONS_LIST);
  }
  if (url === "/llms-full.txt" || url === "/index.md") {
    return bundle.renderSiteIndexMarkdown(
      bundle.API_PRODUCTS,
      bundle.INDUSTRIES_LIST,
      bundle.SOLUTIONS_LIST
    );
  }
  if (url === "/use-cases.md") {
    return bundle.renderUseCasesHubMarkdown(bundle.INDUSTRIES_LIST, bundle.SOLUTIONS_LIST);
  }

  const productMatch = url.match(/^\/products\/([^/]+)\.md$/);
  if (productMatch) {
    const product = bundle.API_PRODUCTS.find((p) => p.slug === productMatch[1]);
    if (!product) return null;
    const page = bundle.API_PRODUCT_PAGES[product.id];
    if (!page) return null;
    const related = bundle.API_PRODUCTS.filter(
      (p) => p.category === product.category && p.id !== product.id
    ).slice(0, 5);
    return bundle.renderProductMarkdown(product, page, related);
  }

  const industryMatch = url.match(/^\/industries\/([^/]+)\.md$/);
  if (industryMatch) {
    const industry = bundle.INDUSTRIES_LIST.find((i) => i.slug === industryMatch[1]);
    return industry ? bundle.renderIndustryMarkdown(industry) : null;
  }

  const solutionMatch = url.match(/^\/solutions\/([^/]+)\.md$/);
  if (solutionMatch) {
    const solution = bundle.SOLUTIONS_LIST.find((s) => s.slug === solutionMatch[1]);
    if (!solution) return null;
    const industryNames: Record<string, string> = Object.fromEntries(
      bundle.INDUSTRIES_LIST.map((i) => [i.slug, i.name])
    );
    return bundle.renderSolutionMarkdown(solution, industryNames);
  }

  return null;
}

async function writeFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}
