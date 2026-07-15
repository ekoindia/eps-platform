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

	const personName = state.me.profile?.name?.trim();
	const fromName = personName ? nameInitials(personName) : "";
	const code = state.me.profile?.code;
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
