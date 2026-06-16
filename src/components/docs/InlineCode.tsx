import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared inline code pill for docs pages. Styling matches the prose treatment
 * applied to MDX-rendered inline code via MdxGuide / docs-inline-code-prose.
 */
export const InlineCode = ({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) => (
	<code
		className={cn(
			"rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] font-normal",
			className,
		)}
	>
		{children}
	</code>
);
