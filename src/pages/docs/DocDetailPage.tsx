import { Helmet } from "react-helmet-async";
import { PageMeta } from "@/components/PageMeta";
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
	const node = slug ? getDocBySlug(slug) : undefined;
	// Stable hook call before any early return; lazy-loads the Try-it dialog.
	const { onTest, dialog } = useTryIt(node?.spec);

	if (!node) return <NotFound />;

	const canonical = `${SITE_URL}${docsHref(node.slug)}`;
	const mdPath = `${docsHref(node.slug)}.md`;

	if (node.kind === "guide") {
		return (
			<>
				<PageMeta
					title={`${node.title}${SITE_TITLE_SUFFIX}`}
					description={node.summary}
					ogTitle={node.title}
					type="article"
				/>
				<Helmet>
					<link rel="canonical" href={canonical} />
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
			<PageMeta
				title={`${spec.name} API Reference${SITE_TITLE_SUFFIX}`}
				description={spec.summary}
				ogTitle={`${spec.name} API Reference`}
				type="article"
			/>
			<Helmet>
				<link rel="canonical" href={canonical} />
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
			{dialog}
		</>
	);
};

export default DocDetailPage;
