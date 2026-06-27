import type { Config } from "../config";
import type { EkoProfile, ProfileResult } from "../types";

export interface EkoClient {
	sendOtp(input: {
		mobile: string;
		orgId?: number;
		platform?: string;
		app?: string;
		clientRefId?: string;
		source?: string;
	}): Promise<{ ok: boolean; raw: unknown }>;
	verifyOtp(input: {
		mobile: string;
		otp: string;
		orgId?: number;
		clientRefId?: string;
		source?: string;
	}): Promise<{ ok: boolean; raw: unknown }>;
	getProfile(input: { mobile: string; orgId?: number }): Promise<ProfileResult>;
}

const NOT_FOUND_CODES = new Set([319, 1200, 1867]);
const INACTIVE_CODE = 2123;
const SUCCESS_CODE = 369;

export function createEkoClient(
	cfg: Config["eko"],
	fetchImpl: typeof fetch = fetch,
): EkoClient {
	const url = `http://${cfg.host}:${cfg.port}${cfg.path}`;

	async function post(fields: Record<string, string>): Promise<unknown> {
		const body = new URLSearchParams(fields).toString();
		const res = await fetchImpl(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				developer_key: cfg.developerKey,
			},
			body,
		});
		if (!res.ok) {
			throw new Error(`Eko upstream HTTP ${res.status}`);
		}
		const text = await res.text();
		try {
			return JSON.parse(text);
		} catch {
			throw new Error(`Eko upstream returned non-JSON (status ${res.status})`);
		}
	}

	function base(orgId?: number): Record<string, string> {
		return {
			initiator_id: cfg.initiatorId,
			user_code: cfg.userCode,
			org_id: String(orgId ?? cfg.defaultOrgId),
		};
	}

	return {
		async sendOtp(input) {
			const raw = (await post({
				...base(input.orgId),
				interaction_type_id: "515",
				mobile: input.mobile,
				app: input.app ?? "eps",
				platform: input.platform ?? "web",
				source: input.source ?? "EPSBACKEND",
				intent_id: "0",
				user_identity: input.mobile,
				user_identity_type: "mobile_number",
				client_ref_id: input.clientRefId ?? "",
			})) as { response_status_id?: number };
			return { ok: raw?.response_status_id === 0, raw };
		},
		async verifyOtp(input) {
			const raw = (await post({
				...base(input.orgId),
				interaction_type_id: "518",
				otp: input.otp,
				mobile: input.mobile,
				source: input.source ?? "EPSBACKEND",
				intent_id: "0",
				verification_type: "2",
				user_identity: input.mobile,
				user_identity_type: "mobile_number",
				client_ref_id: input.clientRefId ?? "",
			})) as { response_status_id?: number };
			return { ok: raw?.response_status_id === 0, raw };
		},
		async getProfile(input) {
			const raw = (await post({
				...base(input.orgId),
				interaction_type_id: "151",
				user_identity: input.mobile,
				user_identity_type: "mobile_number",
			})) as {
				response_type_id?: number;
				data?: { user_detail?: Record<string, unknown> };
			};
			const code = Number(raw?.response_type_id ?? -1);
			if (code === INACTIVE_CODE)
				return { kind: "inactive", responseTypeId: code };
			if (NOT_FOUND_CODES.has(code))
				return { kind: "not_found", responseTypeId: code };
			const d = raw?.data?.user_detail;
			if (code === SUCCESS_CODE && d) {
				return {
					kind: "found",
					responseTypeId: code,
					profile: mapProfile(d),
				};
			}
			return { kind: "not_found", responseTypeId: code };
		},
	};
}

function mapProfile(d: Record<string, unknown>): EkoProfile {
	const roles = Array.isArray(d.role_list) ? d.role_list : [];
	return {
		name: String(d.name ?? ""),
		email: String(d.email ?? ""),
		mobile: String(d.mobile ?? ""),
		code: (d.code as number | string) ?? "",
		userType: String(d.user_type ?? ""),
		ekoUserId: String(d.eko_user_id ?? ""),
		roleList: roles.map((r) => String(r)),
		orgId: Number(d.org_id ?? 1),
		dateOfJoining: d.date_of_joining ? String(d.date_of_joining) : undefined,
		onboarding: Number(d.onboarding ?? 0),
		zohoId: String(d.crm_contact_id ?? ""),
	};
}
