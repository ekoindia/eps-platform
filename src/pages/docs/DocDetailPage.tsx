import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { CodeSamples } from "@/components/docs/CodeSamples";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { EndpointDetail } from "@/components/docs/EndpointDetail";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { SITE_URL } from "@/lib/config/site";
import { docsHref, getDocBySlug } from "@/lib/data/docs-registry";
import NotFound from "@/pages/NotFound";

/**
 * `/docs/<slug>` — resolves a single doc node (endpoint or guide) and renders
 * it in the 3-pane shell. Endpoints get a right rail of language-tabbed code
 * samples + example response; the live try-it console arrives in a later phase.
 * Unknown slugs fall through to NotFound.
 */
const DocDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();
	const node = slug ? getDocBySlug(slug) : undefined;

	if (!node) return <NotFound />;

	// Guides render via the MDX pipeline (added in a later phase); until then a
	// guide node has no component to show.
	if (node.kind !== "endpoint" || !node.spec) return <NotFound />;

	const spec = node.spec;
	const canonical = `${SITE_URL}${docsHref(node.slug)}`;
	const mdPath = `${docsHref(node.slug)}.md`;

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

			<DocsLayout rightPane={<CodeSamples spec={spec} />}>
				<EndpointDetail spec={spec} />
			</DocsLayout>
		</>
	);
};

export default DocDetailPage;
