/**
 * App-level default SEO meta tags.
 *
 * Rendered once at the top of the component tree so that every page inherits
 * sensible defaults. Page-level <Helmet> blocks override individual tags via
 * react-helmet-async's built-in cascading (deepest wins per tag).
 */
import {
	SITE_DESCRIPTION,
	SITE_OG_IMAGE,
	SITE_OG_TITLE,
	SITE_TITLE,
	SOCIAL_TWITTER_HANDLE,
} from "@/lib/config/site";
import { Helmet } from "react-helmet-async";

export const DefaultMeta = () => (
	<Helmet>
		<title>{SITE_TITLE}</title>
		<meta name="description" content={SITE_DESCRIPTION} />

		<meta property="og:type" content="website" />
		<meta property="og:title" content={SITE_OG_TITLE} />
		<meta property="og:description" content={SITE_DESCRIPTION} />
		<meta property="og:image" content={SITE_OG_IMAGE} />

		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:site" content={SOCIAL_TWITTER_HANDLE} />
		<meta name="twitter:title" content={SITE_OG_TITLE} />
		<meta name="twitter:description" content={SITE_DESCRIPTION} />
		<meta name="twitter:image" content={SITE_OG_IMAGE} />
	</Helmet>
);
