import type { ComponentType } from "react";
import ErrorCodes from "./error-codes.mdx";
import HowAuthWorks from "./how-auth-works.mdx";
import Quickstart from "./quickstart.mdx";

/**
 * Eager map of guide slug → compiled MDX component. Imports live here (NOT in
 * `docs-guides.ts`) so the metadata stays Node/SSR-safe and `.mdx` only enters
 * the bundle via the lazy docs detail page. Eager (not lazy) so server and
 * client render trees match during hydration.
 *
 * Keep keys in sync with `GUIDES` in `docs-guides.ts`.
 */
export const GUIDE_COMPONENTS: Record<
	string,
	ComponentType<{ components?: Record<string, unknown> }>
> = {
	quickstart: Quickstart,
	"how-auth-works": HowAuthWorks,
	"error-codes": ErrorCodes,
};
