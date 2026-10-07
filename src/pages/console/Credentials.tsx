import { useConsoleMe } from "@/components/console/ConsoleLayout";
import {
	CredentialRow,
	UatCredentialsBlock,
} from "@/components/console/UatCredentials";
import { ApiError, authClient, type Lifecycle } from "@/lib/auth/client";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

type AadhaarKeyState =
	| { status: "loading" }
	| { status: "ok"; key: string }
	| { status: "hidden" }
	| { status: "error" };

/**
 * Production RSA public key for Aadhaar encryption. Mounted only for `active`
 * accounts, so a state change unmounts it and the cleanup drops a late answer.
 * The backend re-checks the state itself; this gate only avoids a pointless
 * request. 403/404 are deliberate "not for you / not configured" answers and
 * render nothing; anything else is transient and says so.
 */
function AadhaarProductionKey() {
	const [state, setState] = useState<AadhaarKeyState>({ status: "loading" });
	useEffect(() => {
		let current = true;
		authClient
			.aadhaarKey()
			.then(({ key }) => current && setState({ status: "ok", key }))
			.catch((error: unknown) => {
				if (!current) return;
				const deliberate =
					error instanceof ApiError &&
					(error.httpStatus === 403 || error.httpStatus === 404);
				setState({ status: deliberate ? "hidden" : "error" });
			});
		return () => {
			current = false;
		};
	}, []);

	if (state.status === "hidden" || state.status === "loading") return null;
	return (
		<div className="flex flex-col gap-2 border-t pt-3">
			<p className="text-sm text-muted-foreground">
				RSA public key for{" "}
				<Link
					to="/docs/aadhaar-number-encryption"
					className="font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
				>
					Aadhaar number encryption
				</Link>{" "}
				in production.
			</p>
			{state.status === "ok" ? (
				<CredentialRow label="aadhaar_rsa_key" value={state.key} />
			) : (
				<p className="text-sm text-destructive">
					Couldn&apos;t load the production Aadhaar key. Reload the page to try
					again.
				</p>
			)}
		</div>
	);
}

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
			{me.state === "active" ? <AadhaarProductionKey /> : null}
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
			<UatCredentialsBlock />
			<ProductionCredentials />
		</div>
	);
}
