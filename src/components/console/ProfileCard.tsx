import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MeView } from "@/lib/auth/client";
import { nameInitials } from "@/lib/auth/identity";
import { lifecycleBadge } from "@/lib/console/lifecycle";
import { formatMobile } from "@/lib/utils";
import { CopyButton } from "@/pages/ai/CommandBlock";
import { Hash, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Who is signed in, at the head of Console Home.
 *
 * The same identity the /console/profile page opens with, cut down to what a
 * partner needs at a glance: name, lifecycle state, the two ways we reach them,
 * and a way through to the full page.
 *
 * Every field falls back, because `me.profile` is null for a session whose
 * upstream lookup came back empty — that account still has a mobile, and the
 * card still has to render.
 * @param me - The session view.
 */
export default function ProfileCard({ me }: { me: MeView }) {
	// Derived from the profile name ALONE. Taking initials from the mobile
	// fallback would spell "9" for a number; the `#NN` form (shared with the
	// header menu's `accountIdentity`) reads as an account, not a person.
	const personName = me.profile?.name?.trim();
	const initials = personName
		? nameInitials(personName)
		: `#${me.mobile.slice(-2)}`;
	const email = me.profile?.email?.trim();
	// Trimmed before the fallback: upstream defaults missing fields to "", and a
	// whitespace-only mobile would otherwise beat the one the session came in on.
	const mobile = me.profile?.mobile?.trim() || me.mobile;
	// Numeric upstream, so stringified before render and before copy.
	const code = me.profile?.code ? String(me.profile.code) : "";
	const badge = lifecycleBadge(me.state);
	// A KYC state is the one badge that names an action: the documents page is
	// where it gets resolved, so the tag itself goes there rather than making
	// the partner find Upload Documents in the rail.
	const kycTag = me.state === "kyc-pending" || me.state === "kyc-rejected";

	return (
		// Half the avatar hangs above the card, so the wrapper reserves that half
		// (h-20 avatar → -mt-10 → pt-10) rather than letting it overlap whatever
		// sits above in the grid.
		<div className="pt-10">
			<div className="flex flex-col items-center gap-3 rounded-xl bg-gradient-to-b from-eko-navy-light to-eko-navy px-6 pb-6 text-center text-white">
				{/* Fill and ring are both OPAQUE: the top half of this circle sits over
				    the page, not the card, so a translucent white fill (what the card's
				    own tints use) would render white-on-white and the initials would
				    disappear above the card's edge.
				    `notranslate` because Google Translate mangles bare initials, and
				    aria-hidden because the name below already says who this is. */}
				<div
					className="notranslate -mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-full bg-eko-navy text-2xl font-semibold text-white ring-4 ring-background"
					aria-hidden="true"
				>
					{initials}
				</div>
				<div className="flex w-full min-w-0 flex-col items-center gap-2">
					{/* `w-full min-w-0` so a long single-word name truncates instead of
					    stretching the column. */}
					<h3 className="w-full min-w-0 truncate text-lg font-semibold text-eko-gold">
						{personName || me.mobile}
					</h3>
					{kycTag ? (
						<Link
							to="/console/documents"
							className="rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
						>
							<Badge variant={badge.variant} className="cursor-pointer">
								{badge.label}
							</Badge>
						</Link>
					) : (
						<Badge variant={badge.variant}>{badge.label}</Badge>
					)}
				</div>
				<div className="flex w-full min-w-0 flex-col items-center gap-1.5 text-sm">
					<p className="flex items-center gap-2">
						<Phone
							className="h-4 w-4 shrink-0 text-eko-gold"
							aria-hidden="true"
						/>
						{formatMobile(mobile)}
					</p>
					{email ? (
						<p className="flex w-full min-w-0 items-center justify-center gap-2">
							<Mail
								className="h-4 w-4 shrink-0 text-eko-gold"
								aria-hidden="true"
							/>
							<span className="min-w-0 break-all">{email}</span>
						</p>
					) : null}
					{code ? (
						<p className="flex items-center gap-2">
							<Hash
								className="h-4 w-4 shrink-0 text-eko-gold"
								aria-hidden="true"
							/>
							EkoCode {code}
							{/* Negative vertical margin: the button's padding is its tap
							    target, and letting it set the row height would space this
							    line apart from the two above it. */}
							<CopyButton text={code} label="Copy EkoCode" className="-my-2" />
						</p>
					) : null}
				</div>
				<Button asChild variant="white" className="w-full">
					<Link to="/console/profile">View Profile</Link>
				</Button>
			</div>
		</div>
	);
}
