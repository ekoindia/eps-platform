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
					let body = renderDevRoute(url, bundle);
					// Guide twins need an async file read, so they're not handled by
					// the sync renderDevRoute.
					if (body === null) {
						const guideMd = url.match(/^\/docs\/([^/]+)\.md$/);
						const guide = guideMd
							? bundle.GUIDES.find((g) => g.slug === guideMd[1])
							: undefined;
						if (guide) {
							const raw = await readGuideSource(server.config.root, guide.slug);
							body = bundle.renderGuideMarkdown(guide, raw);
						}
					}
					if (body === null) {
						next();
						return;
					}

					res.statusCode = 200;
					res.setHeader(
						"Content-Type",
						url.endsWith(".txt")
							? "text/plain; charset=utf-8"
							: "text/markdown; charset=utf-8",
					);
					res.setHeader("Cache-Control", "no-cache");
					res.end(body);
				} catch (err) {
					server.config.logger.error(
						`[eko:markdown] ${(err as Error).message}`,
					);
					next(err);
				}
			});
		},
		async closeBundle() {
			if (!resolvedConfig) return;
			if (resolvedConfig.command !== "build") return;
			if (resolvedConfig.build.ssr) return; // skip SSR builds if ever added
			const outDir = path.resolve(
				resolvedConfig.root,
				resolvedConfig.build.outDir,
			);

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
				const activeProducts = bundle.API_PRODUCTS.filter((p) => !p.disabled);
				// Docs-only products (specs but no marketing page) are excluded from
				// every product-link surface below so we never emit a /products/<slug>
				// link that resolves to a 404.
				const marketedProducts = activeProducts.filter((p) =>
					Boolean(bundle.API_PRODUCT_PAGES[p.id]),
				);
				for (const product of marketedProducts) {
					const page = bundle.API_PRODUCT_PAGES[product.id];
					if (!page) {
						this.warn(`No page data for product id="${product.id}" — skipping`);
						continue;
					}
					const related = marketedProducts
						.filter(
							(p) => p.category === product.category && p.id !== product.id,
						)
						.slice(0, 5);
					const md = bundle.renderProductMarkdown(product, page, related);
					await writeFile(
						path.join(outDir, "products", `${product.slug}.md`),
						md,
					);
					written++;
				}

				// -- Industries -----------------------------------------------------
				for (const ind of bundle.INDUSTRIES_LIST) {
					const md = bundle.renderIndustryMarkdown(ind);
					await writeFile(
						path.join(outDir, "industries", `${ind.slug}.md`),
						md,
					);
					written++;
				}

				// -- Solutions ------------------------------------------------------
				const industryNames: Record<string, string> = Object.fromEntries(
					bundle.INDUSTRIES_LIST.map((i) => [i.slug, i.name]),
				);
				for (const sol of bundle.SOLUTIONS_LIST) {
					const md = bundle.renderSolutionMarkdown(sol, industryNames);
					await writeFile(path.join(outDir, "solutions", `${sol.slug}.md`), md);
					written++;
				}

				// -- Products listing -----------------------------------------------
				await writeFile(
					path.join(outDir, "products.md"),
					bundle.renderProductsIndexMarkdown(
						marketedProducts,
						bundle.API_PRODUCT_PAGES,
						bundle.COMMON_API_FAQS,
					),
				);
				written++;

				// Plain-text twin of products.md, split into self-contained parts small
				// enough to train Zoho SalesIQ's AnswerBot without timing out.
				const productById = new Map(marketedProducts.map((p) => [p.id, p]));
				for (const part of bundle.PRODUCTS_TXT_PARTS) {
					const partProducts = part.productIds
						.map((id) => productById.get(id))
						.filter((p): p is NonNullable<typeof p> => Boolean(p));
					await writeFile(
						path.join(outDir, `${part.slug}.txt`),
						bundle.renderProductsIndexTextPart(
							part,
							partProducts,
							bundle.API_PRODUCT_PAGES,
							bundle.COMMON_API_FAQS,
						),
					);
					written++;
				}

				// -- Pricing rate card ------------------------------------------------
				await writeFile(
					path.join(outDir, "pricing.md"),
					bundle.renderPricingMarkdown(),
				);
				written++;

				// -- FAQ --------------------------------------------------------------
				await writeFile(
					path.join(outDir, "faq.md"),
					bundle.renderFaqMarkdown(bundle.GLOBAL_FAQS),
				);
				written++;

				// -- Use-cases hub --------------------------------------------------
				await writeFile(
					path.join(outDir, "use-cases.md"),
					bundle.renderUseCasesHubMarkdown(
						bundle.INDUSTRIES_LIST,
						bundle.SOLUTIONS_LIST,
					),
				);
				written++;

				// -- Developer docs -------------------------------------------------
				for (const spec of bundle.DOCUMENTED_SPECS) {
					await writeFile(
						path.join(outDir, "docs", `${spec.slug}.md`),
						bundle.renderEndpointMarkdown(spec),
					);
					written++;
				}
				await writeFile(
					path.join(outDir, "docs.md"),
					bundle.renderDocsIndexMarkdown(),
				);
				written++;

				for (const guide of bundle.GUIDES) {
					const raw = await readGuideSource(resolvedConfig.root, guide.slug);
					await writeFile(
						path.join(outDir, "docs", `${guide.slug}.md`),
						bundle.renderGuideMarkdown(guide, raw),
					);
					written++;
				}

				// -- Site index -----------------------------------------------------
				await writeFile(
					path.join(outDir, "index.md"),
					bundle.renderSiteIndexMarkdown(
						marketedProducts,
						bundle.INDUSTRIES_LIST,
						bundle.SOLUTIONS_LIST,
					),
				);
				written++;

				// -- AI hub ---------------------------------------------------------
				await writeFile(
					path.join(outDir, "ai.md"),
					bundle.renderAgentsMarkdown(),
				);
				written++;

				// -- AI agents (transactional MCP) ----------------------------------
				// Emitted every build; the page is only discoverable (nav/sitemap/
				// llms.txt) when SHOW_TRANSACT_MCP is on, so an unreferenced twin is safe.
				await writeFile(
					path.join(outDir, "agents.md"),
					bundle.renderTransactAgentsMarkdown(),
				);
				written++;

				// -- llms.txt -------------------------------------------------------
				await writeFile(
					path.join(outDir, "llms.txt"),
					bundle.renderLlmsTxt(
						marketedProducts,
						bundle.INDUSTRIES_LIST,
						bundle.SOLUTIONS_LIST,
					),
				);
				written++;

				// -- llms-full.txt --------------------------------------------------
				await writeFile(
					path.join(outDir, "llms-full.txt"),
					bundle.renderSiteIndexMarkdown(
						marketedProducts,
						bundle.INDUSTRIES_LIST,
						bundle.SOLUTIONS_LIST,
					),
				);
				written++;

				// eslint-disable-next-line no-console
				console.log(
					`\n[eko:markdown] wrote ${written} markdown files to ${path.relative(resolvedConfig.root, outDir)}/`,
				);
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
		disabled?: boolean;
	}>;
	API_PRODUCT_PAGES: Record<string, unknown>;
	COMMON_API_FAQS: Array<{ q: string; a: string }>;
	GLOBAL_FAQS: Array<{
		q: string;
		a: string;
		links?: Array<{ label: string; href: string }>;
	}>;
	INDUSTRIES_LIST: Array<{ slug: string; name: string; category: string }>;
	SOLUTIONS_LIST: Array<{ slug: string; name: string }>;
	renderProductMarkdown: (p: unknown, d: unknown, r: unknown[]) => string;
	renderIndustryMarkdown: (d: unknown) => string;
	renderSolutionMarkdown: (d: unknown, n: Record<string, string>) => string;
	renderUseCasesHubMarkdown: (i: unknown[], s: unknown[]) => string;
	renderSiteIndexMarkdown: (p: unknown[], i: unknown[], s: unknown[]) => string;
	renderLlmsTxt: (p: unknown[], i: unknown[], s: unknown[]) => string;
	renderProductsIndexMarkdown: (
		p: unknown[],
		pages: Record<string, unknown>,
		commonFaqs: Array<{ q: string; a: string }>,
	) => string;
	PRODUCTS_TXT_PARTS: Array<{
		slug: string;
		title: string;
		shortLabel: string;
		lede: string;
		productIds: string[];
	}>;
	renderProductsIndexTextPart: (
		part: unknown,
		p: unknown[],
		pages: Record<string, unknown>,
		commonFaqs: Array<{ q: string; a: string }>,
	) => string;
	renderPricingMarkdown: () => string;
	renderFaqMarkdown: (faqs: unknown[]) => string;
	DOCUMENTED_SPECS: Array<{ slug: string }>;
	renderEndpointMarkdown: (spec: unknown) => string;
	renderDocsIndexMarkdown: () => string;
	GUIDES: Array<{ slug: string; title: string; summary?: string }>;
	renderGuideMarkdown: (
		meta: { slug: string; title: string; summary?: string },
		rawBody: string,
	) => string;
	renderAgentsMarkdown: () => string;
	renderTransactAgentsMarkdown: () => string;
}

