/**
 * Secret-free diagnostics for a failing EPS `403`.
 *
 * Deliberately does NO signing and accepts NO `access_key`: this server is
 * reachable anonymously over HTTP, and a tool argument also lands in the
 * caller's model context. Everything here works on values that are already
 * public — the timestamp and the computed signature — plus a published
 * known-answer vector the caller checks their own implementation against.
 *
 * Pure and dependency-free so it unit-tests without an MCP client.
 */

/** One diagnostic verdict. `ok: null` = nothing supplied to check. */
export interface AuthCheck {
	name: string;
	ok: boolean | null;
	detail: string;
}

/** A 403 cause, keyed so consumers can act on the id rather than the prose. */
export interface AuthCause {
	id: string;
	cause: string;
	fix: string;
}

/** Epoch milliseconds is 13 digits until November 2286; seconds is 10. */
const MS_DIGITS = 13;
const SECONDS_DIGITS = 10;

/**
 * How far a timestamp may drift before it is worth suspecting. Eko does not
 * publish its tolerance, so this is a heuristic for the report, not a
 * documented limit — the correct behaviour is always to sign per request.
 */
export const DRIFT_WARN_MS = 5 * 60 * 1000;

/** Treat an omitted argument and an empty/whitespace string alike. */
const supplied = (value: string | undefined): string | undefined => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
};

/**
 * Classify `secret-key-timestamp` by digit length rather than parsing it as a
 * number: only a 13-digit value is converted, which keeps the arithmetic well
 * inside the safe-integer range whatever the caller pastes in.
 */
export const checkTimestamp = (
	value: string | undefined,
	nowMs: number,
): AuthCheck[] => {
	const timestamp = supplied(value);
	if (!timestamp)
		return [
			{
				name: "timestamp",
				ok: null,
				detail:
					"No timestamp supplied. Pass the exact secret-key-timestamp you sent.",
			},
		];

	if (!/^\d+$/.test(timestamp))
		return [
			{
				name: "timestamp_format",
				ok: false,
				detail:
					"Not a plain digit string. The timestamp is signed verbatim, so quotes, " +
					"a decimal point, a '+' or whitespace all change the signature.",
			},
		];

	if (timestamp.length === SECONDS_DIGITS)
		return [
			{
				name: "timestamp_unit",
				ok: false,
				detail:
					"10 digits — these are epoch SECONDS. Eko expects MILLISECONDS " +
					"(13 digits): use Date.now(), time.time()*1000, or System.currentTimeMillis().",
			},
		];

	if (timestamp.length !== MS_DIGITS)
		return [
			{
				name: "timestamp_unit",
				ok: false,
				detail: `${timestamp.length} digits — epoch milliseconds is ${MS_DIGITS}. Check for a truncated or padded value.`,
			},
		];

	// Signed drift: a clock running fast is as rejectable as one running slow.
	const driftMs = Number(timestamp) - nowMs;
	const magnitude = Math.abs(driftMs);
	const direction = driftMs > 0 ? "in the future" : "in the past";
	return [
		{ name: "timestamp_unit", ok: true, detail: "13 digits — milliseconds." },
		{
			name: "clock_drift",
			ok: magnitude <= DRIFT_WARN_MS,
			detail:
				magnitude <= DRIFT_WARN_MS
					? `${driftMs} ms from this server's clock — within the ${DRIFT_WARN_MS} ms heuristic.`
					: `${magnitude} ms ${direction} vs this server's clock (heuristic threshold ${DRIFT_WARN_MS} ms). ` +
						"Either the machine's clock is wrong (check NTP) or the timestamp is being " +
						"reused instead of regenerated per request.",
		},
	];
};

/** Strict base64: canonical alphabet, correct padding, decodes to 32 bytes. */
export const checkSignatureShape = (value: string | undefined): AuthCheck[] => {
	const signature = supplied(value);
	if (!signature)
		return [
			{
				name: "signature_shape",
				ok: null,
				detail:
					"No secret-key supplied. Pass the signature your code produced — " +
					"never the access_key it was derived from.",
			},
		];

	if (value !== signature)
		return [
			{
				name: "signature_shape",
				ok: false,
				detail:
					"Leading/trailing whitespace or a trailing newline. Header values are sent " +
					"verbatim — strip it (a common artefact of reading the key from a file).",
			},
		];

	if (/^[0-9a-f]{64}$/i.test(signature))
		return [
			{
				name: "signature_shape",
				ok: false,
				detail:
					"64 hex characters — this is the raw HMAC digest. The final base64 step " +
					"was skipped: base64-encode the digest bytes.",
			},
		];

	if (/[-_]/.test(signature))
		return [
			{
				name: "signature_shape",
				ok: false,
				detail:
					"Contains '-' or '_' — URL-safe base64. Eko expects the standard alphabet " +
					"('+' and '/'), padded with '='.",
			},
		];

	// Round-trip is the strict test: a lenient decoder accepts junk, but only a
	// canonical encoding re-encodes to itself.
	const decoded = Buffer.from(signature, "base64");
	if (decoded.toString("base64") !== signature)
		return [
			{
				name: "signature_shape",
				ok: false,
				detail:
					"Not canonical base64 — wrong padding or an out-of-alphabet character.",
			},
		];

	if (decoded.length !== 32)
		return [
			{
				name: "signature_shape",
				ok: false,
				detail: `Decodes to ${decoded.length} bytes; SHA-256 is 32. Check the hash algorithm — SHA-1 gives 20, SHA-512 gives 64.`,
			},
		];

	return [
		{
			name: "signature_shape",
			ok: true,
			detail:
				"Canonical base64 of 32 bytes — the right shape for HMAC-SHA256. " +
				"Shape alone cannot prove the value: run the test vector.",
		},
	];
};

/**
 * Ranked 403 causes, most likely first. Signing errors sit at the bottom on
 * purpose: the algorithm is confirmed against Eko's server and reproduced by
 * every published snippet, so once the test vector matches, the fault is almost
 * always provisioning or environment.
 */
export const RANKED_403_CAUSES: AuthCause[] = [
	{
		id: "ip_not_allowlisted",
		cause: "The calling server's public IP is not allowlisted for that key.",
		fix: "Send your egress IP to Eko support. Note that serverless/dynamic egress (Vercel, Lambda) cannot be allowlisted — call from a fixed-IP host.",
	},
	{
		id: "key_inactive",
		cause: "The key is not active, or not provisioned for that environment.",
		fix: "Confirm with Eko that the keypair is live for the environment you are calling.",
	},
	{
		id: "environment_mismatch",
		cause:
			"UAT credentials sent to the production base URL, or the reverse — the keys are environment-specific.",
		fix: "Check the base URL against the environments topic; the developer_key and access_key must come from the same environment.",
	},
	{
		id: "header_name_typo",
		cause:
			"Header spelled wrongly: `secret_key`/`secretKey` instead of `secret-key`, or `developer-key` instead of `developer_key`.",
		fix: "Header names are exactly: developer_key, secret-key, secret-key-timestamp, content-type.",
	},
	{
		id: "timestamp_mismatch",
		cause:
			"The signed timestamp is not the one sent in `secret-key-timestamp` — often a second Date.now() call, or a value cached across requests.",
		fix: "Compute the timestamp once, sign that exact string, and send the same string.",
	},
	{
		id: "key_decoded_before_signing",
		cause:
			"The base64 of the access_key was decoded back to bytes before being used as the HMAC key.",
		fix: "The HMAC key is the base64 STRING itself, used as-is. Confirm with the test vector.",
	},
];
