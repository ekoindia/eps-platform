/**
 * App-level meta tags that are the same on every page.
 *
 * React 19 + react-helmet-async v3 renders every <Helmet> instance — there is
 * no "deepest wins" cascading — so anything a page can override (title,
 * description, og:*, twitter title/description/image) lives in `PageMeta`, not
 * here. Only never-overridden singletons stay.
 */
import { SOCIAL_TWITTER_HANDLE } from "@/lib/config/site";
import { Helmet } from "react-helmet-async";

export const DefaultMeta = () => (
	<Helmet>
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:site" content={SOCIAL_TWITTER_HANDLE} />
	</Helmet>
);
