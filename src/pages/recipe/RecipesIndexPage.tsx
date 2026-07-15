import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { RECIPES, recipeHref } from "@/lib/data/api-recipes";

const TITLE = "API Recipes";
const DESCRIPTION =
	"Multi-step Eko API workflows — the order to call endpoints in, and how to branch on each response.";
const MD_PATH = `${recipeHref()}.md`;

/**
 * `/recipe` — lists every multi-step workflow. The per-endpoint docs explain how
 * to call one API; these explain how to combine several.
 */
const RecipesIndexPage = () => (
	<>
		<Helmet>
			{/* Single child: react-helmet-async drops a multi-child <title>. */}
			<title>{`${TITLE}${SITE_TITLE_SUFFIX}`}</title>
			<meta name="description" content={DESCRIPTION} />
			<link rel="canonical" href={`${SITE_URL}${recipeHref()}`} />
			<meta property="og:title" content={TITLE} />
			<meta property="og:description" content={DESCRIPTION} />
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
			<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{TITLE}
			</h1>
			<p className="mt-3 text-muted-foreground">
				Each recipe is a complete workflow across several Eko endpoints — the
				order to call them in, and the conditional jumps to make based on each
				response.
			</p>

			<ul className="mt-8 grid gap-4">
				{RECIPES.map((recipe) => {
					const product = recipe.productId
						? ACTIVE_PRODUCTS_MAP[recipe.productId]
						: undefined;
					return (
						<li key={recipe.slug}>
							<Link
								to={recipeHref(recipe.slug)}
								className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-muted/50"
							>
								<div className="flex items-center justify-between gap-3">
									<h2 className="font-medium text-foreground">{recipe.name}</h2>
									<ArrowRight
										aria-hidden="true"
										className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
									/>
								</div>
								<p className="mt-1.5 text-sm text-muted-foreground">
									{recipe.summary}
								</p>
								<p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
									<span className="rounded border border-border px-1.5 py-0.5 font-mono">
										{recipe.steps.length} step
										{recipe.steps.length === 1 ? "" : "s"}
									</span>
									{product && <span>{product.name}</span>}
								</p>
							</Link>
						</li>
					);
				})}
			</ul>
		</DocsLayout>
	</>
);

export default RecipesIndexPage;
