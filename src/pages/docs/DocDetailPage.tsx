import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { CodeSamples } from "@/components/docs/CodeSamples";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { EndpointDetail } from "@/components/docs/EndpointDetail";
import { MdxGuide } from "@/components/docs/MdxGuide";
import { PageActions } from "@/components/docs/PageActions";
import { useTryIt } from "@/components/docs/useTryIt";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { SITE_URL } from "@/lib/config/site";
import { docsHref, getDocBySlug } from "@/lib/data/docs-registry";
import NotFound from "@/pages/NotFound";

/**
 * `/docs/<slug>` — resolves a single doc node and renders it in the 3-pane
 * shell: an MDX guide (no right rail) or an API endpoint (with a code-samples
 * right rail). Each carries SEO meta + a markdown-twin alternate link. Unknown
 * slugs fall through to NotFound.
 */
const DocDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();
	// Stable hook call before any early return; opens the Scalar "Try it" modal.
	const onTest = useTryIt();
	const node = slug ? getDocBySlug(slug) : undefined;

	if (!node) return <NotFound />;

	const canonical = `${SITE_URL}${docsHref(node.slug)}`;
	const mdPath = `${docsHref(node.slug)}.md`;

	if (node.kind === "guide") {
		return (
			<>
				<Helmet>
					<title>
						{node.title}
						{SITE_TITLE_SUFFIX}
					</title>
					{node.summary && <meta name="description" content={node.summary} />}
					<link rel="canonical" href={canonical} />
					<meta property="og:title" content={node.title} />
					{node.summary && (
						<meta property="og:description" content={node.summary} />
					)}
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
						title={node.title}
						kind="guide"
						className="mb-6"
					/>
					<MdxGuide slug={node.slug} />
				</DocsLayout>
			</>
		);
	}

	if (!node.spec) return <NotFound />;
	const spec = node.spec;

	return (
		<>
			<Helmet>
				<title>
					{spec.name} API Reference{SITE_TITLE_SUFFIX}
				</title>
				<meta name="description" content={spec.summary} />
				<link rel="canonical" href={canonical} />
				<meta property="og:title" content={`${spec.name} API Reference`} />
				<meta property="og:description" content={spec.summary} />
				<meta property="og:type" content="article" />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={mdPath}
				/>
			</Helmet>
			<AiHint mdPath={mdPath} />

			<DocsLayout
				rightPane={
					<>
						<PageActions
							mdPath={mdPath}
							title={spec.name}
							kind="endpoint"
							className="mb-6 hidden lg:flex"
						/>
						<CodeSamples spec={spec} onTest={onTest} />
					</>
				}
			>
				<PageActions
					mdPath={mdPath}
					title={spec.name}
					kind="endpoint"
					className="mb-6 lg:hidden"
				/>
				<EndpointDetail spec={spec} />
			</DocsLayout>
		</>
	);
};

export default DocDetailPage;
