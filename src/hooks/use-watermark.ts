import { useGeolocation } from "@/hooks/use-geolocation";
import { useOptionalAuth } from "@/lib/auth/AuthProvider";
import { authClient } from "@/lib/auth/client";
import { useEffect, useMemo, useState } from "react";

/**
 * What to stamp on a capture.
 *
 * `true` uses the KYC defaults below; an object keeps those and replaces or
 * adds the keys it names; a string is the literal text; `false` stamps nothing.
 */
export type WatermarkSpec = boolean | string | Record<string, string>;

/** The default fields, in the order they are stamped. */
export interface WatermarkFields {
	name: string;
	org: string;
	location: string;
	timestamp: string;
}

/**
 * Joins the watermark fields into the multi-line text the editor draws.
 *
 * Empty fields are dropped rather than stamped blank — a capture taken with
 * location denied should read as three lines, not four with a gap.
 * @param fields - The default fields plus any caller additions.
 * @returns Newline-joined text.
 */
export function joinWatermark(fields: Record<string, string>): string {
	return Object.values(fields).filter(Boolean).join("\n");
}

/**
 * Formats the position line: coordinates and confidence, then the IP.
 *
 * Both halves are worth having and neither is sufficient. Coordinates say where
 * the device believed it was and can be spoofed on a rooted phone; the IP is
 * observed server-side and is much harder to fake, but only narrows the city.
 * @param position - The fix, if one was obtained.
 * @param ip - The caller's public IP, if known.
 * @returns One line, possibly empty.
 */
export function formatLocation(
	position: {
		latitude: number | null;
		longitude: number | null;
		accuracy: number | null;
		error: string | null;
	},
	ip: string,
): string {
	const fix =
		position.latitude !== null && position.longitude !== null
			? `${position.latitude}, ${position.longitude}` +
				(position.accuracy !== null
					? ` (${Math.round(position.accuracy)}m)`
					: "")
			: "";
	return [fix, ip].filter(Boolean).join(" – ");
}

/**
 * The watermark text for a capture — who took it, from where, and when.
 *
 * Ported from Eloka's Dropzone, where this was the point of the flag: a KYC
 * photo is evidence, and evidence with no provenance stamped into the pixels
 * can be re-used for a different customer on a different day.
 *
 * Nothing is requested unless a watermark is actually asked for: `false` (or a
 * literal string) skips the geolocation prompt and the IP call entirely.
 * @param watermark - See {@link WatermarkSpec}.
 * @returns The text to stamp, or "" when there is nothing to stamp.
 */
export function useWatermarkText(watermark?: WatermarkSpec): string {
	// A literal string needs no context at all; only the boolean/object forms do.
	const wantsDefaults = watermark === true || typeof watermark === "object";

	// Optional: an upload control is usable on a page with no session, it just
	// has no name to stamp.
	const state = useOptionalAuth()?.state ?? { status: "loading" as const };
	const position = useGeolocation(wantsDefaults);
	const [ip, setIp] = useState("");

	useEffect(() => {
		if (!wantsDefaults) return;
		let live = true;
		authClient
			.myIp()
			.then((response) => {
				if (live) setIp(response.ip);
			})
			// A missing IP costs one line of the watermark, not the capture.
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, [wantsDefaults]);

	const profile =
		state.status === "authed" && state.role === "developer"
			? state.me.profile
			: null;
	// Admin sessions carry no mobile; they are also not who KYC captures come from.
	const mobile =
		state.status === "authed" && state.role !== "admin" ? state.me.mobile : "";

	return useMemo(() => {
		if (typeof watermark === "string") return watermark;
		if (!wantsDefaults) return "";

		const who = profile?.name || mobile || "";
		const code = profile?.code ? ` (${profile.code})` : "";
		const defaults: WatermarkFields = {
			name: who ? `${who}${code}` : "",
			org: profile?.orgId ? `Eko (${profile.orgId})` : "Eko",
			location: formatLocation(position, ip),
			timestamp: `${new Date().toLocaleString()} @ ${window.location.host}`,
		};

		// Overrides replace a default by key; unknown keys are appended.
		const overrides = typeof watermark === "object" ? watermark : {};
		return joinWatermark({ ...defaults, ...overrides });
	}, [watermark, wantsDefaults, profile, mobile, position, ip]);
}
