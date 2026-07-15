import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { PageActions } from "@/components/docs/PageActions";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { RecipeFlowchart } from "@/components/recipe/RecipeFlowchart";
import { RecipeStepper } from "@/components/recipe/RecipeStepper";
import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import { getRecipeBySlug, recipeHref } from "@/lib/data/api-recipes";
import NotFound from "@/pages/NotFound";

/**
 * `/recipe/<slug>` — one multi-step API workflow, drawn as a stepper in the
 * same 3-pane docs shell. Carries SEO meta + a markdown-twin alternate link.
 * Unknown slugs fall through to NotFound.
 */
const RecipeDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();
	const recipe = slug ? getRecipeBySlug(slug) : undefined;

	if (!recipe) return <NotFound />;

	const canonical = `${SITE_URL}${recipeHref(recipe.slug)}`;
	const mdPath = `${recipeHref(recipe.slug)}.md`;
	// Guarded the same way as the markdown twin, so the two surfaces agree on
	// whether the product cross-link exists.
	const product = recipe.productId
		? ACTIVE_PRODUCTS_MAP[recipe.productId]
		: undefined;
	const title = `${recipe.name} — API Recipe`;

	return (
		<>
			<Helmet>
				{/* Single child: react-helmet-async drops a multi-child <title>. */}
				<title>{`${title}${SITE_TITLE_SUFFIX}`}</title>
				<meta name="description" content={recipe.summary} />
				<link rel="canonical" href={canonical} />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={recipe.summary} />
				<meta property="og:type" content="article" />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={mdPath}
				/>
			</Helmet>
			<AiHint mdPath={mdPath} />

			<DocsLayout>
				<PageActions
					mdPath={mdPath}
					title={recipe.name}
					kind="guide"
					className="mb-6"
				/>

				<BreadcrumbNav
					variant="surface"
					crumbs={[
						{ label: "Recipes", href: recipeHref() },
						{ label: recipe.name },
					]}
				/>

				<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
					{recipe.name}
				</h1>
				<p className="mt-3 text-muted-foreground">{recipe.summary}</p>

				{product && (
					<p className="mt-3 text-sm text-muted-foreground">
						Product & pricing:{" "}
						<Link
							to={productHref(product.slug)}
							className="font-medium text-foreground underline underline-offset-4"
						>
							{product.name}
						</Link>
					</p>
				)}

				<RecipeStepper recipe={recipe} />

				<h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Flow at a glance
				</h2>
				<RecipeFlowchart recipe={recipe} />

				<div className="mt-10 border-t border-border pt-6">
					<Link
						to={recipeHref()}
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft aria-hidden="true" className="size-4" />
						See all Recipes
					</Link>
				</div>
			</DocsLayout>
		</>
	);
};

export default RecipeDetailPage;
