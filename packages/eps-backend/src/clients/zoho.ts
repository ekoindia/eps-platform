import type { Config } from "../config";

export interface ZohoClient {
	findLead(mobile: string): Promise<boolean>;
}

export function createZohoClient(
	cfg: Config["zoho"],
	fetchImpl: typeof fetch = fetch,
): ZohoClient {
	return {
		async findLead(mobile) {
			if (!cfg.enabled || !cfg.baseUrl || !cfg.accessToken) return false;
			const u = new URL(`${cfg.baseUrl}/crm/v3/Leads/search`);
			u.searchParams.set("phone", mobile);
			const res = await fetchImpl(u.toString(), {
				headers: { Authorization: `Zoho-oauthtoken ${cfg.accessToken}` },
			});
			if (!res.ok) return false;
			const json = (await res.json().catch(() => ({}))) as {
				data?: unknown[];
			};
			return Array.isArray(json.data) && json.data.length > 0;
		},
	};
}
