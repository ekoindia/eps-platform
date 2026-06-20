/**
 * Pure builders for a Postman collection (v2.1) and a Bruno collection from the
 * agent bundle, each with a pre-request script that computes the EPS secret-key
 * from collection variables. For LOCAL/testing use — do not commit real secrets.
 */
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

/** Postman pre-request: compute secret-key via the bundled CryptoJS. */
export const PRE_REQUEST_SIGNING_SCRIPT = [
	"const ts = Date.now().toString();",
	"const accessKey = pm.collectionVariables.get('access_key');",
	"const encodedKey = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(accessKey));",
	"const sig = CryptoJS.HmacSHA256(ts, encodedKey);",
	"pm.collectionVariables.set('secret-key', CryptoJS.enc.Base64.stringify(sig));",
	"pm.collectionVariables.set('secret-key-timestamp', ts);",
].join("\n");

interface PostmanScript {
	listen: string;
	script: { type: string; exec: string[] };
}
interface PostmanRequest {
	name: string;
	request: Record<string, unknown>;
}
interface PostmanFolder {
	name: string;
	item: PostmanRequest[];
}
export interface PostmanCollection {
	info: Record<string, unknown>;
	event?: PostmanScript[];
	variable: { key: string; value: string }[];
	item: PostmanFolder[];
}

export const buildPostmanCollection = (
	bundle: AgentBundle,
): PostmanCollection => {
	const baseUrl = bundle.meta.environments[0].baseUrl;
	const byProduct = new Map<string, PostmanRequest[]>();
	for (const a of bundle.apis) {
		// Query params (e.g. initiator_id/user_code on a GET) → Postman url.query,
		// with the raw URL kept consistent.
		const query = a.requestParams
			.filter((p) => p.in === "query")
			.map((p) => ({
				key: p.name,
				value: p.example != null ? String(p.example) : "",
			}));
		const raw = query.length
			? `${baseUrl}${a.path}?${query
					.map(
						(q) =>
							`${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`,
					)
					.join("&")}`
			: `${baseUrl}${a.path}`;
		const item: PostmanRequest = {
			name: a.name,
			request: {
				method: a.method,
				header: [
					{ key: "developer_key", value: "{{developer_key}}" },
					{ key: "secret-key", value: "{{secret-key}}" },
					{ key: "secret-key-timestamp", value: "{{secret-key-timestamp}}" },
					{ key: "content-type", value: "application/json" },
				],
				url: {
					raw,
					host: [baseUrl],
					path: a.path.split("/").filter(Boolean),
					...(query.length ? { query } : {}),
				},
				body:
					a.method === "GET"
						? undefined
						: { mode: "raw", raw: JSON.stringify(a.sampleRequest, null, 2) },
				description: a.summary,
			},
		};
		const list = byProduct.get(a.productName) ?? [];
		list.push(item);
		byProduct.set(a.productName, list);
	}
	return {
		info: {
			name: "Eko Platform Services",
			schema:
				"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
			description:
				"Generated from eps.json. Set access_key + developer_key in collection variables (local use only).",
		},
		event: [
			{
				listen: "prerequest",
				script: {
					type: "text/javascript",
					exec: PRE_REQUEST_SIGNING_SCRIPT.split("\n"),
				},
			},
		],
		variable: [
			{ key: "access_key", value: "" },
			{ key: "developer_key", value: "" },
			{ key: "secret-key", value: "" },
			{ key: "secret-key-timestamp", value: "" },
		],
		item: [...byProduct.entries()].map(([name, item]) => ({ name, item })),
	};
};
