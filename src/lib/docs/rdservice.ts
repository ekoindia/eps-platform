/**
 * UIDAI RDService protocol helpers for the in-page device tester on the
 * "Aadhaar Biometric Authentication with RDService" guide.
 *
 * PLAIN DATA + fetch — no React, no top-level browser globals — so the parsing
 * and PidOptions builders are unit-testable in Node and the module is safe to
 * import during SSG prerender. Network functions only ever run from user
 * gestures in the browser.
 *
 * Attribute extraction is regex-based (matching Eko's production Connect app):
 * RDService drivers emit small, flat, vendor-quirky XML where lenient regex
 * parsing has proven more robust than strict XML parsing, and it keeps this
 * module DOM-free for Node tests.
 */

/** One RDService driver discovered on a localhost port. */
export interface RdDevice {
	port: number;
	protocol: "http" | "https";
	/** Driver status. `USED` = detected but held by another application. */
	status: "READY" | "NOTREADY" | "USED";
	/** Human-readable driver name from the `info` attribute. */
	info: string;
	/** Sanitized path of the `CAPTURE` interface (leading slash, no host). */
	capturePath: string;
	/** Sanitized path of the `DEVICEINFO` interface, when advertised. */
	deviceInfoPath?: string;
	rawXml: string;
}

/** Form state that `buildPidOptionsXml` turns into a PidOptions document. */
export interface PidOptionsConfig {
	modality: "fingerprint" | "iris";
	/** fCount / iCount — number of records to capture. */
	count: number;
	/** fType (0=FMR, 1=FIR, 2=both) / iType (0=IIR). */
	typeAttr: number;
	/** 0 = XML, 1 = Protobuf. */
	format: 0 | 1;
	/** Device-side capture timeout in milliseconds. */
	timeoutMs: number;
	/** UIDAI environment flag. Providers used by Eko expect "P". */
	env: string;
	/** eKYC wadh value; empty string omits the attribute (plain auth). */
	wadh: string;
}

/** Parsed `<Resp …>` of a capture response. `errCode` stays a string — codes
 * are identifiers, and vendors have been seen emitting non-numeric values. */
export interface CaptureResult {
	errCode: string;
	errInfo: string;
	qScore?: number;
	nmPoints?: number;
	/** Attributes of the `<DeviceInfo …>` element, when present. */
	deviceInfo?: Record<string, string>;
	rawXml: string;
}

export type TesterPhase =
	| "idle"
	| "discovering"
	| "ready"
	| "capturing"
	| "done"
	| "error";

/** Capture `errCode` → developer-facing meaning (UIDAI RD spec + field notes). */
export const RD_ERROR_MESSAGES: Record<string, string> = {
	"0": "Success",
	"210": "Protobuf format not supported by this driver — use format=0 (XML)",
	"700": "Capture timed out — no finger/eye presented within the timeout",
	"710":
		"Device is being used by another application — close other biometric apps",
	"720": "Device not ready — reconnect the scanner",
	"730": "Capture failed — retry the scan",
	"740": "Device needs to be re-initialized — unplug and replug the scanner",
	"750": "This RD Service does not support fingerprint capture",
	"760": "This RD Service does not support iris capture",
	"770": "Invalid capture URL",
	"999": "Internal RD Service error",
};

/** Localhost ports probed for RDService drivers, in Eko's production scan
 * order: the common 11100–11105 range first (http then https), then the
 * long-tail 11106–11120 pairs. */
export const RD_PROBE_LIST: ReadonlyArray<{
	port: number;
	protocol: "http" | "https";
}> = (() => {
	const probes: { port: number; protocol: "http" | "https" }[] = [];
	for (let port = 11100; port <= 11105; port++)
		probes.push({ port, protocol: "http" });
	for (let port = 11100; port <= 11105; port++)
		probes.push({ port, protocol: "https" });
	for (let port = 11106; port <= 11120; port++)
		probes.push({ port, protocol: "http" }, { port, protocol: "https" });
	return probes;
})();

