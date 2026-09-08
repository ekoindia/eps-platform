/**
 * Pure, DOM-free request pipeline for the docs "Test Request" widget.
 *
 * Everything the modal needs to turn form state into a signed HTTP call and
 * classify what came back, kept free of React so it unit-tests directly:
 *
 *   validate → sign (in-browser, at send time) → build body → POST to the
 *   eps-backend try-it proxy → parse → classify (HTTP + Eko envelope).
 *
 * The raw `access_key` is only ever an HMAC input here (see `eko-signing.ts`);
 * it never appears in a header. `developer_key` travels to the proxy as
 * `x-eps-developer-key` because nginx drops underscore headers by default; the
 * proxy renames it back before forwarding upstream.
 */
import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { API_PARAM_FORMATS } from "@/lib/data/api-formats";
import type {
	ApiErrorScenario,
	ApiSpec,
	HttpMethod,
	ResolvedApiParam,
} from "@/lib/data/api-specs-common";
import {
	isMultipart,
	MULTIPART_JSON_FIELD,
	multipartPayloadFrom,
	resolveRequestParams,
	splitMultipartBody,
} from "@/lib/data/api-specs-common";
import { resolveEndpointUrl } from "@/lib/docs/code-samples";
import { buildSignedHeaders } from "@/lib/docs/eko-signing";

export type TryItEnv = keyof typeof API_ENVIRONMENTS;

/** Where the widget POSTs. Same-origin `/api` reaches eps-backend on Vercel;
 * `VITE_TRYIT_PROXY_URL` overrides for other deployments. Derived here rather
 * than imported from `auth/client.ts` so the docs chunk does not drag the
 * whole auth client in. */
export const TRYIT_PROXY_URL: string =
	import.meta.env.VITE_TRYIT_PROXY_URL ??
	`${import.meta.env.VITE_EPS_BACKEND_URL ?? "/api"}/tryit/proxy`;

/** Browser-side deadline; the proxy's own upstream timeout is 30 s. */
export const TRYIT_TIMEOUT_MS = 35_000;

/** Body keys that must never be persisted, even if a user pastes them into the
 * Raw JSON editor (compared case-insensitively). */
export const CREDENTIAL_KEYS: readonly string[] = [
	"developer_key",
	"access_key",
	"secret-key",
	"secret-key-timestamp",
];

export interface TryItCreds {
	developerKey: string;
	accessKey: string;
}

export interface TryItValues {
	/** Path + query values as wire strings, by param name. */
	params: Record<string, string>;
	/** Non-file JSON body (typed values). */
	body: Record<string, unknown>;
	/** Multipart uploads, by param name. */
	files: Record<string, File | null>;
}

export interface TryItInput extends TryItValues {
	env: TryItEnv;
	creds: TryItCreds;
	/** Signing timestamp — read `Date.now()` at send time, never earlier. */
	now: number;
}

/** A fully built request, ready for {@link sendViaProxy}. */
export interface TryItRequest {
	url: string;
	method: HttpMethod;
	/** Headers as sent to the proxy (`x-eps-developer-key`, not `developer_key`). */
	headers: Record<string, string>;
	body?: string | FormData;
}

export interface TryItResult {
	httpStatus: number;
	ok: boolean;
	ms: number;
	bytes: number;
	requestUrl: string;
	/** Headers as the upstream API receives them (`developer_key` restored). */
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	bodyBytes: ArrayBuffer;
	bodyText: string;
	/** Parsed body when it is a JSON object; null for anything else. */
	json: Record<string, unknown> | null;
}

/** Thrown when the proxy itself (not the upstream API) refused or failed. */
export class TryItProxyError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * A fresh 15-character `client_ref_id`: 8 base-36 chars of the millisecond
 * clock (sortable, unique per ms) + 7 random base-36 chars. 15 is the cap EPS
 * enforces on the wire (the documented `client-ref` format allows 20).
 */
export const generateClientRefId = (nowMs: number): string => {
	const time = nowMs.toString(36).padStart(8, "0").slice(-8);
	const bytes = new Uint8Array(7);
	crypto.getRandomValues(bytes);
	let rand = "";
	for (const b of bytes) rand += BASE36[b % 36];
	return time + rand;
};

/**
 * Turn a text-input string into the typed value the wire expects for `param`.
 * Blank numeric input yields `undefined` (key omitted), never `0`.
 */
export const coerceValue = (param: ResolvedApiParam, raw: string): unknown => {
	if (param.type === "number" || param.type === "integer") {
		const trimmed = raw.trim();
		return trimmed === "" ? undefined : Number(trimmed);
	}
	if (param.type === "boolean") return raw === "true";
	return raw;
};

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

