/**
 * Compiled MDX bodies for the SDK guides, keyed by slug.
 *
 * Kept SEPARATE from `@/lib/data/sdk-guides` (the metadata) so that module stays
 * Node-loadable without the MDX toolchain — `ssg/routes.ts`, the markdown
 * plugin, the agent-bundle builder and the tests all import the metadata only.
 *
 * Imports are EAGER, not lazy, so the server and client render the same tree
 * during hydration (a lazy import would risk a mismatch).
 */
import type { ComponentType } from "react";

import Go from "./go.mdx";
import Java from "./java.mdx";
import Nodejs from "./nodejs.mdx";
import Php from "./php.mdx";
import Python from "./python.mdx";

export const SDK_GUIDE_COMPONENTS: Record<
	string,
	ComponentType<{ components?: Record<string, unknown> }>
> = {
	nodejs: Nodejs,
	python: Python,
	php: Php,
	go: Go,
	java: Java,
};
