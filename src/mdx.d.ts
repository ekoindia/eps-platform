declare module "*.mdx" {
	import type { ComponentType } from "react";
	/** Compiled MDX document — accepts an optional `components` override map. */
	const MDXComponent: ComponentType<{
		components?: Record<string, unknown>;
	}>;
	export default MDXComponent;
}
