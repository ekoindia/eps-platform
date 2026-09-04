/**
 * `<SecretKeyTester />` — interactive `secret-key` playground embedded at the
 * end of the "How Authentication Works" guide.
 *
 * Everything runs in the visitor's browser: the signature is computed with Web
 * Crypto via `computeSecretKey`, and the access key is held in component state
 * only — it is never sent to Eko or anywhere else, and never persisted. SSR-safe
 * by construction: the first render is a static shell, the timestamp is seeded
 * from a mount effect, and all crypto happens in effects/handlers.
 *
 *   secret-key = base64( HMAC-SHA256( timestamp, base64(access_key) ) )
 */
import { CopyBtn } from "@/components/docs/copy-btn";
import { API_AUTH_INFO } from "@/lib/data/api-auth";
import { computeSecretKey } from "@/lib/docs/eko-signing";
import { uatCredentials } from "@/lib/uat-credentials";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	ChevronRight,
	Clock,
	Eye,
	EyeOff,
	FlaskConical,
	KeyRound,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

/** A signable timestamp is a plain digit string — it is signed verbatim. */
const DIGITS_ONLY = /^\d+$/;

/** Epoch-seconds instead of milliseconds is a real, silent cause of `403`. */
const SECONDS_LENGTH = 10;

const fieldLabel =
	"flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const fieldInput =
	"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition-colors placeholder:font-sans placeholder:text-slate-400 focus:border-eko-gold focus:ring-2 focus:ring-eko-gold/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

const ghostButton =
	"inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";

const sampleLink =
	"inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-eko-navy transition-colors hover:underline dark:text-eko-gold";

/** The published known-answer vector, shared with the agent bundle's `auth`
 * topic and the `debug_auth` MCP tool — one definition, both audiences. */
const TEST_VECTOR = API_AUTH_INFO.testVector;

