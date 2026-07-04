/**
 * Per-caller execution context shared by the HTTP and stdio transports:
 * partner credentials, normalized environment, and the voluntary tool
 * allowlist. Nothing here is ever persisted or logged.
 */

/** Normalized execution context for one caller. */
export interface TransactCtx {
	developerKey: string;
	accessKey: string;
	/** Normalized to the EpsClient environment ids (never the raw header value). */
	environment: "sandbox" | "production";
	/** Allowed MCP tool NAMES (e.g. "eps_pan_lite"), or "all". Voluntary
	 * scoping set by the partner's client config — not entitlement enforcement;
	 * the partner's Eko credentials remain the real authorization boundary. */
	allowed: Set<string> | "all";
	initiatorId?: string;
	userCode?: string;
	fetch?: typeof fetch;
	now?: () => number;
}

/**
 * Map the wire environment name to the EpsClient environment id.
 * Returns undefined for unknown values (caller must reject, not guess).
 *
 * @param raw - `X-Eko-Env` header / `EKO_ENV` env value; absent → "uat".
 */
export const parseEnvironment = (
	raw: string | undefined,
): "sandbox" | "production" | undefined => {
	const value = (raw ?? "uat").trim().toLowerCase();
	if (value === "uat") return "sandbox";
	if (value === "production") return "production";
	return undefined;
};

/**
 * Parse the allowlist value: "*" → "all", else a Set of tool names.
 * Returns undefined for an absent/empty value (HTTP callers must send it
 * explicitly — these are paid APIs; "forgot the header" must not mean
 * "everything enabled").
 *
 * @param raw - `X-Eko-Allowed-Apis` header / `EKO_ALLOWED_APIS` env value.
 */
export const parseAllowed = (
	raw: string | undefined,
): Set<string> | "all" | undefined => {
	const value = raw?.trim();
	if (!value) return undefined;
	if (value === "*") return "all";
	const names = value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return names.length ? new Set(names) : undefined;
};

/** True when the tool name passes the allowlist. */
export const isAllowed = (ctx: TransactCtx, toolName: string): boolean =>
	ctx.allowed === "all" || ctx.allowed.has(toolName);
