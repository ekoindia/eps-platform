/**
 * Single source of truth for the primary site navigation.
 *
 * Both the desktop nav (`Header.tsx`) and the mobile drawer
 * (`HeaderDropdownPanels.tsx`) iterate this array, so item order and presence
 * stay in sync across breakpoints.
 */

import { SHOW_TRANSACT_MCP } from "@/lib/config/features";

/** Identifies a nav item that opens a dropdown (desktop) / accordion (mobile). */
export type DropdownKey =
	| "products"
	| "useCases"
	| "ai"
	| "developers"
	| "company";

export interface NavLink {
	label: string;
	/** Target URL for plain links. Omitted for dropdown-only items. */
	href?: string;
	/** External links render as `<a target="_blank">` instead of a router `<Link>`. */
	external?: boolean;
	/** Presence marks this item as a dropdown/accordion trigger. */
	dropdownKey?: DropdownKey;
}

export const navLinks: NavLink[] = [
	{ label: "Products", href: "/products", dropdownKey: "products" },
	{ label: "Use Cases", href: "/use-cases", dropdownKey: "useCases" },
	{ label: "Pricing", href: "/pricing" },
	// Two distinct AI stories once the transactional MCP is live: "Build with AI"
	// (dev-time, /ai) and "For AI agents" (runtime, /agents). Until then the item
	// stays a single plain link to /ai so we never surface the ungated page.
	SHOW_TRANSACT_MCP
		? { label: "AI", href: "/ai", dropdownKey: "ai" }
		: { label: "AI Agents", href: "/ai" },
	{ label: "Developers", dropdownKey: "developers" },
	{ label: "Company", dropdownKey: "company" },
];
