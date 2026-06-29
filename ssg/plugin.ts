/**
 * Vite plugin: after `vite build`, pre-renders every route listed in the
 * route manifest to static HTML files in the build output directory.
 *
 * Follows the same architecture as `vite-plugin-generate-markdown.ts`:
 * spins up a temporary Vite SSR server in `closeBundle`, loads modules
 * via `ssrLoadModule`, then tears down.
 */
import path from "node:path";
import mdx from "@mdx-js/rollup";
import type { Plugin, ResolvedConfig } from "vite";
import { createServer } from "vite";
import { imagetools } from "vite-imagetools";
import { mdxOptions } from "./mdx-options";

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
				// MDX before imagetools so `.mdx` guide imports reachable from the
				// eager AppServer tree compile during prerender.
				plugins: [{ enforce: "pre", ...mdx(mdxOptions) }, imagetools()],
				server: { middlewareMode: true, hmr: false },
				appType: "custom",
				optimizeDeps: { noDiscovery: true, include: [] },
				resolve: { alias: resolvedConfig.resolve.alias },
				// react-helmet-async still needs Vite's SSR transform for named
				// imports. react-router v7 ships CJS for Node.js — leave it to
				// Node's native loader so the module.exports wrapper isn't
				// evaluated as ESM.
				ssr: {
					noExternal: ["react-helmet-async"],
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
