import type { AuthState } from "@/lib/auth/AuthProvider";

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
function nameInitials(name: string): string {
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
	// back to the same mobile-derived identity below.
	const profile = state.role === "developer" ? state.me.profile : null;
	const personName = profile?.name?.trim();
	const fromName = personName ? nameInitials(personName) : "";
	const code = profile?.code;
	return {
		name: personName || state.me.mobile,
		// Mobile-derived fallback (last two digits) when no name exists.
		initials: fromName || `#${state.me.mobile.slice(-2)}`,
		detail: "EPS Admin",
		// Mobile is skipped when it already serves as the primary name.
		meta:
			[personName ? state.me.mobile : "", code ? `Code ${code}` : ""]
				.filter(Boolean)
				.join(" · ") || undefined,
	};
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
