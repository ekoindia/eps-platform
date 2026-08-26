import type { AuthState } from "@/lib/auth/AuthProvider";
import type { Profile } from "@/lib/auth/client";
import { formatMobile } from "@/lib/utils";

/** Display identity for the logged-in user, ready to render in a profile menu. */
export interface AccountIdentity {
	/** Primary label — the user's name, mobile, or GitHub handle. */
	name: string;
	/** 1–2 character avatar fallback (no photo support yet). */
	initials: string;
	/** Secondary line — the account role. */
	detail: string;
	/** Tertiary line — mobile and user code, when known. */
	meta?: string;
}

/** Logged-in identity to attach to a support-chat visitor. Absent fields are unknown. */
export interface ChatIdentity {
	name?: string;
	email?: string;
	contactNumber?: string;
}

/** Initials from a person's name: first+last word initial, or first letter for one word. */
export function nameInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "";
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Derives the display identity for an authenticated session, or `null` when the
 * user is anonymous or still loading. Falls back gracefully for OTP developers
 * with no name (mobile-derived initials) and admins with no GitHub handle.
 */
export function accountIdentity(state: AuthState): AccountIdentity | null {
	if (state.status !== "authed") return null;

	if (state.role === "admin") {
		const handle = state.me.login?.trim();
		return {
			name: handle || state.me.sub,
			initials: handle ? handle.slice(0, 2).toUpperCase() : "A",
			detail: "Admin",
		};
	}

	// A signup session has no Eko profile yet — it carries only a mobile, same
	// as a developer session whose profile lookup came back empty. Both fall
	// back to the same mobile-derived name/initials below; only `detail`
	// differs, since a signup session is not yet a developer at all.
	const profile = state.role === "developer" ? state.me.profile : null;
	const personName = profile?.name?.trim();
	const fromName = personName ? nameInitials(personName) : "";
	const code = profile?.code;
	return {
		// Every rendered mobile goes through `formatMobile`, here and in
		// `ProfileCard`, so the menu and the card never disagree on spacing.
		name: personName || formatMobile(state.me.mobile),
		// Mobile-derived fallback (last two digits) when no name exists.
		initials: fromName || `#${state.me.mobile.slice(-2)}`,
		detail: state.role === "signup" ? "Finishing setup" : "EPS Admin",
		// Mobile is skipped when it already serves as the primary name.
		meta:
			[
				personName ? formatMobile(state.me.mobile) : "",
				code ? `EkoCode ${code}` : "",
			]
				.filter(Boolean)
				.join(" · ") || undefined,
	};
}

/**
 * Where this session's console lives, and how the header should label it.
 *
 * An admin's home is the GitOps console at `/admin`; every other authenticated
 * role (developer, signup) belongs in the developer console. Anonymous and
 * loading sessions never render the chip, so they fall through to `/console` —
 * the same route `GetStartedButton` sends a signed-out visitor to.
 * @param state - The current auth state.
 * @returns The console route and its short header label.
 */
export function consoleTarget(state: AuthState): {
	href: string;
	label: string;
} {
	return state.status === "authed" && state.role === "admin"
		? { href: "/admin", label: "Admin" }
		: { href: "/console", label: "Console" };
}

/**
 * Whether `pathname` is inside `href`, for marking the console chip active.
 *
 * Deliberately not a bare `startsWith`: that would light the chip up on
 * `/console-old` or `/administrator`. Only the route itself and its children
 * count.
 * @param pathname - The current location pathname.
 * @param href - A console route from `consoleTarget`.
 */