/** First attribute value matched by `attr\s*=\s*"…"` or `'…'`, else undefined. */
const attrValue = (xml: string, attr: string): string | undefined => {
	const match = new RegExp(
		`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
		"i",
	).exec(xml);
	return match ? (match[1] ?? match[2]) : undefined;
};

/**
 * Sanitize an `<Interface path>` value into a same-origin path: strips any
 * scheme/host/port prefix (drivers emit variants like
 * `http://127.0.0.1:11100/rd/capture` or `/127.0.0.1:11100/capture`), rejects
 * paths pointing at any host other than localhost, collapses stray whitespace
 * and duplicate slashes, and guarantees a single leading `/`.
 * Returns undefined for unusable values.
 */
export function sanitizeCapturePath(path: string): string | undefined {
	let cleaned = path.replace(/\s+/g, "");
	if (!cleaned || [...cleaned].some((c) => c.charCodeAt(0) < 32))
		return undefined;
	const hostPrefix =
		/^(?:https?)?:?\/?\/?(?:127\.0\.0\.1|localhost)(?::[0-9]+)?/i.exec(cleaned);
	if (hostPrefix) {
		cleaned = cleaned.slice(hostPrefix[0].length);
	} else if (/^(?:https?:)?\/\//i.test(cleaned)) {
		return undefined; // absolute URL to a non-localhost host
	}
	cleaned = `/${cleaned.replace(/^:?\/+/, "")}`.replace(/\/\/+/g, "/");
	return cleaned === "/" ? undefined : cleaned;
}

/** Path of an `<Interface id="…" path="…">` element, matched by id (drivers
 * order the interfaces differently), sanitized. */
const interfacePath = (xml: string, id: string): string | undefined => {
	const match = new RegExp(
		`<Interface[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*\\bpath\\s*=\\s*["']([^"']+)["']`,
		"i",
	).exec(xml);
	return match ? sanitizeCapturePath(match[1]) : undefined;
};

/**
 * Parse an `RDSERVICE` discovery response into an `RdDevice`.
 * Returns undefined when the XML has no recognisable `<RDService status>`.
 */
export function parseRdServiceInfo(
	xml: string,
	port: number,
	protocol: "http" | "https",
): RdDevice | undefined {
	const statusRaw = /<RDService[^>]*\bstatus\s*=\s*["']([^"']+)["']/i.exec(
		xml,
	)?.[1];
	if (!statusRaw) return undefined;
	const statusUpper = statusRaw.trim().toUpperCase();
	const status =
		statusUpper === "READY" || statusUpper === "USED"
			? statusUpper
			: "NOTREADY";
	const capturePath = interfacePath(xml, "CAPTURE");
	if (!capturePath) return undefined;
	return {
		port,
		protocol,
		status,
		info: attrValue(xml, "info") ?? "Unknown RD Service",
		capturePath,
		deviceInfoPath: interfacePath(xml, "DEVICEINFO"),
		rawXml: xml,
	};
}

/** Parse a CAPTURE (PidData) response's `<Resp>` + `<DeviceInfo>` elements. */
export function parsePidData(xml: string): CaptureResult {
	const resp = /<Resp\b[^>]*>/i.exec(xml)?.[0] ?? "";
	const qScoreRaw = attrValue(resp, "qScore");
	const nmPointsRaw = attrValue(resp, "nmPoints");
	const deviceInfoTag = /<DeviceInfo\b[^>]*>/i.exec(xml)?.[0];
	let deviceInfo: Record<string, string> | undefined;
	if (deviceInfoTag) {
		deviceInfo = {};
		for (const m of deviceInfoTag.matchAll(
			/\b([a-zA-Z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
		)) {
			deviceInfo[m[1]] = m[2] ?? m[3];
		}
	}
	return {
		errCode: attrValue(resp, "errCode")?.trim() ?? "-1",
		errInfo: attrValue(resp, "errInfo") ?? "",
		qScore: qScoreRaw !== undefined ? Number(qScoreRaw) : undefined,
		nmPoints: nmPointsRaw !== undefined ? Number(nmPointsRaw) : undefined,
		deviceInfo,
		rawXml: xml,
	};
}

/**
 * Build the PidOptions XML for a fingerprint or iris capture. Notes baked in
 * from production: `env` is always emitted (Mantra fails without it; Morpho
 * accepts only "P"), `posh="UNKNOWN"` allows any finger/eye, and `wadh` is
 * emitted only when non-empty (eKYC flows).
 */
export function buildPidOptionsXml(config: PidOptionsConfig): string {
	const bio =
		config.modality === "iris"
			? `iCount="${config.count}" iType="${config.typeAttr}"`
			: `fCount="${config.count}" fType="${config.typeAttr}"`;
	const wadh = config.wadh ? ` wadh="${config.wadh}"` : "";
	return (
		`<PidOptions ver="1.0">` +
		`<Opts ${bio} format="${config.format}" pidVer="2.0" ` +
		`timeout="${config.timeoutMs}" otp=""${wadh} posh="UNKNOWN" env="${config.env}" />` +
		`</PidOptions>`
	);
}

/** A fetch that rejects after `timeoutMs`, also honouring `outerSignal`.
 * Hand-rolled (no `AbortSignal.timeout`/`AbortSignal.any`) for Safari/older
 * Chromium compatibility. */
async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs: number,
	outerSignal?: AbortSignal,
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const onOuterAbort = () => controller.abort();
	outerSignal?.addEventListener("abort", onOuterAbort);
	if (outerSignal?.aborted) controller.abort();
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
		outerSignal?.removeEventListener("abort", onOuterAbort);
	}
}

export interface DiscoveryCallbacks {
	/** Called for each parsed RDService as soon as its probe answers. */
	onDevice?: (device: RdDevice) => void;
	/** Called with a human-readable line per probe/parse event. */
	onLog?: (message: string, level: "info" | "warn" | "error") => void;
	signal?: AbortSignal;
	/** Per-probe timeout in ms (default 2500). */
	probeTimeoutMs?: number;
}

/**
 * Probe every entry of `RD_PROBE_LIST` with the custom `RDSERVICE` HTTP verb
 * and return all discovered drivers. Runs the probes through a small worker
 * pool; scans the FULL list (no early stop) — this is a diagnostic tool, so
 * seeing every driver, including NOTREADY ones, is the point.
 */
export async function discoverRdServices({
	onDevice,
	onLog,
	signal,
	probeTimeoutMs = 2500,
}: DiscoveryCallbacks = {}): Promise<RdDevice[]> {
	const devices: RdDevice[] = [];
	let nextIndex = 0;

	const worker = async (): Promise<void> => {
		while (nextIndex < RD_PROBE_LIST.length && !signal?.aborted) {
			const { port, protocol } = RD_PROBE_LIST[nextIndex++];
			const url = `${protocol}://127.0.0.1:${port}`;
			try {
				const response = await fetchWithTimeout(
					url,
					{ method: "RDSERVICE" },
					probeTimeoutMs,
					signal,
				);
				const xml = await response.text();
				const device = parseRdServiceInfo(xml, port, protocol);
				if (device) {
					devices.push(device);
					onLog?.(
						`${url} → ${device.status} — ${device.info}`,
						device.status === "READY" ? "info" : "warn",
					);
					onDevice?.(device);
				} else {
					onLog?.(`${url} → responded but no <RDService> found`, "warn");
				}
			} catch {
				// Silent per-port failure is the normal case (nothing listening).
				onLog?.(`${url} → no response`, "info");
			}
		}
	};

	await Promise.all(Array.from({ length: 10 }, worker));
	// Stable order: READY first, then USED, then NOTREADY.
	const rank = { READY: 0, USED: 1, NOTREADY: 2 } as const;
	return devices.sort((a, b) => rank[a.status] - rank[b.status]);
}

/** Origin of a discovered device, e.g. `http://127.0.0.1:11100`. */
export const deviceOrigin = (device: RdDevice): string =>
	`${device.protocol}://127.0.0.1:${device.port}`;

/**
 * Send a `CAPTURE` request (PidOptions body) to a discovered device and parse
 * the PidData response. The long default timeout leaves time for the user to
 * place their finger / align their eye.
 */
export async function captureFromDevice(
	device: RdDevice,
	pidOptionsXml: string,
	timeoutMs = 120_000,
	signal?: AbortSignal,
): Promise<CaptureResult> {
	const response = await fetchWithTimeout(
		`${deviceOrigin(device)}${device.capturePath}`,
		{
			method: "CAPTURE",
			headers: { "Content-Type": "text/xml" },
			body: pidOptionsXml,
		},
		timeoutMs,
		signal,
	);
	return parsePidData(await response.text());
}

/** Fetch the driver's DEVICEINFO XML, or undefined if it advertises no
 * DEVICEINFO interface. */
export async function fetchDeviceInfo(
	device: RdDevice,
	signal?: AbortSignal,
): Promise<string | undefined> {
	if (!device.deviceInfoPath) return undefined;
	const response = await fetchWithTimeout(
		`${deviceOrigin(device)}${device.deviceInfoPath}`,
		{ method: "DEVICEINFO" },
		10_000,
		signal,
	);
	return response.text();
}