/** Read a guide's raw `.mdx` source (pure markdown) from the content dir. */
async function readGuideSource(root: string, slug: string): Promise<string> {
	return fs.readFile(
		path.join(root, "src/content/docs", `${slug}.mdx`),
		"utf8",
	);
}

async function loadRenderBundle(
	server: Pick<ViteDevServer, "ssrLoadModule">,
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
		renderProductsIndexMod,
		renderPricingMod,
		renderFaqMod,
		docsRegistryMod,
		renderDocMod,
		docsGuidesMod,
		renderAgentsMod,
		renderTransactMod,
	] = await Promise.all([
		server.ssrLoadModule("/src/lib/data/api-products.ts"),
		server.ssrLoadModule("/src/lib/data/api-product-pages.ts"),
		server.ssrLoadModule("/src/lib/data/industries.ts"),
		server.ssrLoadModule("/src/lib/data/solutions.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-product.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-industry.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-solution.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-index.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-products-index.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-pricing.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-faq.ts"),
		server.ssrLoadModule("/src/lib/data/docs-registry.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-doc.ts"),
		server.ssrLoadModule("/src/content/docs/docs-guides.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-agents.ts"),
		server.ssrLoadModule("/src/lib/markdown/render-transact.ts"),
	]);

	return {
		API_PRODUCTS: productsMod.API_PRODUCTS,
		API_PRODUCT_PAGES: productPagesMod.API_PRODUCT_PAGES,
		COMMON_API_FAQS: productPagesMod.COMMON_API_FAQS,
		GLOBAL_FAQS: productPagesMod.GLOBAL_FAQS,
		INDUSTRIES_LIST: industriesMod.ACTIVE_INDUSTRIES_LIST,
		SOLUTIONS_LIST: solutionsMod.ACTIVE_SOLUTIONS_LIST,
		renderProductMarkdown: renderProductMod.renderProductMarkdown,
		renderIndustryMarkdown: renderIndustryMod.renderIndustryMarkdown,
		renderSolutionMarkdown: renderSolutionMod.renderSolutionMarkdown,
		renderUseCasesHubMarkdown: renderIndexMod.renderUseCasesHubMarkdown,
		renderSiteIndexMarkdown: renderIndexMod.renderSiteIndexMarkdown,
		renderLlmsTxt: renderIndexMod.renderLlmsTxt,
		renderProductsIndexMarkdown:
			renderProductsIndexMod.renderProductsIndexMarkdown,
		PRODUCTS_TXT_PARTS: renderProductsIndexMod.PRODUCTS_TXT_PARTS,
		renderProductsIndexTextPart:
			renderProductsIndexMod.renderProductsIndexTextPart,
		renderPricingMarkdown: renderPricingMod.renderPricingMarkdown,
		renderFaqMarkdown: renderFaqMod.renderFaqMarkdown,
		DOCUMENTED_SPECS: docsRegistryMod.getDocumentedSpecs(),
		renderEndpointMarkdown: renderDocMod.renderEndpointMarkdown,
		renderDocsIndexMarkdown: renderDocMod.renderDocsIndexMarkdown,
		GUIDES: docsGuidesMod.GUIDES,
		renderGuideMarkdown: renderDocMod.renderGuideMarkdown,
		renderAgentsMarkdown: renderAgentsMod.renderAgentsMarkdown,
		renderTransactAgentsMarkdown:
			renderTransactMod.renderTransactAgentsMarkdown,
	};
}

