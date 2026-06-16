import { promises as fs } from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { createServer } from "vite";

/**
 * Vite plugin: emit the canonical agent bundle + split slices under
 * `dist/agent/` after build, and serve the same JSON at `/agent/*.json` during
 * `vite dev`.
 *
 * Both paths call the SAME pure builder (`buildAgentBundle`) over the same
 * documented spec set (`getDocumentedSpecs`), loaded via Vite's SSR loader so
 * TS + `@/` aliases resolve with no extra runtime deps and there is no
 * dev/prod drift. Mirrors `vite-plugin-generate-openapi.ts`.
 */

/** Build the full bundle + split slices as a path→json map. */
async function buildFiles(
	server: Pick<ViteDevServer, "ssrLoadModule">,
): Promise<Record<string, string>> {
	const [registry, builder] = await Promise.all([
		server.ssrLoadModule("/src/lib/data/docs-registry.ts"),
		server.ssrLoadModule("/src/lib/agent/build-agent-bundle.ts"),
	]);
	const specs = registry.getDocumentedSpecs();
	const bundle = builder.buildAgentBundle(specs);

	const files: Record<string, string> = {};
	const j = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

	files["agent/eps.json"] = j(bundle);
	files["agent/index.json"] = j(builder.buildIndex(bundle));
	for (const api of bundle.apis)
		files[`agent/api/${api.slug}.json`] = j(builder.buildApi(bundle, api.slug));
	for (const topic of Object.keys(bundle.topics))
		files[`agent/topic/${topic}.json`] = j(builder.buildTopic(bundle, topic));

	return files;
}

export function generateAgentBundlePlugin(): Plugin {
	let resolvedConfig: ResolvedConfig | undefined;

	return {
		name: "eko:generate-agent-bundle",
		configResolved(c) {
			resolvedConfig = c;
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url?.split("?")[0] ?? "";
				if (!url.startsWith("/agent/") || !url.endsWith(".json")) {
					next();
					return;
				}
				try {
					const files = await buildFiles(server);
					const key = url.slice(1); // strip leading "/"
					const body = files[key];
					if (body === undefined) {
						next();
						return;
					}
					res.statusCode = 200;
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					res.end(body);
				} catch (err) {
					server.config.logger.error(
						`[eko:agent-bundle] ${(err as Error).message}`,
					);
					next(err);
				}
			});
		},
		async closeBundle() {
			if (!resolvedConfig) return;
			if (resolvedConfig.command !== "build") return;
			if (resolvedConfig.build.ssr) return;
			const outDir = path.resolve(
				resolvedConfig.root,
				resolvedConfig.build.outDir,
			);

			const ssrServer = await createServer({
				root: resolvedConfig.root,
				configFile: false,
				logLevel: "warn",
				server: { middlewareMode: true, hmr: false },
				appType: "custom",
				optimizeDeps: { noDiscovery: true, include: [] },
				resolve: { alias: resolvedConfig.resolve.alias },
			});

			try {
				const files = await buildFiles(ssrServer);
				for (const [rel, body] of Object.entries(files)) {
					const file = path.join(outDir, rel);
					await fs.mkdir(path.dirname(file), { recursive: true });
					await fs.writeFile(file, body, "utf8");
				}
				// eslint-disable-next-line no-console
				console.log(
					`\n[eko:agent-bundle] wrote ${Object.keys(files).length} files to ${path.relative(resolvedConfig.root, outDir)}/agent/`,
				);
			} finally {
				await ssrServer.close();
			}
		},
	};
}
