import type { ComponentType } from "react";

/**
 * A renderable icon component that accepts a `className`.
 *
 * Deliberately library-agnostic: satisfied by lucide-react icons
 * (`LucideIcon`), react-icons icons (`IconType`), and the project's own inline
 * `currentColor` SVG components (e.g. `McpIcon`, `HarnessIcon`). Use this
 * wherever a field or prop should accept an icon from any of those families.
 */
export type IconComponent = ComponentType<{ className?: string }>;