export function isInsideRoute(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * How far through onboarding this profile is, as a percentage.
 *
 * `onboardingSteps` is the ordered FULL list of steps; `roleList` carries the
 * ones still PENDING. A step is therefore done exactly when its role no longer
 * appears in `roleList` — the same projection the backend's signup service
 * makes to pick the current step (`packages/eps-backend/src/signup/service.ts`),
 * kept deliberately in step with it.
 *
 * Note this is onboarding progress, NOT Eloka's shop+personal field checklist:
 * those fields reach us only as opaque `detailBlocks`, and Eloka's own count is
 * unreliable anyway (it tests `!== ""`, so an absent key scores as complete).
 * @param profile - The signed-in user's profile.
 * @returns 0–100, rounded.
 */
export function profileCompleteness(profile: Profile): number {
	// The authoritative "finished" signal — upstream flips it to 0 on completion,
	// and it stays right even when the step list came back empty.
	if (profile.onboarding === 0) return 100;
	const steps = profile.onboardingSteps;
	if (steps.length === 0) return 0;
	const pending = new Set(profile.roleList.map(Number));
	const done = steps.filter((step) => !pending.has(step.role)).length;
	return Math.round((done / steps.length) * 100);
}

/**
 * Reads one displayable field out of a profile detail block.
 *
 * The blocks are forwarded from upstream whole and untyped (see
 * `Profile.detailBlocks`), and upstream is inconsistent about spelling: some
 * responses use `personal_detail`, some `personal_details`. Both are allowlisted
 * by the backend, so both are tried here.
 *
 * Only strings and numbers are returned. Anything else — a nested object, an
 * array, null — is a field this function was not meant to render, and returning
 * it would put "[object Object]" on the page.
 * @param blocks - The profile's `detailBlocks`, or undefined when there is no profile.
 * @param block - Block name without the singular/plural suffix, e.g. `"personal"`.
 * @param field - The field inside that block, e.g. `"gender"`.
 * @returns The trimmed value, or null when absent or not displayable.
 */
export function detailField(
	blocks: Record<string, unknown> | undefined,
	block: string,
	field: string,
): string | null {
	if (!blocks) return null;
	for (const name of [`${block}_detail`, `${block}_details`]) {
		const source = blocks[name];
		if (!source || typeof source !== "object") continue;
		const value = (source as Record<string, unknown>)[field];
		if (typeof value === "number" && Number.isFinite(value)) {
			return String(value);
		}
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

/**
 * Derives the support-chat visitor identity for an authenticated developer, or
 * `null` for anonymous, loading, and admin sessions (admins are internal staff —
 * identifying them to a sales operator has no value).
 *
 * A developer session always carries `me.mobile`, so it is identifiable even when
 * the Eko profile lookup came back empty. Blank fields are dropped rather than
 * sent: the profile mapper defaults missing values to `""`, and pushing those
 * would overwrite whatever the visitor typed into the chat form themselves.
 */
export function chatIdentity(state: AuthState): ChatIdentity | null {
	if (state.status !== "authed" || state.role !== "developer") return null;

	const identity: ChatIdentity = {};
	const name = state.me.profile?.name?.trim();
	const email = state.me.profile?.email?.trim();
	const contactNumber = state.me.profile?.mobile?.trim() || state.me.mobile;
	if (name) identity.name = name;
	if (email) identity.email = email;
	if (contactNumber) identity.contactNumber = contactNumber;
	return Object.keys(identity).length > 0 ? identity : null;
}

/**
 * The GST number the profile carries, if any.
 *
 * GST has no agreed field name on the upstream profile — it turns up under
 * different keys per user type, and many profiles have none at all — so this
 * scans the detail blocks and the flat user detail for a key that names GST
 * rather than pinning a name that may not exist.
 *
 * Mirrors `findGstNumber` in eps-backend's `activationFee.ts`, which is the
 * authority: this copy exists only so a form can decide whether to *ask* for a
 * GST number. If the two ever disagree the worst case is a field shown that did
 * not need to be — the backend still prefers the profile's own value over
 * anything typed.
 * @param profile - The signed-in developer's profile, or null.
 * @returns The GST number, or "" when the profile carries none.
 */
export function profileGstNumber(profile: Profile | null | undefined): string {
	if (!profile) return "";
	const sources: Record<string, unknown>[] = [profile.userDetail ?? {}];
	for (const block of Object.values(profile.detailBlocks ?? {})) {
		if (block && typeof block === "object" && !Array.isArray(block)) {
			sources.push(block as Record<string, unknown>);
		}
	}
	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			if (!/gst/i.test(key)) continue;
			if (typeof value !== "string" && typeof value !== "number") continue;
			const text = String(value).trim();
			if (text) return text;
		}
	}
	return "";
}
