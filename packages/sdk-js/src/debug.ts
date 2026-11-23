/**
 * Debug mode: opt-in, masked diagnostics a developer can share with Eko
 * support. Normative contract: "Debug mode conformance" in
 * docs/sdk-golden-vector.md — the other four SDKs port this file.
 *
 * Everything here is best-effort and isolated: a failure while building,
 * masking or delivering an event is swallowed, so debug can never change a
 * call's outcome. Masking is fail-closed: only keys the surface classifies
 * print anything but `****`.
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

/** One masked debug event, e.g. `{ logger: "eps-sdk", event: "request", … }`. */
export type EpsDebugEvent = Record<string, unknown>;
/** A callback that receives every debug event (already masked). */
export type EpsDebugSink = (event: EpsDebugEvent) => void;

/** The surface's `redact` classification (any list may be absent). */
export interface Redact {
	safe?: string[];
	last4?: string[];
	text?: string[];
	nest?: string[];
}

type KeyClass = "safe" | "last4" | "text" | "nest" | "default";

/** Multipart metadata captured while the form was built. */
export interface MultipartDebug {
	fields: string;
	files: { param: string; ext: string | null; bytes: number | null }[];
}

const MASK = "****";
const UNAVAILABLE = "[unavailable]";
const SAFE_SHAPE = /^[A-Za-z0-9_.:-]{0,64}$/;
const KEY_SHAPE = /^[a-z][a-z0-9_]{0,39}$/;
const LAST4_URL = /^\*\*\*\*[A-Za-z0-9]{4}$/;
const EXT_SHAPE = /^[a-z0-9]{1,5}$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PAN = /[A-Z]{5}[0-9]{4}[A-Z]/g;
const DIGITS = /[0-9]{6,}/g;
const MAX_DEPTH = 8;
const MAX_EVENT_BYTES = 64 * 1024;
const TEXT_CAP = 1024;
const SAFE_TEXT_CAP = 256;
const BODY_TEXT_CAP = 512;

/** `****` for 8 chars or fewer, else `****` + the last 4 (code points). */
const last4 = (s: string): string => {
	const cps = Array.from(s);
	return cps.length <= 8 ? MASK : MASK + cps.slice(-4).join("");
};

/** Classifies keys by the surface's lists and masks values accordingly. */
export class Masker {
	private readonly classes = new Map<string, KeyClass>();

	constructor(
		redact: Redact | undefined,
		private readonly clientRef: RegExp | undefined,
	) {
		// Later lists win, so `last4` beats every other class.
		for (const cls of ["nest", "text", "safe", "last4"] as const)
			for (const key of redact?.[cls] ?? []) this.classes.set(key, cls);
	}

	private classOf(key: string): KeyClass {
		return this.classes.get(key.toLowerCase()) ?? "default";
	}

	/** A key name prints when it is classified or looks like a field name. */
	private printable(key: string): boolean {
		return this.classes.has(key.toLowerCase()) || KEY_SHAPE.test(key);
	}

	/** Class of a child key: an unprintable name is always `default`. */
	private childClass(key: string, parent: KeyClass): KeyClass {
		if (!this.printable(key)) return "default";
		return parent === "text" ? "text" : this.classOf(key);
	}

	/**
	 * Mask `value` held under `key` of class `cls`. Every request scalar the
	 * masker changes is pushed to `changed` (when given) so later text can be
	 * scrubbed of it.
	 */
	mask(
		value: unknown,
		cls: KeyClass,
		key: string | null,
		known: string[],
		changed?: string[],
		depth = 0,
	): unknown {
		if (value === null || value === undefined || typeof value === "boolean")
			return value ?? null;
		if (typeof value === "object") {
			const walk = cls === "nest" || cls === "safe" || cls === "text";
			if (!walk || depth >= MAX_DEPTH) {
				if (changed) this.collectAll(value, changed);
				return MASK;
			}
			if (Array.isArray(value))
				return value.map((v) =>
					this.mask(v, cls, key, known, changed, depth + 1),
				);
			const out: Record<string, unknown> = {};
			let unnamed = 0;
			for (const [k, v] of Object.entries(value)) {
				const name = this.printable(k) ? k : `#${++unnamed}`;
				out[name] = this.mask(
					v,
					this.childClass(k, cls),
					k,
					known,
					changed,
					depth + 1,
				);
			}
			return out;
		}
		const s = String(value);
		const masked = this.scalar(value, s, cls, key, known);
		if (changed && masked !== value && Array.from(s).length >= 4)
			changed.push(s);
		return masked;
	}

