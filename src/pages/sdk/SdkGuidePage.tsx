import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { Callout } from "@/components/docs/Callout";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MdxProse } from "@/components/docs/MdxProse";
import { PageActions } from "@/components/docs/PageActions";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { SdkFacts, SdkGuideContext } from "@/components/sdk/SdkFacts";
import { Button } from "@/components/ui/button";
import { SDK_GUIDE_COMPONENTS } from "@/content/sdk/sdk-guide-components";
import { SITE_URL } from "@/lib/config/site";
import { SDK_GUIDES, getSdkGuide, sdkGuideHref } from "@/lib/data/sdk-guides";
import { ArrowLeft, ArrowRight } from "lucide-react";
import NotFound from "@/pages/NotFound";

/** Tags the `.mdx` guides may use without importing anything. */
const MDX_COMPONENTS = { Button, Callout, SdkFacts };

/**
 * `/docs/sdk/<lang>` — one language guide: structured facts from
 * `@/lib/data/sdk-guides` rendered by `<SdkFacts>`, wrapped in per-language
 * prose from `src/content/sdk/<lang>.mdx`. Unknown languages fall through to
 * NotFound rather than rendering a page from missing metadata.
 */
const SdkGuidePage = () => {
	const { lang } = useParams<{ lang: string }>();
	const guide = lang ? getSdkGuide(lang) : undefined;
	const Body = guide ? SDK_GUIDE_COMPONENTS[guide.slug] : undefined;

	if (!guide || !Body) return <NotFound />;

	const href = sdkGuideHref(guide.slug);
	const mdPath = `${href}.md`;
	const ordered = [...SDK_GUIDES].sort((a, b) => a.order - b.order);
	const next = ordered[(ordered.indexOf(guide) + 1) % ordered.length];

	return (
		<>
			<Helmet>
				{/* Single child: react-helmet-async drops a multi-child <title>. */}
				<title>{`${guide.title}${SITE_TITLE_SUFFIX}`}</title>
				<meta name="description" content={guide.summary} />
				<link rel="canonical" href={`${SITE_URL}${href}`} />
				<meta property="og:title" content={guide.title} />
				<meta property="og:description" content={guide.summary} />
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
					title={guide.title}
					kind="guide"
					className="mb-6"
				/>
				<Link
					to={sdkGuideHref()}
					className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					All SDKs
				</Link>
				<SdkGuideContext.Provider value={guide}>
					<MdxProse>
						<Body components={MDX_COMPONENTS} />
					</MdxProse>
				</SdkGuideContext.Provider>
				{next !== guide && (
					<Link
						to={sdkGuideHref(next.slug)}
						className="mt-10 flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-eko-gold"
					>
						<span>
							<span className="block text-xs uppercase tracking-wide text-muted-foreground">
								Next SDK
							</span>
							<span className="font-medium text-foreground">{next.title}</span>
						</span>
						<ArrowRight className="h-4 w-4 shrink-0 text-eko-gold" />
					</Link>
				)}
			</DocsLayout>
		</>
	);
};

export default SdkGuidePage;
