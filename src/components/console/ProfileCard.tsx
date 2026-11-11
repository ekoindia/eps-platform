import { ProfileQuestions } from "@/components/console/ProfileQuestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MeView } from "@/lib/auth/client";
import { nameInitials } from "@/lib/auth/identity";
import { lifecycleBadge } from "@/lib/console/lifecycle";
import { formatMobile } from "@/lib/utils";
import { CopyButton } from "@/pages/ai/CommandBlock";
import { Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Who is signed in, at the head of Console Home.
 *
 * The same identity the /console/profile page opens with, cut down to what a
 * partner needs at a glance: name, lifecycle state, the two ways we reach them,
 * and a way through to the full page — plus the profile strength meter and
 * one question at a time towards filling the profile in (`ProfileQuestions`).
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
		<section
			aria-label="Your profile"
			className="flex flex-col gap-5 rounded-[18px] bg-gradient-to-b from-eko-navy-light to-eko-navy p-6 text-white shadow-navy"
		>
			<div className="flex items-center gap-3.5">
				{/* `notranslate` because Google Translate mangles bare initials, and
				    aria-hidden because the name beside it already says who this is. */}
				<div
					className="notranslate grid h-15 w-15 shrink-0 place-items-center rounded-full border-2 border-white/25 bg-white/10 text-xl font-semibold"
					aria-hidden="true"
				>
					{initials}
				</div>
				<div className="flex min-w-0 flex-col gap-1.5">
					{/* `min-w-0` so a long single-word name truncates instead of
					    stretching the column. */}
					<h3 className="min-w-0 truncate text-lg font-bold uppercase tracking-wide text-eko-gold">
						{personName || me.mobile}
					</h3>
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
						{code ? (
							<span className="flex items-center gap-1 text-xs text-white/80">
								EkoCode {code}
								{/* Negative vertical margin: the button's padding is its tap
								    target, and letting it set the row height would push the
								    badge row apart. */}
								<CopyButton
									text={code}
									label="Copy EkoCode"
									className="-my-2"
								/>
							</span>
						) : null}
					</div>
				</div>
			</div>
			{/* Mobile and email give way to the question deck while it has
			    something to ask: vertical room matters more, and both are on the
			    profile page. */}
			<ProfileQuestions
				profile={me.profile}
				contact={
					<ul className="flex flex-col gap-2 text-sm">
						<li className="flex items-center gap-2.5">
							<Phone
								className="h-4 w-4 shrink-0 text-eko-gold"
								aria-hidden="true"
							/>
							{formatMobile(mobile)}
						</li>
						{email ? (
							<li className="flex min-w-0 items-center gap-2.5">
								<Mail
									className="h-4 w-4 shrink-0 text-eko-gold"
									aria-hidden="true"
								/>
								<span className="min-w-0 break-all">{email}</span>
							</li>
						) : null}
					</ul>
				}
			/>
			<Button
				asChild
				variant="hero-outline"
				className="h-11 w-full rounded-[10px] border border-white/40"
			>
				<Link to="/console/profile">View Profile</Link>
			</Button>
		</section>
	);
}
