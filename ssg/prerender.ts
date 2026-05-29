/**
 * Orchestrator: iterates every route in the manifest, renders each to
 * a static HTML file, and writes them into the build output directory.
 */
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import path from "node:path";
import { minify } from "html-minifier-terser";
import Beasties from "beasties";
import type { ViteDevServer } from "vite";
import type { ROUTE_CHUNK_MAP } from "./routes";

const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
};

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
  const routeChunkMap: typeof ROUTE_CHUNK_MAP = routesMod.ROUTE_CHUNK_MAP ?? [];
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
  // Also build a chunk map (source file → hashed URL) for preload injection.
  const { assetMap, chunkMap } = await buildMaps(outDir);

  // imagetools renders `/@imagetools/<id>` URLs during SSR that have no entry
  // in Vite's manifest (different from the build's hashed filenames, and the
  // manifest only keeps one width per image). Map each dev id → hashed prod
  // file by content hash: the SSR middleware serves the exact bytes that the
  // build emitted to dist/assets, so sha256 matches them unambiguously.
  const imageHashToUrl = await buildImageContentHashMap(outDir);
  const imagetoolsIdCache = new Map<string, string>();

  // Critical CSS extractor — inlines above-fold CSS and defers the rest
  const beasties = new Beasties({
    path: outDir,
    publicPath: "/",
    reduceInlineStyles: true,
    pruneSource: false,
    mergeStylesheets: true,
    preload: "media",
    logLevel: "warn",
  });

  // Save the original SPA shell as a fallback for catch-all rewrites
  const fallbackPath = path.join(outDir, "__spa-fallback.html");
  const minifiedTemplate = await minify(template, MINIFY_OPTIONS);
  await fs.writeFile(fallbackPath, minifiedTemplate, "utf-8");

  let written = 0;

  for (const route of routes) {
    try {
      let html = renderRoute(route, template, renderPage);
      html = replaceAssetUrls(html, assetMap);
      html = await replaceImagetoolsUrls(
        html,
        ssrServer,
        imageHashToUrl,
        imagetoolsIdCache,
      );
      html = injectRoutePreload(html, route, routeChunkMap, chunkMap);
      html = addFetchPriorityLow(html);
      html = await beasties.process(html);
      html = await minify(html, MINIFY_OPTIONS);

      // Determine output path:
      //   /                     → dist/index.html  (overwrite)
      //   /products/aeps-api    → dist/products/aeps-api/index.html
      //   /about-us             → dist/about-us/index.html
      let filePath: string;
      if (route === "/") {
        filePath = path.join(outDir, "index.html");
      } else {
        filePath = path.join(outDir, route.slice(1), "index.html");
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, "utf-8");
      written++;
    } catch (err) {
      throw new Error(
        `[ssg] Failed to pre-render ${route}: ${(err as Error).message}`,
        { cause: err },
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
  isDynamicEntry?: boolean;
}

/**
 * Reads `dist/.vite/manifest.json` and builds two maps in one pass:
 *  - assetMap: dev source URL → hashed production URL (for SSR asset rewriting)
 *  - chunkMap: source file key → hashed chunk URL (for modulepreload injection)
 *
 * e.g. assetMap: "/src/assets/eps-logo-color.svg" → "/assets/eps-logo-color-D4f2a.svg"
 *      chunkMap: "src/pages/Index.tsx" → "/assets/Index-Bx3kR1Aj.js"
 */
async function buildMaps(
  outDir: string,
): Promise<{ assetMap: Map<string, string>; chunkMap: Map<string, string> }> {
  const assetMap = new Map<string, string>();
  const chunkMap = new Map<string, string>();

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
      assetMap.set(devUrl, prodUrl);

      // Dynamic entries (React.lazy chunks) get a modulepreload entry
      if (entry.isDynamicEntry) {
        chunkMap.set(key, prodUrl);
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ssg] Loaded asset manifest with ${assetMap.size} entries, ${chunkMap.size} dynamic chunks`,
    );
  } catch {
    console.warn(
      "[ssg] Could not read .vite/manifest.json — asset URLs will not be rewritten",
    );
  }

  return { assetMap, chunkMap };
}

/**
 * Looks up the hashed chunk URL for a given route using ROUTE_CHUNK_MAP,
 * then injects a <link rel="modulepreload"> into the <head>. This tells
 * the browser to fetch the route-specific JS chunk in parallel with the
 * main bundle, eliminating the React.lazy() import waterfall.
 */
function injectRoutePreload(
  html: string,
  route: string,
  routeChunkMap: Array<{ pattern: RegExp; src: string }>,
  chunkMap: Map<string, string>,
): string {
  // Find which source file handles this route
  const match = routeChunkMap.find(({ pattern }) => pattern.test(route));
  if (!match) return html;

  // Look up the hashed chunk URL from the Vite manifest
  const chunkUrl = chunkMap.get(match.src);
  if (!chunkUrl) return html;

  return html.replace(
    "</head>",
    `<link rel="modulepreload" crossorigin href="${chunkUrl}"></head>`,
  );
}

/**
 * Adds fetchpriority="low" to the main app <script type="module"> tag.
 * Pre-rendered pages already display full content, so the hydration
 * script is lower priority than images and CSS during initial load.
 */
function addFetchPriorityLow(html: string): string {
  return html.replace(
    '<script type="module" crossorigin',
    '<script type="module" crossorigin fetchpriority="low"',
  );
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

/* ------------------------------------------------------------------ */
/*  imagetools URL helpers                                              */
/* ------------------------------------------------------------------ */

const IMAGETOOLS_URL_RE = /\/@imagetools\/[0-9a-f]+/g;
const IMAGE_EXTENSIONS = new Set([".avif", ".webp", ".png", ".jpg", ".jpeg"]);

/**
 * Hashes every emitted image in dist/assets so SSR `/@imagetools/<id>` URLs
 * can be matched to their hashed production filename by content.
 * Returns sha256(content) → "/assets/<file>".
 */
async function buildImageContentHashMap(
  outDir: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const assetsDir = path.join(outDir, "assets");

  let files: string[];
  try {
    files = await fs.readdir(assetsDir);
  } catch {
    return map;
  }

  await Promise.all(
    files
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map(async (file) => {
        const buf = await fs.readFile(path.join(assetsDir, file));
        map.set(sha256(buf), "/assets/" + file);
      }),
  );

  return map;
}

/**
 * Rewrites every `/@imagetools/<id>` dev URL in the HTML to its hashed
 * production URL. For each unseen id, fetches the bytes the imagetools dev
 * middleware serves, hashes them, and looks up the matching dist file.
 */
async function replaceImagetoolsUrls(
  html: string,
  ssrServer: ViteDevServer,
  imageHashToUrl: Map<string, string>,
  idCache: Map<string, string>,
): Promise<string> {
  if (imageHashToUrl.size === 0) return html;

  const matches = html.match(IMAGETOOLS_URL_RE);
  if (!matches) return html;

  for (const devUrl of new Set(matches)) {
    if (idCache.has(devUrl)) continue;

    const buf = await fetchImagetoolsBuffer(ssrServer, devUrl);
    const prodUrl = buf && imageHashToUrl.get(sha256(buf));
    if (!prodUrl) {
      throw new Error(
        `[ssg] Could not match imagetools URL ${devUrl} to a built asset by content hash`,
      );
    }
    idCache.set(devUrl, prodUrl);
  }

  return html.replace(IMAGETOOLS_URL_RE, (devUrl) => idCache.get(devUrl) ?? devUrl);
}

/**
 * Drives the imagetools connect middleware with a mock request/response to
 * capture the bytes for a `/@imagetools/<id>` URL (the module has already
 * been loaded during SSR render, so the image is in imagetools' cache).
 */
function fetchImagetoolsBuffer(
  ssrServer: ViteDevServer,
  url: string,
): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const res = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
    }) as Writable & {
      setHeader: () => void;
      getHeader: () => undefined;
      removeHeader: () => void;
      writeHead: () => unknown;
      statusCode: number;
    };
    res.setHeader = () => {};
    res.getHeader = () => undefined;
    res.removeHeader = () => {};
    res.writeHead = () => res;
    res.statusCode = 200;
    res.on("finish", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);

    const req = { url, method: "GET", headers: {} };
    // If no middleware handles the URL, `next` is called → no image.
    ssrServer.middlewares(req as never, res as never, () => resolve(null));
  });
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