/** The timestamp rendered as local wall-clock time, or null when unusable. */
const localTime = (timestamp: string): string | null => {
	const date = new Date(Number(timestamp));
	return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

/** One labelled, copyable output value. */
const OutputRow = ({
	label,
	value,
	placeholder,
	accent,
}: {
	label: string;
	value: string;
	placeholder: string;
	accent?: boolean;
}) => (
	<div>
		<div className="mb-1.5 flex items-center justify-between gap-2">
			{/* A <span>, not <code>: the site's inline-code chip styling fights the
			    card's own surface in dark mode. */}
			<span className="font-mono text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{label}
			</span>
			{value ? <CopyBtn text={value} label="Copy" /> : null}
		</div>
		<div
			className={cn(
				"break-all rounded-lg border px-3 py-2.5 font-mono text-sm",
				value
					? "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
					: "border-dashed border-slate-300 bg-transparent text-slate-400 dark:border-slate-600 dark:text-slate-500",
				value && accent && "text-eko-navy dark:text-eko-gold",
			)}
		>
			{value || placeholder}
		</div>
	</div>
);

/**
 * @param defaultAccessKey - Access key to seed the field with on mount. The docs
 * mount passes nothing (a visitor pastes their own key); the console test page
 * passes the shared UAT key so a signature is ready without a single click.
 */
export const SecretKeyTester = ({
	defaultAccessKey = "",
}: {
	defaultAccessKey?: string;
} = {}) => {
	const [accessKey, setAccessKey] = useState("");
	const [timestamp, setTimestamp] = useState("");
	const [reveal, setReveal] = useState(false);
	const [expected, setExpected] = useState("");
	const [secretKey, setSecretKey] = useState("");
	const [error, setError] = useState("");

	// Client-only seed: keeps the SSR and first client render identical. Both
	// values are seeded here rather than in useState — `Date.now()` cannot be an
	// initial value without a hydration mismatch, and seeding only one of them
	// there would put the two halves of the same input pair out of step.
	useEffect(() => {
		setTimestamp(String(Date.now()));
		if (defaultAccessKey) setAccessKey(defaultAccessKey);
		// Mount-only: a caller changing the default later must not clobber what the
		// user has since typed into the field.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const key = accessKey.trim();
	const stamp = timestamp.trim();
	const validStamp = DIGITS_ONLY.test(stamp);

	useEffect(() => {
		// Clear stale output first: a signature must never outlive the inputs
		// that produced it, or the verifier below would validate the wrong pair.
		if (!key || !validStamp) {
			setSecretKey("");
			setError("");
			return;
		}
		let cancelled = false;
		computeSecretKey(key, stamp).then(
			(signature) => {
				if (cancelled) return;
				setSecretKey(signature);
				setError("");
			},
			() => {
				if (cancelled) return;
				setSecretKey("");
				setError(
					"Web Crypto is unavailable here — signing needs a secure context (https or localhost).",
				);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [key, stamp, validStamp]);

	const uat = uatCredentials();
	const stampTime = validStamp ? localTime(stamp) : null;
	const looksLikeSeconds = validStamp && stamp.length === SECONDS_LENGTH;

	const expectedSignature = expected.trim();
	// Undecided until there is something real on both sides of the comparison.
	const matches =
		expectedSignature && secretKey ? expectedSignature === secretKey : null;

	return (
		<div className="not-prose my-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
			<div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
				<span className="grid h-9 w-9 place-items-center rounded-lg bg-eko-navy text-eko-gold">
					<KeyRound className="h-4.5 w-4.5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
						secret-key playground
					</div>
					<div className="truncate font-mono text-[0.7rem] text-slate-500 dark:text-slate-400">
						base64( HMAC-SHA256( timestamp, base64(access_key) ) )
					</div>
				</div>
				<span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-300">
					Runs in your browser
				</span>
			</div>

			<div className="space-y-5 bg-white px-4 py-5 dark:bg-slate-950/40">
				<div className="grid gap-5 md:grid-cols-2">
					<div className="space-y-1.5">
						<label className={fieldLabel} htmlFor="skt-access-key">
							<KeyRound className="h-3.5 w-3.5" />
							Access Key <span className="normal-case">(auth key)</span>
						</label>
						<div className="flex gap-2">
							<input
								id="skt-access-key"
								type={reveal ? "text" : "password"}
								value={accessKey}
								onChange={(e) => setAccessKey(e.target.value)}
								placeholder="Paste your access key"
								autoComplete="off"
								spellCheck={false}
								className={fieldInput}
							/>
							<button
								type="button"
								onClick={() => setReveal((v) => !v)}
								aria-label={reveal ? "Hide access key" : "Show access key"}
								className={ghostButton}
							>
								{reveal ? (
									<EyeOff className="h-3.5 w-3.5" />
								) : (
									<Eye className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
						<div className="flex flex-wrap gap-x-4 gap-y-1">
							{uat ? (
								<button
									type="button"
									onClick={() => setAccessKey(uat.accessKey)}
									className={sampleLink}
								>
									<Sparkles className="h-3.5 w-3.5" />
									Use the UAT test key
								</button>
							) : null}
							{/* Same constant the agent bundle publishes as `auth.testVector`
							    and `debug_auth` returns — one definition, both audiences. */}
							<button
								type="button"
								onClick={() => {
									setAccessKey(TEST_VECTOR.accessKey);
									setTimestamp(TEST_VECTOR.timestamp);
									setExpected(TEST_VECTOR.secretKey);
								}}
								className={sampleLink}
							>
								<FlaskConical className="h-3.5 w-3.5" />
								Load the published test vector
							</button>
						</div>
					</div>

					<div className="space-y-1.5">
						<label className={fieldLabel} htmlFor="skt-timestamp">
							<Clock className="h-3.5 w-3.5" />
							Timestamp <span className="normal-case">(milliseconds)</span>
						</label>
						<div className="flex gap-2">
							{/* Text, not number: the string is signed verbatim, and a number
							    input would accept exponent notation and normalise the value. */}
							<input
								id="skt-timestamp"
								type="text"
								inputMode="numeric"
								pattern="[0-9]*"
								value={timestamp}
								onChange={(e) => setTimestamp(e.target.value)}
								placeholder="1700000000000"
								autoComplete="off"
								spellCheck={false}
								className={fieldInput}
							/>
							<button
								type="button"
								onClick={() => setTimestamp(String(Date.now()))}
								className={ghostButton}
							>
								<RefreshCw className="h-3.5 w-3.5" />
								Now
							</button>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400">
							{!stamp ? (
								"Send this exact value as secret-key-timestamp."
							) : !validStamp ? (
								<span className="text-red-600 dark:text-red-400">
									Digits only — the timestamp is signed as a string.
								</span>
							) : looksLikeSeconds ? (
								<span className="inline-flex items-start gap-1 text-amber-700 dark:text-amber-400">
									<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
									That looks like seconds. Eko expects milliseconds.
								</span>
							) : (
								(stampTime ?? "Out of range for a calendar date.")
							)}
						</p>
					</div>
				</div>

				{error ? (
					<p className="rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300">
						{error}
					</p>
				) : null}

				<div className="grid gap-4 md:grid-cols-2">
					<OutputRow
						label="secret-key"
						value={secretKey}
						placeholder="Enter an access key and timestamp"
						accent
					/>
					<OutputRow
						label="secret-key-timestamp"
						value={validStamp ? stamp : ""}
						placeholder="Waiting for a valid timestamp"
					/>
				</div>

				<details className="group rounded-lg border border-slate-200 dark:border-slate-700">
					<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
						<ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
						Verify an existing signature
					</summary>
					<div className="space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
						<label className={fieldLabel} htmlFor="skt-expected">
							Signature to check
						</label>
						<input
							id="skt-expected"
							type="text"
							value={expected}
							onChange={(e) => setExpected(e.target.value)}
							placeholder="Paste the secret-key your code produced"
							autoComplete="off"
							spellCheck={false}
							className={fieldInput}
						/>
						<div aria-live="polite">
							{matches === null ? (
								<p className="text-xs text-slate-500 dark:text-slate-400">
									Paste a signature above to compare it against the one computed
									from the same access key and timestamp.
								</p>
							) : matches ? (
								<p className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-300">
									<ShieldCheck className="h-4 w-4 shrink-0" />
									Signatures match
								</p>
							) : (
								<div className="rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300">
									<p className="inline-flex items-center gap-2 text-sm font-medium">
										<ShieldAlert className="h-4 w-4 shrink-0" />
										No match
									</p>
									<ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
										<li>
											The HMAC key must be the base64 <em>string</em>, not its
											decoded bytes.
										</li>
										<li>
											The message must be the same timestamp you send in{" "}
											<code className="rounded bg-red-500/10 px-1 font-mono">
												secret-key-timestamp
											</code>
											, in milliseconds.
										</li>
										<li>Check for a trailing newline or stray whitespace.</li>
									</ul>
								</div>
							)}
						</div>
					</div>
				</details>
			</div>
		</div>
	);
};
