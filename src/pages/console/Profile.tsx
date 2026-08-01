import { useConsoleMe } from "@/components/console/ConsoleLayout";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	accountIdentity,
	detailField,
	profileCompleteness,
} from "@/lib/auth/identity";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
import { groupChildren } from "@/lib/connect/interactions";
import { cn } from "@/lib/utils";
import { ChevronRight, Phone, SquarePen } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Manage My Account (536) — the composite flow whose children this page lists.
 * Same id the console rail links to; here the individual sub-flows are shown.
 */
const MANAGE_ACCOUNT_ID = 536;

/**
 * User Profile (401) — Eloka's personal-details editor. We do not reimplement
 * its form: when the user is entitled to the flow, the Connect widget renders
 * upstream's own.
 */
const USER_PROFILE_ID = 401;

/**
 * Labels for the user types that can reach this console.
 *
 * Only 23 is reachable today — `getProfile` rejects anything else outright
 * (`org_id === 1 && user_type === "23"`, see `clients/eko.ts`) unless
 * `DEV_ALLOW_ANY_USER_TYPE` is set, which is never true in production. The map
 * exists so a widened gate shows a real label instead of a bare number; the
 * fallback covers the dev-only case rather than any live user.
 */
const USER_TYPE_LABELS: Record<string, string> = {
	"23": "Enterprise Partner",
};

/** Colour for the completeness meter, mirroring Eloka's thresholds. */
function meterColor(percent: number): string {
	if (percent >= 60) return "text-eko-success";
	if (percent > 40) return "text-eko-gold";
	return "text-destructive";
}

/** Formats a 10-digit Indian mobile as `+91 12345 67890`; passes anything else through. */
function formatMobile(mobile: string): string {
	const digits = mobile.replace(/\D/g, "");
	if (digits.length !== 10) return mobile;
	return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** The blue identity card: who you are, and how far through onboarding. */
function IdentityCard() {
	const { state } = useAuth();
	// Reuse the header menu's derivation rather than repeating it — it already
	// falls back to mobile-derived initials for a session with no Eko profile.
	const identity = accountIdentity(state);
	const me = useConsoleMe();
	const profile = me.profile;
	const percent = profile ? profileCompleteness(profile) : 0;

	return (
		<div className="flex flex-col gap-8 rounded-xl bg-gradient-to-b from-eko-navy-light to-eko-navy p-6 text-white">
			<div className="flex items-start gap-4">
				<div
					className="notranslate grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-semibold ring-2 ring-white/25"
					aria-hidden="true"
				>
					{identity?.initials}
				</div>
				<div className="flex min-w-0 flex-col gap-0.5">
					<h3 className="truncate text-xl font-semibold text-eko-gold">
						{profile?.name || identity?.name}
					</h3>
					<p className="text-sm font-semibold">
						{USER_TYPE_LABELS[profile?.userType ?? ""] ?? "Partner"}
					</p>
					{profile?.code ? (
						<p className="text-sm text-white/85">
							User Code:{" "}
							<strong className="font-semibold">{profile.code}</strong>
						</p>
					) : null}
					<p className="mt-2 flex items-center gap-2 text-sm">
						<Phone
							className="h-4 w-4 shrink-0 text-eko-gold"
							aria-hidden="true"
						/>
						{formatMobile(profile?.mobile || me.mobile)}
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<p className="text-sm text-white/85">Profile Completeness</p>
				<div className="flex items-center gap-3">
					{/* Width is runtime data, so it must be an inline style: Tailwind
					    generates classes at build time and cannot produce `w-[57%]`
					    from a value that only exists once the profile loads. */}
					<div
						className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
						role="progressbar"
						aria-valuenow={percent}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Profile completeness"
					>
						<div
							className="h-full rounded-full bg-white transition-[width]"
							style={{ width: `${percent}%` }}
						/>
					</div>
					<span
						className={cn(
							"text-sm font-semibold tabular-nums",
							meterColor(percent),
						)}
					>
						{percent}%
					</span>
				</div>
			</div>
		</div>
	);
}

/**
 * The sub-flows of Manage My Account, straight from the caller's interaction
 * list — the rows are upstream's, not ours, so they follow the user's role.
 * Renders nothing at all when the list is unresolved or grants no children.
 */
function ManageMyAccount() {
	const interactions = useRoleTransactionList();
	const children = interactions
		? groupChildren(interactions, MANAGE_ACCOUNT_ID)
		: [];
	if (children.length === 0) return null;

	return (
		<section className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold text-eko-navy">Manage My Account</h3>
			<div className="divide-y rounded-lg border">
				{children.map((child) => (
					<Link
						key={child.id}
						to={`/console/transaction/${MANAGE_ACCOUNT_ID}/${child.id}`}
						className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
					>
						<span>{child.label}</span>
						<ChevronRight
							className="h-4 w-4 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
					</Link>
				))}
			</div>
		</section>
	);
}

/** The four personal fields Eloka shows, in Eloka's order. */
const PERSONAL_FIELDS: ReadonlyArray<{ field: string; label: string }> = [
	{ field: "gender", label: "Gender" },
	{ field: "dob", label: "Date of Birth" },
	{ field: "qualification", label: "Qualification" },
	{ field: "marital_status", label: "Marital Status" },
];

/**
 * Personal details, read from the `personal_detail` block the backend forwards.
 *
 * Editing deliberately links out to the Connect widget instead of posting
 * interaction 401 from here: the BFF exposes no profile-write endpoint, and
 * upstream already owns the form. When the user is not entitled to 401 there is
 * no edit affordance at all — a pencil that cannot save is worse than none.
 */
function PersonalDetails() {
	const me = useConsoleMe();
	const interactions = useRoleTransactionList();
	const canEdit = Boolean(interactions?.[String(USER_PROFILE_ID)]);
	const values = PERSONAL_FIELDS.map((entry) => ({
		...entry,
		value: detailField(me.profile?.detailBlocks, "personal", entry.field),
	}));

	return (
		<section className="flex flex-col gap-4 rounded-lg border p-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-eko-navy">
					Personal Details
				</h3>
				{canEdit ? (
					<Link
						to={`/console/transaction/${USER_PROFILE_ID}`}
						className="flex items-center gap-1.5 text-sm font-medium text-eko-navy underline underline-offset-4 hover:no-underline"
					>
						<SquarePen className="h-4 w-4" aria-hidden="true" />
						Edit
					</Link>
				) : null}
			</div>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-5">
				{values.map(({ field, label, value }) => (
					<div key={field} className="flex flex-col gap-0.5">
						<dt className="text-sm text-muted-foreground">{label}</dt>
						<dd className="text-sm font-medium">{value ?? "—"}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/**
 * Console Profile page — the signed-in partner's identity, their
 * Manage-My-Account flows, and their personal details.
 *
 * Reads the session `ConsoleLayout` already fetched; no request of its own.
 */
export default function Profile() {
	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-eko-navy">My Profile</h2>
				<p className="text-sm text-muted-foreground">
					Your account details, as registered with Eko.
				</p>
			</div>
			<IdentityCard />
			<div className="grid gap-6 lg:grid-cols-2">
				<PersonalDetails />
				<ManageMyAccount />
			</div>
		</div>
	);
}
