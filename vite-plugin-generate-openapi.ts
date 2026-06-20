import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { createServer } from "vite";

/**
 * Vite plugin: emit a public OpenAPI 3.1 document at `dist/openapi.json` after
 * build, and serve the same document at `/openapi.json` during `vite dev`.
 *
 * Both paths call the SAME pure builder (`buildOpenApiDocument`) over the same
 * documented spec set (`getDocumentedSpecs`), loaded via Vite's SSR loader so
 * TS + `@/` aliases resolve with no extra runtime deps and there is no
 * dev/prod drift.
 */
export function generateOpenApiPlugin(): Plugin {
	let resolvedConfig: ResolvedConfig | undefined;

	return {
		name: "eko:generate-openapi",
		configResolved(c) {
			resolvedConfig = c;
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url?.split("?")[0] ?? "";
				if (url !== "/openapi.json") {
					next();
					return;
				}
				try {
					const json = await buildJson(server);
					res.statusCode = 200;
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					res.end(json);
				} catch (err) {
					server.config.logger.error(`[eko:openapi] ${(err as Error).message}`);
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
				const json = await buildJson(ssrServer);
				const file = path.join(outDir, "openapi.json");
				await fs.mkdir(path.dirname(file), { recursive: true });
				await fs.writeFile(file, json, "utf8");
				// eslint-disable-next-line no-console
				console.log(
					`\n[eko:openapi] wrote openapi.json to ${path.relative(resolvedConfig.root, outDir)}/`,
				);
			} finally {
				await ssrServer.close();
			}
		},
	};
}

async function buildJson(
	server: Pick<ViteDevServer, "ssrLoadModule">,
): Promise<string> {
	const [registry, builder] = await Promise.all([
		server.ssrLoadModule("/src/lib/data/docs-registry.ts"),
		server.ssrLoadModule("/src/lib/openapi/build-openapi.ts"),
	]);
	const specs = registry.getDocumentedSpecs();
	const doc = builder.buildOpenApiDocument(specs);
	return `${JSON.stringify(doc, null, 2)}\n`;
}
