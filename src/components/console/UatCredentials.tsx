/**
 * The shared UAT keypair block, rendered on both `/console/credentials` and
 * `/console/uat-sandbox`.
 *
 * Extracted from `pages/console/Credentials.tsx` so the two pages cannot drift:
 * the test page needs the same `access_key` it feeds to the secret-key signer,
 * and a second copy of these rows would be a second place to forget the
 * "not issued yet" fallback. Markup is unchanged from the original.
 */
import { uatCredentials } from "@/lib/uat-credentials";
import { CopyButton } from "@/pages/ai/CommandBlock";

/** One `label / value / copy` row of the UAT credentials block. */
export function CredentialRow({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
				{label}
			</span>
			<code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
				{value}
			</code>
			<CopyButton text={value} label={`Copy ${label}`} />
		</div>
	);
}

/**
 * UAT keypair block. Shown to every signed-in developer regardless of lifecycle
 * state: the same keypair is already published anonymously in llms.txt, so
 * gating it here would protect nothing (see `uatCredentials`). Falls back to the
 * "not issued yet" note when the build env has no keypair configured.
 */
export function UatCredentialsBlock() {
	const credentials = uatCredentials();
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">
					{credentials ? "UAT API credentials" : "API credentials"}
				</p>
				<p className="text-sm text-muted-foreground">
					{credentials
						? "Keys for the UAT (test) environment. Nothing here touches live money or live records, so keep test data disposable. Your production keys are issued separately."
						: "Your UAT and production API keys will appear here once issued. Contact your account manager to expedite access."}
				</p>
			</div>
			{credentials ? (
				<div className="flex flex-col gap-2">
					<CredentialRow
						label="developer_key"
						value={credentials.developerKey}
					/>
					<CredentialRow label="access_key" value={credentials.accessKey} />
				</div>
			) : null}
		</div>
	);
}
