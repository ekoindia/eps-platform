/**
 * `/console/uat-sandbox` — the three ways to call an EPS endpoint against UAT,
 * plus everything needed to sign one of those calls by hand.
 *
 * Nothing here talks to the network. The keypair is the public UAT pair from
 * `uatCredentials()`, and the signature is computed in the browser by the same
 * `<SecretKeyTester />` the "How Authentication Works" guide mounts — so this
 * page is a guide with a working calculator in it, not a request runner. The
 * runner already exists in two places this links out to: the docs Try-it modal
 * and the Postman collection.
 */
import { UatCredentialsBlock } from "@/components/console/UatCredentials";
import { Callout } from "@/components/docs/Callout";
import { SecretKeyTester } from "@/components/docs/SecretKeyTester";
import { EKOSTORE_KYC_ID } from "@/lib/connect/use-ekostore";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
import { uatCredentials } from "@/lib/uat-credentials";
import { BookOpen, Download, ShieldCheck, Terminal } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { SiPostman } from "react-icons/si";
import { Link } from "react-router-dom";

/** Same artifact the docs page-actions menu offers, built into `dist/agent/`. */
const POSTMAN_URL = "/agent/eps.postman_collection.json";

const inlineLink =
	"font-medium text-eko-navy underline underline-offset-4 hover:no-underline";

/** Inline `code` chip, matching the credential rows above it. */
const Code = ({ children }: { children: ReactNode }) => (
	<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em]">
		{children}
	</code>
);

/** One numbered way to test, in the shared `<ol className="divide-y">` list. */
const Way = ({
	icon: Icon,
	title,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	children: ReactNode;
}) => (
	<li className="flex gap-3 py-4 first:pt-0 last:pb-0">
		<Icon
			className="mt-0.5 h-4 w-4 shrink-0 text-eko-navy"
			aria-hidden="true"
		/>
		<div className="flex min-w-0 flex-col gap-1.5">
			<p className="text-sm font-semibold text-eko-navy">{title}</p>
			<div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
				{children}
			</div>
		</div>
	</li>
);

/**
 * Pointer to the ekostore-hosted KYC sandbox, for developers who want to see the
 * verification APIs return real data before writing any code.
 *
 * Gated on the same entitlement as the rail item it points at (`ConsoleLayout`'s
 * `EKOSTORE_KYC_ITEM`): that page tells an unentitled user it "isn't available on
 * this account", and offering a link that only resolves to a refusal is worse
 * than not offering it. Null (unresolved or failed) is treated as not entitled,
 * matching the rail.
 */
function LiveSandboxCallout() {
	const interactions = useRoleTransactionList();
	if (!interactions?.[String(EKOSTORE_KYC_ID)]) return null;
	return (
		<div className="flex gap-3 rounded-md border border-eko-navy/25 bg-eko-navy/5 p-4">
			<ShieldCheck
				className="mt-0.5 h-5 w-5 shrink-0 text-eko-navy"
				aria-hidden="true"
			/>
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium text-eko-navy">
					Prefer to click rather than code?
				</p>
				<p className="text-sm text-muted-foreground">
					Run the KYC &amp; verification APIs live — real requests, real
					responses, no integration — from{" "}
					<Link to="/console/kyc-verification" className={inlineLink}>
						Live Sandbox (KYC &amp; Verification)
					</Link>
					.
				</p>
			</div>
		</div>
	);
}

/**
 * Console "Test the APIs (UAT)" page.
 */
export default function TestApis() {
	const uat = uatCredentials();

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<Helmet>
				<title>How to test APIs (UAT)? | Eko Console</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>

			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">
					How to test APIs (UAT)?
				</h2>
				<p className="text-sm text-muted-foreground">
					{uat
						? "Three ways to call an EPS endpoint against the UAT (test) environment, using the test keys below."
						: "Three ways to call an EPS endpoint against the UAT (test) environment, once your test keys are available."}
				</p>
			</div>

			<UatCredentialsBlock />

			{/* Honest empty state: without a keypair the signer below has nothing to
			    seed from and the walkthroughs cannot be followed end to end. */}
			{uat ? null : (
				<Callout type="warning">
					<p>
						No UAT keypair is configured for this build, so the generator below
						starts empty and the steps that follow need keys you supply
						yourself. Paste your own <Code>access_key</Code> to sign, or ask
						your account manager for UAT access.
					</p>
				</Callout>
			)}

			<section className="flex flex-col gap-2">
				<h3 className="text-sm font-semibold text-eko-navy">
					Generate a secret-key
				</h3>
				<p className="text-sm text-muted-foreground">
					Every request carries three auth headers: <Code>developer_key</Code>{" "}
					(copy it above), <Code>secret-key</Code> and{" "}
					<Code>secret-key-timestamp</Code>. The secret-key is{" "}
					<Code>base64(HMAC-SHA256(timestamp, base64(access_key)))</Code> — a
					fresh signature per timestamp, never the access key itself. Generate a
					pair here, then paste both into whichever tool you are using.
				</p>
				<SecretKeyTester defaultAccessKey={uat?.accessKey ?? ""} />
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="text-sm font-semibold text-eko-navy">
					Three ways to test
				</h3>
				<ol className="divide-y rounded-md border px-4 py-2">
					<Way icon={BookOpen} title="Send it from the documentation">
						<p>
							Open{" "}
							<Link to="/docs" className={inlineLink}>
								Integration Docs
							</Link>
							, pick an API, then hit <strong>Test Request</strong> in the
							right-hand code pane and <strong>Send</strong> in the panel that
							opens.
						</p>
						<p>
							Nothing to paste: it is pre-filled with the UAT keys and signs
							every request in your browser.
						</p>
					</Way>

					<Way icon={Terminal} title="Copy the cURL and run it in a terminal">
						<p>
							On the same API page, the <strong>API</strong> tab of the
							right-hand pane holds a ready cURL command. Copy it, paste it into
							a terminal, and fill in <Code>developer_key</Code>,{" "}
							<Code>secret-key</Code> and <Code>secret-key-timestamp</Code> from
							the sections above.
						</p>
						<p>
							Send the same timestamp that produced the signature — a mismatched
							or stale pair is rejected. Hit <strong>Now</strong> in the
							generator to refresh both before each run.
						</p>
					</Way>

					<Way icon={SiPostman} title="Import the Postman collection">
						<p>
							<a
								href={POSTMAN_URL}
								download
								className={`inline-flex items-center gap-1.5 ${inlineLink}`}
							>
								<Download className="h-3.5 w-3.5" aria-hidden="true" />
								Download the Postman collection
							</a>{" "}
							— every documented endpoint, grouped by product.
						</p>
						<p>
							Import it, then set the collection's <Code>developer_key</Code>{" "}
							and <Code>access_key</Code> variables to the UAT pair above. Its
							pre-request script computes <Code>secret-key</Code> on every send,
							so there is no manual signing step here.
						</p>
					</Way>
				</ol>
			</section>

			<div>
				<Callout type="warning">
					<p>
						Use the{" "}
						<strong>
							sample values printed on each API's documentation page
						</strong>{" "}
						when testing against UAT. Arbitrary PANs, account numbers, mobile
						numbers or IDs generally will not resolve in the test environment,
						and the failure looks like an integration bug when it is only
						unknown test data.
					</p>
				</Callout>
				<Callout type="note">
					<p>
						A UAT call that used to work can start failing when the API provider
						changes the test data behind an endpoint — the documented sample
						stops matching what their sandbox holds. Report the issue to us and
						we will get it working again.
					</p>
				</Callout>
			</div>

			<LiveSandboxCallout />
		</div>
	);
}
