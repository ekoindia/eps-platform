/**
 * Typographic wrapper for compiled MDX in the docs column — tracks the site
 * theme and inverts under docs-local dark mode.
 *
 * Shared by `MdxGuide` (`/docs/<slug>` guides) and `SdkGuidePage`
 * (`/docs/sdk/<lang>`) so the two render identically without either copying the
 * class string.
 */
import type { ReactNode } from "react";

export const MdxProse = ({ children }: { children: ReactNode }) => (
	<div className="docs-inline-code-prose prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-semibold prose-a:text-eko-gold-ink prose-a:underline dark:prose-a:text-eko-gold [&_:where(h1,h2,h3,h4,h5,h6)_a]:!no-underline [&_:where(h1,h2,h3,h4,h5,h6)_a]:!text-eko-navy dark:[&_:where(h1,h2,h3,h4,h5,h6)_a]:!text-eko-gold">
		{children}
	</div>
);
