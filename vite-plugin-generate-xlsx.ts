import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { createServer } from "vite";
import { renderPricingXlsx, type PricingXlsxData } from "./ssg/render-pricing-xlsx";

const XLSX_ROUTE = "/eps-pricing-calculator.xlsx";
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Vite plugin: after `vite build`, generate the offline Excel pricing
 * calculator (`/eps-pricing-calculator.xlsx`) from the same pricing config
 * that powers the interactive `/pricing` page, and write it into the build
 * output dir. Also serves the workbook on the fly during `vite dev`.
 *
 * Pricing data is loaded via Vite's own SSR loader (mirroring
 * `vite-plugin-generate-markdown.ts`); the exceljs dependency lives only in
 * this node-side pipeline and never reaches the client bundle.
 */
export function generatePricingXlsxPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: "eko:generate-xlsx",
    configResolved(c) {
      resolvedConfig = c;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== XLSX_ROUTE) {
          next();
          return;
        }
        try {
          const buffer = await renderPricingXlsx(await loadPricingData(server));
          res.statusCode = 200;
          res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
          res.setHeader("Content-Disposition", 'attachment; filename="eps-pricing-calculator.xlsx"');
          res.setHeader("Cache-Control", "no-cache");
          res.end(buffer);
        } catch (err) {
          server.config.logger.error(`[eko:xlsx] ${(err as Error).message}`);
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
        const buffer = await renderPricingXlsx(await loadPricingData(ssrServer));
        await fs.writeFile(path.join(outDir, XLSX_ROUTE.slice(1)), buffer);
        // eslint-disable-next-line no-console
        console.log(`\n[eko:xlsx] wrote ${XLSX_ROUTE.slice(1)} to ${path.relative(resolvedConfig.root, outDir)}/`);
      } finally {
        await ssrServer.close();
      }
    },
  };
}

/** Load pricing config + site constants through Vite's SSR module loader. */
async function loadPricingData(
  server: Pick<ViteDevServer, "ssrLoadModule">
): Promise<PricingXlsxData> {
  const [pricingMod, siteMod] = await Promise.all([
    server.ssrLoadModule("/src/lib/data/api-pricing.ts"),
    server.ssrLoadModule("/src/lib/config/site.ts"),
  ]);

  return {
    groups: pricingMod.PRICING_GROUPS,
    gstRate: pricingMod.GST_RATE,
    setupFeeWaived: pricingMod.SETUP_FEE_WAIVED,
    hasVolumeDiscounts: pricingMod.HAS_VOLUME_DISCOUNTS,
    maxVolume: pricingMod.MAX_VOLUME,
    siteUrl: siteMod.SITE_URL,
    displayName: pricingMod.displayName,
  };
}
