import type { Config } from "../config";
import { withTimeout } from "./http";

export interface ZohoClient {
	findLead(mobile: string): Promise<boolean>;
}

export function createZohoClient(
	cfg: Config["zoho"],
	fetchImpl: typeof fetch = fetch,
): ZohoClient {
	const doFetch = withTimeout(fetchImpl);
	return {
		async findLead(mobile) {
			if (!cfg.enabled || !cfg.baseUrl || !cfg.accessToken) return false;
			const u = new URL(`${cfg.baseUrl}/crm/v3/Leads/search`);
			u.searchParams.set("phone", mobile);
			const res = await doFetch(u.toString(), {
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
