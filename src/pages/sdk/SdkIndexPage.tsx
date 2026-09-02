import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AiHint } from "@/components/AiHint";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { PageActions } from "@/components/docs/PageActions";
import { SITE_TITLE_SUFFIX } from "@/components/docs/docs-meta";
import { type LangId, LangIcon } from "@/components/icons/LangIcon";
import { SITE_URL } from "@/lib/config/site";
import { SDK_GUIDES, sdkGuideHref } from "@/lib/data/sdk-guides";
import { SDK_INSTALL } from "@/lib/docs/code-samples";
import { docsHref, getDocumentedSpecs } from "@/lib/data/docs-registry";
import { ArrowRight } from "lucide-react";

const TITLE = "EPS SDKs";
const DESCRIPTION =
	"Backend SDKs for the EPS APIs in Node.js, Python, PHP, Go and Java — HMAC signing, input validation and typed errors built in.";
const MD_PATH = `${sdkGuideHref()}.md`;

/**
 * `/docs/sdk` — the SDK hub: every language, what it needs, how to install it,
 * and a link into its full guide. Cards are generated from `SDK_GUIDES`, so a
 * new SDK appears here, in the nav, in the sitemap and in the markdown twin
 * from one data edit.
 */
const SdkIndexPage = () => {
	const ordered = [...SDK_GUIDES].sort((a, b) => a.order - b.order);
	return (
		<>
			<Helmet>
				{/* Single child: react-helmet-async drops a multi-child <title>. */}
				<title>{`${TITLE}${SITE_TITLE_SUFFIX}`}</title>
				<meta name="description" content={DESCRIPTION} />
				<link rel="canonical" href={`${SITE_URL}${sdkGuideHref()}`} />
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
				<PageActions
					mdPath={MD_PATH}
					title={TITLE}
					kind="guide"
					className="mb-6"
				/>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
					{TITLE}
				</h1>
				<p className="mt-3 text-muted-foreground">
					Every SDK embeds the same API surface these docs are built from, so one
					generic <code>call(slug, params)</code> reaches all{" "}
					{getDocumentedSpecs().length} endpoints. Each signs your requests,
					validates params before sending, and reports failures the same way.
					Pick a language.
				</p>

				<div className="mt-8 grid gap-4 sm:grid-cols-2">
					{ordered.map((guide) => {
						const install = SDK_INSTALL[guide.lang];
						return (
							<Link
								key={guide.slug}
								to={sdkGuideHref(guide.slug)}
								className="group flex flex-col rounded-xl border border-border p-5 transition-colors hover:border-eko-gold"
							>
								<span className="flex items-center gap-2.5">
									<LangIcon
										id={guide.lang as LangId}
										className="h-5 w-5 shrink-0"
									/>
									<span className="font-semibold text-foreground">
										{guide.title}
									</span>
								</span>
								<span className="mt-2 flex-1 text-sm text-muted-foreground">
									{guide.summary}
								</span>
								{install && (
									<code className="mt-3 block overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
										{install.command}
									</code>
								)}
								<span className="mt-3 text-xs text-muted-foreground">
									{guide.minRuntime}
								</span>
								<span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-eko-gold">
									Read the guide
									<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
								</span>
							</Link>
						);
					})}
				</div>

				<h2 className="mt-12 text-lg font-semibold text-foreground">
					Not using one of these languages?
				</h2>
				<p className="mt-2 text-muted-foreground">
					Every endpoint is a plain signed REST call. The{" "}
					<Link to={docsHref("how-auth-works")} className="text-eko-gold hover:underline">
						authentication guide
					</Link>{" "}
					has paste-ready signing code in six languages, and each{" "}
					<Link to={docsHref()} className="text-eko-gold hover:underline">
						endpoint reference
					</Link>{" "}
					ships a cURL sample.
				</p>
			</DocsLayout>
		</>
	);
};

export default SdkIndexPage;
