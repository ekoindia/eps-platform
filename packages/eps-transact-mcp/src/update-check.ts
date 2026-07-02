/**
 * Best-effort "is a newer version published?" check for the stdio bin. Never
 * throws, never blocks: offline / proxied / slow registry all resolve to "no
 * notice". Not used by the HTTP server — a remote user can't self-update.
 *
 * (Deliberately mirrors eps-context-mcp's update-check: two separately-published
 * packages can't share a src module, same call as the copied requestId/accessLog.
 * Drift-guarded: parity.copied-utils.test.ts pins both sides and fails on any
 * change, forcing a sync review.)
 */
const REGISTRY_URL =
	"https://registry.npmjs.org/@ekoindia/eps-transact-mcp/latest";

export interface VersionState {
	current: string;
	latest?: string;
	updateAvailable?: boolean;
}

/** Parse a strict `x.y.z` (no prerelease/build) into a numeric triple, or null. */
const parseStrict = (v: string): [number, number, number] | null => {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/**
 * True when `latest` is strictly newer than `current`. Returns undefined
 * ("unknown") if either side isn't a strict x.y.z — we never nudge on a
 * prerelease or a malformed version.
 */
export const isNewer = (
	current: string,
	latest: string,
): boolean | undefined => {
	const a = parseStrict(current);
	const b = parseStrict(latest);
	if (!a || !b) return undefined;
	for (let i = 0; i < 3; i++) {
		if (b[i] > a[i]) return true;
		if (b[i] < a[i]) return false;
	}
	return false;
};

/**
 * Fetch the published `latest` dist-tag and compare. Silent on any failure.
 *
 * @param current - this build's version (from package.json).
 * @param deps.fetch - injectable for tests; defaults to global fetch.
 * @param deps.timeoutMs - abort budget; default 3000.
 */
export const checkForUpdate = async (
	current: string,
	deps: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<VersionState> => {
	const fetchFn = deps.fetch ?? fetch;
	try {
		const res = await fetchFn(REGISTRY_URL, {
			signal: AbortSignal.timeout(deps.timeoutMs ?? 3000),
		});
		if (!res.ok) return { current };
		const body = (await res.json()) as { version?: unknown };
		const latest = typeof body.version === "string" ? body.version : undefined;
		if (!latest) return { current };
		const newer = isNewer(current, latest);
		return {
			current,
			latest,
			...(newer !== undefined && { updateAvailable: newer }),
		};
	} catch {
		return { current }; // offline / timeout / proxy / bad JSON — no notice
	}
};

/** The stderr line shown when a newer version exists. */
export const updateNotice = (state: VersionState): string =>
	`eps-transact-mcp ${state.latest} available (running ${state.current}). ` +
	`Use "npx -y @ekoindia/eps-transact-mcp@latest" in your MCP config to always run the newest version.`;

/**
 * stdio-only convenience: run the check (unless disabled) and emit the notice
 * to stderr. Awaited by the caller but bounded by the fetch timeout; failures
 * are swallowed so the server always starts.
 *
 * @param current - this build's version.
 * @param deps.env - environment map (default process.env) for the opt-out.
 * @param deps.warn - sink for the notice (default console.error).
 */
export const notifyIfOutdated = async (
	current: string,
	deps: {
		env?: Record<string, string | undefined>;
		fetch?: typeof fetch;
		warn?: (msg: string) => void;
	} = {},
): Promise<void> => {
	const env = deps.env ?? process.env;
	if (env.EPS_NO_UPDATE_CHECK === "1") return;
	const state = await checkForUpdate(current, { fetch: deps.fetch });
	if (state.updateAvailable) (deps.warn ?? console.error)(updateNotice(state));
};