const isMissing = (v: unknown): boolean =>
	v === undefined || v === null || v === "";

/**
 * Field-level validation against the spec: required, enum, numeric bounds,
 * UTF-8 `maxLength`, named `format`, and (for uploads) presence + `max` bytes.
 * Returns `{ [paramName]: message }` — empty when everything passes.
 */
export const validateParams = (
	params: ResolvedApiParam[],
	values: TryItValues,
): Record<string, string> => {
	const errors: Record<string, string> = {};
	for (const p of params) {
		if (p.in === "header") continue;
		const value =
			p.in === "body"
				? p.type === "file"
					? values.files[p.name]
					: values.body[p.name]
				: values.params[p.name];
		if (isMissing(value)) {
			if (p.required) errors[p.name] = "Required";
			continue;
		}
		if (p.type === "file") {
			const file = value as File;
			if (p.max !== undefined && file.size > p.max)
				errors[p.name] = `File too large (max ${Math.round(p.max / 1024)} KB)`;
			continue;
		}
		const wire =
			typeof value === "object" ? JSON.stringify(value) : String(value);
		if (p.enum && !p.enum.some((e) => String(e) === wire)) {
			errors[p.name] = `Must be one of: ${p.enum.join(", ")}`;
			continue;
		}
		if (p.type === "number" || p.type === "integer") {
			const n = typeof value === "number" ? value : Number(wire);
			if (!Number.isFinite(n)) errors[p.name] = "Must be a number";
			else if (p.type === "integer" && !Number.isInteger(n))
				errors[p.name] = "Must be a whole number";
			else if (p.min !== undefined && n < p.min)
				errors[p.name] = `Must be ≥ ${p.min}`;
			else if (p.max !== undefined && n > p.max)
				errors[p.name] = `Must be ≤ ${p.max}`;
			if (errors[p.name]) continue;
		}
		if (p.maxLength !== undefined && utf8Bytes(wire) > p.maxLength) {
			errors[p.name] = `Max ${p.maxLength} bytes`;
			continue;
		}
		const format = p.format ? API_PARAM_FORMATS[p.format] : undefined;
		if (format && !new RegExp(format.pattern).test(wire))
			errors[p.name] = `Expected ${format.label}`;
	}
	return errors;
};

/** Params the widget renders and validates (everything but auth headers). */
export const editableParams = (spec: ApiSpec): ResolvedApiParam[] =>
	resolveRequestParams(spec).filter((p) => p.in !== "header");

/**
 * Build the signed request for the proxy. Signs with a fresh timestamp at
 * call time; the access key is consumed by the HMAC and discarded.
 */
export const buildTryItRequest = async (
	spec: ApiSpec,
	input: TryItInput,
): Promise<TryItRequest> => {
	const url = resolveEndpointUrl(
		spec,
		input.params,
		API_ENVIRONMENTS[input.env].baseUrl,
	);
	const signed = await buildSignedHeaders(input.creds, input.now);
	const headers: Record<string, string> = {
		"x-eps-developer-key": signed.developer_key,
		"secret-key": signed["secret-key"],
		"secret-key-timestamp": signed["secret-key-timestamp"],
		accept: "application/json",
	};
	const request: TryItRequest = { url, method: spec.method, headers };
	if (spec.method === "GET" || spec.method === "DELETE") return request;
	if (isMultipart(spec)) {
		// Browser sets the multipart content-type (with boundary) from FormData.
		const { files } = splitMultipartBody(resolveRequestParams(spec));
		const form = new FormData();
		form.append(
			MULTIPART_JSON_FIELD,
			JSON.stringify(
				multipartPayloadFrom(
					input.body,
					files.map((f) => f.name),
				),
			),
		);
		for (const f of files) {
			const file = input.files[f.name];
			if (file) form.append(f.name, file, file.name);
		}
		request.body = form;
		return request;
	}
	headers["content-type"] = "application/json";
	request.body = JSON.stringify(input.body);
	return request;
};

/** The header set as the upstream API sees it (for the "Request headers" panel). */
export const upstreamHeadersFor = (
	req: TryItRequest,
): Record<string, string> => {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(req.headers)) {
		out[k === "x-eps-developer-key" ? "developer_key" : k] = v;
	}
	if (req.body instanceof FormData) out["content-type"] = "multipart/form-data";
	return out;
};

/**
 * Human message for a response that did not come from the upstream API: the
 * proxy's own JSON envelope when it sent one (rate limit, size cap, timeout),
 * else a hint that `/api` is not routed to eps-backend at all.
 */