function renderDevRoute(url: string, bundle: MarkdownBundle): string | null {
	const activeProducts = bundle.API_PRODUCTS.filter((p) => !p.disabled);
	// Docs-only products (no marketing page) are excluded from product-link surfaces.
	const marketedProducts = activeProducts.filter((p) =>
		Boolean(bundle.API_PRODUCT_PAGES[p.id]),
	);
	if (url === "/llms.txt") {
		return bundle.renderLlmsTxt(
			marketedProducts,
			bundle.INDUSTRIES_LIST,
			bundle.SOLUTIONS_LIST,
		);
	}
	if (url === "/llms-full.txt" || url === "/index.md") {
		return bundle.renderSiteIndexMarkdown(
			marketedProducts,
			bundle.INDUSTRIES_LIST,
			bundle.SOLUTIONS_LIST,
		);
	}
	if (url === "/use-cases.md") {
		return bundle.renderUseCasesHubMarkdown(
			bundle.INDUSTRIES_LIST,
			bundle.SOLUTIONS_LIST,
		);
	}
	if (url === "/products.md") {
		return bundle.renderProductsIndexMarkdown(
			marketedProducts,
			bundle.API_PRODUCT_PAGES,
			bundle.COMMON_API_FAQS,
		);
	}
	const partMatch = url.match(/^\/([^/]+)\.txt$/);
	if (partMatch) {
		const part = bundle.PRODUCTS_TXT_PARTS.find((p) => p.slug === partMatch[1]);
		if (part) {
			const productById = new Map(marketedProducts.map((p) => [p.id, p]));
			const partProducts = part.productIds
				.map((id) => productById.get(id))
				.filter((p): p is NonNullable<typeof p> => Boolean(p));
			return bundle.renderProductsIndexTextPart(
				part,
				partProducts,
				bundle.API_PRODUCT_PAGES,
				bundle.COMMON_API_FAQS,
			);
		}
	}
	if (url === "/pricing.md") {
		return bundle.renderPricingMarkdown();
	}
	if (url === "/faq.md") {
		return bundle.renderFaqMarkdown(bundle.GLOBAL_FAQS);
	}
	if (url === "/docs.md") {
		return bundle.renderDocsIndexMarkdown();
	}
	if (url === "/ai.md") {
		return bundle.renderAgentsMarkdown();
	}
	if (url === "/agents.md") {
		return bundle.renderTransactAgentsMarkdown();
	}
	const docMatch = url.match(/^\/docs\/([^/]+)\.md$/);
	if (docMatch) {
		const spec = bundle.DOCUMENTED_SPECS.find((s) => s.slug === docMatch[1]);
		return spec ? bundle.renderEndpointMarkdown(spec) : null;
	}

	const productMatch = url.match(/^\/products\/([^/]+)\.md$/);
	if (productMatch) {
		const product = activeProducts.find((p) => p.slug === productMatch[1]);
		if (!product) return null;
		const page = bundle.API_PRODUCT_PAGES[product.id];
		if (!page) return null;
		const related = marketedProducts
			.filter((p) => p.category === product.category && p.id !== product.id)
			.slice(0, 5);
		return bundle.renderProductMarkdown(product, page, related);
	}

	const industryMatch = url.match(/^\/industries\/([^/]+)\.md$/);
	if (industryMatch) {
		const industry = bundle.INDUSTRIES_LIST.find(
			(i) => i.slug === industryMatch[1],
		);
		return industry ? bundle.renderIndustryMarkdown(industry) : null;
	}

	const solutionMatch = url.match(/^\/solutions\/([^/]+)\.md$/);
	if (solutionMatch) {
		const solution = bundle.SOLUTIONS_LIST.find(
			(s) => s.slug === solutionMatch[1],
		);
		if (!solution) return null;
		const industryNames: Record<string, string> = Object.fromEntries(
			bundle.INDUSTRIES_LIST.map((i) => [i.slug, i.name]),
		);
		return bundle.renderSolutionMarkdown(solution, industryNames);
	}

	return null;
}

async function writeFile(filePath: string, contents: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, contents, "utf8");
}
