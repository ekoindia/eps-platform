import { Helmet } from "react-helmet-async";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import agreementMarkdown from "@/content/legal/partner-agreement.md?raw";
import { AiHint } from "@/components/AiHint";
import LegalPageLayout from "@/components/LegalPageLayout";
import { SITE_OG_IMAGE, SITE_URL } from "@/lib/config/site";

const PAGE_PATH = "/samples/partner-agreement";
const MD_PATH = `${PAGE_PATH}.md`;
const PAGE_TITLE = "Sample Partner Agreement | Eko Platform Services";
const PAGE_DESCRIPTION =
	"Read the Eko Platform Services partner agreement before you sign it. A sample, published for review — signing commits you to no fee and no minimum usage.";
const PAGE_KEYWORDS =
	"Eko partner agreement, EPS agreement sample, API partner contract, business correspondent agreement, fintech API terms";

/**
 * `/samples/partner-agreement` — the EPS partner agreement, published as a
 * reviewable sample plus an explanatory FAQ.
 *
 * Single source of truth is `src/content/legal/partner-agreement.md`, imported
 * `?raw` here and copied verbatim to the `.md` twin by
 * `vite-plugin-generate-markdown.ts`. `noindex`: this is a contract sample, not
 * a page we want ranking — but it stays fetchable so an AI agent handed the URL
 * can read and explain it.
 */
const PartnerAgreementSamplePage = () => (
	<LegalPageLayout
		title="Eko Platform Services Agreement — Sample"
		description={PAGE_DESCRIPTION}
	>
		<Helmet>
			<title>{PAGE_TITLE}</title>
			<meta name="robots" content="noindex" />
			<meta name="keywords" content={PAGE_KEYWORDS} />
			<link rel="canonical" href={`${SITE_URL}${PAGE_PATH}`} />
			<link
				rel="alternate"
				type="text/markdown"
				href={`${SITE_URL}${MD_PATH}`}
			/>
			<meta property="og:title" content={PAGE_TITLE} />
			<meta property="og:description" content={PAGE_DESCRIPTION} />
			<meta property="og:url" content={`${SITE_URL}${PAGE_PATH}`} />
			<meta property="og:image" content={SITE_OG_IMAGE} />
			<meta name="twitter:title" content={PAGE_TITLE} />
			<meta name="twitter:description" content={PAGE_DESCRIPTION} />
			<meta name="twitter:image" content={SITE_OG_IMAGE} />
		</Helmet>

		<AiHint mdPath={MD_PATH} />

		{/* ponytail: plain @tailwindcss/typography, no custom prose components —
		    the ask was markdown hierarchy and nothing more. The source file's own
		    `#` heading is dropped; LegalPageLayout already renders the <h1>. */}
		<div className="prose prose-slate max-w-none dark:prose-invert">
			<Markdown remarkPlugins={[remarkGfm]} disallowedElements={["h1"]}>
				{agreementMarkdown}
			</Markdown>
		</div>
	</LegalPageLayout>
);

export default PartnerAgreementSamplePage;