	private scalar(
		value: unknown,
		s: string,
		cls: KeyClass,
		key: string | null,
		known: string[],
	): unknown {
		switch (cls) {
			case "last4":
				return last4(s);
			case "safe":
				if (
					key?.toLowerCase() === "client_ref_id" &&
					this.clientRef &&
					!this.clientRef.test(s)
				)
					return MASK;
				if (SAFE_SHAPE.test(s))
					return known.some((k) => s.includes(k)) ? MASK : value;
				return this.text(s, SAFE_TEXT_CAP, known);
			case "text":
			case "nest":
				return this.text(s, TEXT_CAP, known);
			default:
				return MASK;
		}
	}

	/** Every scalar under a masked-whole value is a known value too. */
	private collectAll(value: unknown, out: string[]): void {
		if (value === null || typeof value !== "object") {
			if (value !== undefined && typeof value !== "boolean") {
				const s = String(value);
				if (Array.from(s).length >= 4) out.push(s);
			}
			return;
		}
		for (const v of Object.values(value)) this.collectAll(v, out);
	}

	/** Mask a whole JSON document (request or response body) from the root. */
	root(value: unknown, known: string[], changed?: string[]): unknown {
		return this.mask(value, "nest", null, known, changed);
	}

	/**
	 * Text scrub: digit runs first (so a short known value cannot match inside a
	 * longer number and leave its ends visible), then known values and their
	 * percent-encoded form, PAN shapes and e-mails, then a code-point cap.
	 */
	text(s: string, cap: number, known: string[]): string {
		let out = s.replace(DIGITS, (d) =>
			d.length >= 9 ? MASK + d.slice(-4) : MASK,
		);
		for (const k of [...known].sort((a, b) => b.length - a.length)) {
			out = out.split(k).join(MASK);
			const encoded = encodeURIComponent(k);
			if (encoded !== k) out = out.split(encoded).join(MASK);
		}
		out = out.replace(PAN, MASK).replace(EMAIL, `${MASK}@${MASK}`);
		const cps = Array.from(out);
		return cps.length > cap
			? `${cps.slice(0, cap).join("")}…(+${cps.length - cap} chars)`
			: out;
	}

	/** Headers: an allowlist, matched case-insensitively. */
	headers(headers: Record<string, string>): Record<string, string> {
		const out: Record<string, string> = {};
		for (const [name, value] of Object.entries(headers)) {
			const lower = name.toLowerCase();
			out[name] =
				lower === "secret-key-timestamp" || lower === "content-type"
					? value
					: lower === "developer_key"
						? last4(value)
						: MASK;
		}
		return out;
	}

	/**
	 * The URL actually sent, masked by the endpoint's path template. Any
	 * mismatch with the base URL or the template fails closed.
	 */
	url(
		url: string,
		baseUrl: string,
		template: string,
		known: string[],
		changed: string[],
	): string {
		try {
			if (!url.startsWith(baseUrl)) return UNAVAILABLE;
			const rest = url.slice(baseUrl.length);
			const q = rest.indexOf("?");
			const pathPart = q < 0 ? rest : rest.slice(0, q);
			const query = q < 0 ? "" : rest.slice(q + 1);
			const tSegs = template.split("/");
			const pSegs = pathPart.split("/");
			if (tSegs.length !== pSegs.length) return UNAVAILABLE;
			const segs: string[] = [];
			for (let i = 0; i < tSegs.length; i++) {
				const param = /^\{([^}]+)\}$/.exec(tSegs[i]);
				if (!param) {
					if (tSegs[i] !== pSegs[i]) return UNAVAILABLE;
					segs.push(tSegs[i]);
				} else {
					segs.push(
						this.urlValue(
							param[1],
							decodeURIComponent(pSegs[i]),
							pSegs[i],
							known,
							changed,
						),
					);
				}
			}
			let unnamed = 0;
			const pairs = query
				.split("&")
				.filter(Boolean)
				.map((pair) => {
					const eq = pair.indexOf("=");
					const rawKey = eq < 0 ? pair : pair.slice(0, eq);
					const rawValue = eq < 0 ? "" : pair.slice(eq + 1);
					const formDecode = (x: string) =>
						decodeURIComponent(x.replace(/\+/g, " "));
					const k = formDecode(rawKey);
					const named = this.printable(k);
					const value = this.urlValue(
						named ? k : null,
						formDecode(rawValue),
						rawValue,
						known,
						changed,
					);
					return `${named ? rawKey : `#${++unnamed}`}=${value}`;
				});
			return (
				baseUrl + segs.join("/") + (pairs.length ? `?${pairs.join("&")}` : "")
			);
		} catch {
			return UNAVAILABLE;
		}
	}

	private urlValue(
		key: string | null,
		decoded: string,
		raw: string,
		known: string[],
		changed: string[],
	): string {
		const cls = key === null ? "default" : this.classOf(key);
		const masked = this.mask(decoded, cls, key, known, changed);
		if (masked === decoded) return raw;
		const s = String(masked);
		return cls === "last4" && LAST4_URL.test(s) ? s : MASK;
	}
}

