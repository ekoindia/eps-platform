/**
 * Pure code-sample generators for an API endpoint (curl / JavaScript / Python).
 *
 * Built from the shared resolvers over `api-specs.ts`. Auth values that must be
 * computed per request use obvious placeholder tokens (never real secrets); the
 * live try-it console fills the real, locally-signed values at send time.
 *
 * Pure + dependency-free so it unit-tests cleanly and is SSR-safe.
 */
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import type { ApiParam, ApiSpec } from "@/lib/data/api-specs-common";
import {
	resolveHeaders,
	resolveRequestParams,
} from "@/lib/data/api-specs-common";

export type SampleLang = "curl" | "javascript" | "python";

export const SAMPLE_LANGS: { id: SampleLang; label: string }[] = [
	{ id: "curl", label: "cURL" },
	{ id: "javascript", label: "JavaScript" },
	{ id: "python", label: "Python" },
];

/** Placeholder used for header values the caller must supply / sign. */
const HEADER_PLACEHOLDER: Record<string, string> = {
	developer_key: "<your_developer_key>",
	"secret-key": "<computed_secret_key>",
	"secret-key-timestamp": "<timestamp_ms>",
	"content-type": "application/json",
};

const headerValue = (h: ApiParam): string =>
	HEADER_PLACEHOLDER[h.name] ?? (h.example != null ? String(h.example) : "");

/**
 * Substitute `{path_param}` tokens using values from `body` (falling back to
 * the param's example) and return the full base-URL-prefixed endpoint URL.
 */
export const resolveEndpointUrl = (
	spec: ApiSpec,
	body?: Record<string, unknown>,
): string => {
	const pathParams = resolveRequestParams(spec).filter((p) => p.in === "path");
	let path = spec.path;
	for (const p of pathParams) {
		const fromBody = body?.[p.name];
		const value =
			fromBody != null
				? String(fromBody)
				: p.example != null
					? String(p.example)
					: `<${p.name}>`;
		path = path.replace(`{${p.name}}`, value);
	}
	return `${DEFAULT_BASE_URL}${path}`;
};

const resolveUrl = (spec: ApiSpec): string => resolveEndpointUrl(spec);

const hasBody = (spec: ApiSpec): boolean =>
	spec.method !== "GET" && Object.keys(spec.sampleRequest).length > 0;

export const toCurl = (spec: ApiSpec): string => {
	const url = resolveUrl(spec);
	const lines = [`curl --request ${spec.method} \\`, `  --url '${url}' \\`];
	const headers = resolveHeaders();
	headers.forEach((h, i) => {
		const last = i === headers.length - 1 && !hasBody(spec);
		lines.push(`  --header '${h.name}: ${headerValue(h)}'${last ? "" : " \\"}`);
	});
	if (hasBody(spec)) {
		lines.push(`  --data '${JSON.stringify(spec.sampleRequest, null, 2)}'`);
	}
	return lines.join("\n");
};

export const toJsFetch = (spec: ApiSpec): string => {
	const url = resolveUrl(spec);
	const headers = Object.fromEntries(
		resolveHeaders().map((h) => [h.name, headerValue(h)]),
	);
	const init: Record<string, unknown> = {
		method: spec.method,
		headers,
	};
	if (hasBody(spec)) init.body = "__BODY__";

	let initStr = JSON.stringify(init, null, 2);
	if (hasBody(spec)) {
		initStr = initStr.replace(
			'"__BODY__"',
			`JSON.stringify(${JSON.stringify(spec.sampleRequest, null, 2)})`,
		);
	}
	return `const response = await fetch('${url}', ${initStr});\nconst data = await response.json();`;
};

export const toPython = (spec: ApiSpec): string => {
	const url = resolveUrl(spec);
	const headers = Object.fromEntries(
		resolveHeaders().map((h) => [h.name, headerValue(h)]),
	);
	const lines = [
		"import requests",
		"",
		`url = "${url}"`,
		`headers = ${pyDict(headers)}`,
	];
	if (hasBody(spec)) {
		lines.push(`payload = ${pyDict(spec.sampleRequest)}`);
		lines.push(
			`response = requests.${spec.method.toLowerCase()}(url, json=payload, headers=headers)`,
		);
	} else {
		lines.push(
			`response = requests.${spec.method.toLowerCase()}(url, headers=headers)`,
		);
	}
	lines.push("data = response.json()");
	return lines.join("\n");
};

/** Render a JS value as a Python literal (dict/list/str/num/bool/None). */
const pyDict = (value: unknown, indent = 0): string => {
	const pad = "    ".repeat(indent + 1);
	const closePad = "    ".repeat(indent);
	if (value === null || value === undefined) return "None";
	if (typeof value === "boolean") return value ? "True" : "False";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return JSON.stringify(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		const items = value.map((v) => `${pad}${pyDict(v, indent + 1)}`);
		return `[\n${items.join(",\n")}\n${closePad}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return "{}";
	const items = entries.map(
		([k, v]) => `${pad}${JSON.stringify(k)}: ${pyDict(v, indent + 1)}`,
	);
	return `{\n${items.join(",\n")}\n${closePad}}`;
};

export const sampleFor = (spec: ApiSpec, lang: SampleLang): string => {
	switch (lang) {
		case "curl":
			return toCurl(spec);
		case "javascript":
			return toJsFetch(spec);
		case "python":
			return toPython(spec);
	}
};
