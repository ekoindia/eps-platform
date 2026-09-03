/**
 * Named-format registry for request params — the single source of truth the
 * SDKs validate against (`format?` on {@link ApiParam}). Baked into
 * `data/sdk-surface.json` as `formats`, so no language keeps its own copy.
 *
 * Every pattern is compiled by five regex engines: JS, PCRE (PHP), Python `re`,
 * Go RE2 and `java.util.regex`. RE2 is the binding constraint — it has no
 * lookaround and no backreferences — so the portable subset is:
 *
 *   - anchored `^…$`, matched against the WHOLE wire string (each SDK uses its
 *     full-match primitive so a trailing newline never sneaks through);
 *   - ASCII only; character classes, groups, `?` `*` `+` `{m,n}`, `\d`;
 *   - NO lookaround, backreferences, named groups, possessive quantifiers,
 *     inline flags, or `\b`/`\A`/`\z` (spelled differently per engine).
 *
 * These are SYNTACTIC checks — `date` accepts `2026-02-31`, `lat-long` accepts
 * `999,-999`. They catch the wrong shape before a request is signed; the
 * server still owns semantics.
 */
export interface ApiParamFormat {
	/** Portable regex source (no delimiters, no flags). */
	pattern: string;
	/** Human label shown in docs and error messages. */
	label: string;
}

export const API_PARAM_FORMATS: Record<string, ApiParamFormat> = {
	date: { pattern: "^\\d{4}-\\d{2}-\\d{2}$", label: "YYYY-MM-DD" },
	"lat-long": {
		pattern: "^-?\\d{1,3}(\\.\\d+)?,-?\\d{1,3}(\\.\\d+)?$",
		label: "latitude,longitude",
	},
	mobile: { pattern: "^[6-9]\\d{9}$", label: "10-digit Indian mobile number" },
	pan: { pattern: "^[A-Z]{5}\\d{4}[A-Z]$", label: "PAN (e.g. ABCDE1234F)" },
	aadhaar: { pattern: "^\\d{12}$", label: "12-digit Aadhaar number" },
	ifsc: { pattern: "^[A-Z]{4}0[A-Z0-9]{6}$", label: "IFSC code" },
	pincode: { pattern: "^\\d{6}$", label: "6-digit PIN code" },
	"client-ref": {
		pattern: "^[A-Za-z0-9_-]{1,20}$",
		label: "1-20 letters, digits, _ or -",
	},
};

/** Name → pattern, the shape baked into the SDK surface. */
export const formatPatterns = (): Record<string, string> =>
	Object.fromEntries(
		Object.entries(API_PARAM_FORMATS).map(([name, f]) => [name, f.pattern]),
	);

/** Constructs the portable subset forbids; each is spelled differently (or not
 * at all) across the five engines. */
const NON_PORTABLE = /\(\?|\\[1-9bAzZ]|\+\+|\*\+|\?\+|\{\d+(,\d*)?\}\+/;

/**
 * Throws if a registry pattern is unanchored, uses a non-portable construct,
 * or does not compile. Runs at build time via `assertParamFormats`.
 */
export const assertFormatRegistry = (
	formats: Record<string, ApiParamFormat> = API_PARAM_FORMATS,
): void => {
	for (const [name, { pattern }] of Object.entries(formats)) {
		if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
			throw new Error(`api-formats: "${name}" must be anchored with ^…$.`);
		}
		if (/[^\x20-\x7e]/.test(pattern)) {
			throw new Error(`api-formats: "${name}" must be ASCII only.`);
		}
		if (NON_PORTABLE.test(pattern)) {
			throw new Error(
				`api-formats: "${name}" uses a construct outside the portable subset (see the file header).`,
			);
		}
		try {
			new RegExp(pattern);
		} catch (err) {
			throw new Error(
				`api-formats: "${name}" does not compile: ${String(err)}`,
			);
		}
	}
};