/** Where events go: a text line writer or a user callback. */
type Sink =
	| { kind: "text"; write: (line: string) => void }
	| { kind: "callback"; fn: EpsDebugSink };

/**
 * Resolve the `debug` option against `EPS_SDK_DEBUG`: an explicit option
 * wins, then the env var, else off (null).
 */
export const resolveSink = (
	option: boolean | EpsDebugSink | undefined,
	env: string | undefined,
): { sink: Sink; source: "option" | "env" } | null => {
	const stderr: Sink = {
		kind: "text",
		write: (line) => void process.stderr.write(line),
	};
	if (typeof option === "function")
		return { sink: { kind: "callback", fn: option }, source: "option" };
	if (option === true) return { sink: stderr, source: "option" };
	if (option === false) return null;
	const flag = env?.trim().toLowerCase();
	return flag === "1" || flag === "true"
		? { sink: stderr, source: "env" }
		: null;
};

/** Package version from `../package.json` (next to `dist/` and `src/`). */
const sdkVersion = (here: string): string => {
	try {
		const pkg = JSON.parse(
			readFileSync(path.resolve(here, "../package.json"), "utf8"),
		) as { version?: unknown };
		return typeof pkg.version === "string" ? pkg.version : "unknown";
	} catch {
		return "unknown";
	}
};

export interface DebugConfig {
	sink: Sink;
	source: "option" | "env";
	here: string;
	env: string;
	baseUrl: string;
	bundleVersion: unknown;
	redact: Redact | undefined;
	clientRef: RegExp | undefined;
	developerKey: string;
	timeoutMs: number;
	retries: number;
	autoStatusCheck: boolean;
}

/** The request as sent, for the `request` event. */
export interface SentRequest {
	method: string;
	url: string;
	template: string;
	headers: Record<string, string>;
	body: unknown;
	multipart: MultipartDebug | undefined;
}

/** Emits events for one client. Every public method swallows its own errors. */
export class Debug {
	private readonly masker: Masker;
	private readonly common: Record<string, unknown>;

	constructor(private readonly cfg: DebugConfig) {
		this.masker = new Masker(cfg.redact, cfg.clientRef);
		this.common = {
			sdk: "js",
			sdk_version: sdkVersion(cfg.here),
			surface: cfg.bundleVersion ?? null,
			env: cfg.env,
		};
		this.emit("init", {
			base_url: cfg.baseUrl,
			runtime: `node ${process.version}`,
			developer_key: last4(cfg.developerKey),
			timeout_ms: cfg.timeoutMs,
			retries: cfg.retries,
			auto_status_check: cfg.autoStatusCheck,
			source: cfg.source,
		});
	}

	/** Start tracing one `call()`; undefined if even that fails. */
	trace(slug: string): Trace | undefined {
		try {
			return new Trace(this, this.masker, slug, this.cfg);
		} catch {
			return undefined;
		}
	}

