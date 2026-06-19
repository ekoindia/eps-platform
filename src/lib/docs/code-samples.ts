/**
 * Pure code-sample generators for an API endpoint (curl / JavaScript / Python / PHP).
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
	buildSampleRequest,
	resolveHeaders,
	resolveRequestParams,
} from "@/lib/data/api-specs-common";

export type SampleLang = "curl" | "javascript" | "python" | "php";

export const SAMPLE_LANGS: { id: SampleLang; label: string }[] = [
	{ id: "curl", label: "cURL" },
	{ id: "javascript", label: "JavaScript" },
	{ id: "python", label: "Python" },
	{ id: "php", label: "PHP" },
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

/** Render a param value for a URL (path token or query value). */
const urlValue = (value: unknown, name: string): string => {
	if (value == null) return `<${name}>`;
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

/**
 * Resolve the full request URL: substitute `{path_param}` tokens and append a
 * query string for any `in:"query"` params. Values come from `overrides`
 * (keyed by param name) when present, else the param's `example`.
 */
export const resolveEndpointUrl = (
	spec: ApiSpec,
	overrides?: Record<string, unknown>,
): string => {
	const params = resolveRequestParams(spec);
	let path = spec.path;
	for (const p of params.filter((p) => p.in === "path")) {
		const value = overrides?.[p.name] ?? p.example;
		path = path.replace(`{${p.name}}`, urlValue(value, p.name));
	}
	let url = `${DEFAULT_BASE_URL}${path}`;
	const queryParams = params.filter((p) => p.in === "query");
	if (queryParams.length) {
		const qs = queryParams
			.map((p) => {
				const value = overrides?.[p.name] ?? p.example;
				return `${encodeURIComponent(p.name)}=${encodeURIComponent(urlValue(value, p.name))}`;
			})
			.join("&");
		url += `?${qs}`;
	}
	return url;
};

const resolveUrl = (spec: ApiSpec): string => resolveEndpointUrl(spec);

const hasBody = (spec: ApiSpec): boolean =>
	spec.method !== "GET" && Object.keys(buildSampleRequest(spec)).length > 0;

export const toCurl = (spec: ApiSpec): string => {
	const url = resolveUrl(spec);
	const lines = [`curl --request ${spec.method} \\`, `  --url '${url}' \\`];
	const headers = resolveHeaders();
	headers.forEach((h, i) => {
		const last = i === headers.length - 1 && !hasBody(spec);
		lines.push(`  --header '${h.name}: ${headerValue(h)}'${last ? "" : " \\"}`);
	});
	if (hasBody(spec)) {
		lines.push(
			`  --data '${JSON.stringify(buildSampleRequest(spec), null, 2)}'`,
		);
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
			`JSON.stringify(${JSON.stringify(buildSampleRequest(spec), null, 2)})`,
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
		lines.push(`payload = ${pyDict(buildSampleRequest(spec))}`);
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

export const toPhp = (spec: ApiSpec): string => {
	const url = resolveUrl(spec);
	const headerLines = resolveHeaders().map(
		(h) => `    ${phpStr(`${h.name}: ${headerValue(h)}`)},`,
	);
	const lines = [
		`$url = ${phpStr(url)};`,
		"$headers = [",
		...headerLines,
		"];",
		"",
		"$ch = curl_init($url);",
		"curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
		`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(spec.method)});`,
		"curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);",
	];
	if (hasBody(spec)) {
		lines.push(
			`$payload = json_encode(${phpArray(buildSampleRequest(spec))});`,
		);
		lines.push("curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);");
	}
	lines.push("");
	lines.push("$response = curl_exec($ch);");
	lines.push("curl_close($ch);");
	lines.push("$data = json_decode($response, true);");
	return lines.join("\n");
};

/** Render a string as a single-quoted PHP literal (no `$`/escape surprises). */
const phpStr = (value: string): string =>
	`'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** Render a JS value as a PHP array/scalar literal (array/str/num/bool/null). */
const phpArray = (value: unknown, indent = 0): string => {
	const pad = "    ".repeat(indent + 1);
	const closePad = "    ".repeat(indent);
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return phpStr(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		const items = value.map((v) => `${pad}${phpArray(v, indent + 1)}`);
		return `[\n${items.join(",\n")}\n${closePad}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return "[]";
	const items = entries.map(
		([k, v]) => `${pad}${phpStr(k)} => ${phpArray(v, indent + 1)}`,
	);
	return `[\n${items.join(",\n")}\n${closePad}]`;
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
		case "php":
			return toPhp(spec);
	}
};

// ---------------------------------------------------------------------------
// SDK usage snippets — both SDKs expose one generic `call(slug, params)`, so a
// faithful example is fully derivable from the spec. Path tokens + required
// params become the single params object; the SDK signs auth and routes path /
// query / body itself (see packages/sdk-js, packages/sdk-php).
// ---------------------------------------------------------------------------

/** Languages that ship a signed SDK package (a subset of `SampleLang`). */
export const SDK_LANGS: { id: SampleLang; label: string }[] = [
	{ id: "javascript", label: "Node.js" },
	{ id: "php", label: "PHP" },
];

export interface SdkInstall {
	command: string;
	registry: string;
	registryUrl: string;
}

/** Install command + registry link per SDK language. Single source of truth
 * shared by the `/docs` showcase and the endpoint code pane. */
export const SDK_INSTALL: Partial<Record<SampleLang, SdkInstall>> = {
	javascript: {
		command: "npm i @ekoindia/eps-sdk",
		registry: "npm",
		registryUrl: "https://www.npmjs.com/package/@ekoindia/eps-sdk",
	},
	php: {
		command: "composer require ekoindia/eps-sdk",
		registry: "Packagist",
		registryUrl: "https://packagist.org/packages/ekoindia/eps-sdk",
	},
};

/** Clamp any language to the nearest SDK language (Node for non-PHP). */
export const toSdkLang = (lang: SampleLang): SampleLang =>
	lang === "php" ? "php" : "javascript";

/**
 * The params object a developer passes to `client.call(slug, {...})`: every
 * `{path}` token plus the required query/body params, with example values
 * (falling back to a `<name>` placeholder). Header/auth params are excluded —
 * the SDK supplies those.
 */
const sdkCallParams = (spec: ApiSpec): Record<string, unknown> => {
	const declared = resolveRequestParams(spec);
	const byName = new Map(declared.map((p) => [p.name, p]));
	const out: Record<string, unknown> = {};
	const valueFor = (name: string, p?: ApiParam): unknown =>
		p?.example != null ? p.example : `<${name}>`;
	// Path tokens first (guaranteed present even if not separately declared).
	for (const m of spec.path.matchAll(/\{(\w+)\}/g)) {
		const name = m[1];
		out[name] = valueFor(name, byName.get(name));
	}
	// Then required query/body params.
	for (const p of declared) {
		if (p.in === "header" || out[p.name] !== undefined) continue;
		if (p.required || p.in === "path") out[p.name] = valueFor(p.name, p);
	}
	return out;
};

export const toNodeSdk = (spec: ApiSpec): string => {
	const params = sdkCallParams(spec);
	const args = Object.keys(params).length
		? `, ${JSON.stringify(params, null, 2)}`
		: "";
	return [
		'import { EpsClient } from "@ekoindia/eps-sdk";',
		"",
		"const client = new EpsClient({",
		"  developerKey: process.env.EPS_DEVELOPER_KEY,",
		"  accessKey: process.env.EPS_ACCESS_KEY,",
		'  environment: "sandbox",',
		"});",
		"",
		`const result = await client.call(${JSON.stringify(spec.slug)}${args});`,
		"console.log(result);",
	].join("\n");
};

export const toPhpSdk = (spec: ApiSpec): string => {
	const params = sdkCallParams(spec);
	const args = Object.keys(params).length ? `, ${phpArray(params)}` : "";
	return [
		"<?php",
		"use Eko\\Eps\\EpsClient;",
		"",
		"$client = new EpsClient(",
		"    developerKey: getenv('EPS_DEVELOPER_KEY'),",
		"    accessKey: getenv('EPS_ACCESS_KEY'),",
		"    environment: 'sandbox'",
		");",
		"",
		`$result = $client->call(${phpStr(spec.slug)}${args});`,
		"print_r($result);",
	].join("\n");
};

/** SDK snippet for the given language (defaults to Node for anything non-PHP). */
export const sdkSampleFor = (spec: ApiSpec, lang: SampleLang): string =>
	lang === "php" ? toPhpSdk(spec) : toNodeSdk(spec);

/**
 * A ready-to-paste agent prompt that integrates THIS endpoint via the
 * `eps-context-mcp` server (which teaches the agent params, auth + signing).
 */
export const toAiPrompt = (spec: ApiSpec): string =>
	[
		`Use the EPS context MCP server (eps-context-mcp) to integrate the "${spec.name}" API.`,
		"",
		`Endpoint: ${spec.method} ${spec.path}`,
		`Slug: ${spec.slug}`,
		"",
		"Use the MCP tools to look up its parameters, required auth and response shape,",
		"then write code that signs the request correctly (HMAC secret-key) and handles",
		"the response. Prefer the @ekoindia/eps-sdk SDK if my project language supports it.",
	].join("\n");
