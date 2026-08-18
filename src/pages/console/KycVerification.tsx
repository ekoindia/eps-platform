import { EKOSTORE_KYC_ID, useEkostoreUrl } from "@/lib/connect/use-ekostore";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

/** Heading for the states that are a message rather than the embedded sandbox. */
const Header = () => (
	<h2 className="text-lg font-semibold text-eko-navy">
		Test KYC &amp; Verification APIs
	</h2>
);

/**
 * Frames ekostore's KYC & verification sandbox inside the console.
 *
 * ekostore serves a gateway rendering of that page — no branding, header, footer
 * or rail — precisely so it can be embedded, and the URL carries a connect-api
 * access token so the user is not asked to sign in a second time.
 */
const KycVerification = () => {
	const interactions = useRoleTransactionList();
	// Tri-state: null while the list is unresolved, so an entitled user is never
	// told "unavailable" on the way to being told the truth.
	const entitled =
		interactions === null
			? null
			: Boolean(interactions[String(EKOSTORE_KYC_ID)]);
	const { url, failed } = useEkostoreUrl(entitled === true);

	// The rail hides this page, but the route is reachable by URL — a nav item is
	// not an access control. The backend re-checks the same entitlement.
	if (entitled === false) {
		return (
			<div className="flex max-w-3xl flex-col gap-6">
				<Header />
				<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
					The KYC &amp; verification sandbox isn't available on this account.
				</div>
			</div>
		);
	}

	if (failed) {
		return (
			<div className="flex max-w-3xl flex-col gap-6">
				<Header />
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
					<p className="font-medium">Couldn't open the sandbox.</p>
					<p className="mt-1">
						The handoff to ekostore was refused. Reload to try again, or{" "}
						<Link to="/console" className="underline underline-offset-4">
							go back to the console
						</Link>
						.
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<Helmet>
				<title>KYC &amp; Verification Sandbox | Eko Console</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			{/* ponytail: negative margins rather than a full-bleed branch in the
			    layout — `main` pads with px-4 sm:px-6 lg:px-8 pb-16, and this is the
			    only page that wants none of it. The top padding stays: `lg:pt-28` is
			    what clears the fixed site header. */}
			<div className="-mx-4 -mb-16 flex h-[80dvh] flex-col sm:-mx-6 lg:-mx-8 lg:h-[calc(100dvh-7rem)]">
				{url ? (
					<>
						<iframe
							// Camera is not inherited by a cross-origin frame, and document
							// capture needs it. No microphone: nothing here records audio.
							allow="camera"
							// Keeps the console URL out of ekostore's logs. The token is on
							// the `src` either way — see docs/features/connect-widget.md.
							referrerPolicy="no-referrer"
							src={url}
							title="KYC & Verification sandbox"
							className="min-h-0 w-full grow border-0 bg-white"
						/>
						{/* A frame ekostore refuses to be embedded in (`X-Frame-Options`,
						    `frame-ancestors`) renders as the browser's own "refused to
						    connect" panel, and no `onError` fires cross-origin for us to
						    catch. So the way out is always offered rather than shown in
						    response to a failure we cannot detect. Same URL, same token:
						    a top-level navigation is never refused. */}
						<p className="shrink-0 px-4 py-1.5 text-right text-xs sm:px-6 lg:px-8">
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
							>
								Open in new tab
							</a>
						</p>
					</>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						Opening the sandbox…
					</div>
				)}
			</div>
		</>
	);
};

export default KycVerification;
