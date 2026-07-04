/**
 * Best-effort npm-registry version check. Because `npx` caches packages, users
 * on an old cached build silently get stale code + stale API data. This checks
 * the published `latest` and surfaces a nudge (stderr + `get_meta`) — it never
 * blocks startup, never throws, and does no network work when
 * `EPS_NO_UPDATE_CHECK` is set.
 */

const REGISTRY_URL =
	"https://registry.npmjs.org/@ekoindia/eps-context-mcp/latest";

/** Mutated in place by {@link checkForUpdate}; read by `get_meta`. */
export interface VersionState {
	current: string;
	latest?: string;
	updateAvailable?: boolean;
}

/**
 * Compare two strict `x.y.z` versions.
 * @returns 1 if a>b, -1 if a<b, 0 if equal, or null if either isn't strict
 *   semver (prerelease/dev builds → no comparison, no notice).
 */
export const compareVersions = (a: string, b: string): number | null => {
	const parse = (v: string): [number, number, number] | null => {
		const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
		return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
	};
	const pa = parse(a);
	const pb = parse(b);
	if (!pa || !pb) return null;
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
	}
	return 0;
};

/**
 * Fire-and-forget registry check. Mutates `state.latest`/`state.updateAvailable`
 * and logs an update nudge to stderr when a newer stable release exists.
 * Fully silent on offline/proxy/timeout/malformed responses. Awaitable so tests
 * can assert deterministically.
 */
export const checkForUpdate = async (state: VersionState): Promise<void> => {
	if (process.env.EPS_NO_UPDATE_CHECK) return;
	try {
		const res = await fetch(REGISTRY_URL, {
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return;
		const data = (await res.json()) as { version?: unknown };
		if (typeof data.version !== "string") return;
		const cmp = compareVersions(data.version, state.current);
		if (cmp === null) return;
		state.latest = data.version;
		state.updateAvailable = cmp > 0;
		if (state.updateAvailable) {
			console.error(
				`eps-context-mcp ${data.version} available (running ${state.current}). ` +
					`Use "npx -y @ekoindia/eps-context-mcp@latest" in your MCP config to always run the newest version.`,
			);
		}
	} catch {
		// offline / proxy / timeout / bad JSON — silent no-op
	}
};
