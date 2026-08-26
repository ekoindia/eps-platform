import { useConsoleMe } from "@/components/console/ConsoleLayout";
import type { Lifecycle } from "@/lib/auth/client";
import { uatCredentials } from "@/lib/uat-credentials";
import { CopyButton } from "@/pages/ai/CommandBlock";
import { Link } from "react-router-dom";

/** One `label / value / copy` row of the UAT credentials block. */
function CredentialRow({ label, value }: { label: string; value: string }) {
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
function ApiCredentials() {
	const credentials = uatCredentials();
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">
					{credentials ? "UAT API credentials" : "API credentials"}
				</p>
				<p className="text-sm text-muted-foreground">
					{credentials
						? "Shared keys for the UAT (test) environment — everyone gets the same pair, so keep test data disposable. Your production keys are issued separately."
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

/** Copy shown to any account that hasn't reached "active" yet. */
const FINISH_ONBOARDING = {
	body: "Finish onboarding to request production keys.",
	cta: { label: "Continue onboarding", href: "/signup" },
} as const;

/**
 * Production-key copy per lifecycle state. The map is keyed on `Lifecycle`
 * itself, so it is total by construction and needs no fallback branch — a state
 * added upstream fails the build here rather than rendering blank.
 */
const PRODUCTION_COPY: Record<
	Lifecycle,
	{ body: string; cta?: { label: string; href: string } }
> = {
	active: {
		body: "Production keys are generated and emailed to your registered email address once your account is approved. Please check your inbox and spam folder for email from `eps.support@eko.co.in`. If you haven't received it within a day, contact us.",
		// cta: { label: "Contact your account manager", href: "/grievance" },
	},
	// Not `FINISH_ONBOARDING`: this partner HAS finished onboarding, so pointing
	// them back at /signup would send them round a loop they have already run.
	"kyc-pending": {
		body: "Production keys are issued once your KYC documents have been uploaded and verified by our team. Please wait for an email from `eps.support@eko.co.in`, once your documents have been approved.",
		cta: { label: "Upload documents", href: "/console/documents" },
	},
	// Also not `FINISH_ONBOARDING`, and deliberately not the `kyc-pending` copy:
	// telling a partner whose documents were refused to wait for an email is the
	// one instruction that cannot resolve their state.
	"kyc-rejected": {
		body: "One or more of your KYC documents were not accepted. Open Upload Documents to see why each one was rejected and upload it again — production keys are issued once the re-uploaded documents are verified by our team.",
		cta: { label: "Re-upload documents", href: "/console/documents" },
	},
	lead: FINISH_ONBOARDING,
	onboarded: FINISH_ONBOARDING,
	unknown: FINISH_ONBOARDING,
	inactive: {
		body: "Your account is inactive, so production keys cannot be issued.",
		cta: { label: "Contact support", href: "/grievance" },
	},
};

/**
 * Production keypair block — deliberately an empty state with no request
 * button: no credential-issuance API exists yet, and a button that cannot
 * issue a key is worse than honest copy. When an endpoint lands, the fetch
 * goes here.
 */
function ProductionCredentials() {
	const me = useConsoleMe();
	const copy = PRODUCTION_COPY[me.state];
	return (
		<div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">Production API credentials</p>
				<p className="text-sm text-muted-foreground">{copy.body}</p>
			</div>
			{copy.cta ? (
				<Link
					to={copy.cta.href}
					className="self-start text-sm font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
				>
					{copy.cta.label}
				</Link>
			) : null}
		</div>
	);
}

/**
 * Console Credentials page: the shared UAT keypair, plus the production-key
 * status for this account.
 */
export default function Credentials() {
	return (
		<div className="flex max-w-2xl flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">Credentials</h2>
				<p className="text-sm text-muted-foreground">
					Keys for signing EPS API requests.
				</p>
			</div>
			<ApiCredentials />
			<ProductionCredentials />
		</div>
	);
}