export const parseProxyError = (
	status: number,
	json: Record<string, unknown> | null,
): string => {
	const err = json?.error;
	if (isPlainObject(err) && typeof err.message === "string") {
		return typeof err.code === "string"
			? `${err.code}: ${err.message}`
			: err.message;
	}
	return `Try-it proxy unavailable (HTTP ${status}) — is /api routed to eps-backend?`;
};

const tryParseObject = (text: string): Record<string, unknown> | null => {
	try {
		const parsed: unknown = JSON.parse(text);
		return isPlainObject(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * POST the built request to the proxy and read the upstream reply. Throws
 * {@link TryItProxyError} when the proxy answered instead of the upstream
 * (recognised by the absence of `x-eps-proxied: 1`).
 */
export const sendViaProxy = async (
	req: TryItRequest,
	signal: AbortSignal,
	fetchImpl: typeof fetch = fetch,
): Promise<TryItResult> => {
	const started = performance.now();
	const res = await fetchImpl(TRYIT_PROXY_URL, {
		method: "POST",
		headers: {
			...req.headers,
			"x-eps-target-url": req.url,
			"x-eps-target-method": req.method,
		},
		body: req.body,
		signal,
	});
	const bodyBytes = await res.arrayBuffer();
	const ms = Math.round(performance.now() - started);
	const bodyText = new TextDecoder().decode(bodyBytes);
	const json = tryParseObject(bodyText);
	if (res.headers.get("x-eps-proxied") !== "1") {
		throw new TryItProxyError(res.status, parseProxyError(res.status, json));
	}
	const responseHeaders: Record<string, string> = {};
	res.headers.forEach((v, k) => {
		responseHeaders[k] = v;
	});
	return {
		httpStatus: res.status,
		ok: res.ok,
		ms,
		bytes: bodyBytes.byteLength,
		requestUrl: req.url,
		requestHeaders: upstreamHeadersFor(req),
		responseHeaders,
		bodyBytes,
		bodyText,
		json,
	};
};

export type EkoOutcome = "success" | "failure" | "unknown";

/**
 * Eko's own verdict, independent of the HTTP status: `status === 0` is success
 * (see `eko-status-0-success-signal`); any other number is a failure; a body
 * that is not an Eko envelope (HTML, empty, array) is unknown.
 */
export const ekoOutcome = (
	json: Record<string, unknown> | null,
): EkoOutcome => {
	if (!json || typeof json.status !== "number") return "unknown";
	return json.status === 0 ? "success" : "failure";
};

/** `tx_status` meanings from the financial response envelope. */
const TX_STATUS_LABELS: Record<string, string> = {
	"0": "Success",
	"1": "Fail",
	"2": "Awaited",
	"3": "Refund Pending",
	"4": "Refunded",
	"5": "On Hold",
};

/** Transaction-state label for financial responses, when present. */
export const txStatusLabel = (
	json: Record<string, unknown> | null,
): string | undefined => {
	const data = json?.data;
	const raw = isPlainObject(data) ? data.tx_status : json?.tx_status;
	if (raw === undefined || raw === null) return undefined;
	const key = String(raw);
	return TX_STATUS_LABELS[key]
		? `${TX_STATUS_LABELS[key]} (tx_status ${key})`
		: `tx_status ${key}`;
};

/**
 * The documented error scenario a live failure matches: same
 * `response_type_id`, else the same `(status, response_status_id)` pair when
 * both sides document them. Undefined when nothing matches.
 */
export const matchErrorScenario = (
	spec: ApiSpec,
	json: Record<string, unknown> | null,
): ApiErrorScenario | undefined => {
	if (!json || !spec.errorScenarios?.length) return undefined;
	const byType =
		typeof json.response_type_id === "number"
			? spec.errorScenarios.find(
					(s) => s.example.response_type_id === json.response_type_id,
				)
			: undefined;
	if (byType) return byType;
	if (
		typeof json.status === "number" &&
		typeof json.response_status_id === "number"
	) {
		return spec.errorScenarios.find(
			(s) =>
				s.example.status === json.status &&
				s.example.response_status_id === json.response_status_id,
		);
	}
	return undefined;
};

/** Copy of `body` without any credential-named keys (for sessionStorage). */
export const redactCredentialKeys = (
	body: Record<string, unknown>,
): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(body).filter(
			([k]) => !CREDENTIAL_KEYS.includes(k.toLowerCase()),
		),
	);

/** Why an aborted send stopped, from the signal's reason. */
export const abortKind = (reason: unknown): "timeout" | "cancelled" =>
	typeof reason === "object" &&
	reason !== null &&
	(reason as { name?: unknown }).name === "TimeoutError"
		? "timeout"
		: "cancelled";