	/** Build, bound, serialize and deliver one event; never throws. */
	emit(
		event: string,
		fields: Record<string, unknown>,
		call?: Record<string, unknown>,
	): void {
		try {
			const out: Record<string, unknown> = {
				logger: "eps-sdk",
				ts: new Date().toISOString(),
				event,
				...this.common,
				...call,
				...fields,
			};
			let line = JSON.stringify(out);
			if (Buffer.byteLength(line) > MAX_EVENT_BYTES && "body" in out) {
				out["body"] = `[${Buffer.byteLength(line)} bytes omitted]`;
				line = JSON.stringify(out);
			}
			if (this.cfg.sink.kind === "text") this.cfg.sink.write(`${line}\n`);
			else this.cfg.sink.fn(out);
		} catch {
			// Debug output must never affect the call.
		}
	}
}

/** Per-call state: the call id and the values later text is scrubbed of. */
export class Trace {
	private readonly callId = crypto.randomBytes(4).toString("hex");
	private known: string[];
	private started = 0;

	constructor(
		private readonly debug: Debug,
		private readonly masker: Masker,
		private readonly slug: string,
		private readonly cfg: DebugConfig,
	) {
		this.known = cfg.developerKey ? [cfg.developerKey] : [];
	}

	private emit(event: string, fields: Record<string, unknown>): void {
		this.debug.emit(event, fields, { call_id: this.callId, slug: this.slug });
	}

	/** Mask and log the request as sent; remember its values for later scrubs. */
	request(attempt: number, req: SentRequest): void {
		try {
			this.started = performance.now();
			const secret = Object.entries(req.headers).find(
				([name]) => name.toLowerCase() === "secret-key",
			)?.[1];
			// Empty strings never count as known values (they match everywhere).
			const base = [this.cfg.developerKey, secret ?? ""].filter(Boolean);
			const changed: string[] = [];
			const url = this.masker.url(
				req.url,
				this.cfg.baseUrl,
				req.template,
				base,
				changed,
			);
			let body: unknown = null;
			if (req.multipart) {
				body = {
					fields: this.masker.root(
						JSON.parse(req.multipart.fields),
						base,
						changed,
					),
					files: req.multipart.files,
				};
			} else if (typeof req.body === "string") {
				body = this.masker.root(JSON.parse(req.body), base, changed);
			}
			this.known = [...base, ...changed];
			this.emit("request", {
				attempt,
				method: req.method,
				url,
				headers: this.masker.headers(req.headers),
				body,
			});
		} catch {
			// isolated
		}
	}

	response(attempt: number, status: number, raw: string): void {
		try {
			let body: unknown;
			try {
				body = this.masker.root(JSON.parse(raw), this.known);
			} catch {
				body = this.masker.text(raw, BODY_TEXT_CAP, this.known);
			}
			this.emit("response", { attempt, status, ms: this.elapsed(), body });
		} catch {
			// isolated
		}
	}

	transportError(attempt: number, err: unknown, status?: number): void {
		try {
			this.emit("transport_error", {
				attempt,
				ms: this.elapsed(),
				error: errorName(err),
				message: this.masker.text(errorMessage(err), TEXT_CAP, this.known),
				...(status !== undefined && { status }),
			});
		} catch {
			// isolated
		}
	}

	retry(attempt: number, delayMs: number): void {
		this.emit("retry", { attempt, delay_ms: delayMs });
	}

	error(err: unknown): void {
		try {
			const e = err as { clientRefId?: unknown; tid?: unknown };
			const ids: Record<string, unknown> = {};
			if (e?.clientRefId != null)
				ids["client_ref_id"] = this.masker.mask(
					e.clientRefId,
					"safe",
					"client_ref_id",
					this.known,
				);
			if (e?.tid != null)
				ids["tid"] = this.masker.mask(e.tid, "safe", "tid", this.known);
			this.emit("error", {
				error: errorName(err),
				message: this.masker.text(errorMessage(err), TEXT_CAP, this.known),
				...ids,
			});
		} catch {
			// isolated
		}
	}

	private elapsed(): number {
		return Math.round(performance.now() - this.started);
	}
}

const errorName = (err: unknown): string =>
	err instanceof Error ? err.name : typeof err;

const errorMessage = (err: unknown): string =>
	err instanceof Error ? err.message : String(err);

/** File metadata for a multipart part: extension (when tidy) and size. */
export const fileMeta = (
	param: string,
	filename: string,
	bytes: number | null,
): MultipartDebug["files"][number] => {
	const ext = path.extname(filename).slice(1).toLowerCase();
	return { param, ext: EXT_SHAPE.test(ext) ? ext : null, bytes };
};
