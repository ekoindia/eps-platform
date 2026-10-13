/**
 * The single owner of a page's title + description + Open Graph / Twitter tags.
 *
 * React 19 + react-helmet-async v3 does NOT dedupe tags across `<Helmet>`
 * instances — every one renders, and the first <title> in tree order wins on
 * load. So render exactly one `<PageMeta>` per page; keep page-specific extras
 * (canonical, alternate, keywords, robots, JSON-LD) in the page's own <Helmet>.
 * The pre-render fails the build on two titles, an empty title or duplicate
 * metas (src/lib/ssr-head.ts).
 */
import { SITE_DESCRIPTION, SITE_OG_IMAGE } from "@/lib/config/site";
import { Helmet } from "react-helmet-async";

interface PageMetaProps {
	/** Full document title. A plain string: `<title>{a} | b</title>` renders empty in React 19. */
	title: string;
	/** Meta description; defaults to the site description. */
	description?: string;
	/** og:title / twitter:title; defaults to `title`. */
	ogTitle?: string;
	/** og:description / twitter:description; defaults to `description`. */
	ogDescription?: string;
	/** og:image / twitter:image; defaults to the site social preview. */
	image?: string;
	/** og:type; defaults to "website". */
	type?: "website" | "article";
}

export const PageMeta = ({
	title,
	description = SITE_DESCRIPTION,
	ogTitle = title,
	ogDescription = description,
	image = SITE_OG_IMAGE,
	type = "website",
}: PageMetaProps) => (
	<Helmet>
		<title>{title}</title>
		<meta name="description" content={description} />

		<meta property="og:type" content={type} />
		<meta property="og:title" content={ogTitle} />
		<meta property="og:description" content={ogDescription} />
		<meta property="og:image" content={image} />

		<meta name="twitter:title" content={ogTitle} />
		<meta name="twitter:description" content={ogDescription} />
		<meta name="twitter:image" content={image} />
	</Helmet>
);
