/**
 * Vite plugin: after `vite build`, pre-renders every route listed in the
 * route manifest to static HTML files in the build output directory.
 *
 * Follows the same architecture as `vite-plugin-generate-markdown.ts`:
 * spins up a temporary Vite SSR server in `closeBundle`, loads modules
 * via `ssrLoadModule`, then tears down.
 */
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { createServer } from "vite";

export function prerenderPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: "eko:prerender-pages",

    configResolved(c) {
      resolvedConfig = c;
    },

    async closeBundle() {
      if (!resolvedConfig) return;
      if (resolvedConfig.command !== "build") return;
      if (resolvedConfig.build.ssr) return; // skip if this is itself an SSR build

      const outDir = path.resolve(
        resolvedConfig.root,
        resolvedConfig.build.outDir,
      );

      // Spin up a minimal Vite SSR server (same pattern as the markdown plugin)
      const ssrServer = await createServer({
        root: resolvedConfig.root,
        configFile: false,
        logLevel: "warn",
        server: { middlewareMode: true, hmr: false },
        appType: "custom",
        optimizeDeps: { noDiscovery: true, include: [] },
        resolve: { alias: resolvedConfig.resolve.alias },
        // Force CJS packages through Vite's transform so named imports work
        ssr: {
          noExternal: [
            "react-helmet-async",
            "react-router-dom",
          ],
        },
      });

      try {
        const { prerenderAllPages } = (await ssrServer.ssrLoadModule(
          "/ssg/prerender.ts",
        )) as typeof import("./prerender");

        await prerenderAllPages(outDir, ssrServer);
      } finally {
        await ssrServer.close();
      }
    },
  };
}
