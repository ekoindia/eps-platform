import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { HttpMethodTag } from "@/components/docs/HttpMethodTag";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { SITE_URL } from "@/lib/config/site";
import { buildNavTree, docsHref } from "@/lib/data/docs-registry";

const MD_PATH = "/docs.md";

/**
 * `/docs` — the documentation landing page. Renders inside the 3-pane shell
 * (no right rail) with a short intro and a scannable index of every API
 * grouped by category. Fully static / prerenderable.
 */
const DocsIndexPage = () => {
	const nav = buildNavTree();
	const canonical = `${SITE_URL}/docs`;

	return (
		<>
			<Helmet>
				<title>Developer Documentation{SITE_TITLE_SUFFIX}</title>
				<meta
					name="description"
					content="API reference and integration guides for Eko's KYC, verification, payment and banking REST APIs."
				/>
				<link rel="canonical" href={canonical} />
				<meta property="og:title" content="Developer Documentation" />
				<meta
					property="og:description"
					content="API reference and integration guides for Eko's REST APIs."
				/>
				<meta property="og:type" content="website" />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={MD_PATH}
				/>
			</Helmet>
			<AiHint mdPath={MD_PATH} />

			<DocsLayout>
				<div className="mx-auto max-w-3xl">
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Developer Documentation
					</h1>
					<p className="mt-3 text-lg text-muted-foreground">
						Integrate Eko's KYC, verification, payment and banking APIs. Every
						endpoint is documented with parameters, responses, code samples and
						a live request console.
					</p>

					{nav.categories.map((category) => (
						<section key={category.category} className="mt-12">
							<h2 className="text-xl font-semibold tracking-tight text-foreground">
								{category.title}
							</h2>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								{category.products.flatMap((product) =>
									product.endpoints.map((ep) => (
										<Link
											key={ep.slug}
											to={docsHref(ep.slug)}
											className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-eko-gold hover:bg-muted/40"
										>
											<div className="min-w-0">
												<span className="block truncate text-sm font-medium text-foreground">
													{ep.title}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{product.name}
												</span>
											</div>
											<HttpMethodTag method={ep.method} short />
										</Link>
									)),
								)}
							</div>
						</section>
					))}
				</div>
			</DocsLayout>
		</>
	);
};

export default DocsIndexPage;
