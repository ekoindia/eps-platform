/**
 * `<RdServiceTester />` — interactive RDService device tester embedded at the
 * end of the "Aadhaar Biometric Authentication with RDService" guide.
 *
 * Everything runs in the visitor's browser against `127.0.0.1` — discovery,
 * DEVICEINFO and CAPTURE all target the locally-installed RDService driver;
 * nothing is transmitted to Eko. SSR-safe by construction: the initial render
 * is a static shell and all network activity starts from click handlers; the
 * single effect only aborts in-flight requests on unmount.
 *
 * Protocol logic lives in `@/lib/docs/rdservice` (React-free, unit-tested).
 */
import {
	buildPidOptionsXml,
	captureFromDevice,
	discoverRdServices,
	deviceOrigin,
	fetchDeviceInfo,
	parsePidData,
	RD_ERROR_MESSAGES,
	RD_PROBE_LIST,
	type CaptureResult,
	type PidOptionsConfig,
	type RdDevice,
	type TesterPhase,
} from "@/lib/docs/rdservice";
import { cn } from "@/lib/utils";
import { Check, Copy, Fingerprint, RefreshCw, ScanEye } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** The KYC 2.1 wadh (`BASE64(SHA-256("2.1FYNNN"))`) as a convenient starting
 * value — real integrations must use the wadh their API provider specifies. */
const DEFAULT_EKYC_WADH = "rhVuL7SnJi2W2UmsyukVqY7c93JWyL9O/kVKgdNMfv8=";

interface LogLine {
	ts: string;
	msg: string;
	level: "info" | "warn" | "error";
}

const nowTs = (): string => new Date().toISOString().slice(11, 23);

/** Small inline copy-to-clipboard button (light/dark aware). */
const CopyBtn = ({ text, label }: { text: string; label: string }) => {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return;
		navigator.clipboard.writeText(text).then(
			() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			},
			() => {},
		);
	};
	return (
		<button
			type="button"
			onClick={copy}
			aria-label={label}
			className={cn(
				"inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs transition-colors dark:border-slate-600",
				copied
					? "text-emerald-600 dark:text-emerald-400"
					: "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
			)}
		>
			{copied ? (
				<Check className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
			{copied ? "Copied" : label}
		</button>
	);
};

const statusBadge = (status: RdDevice["status"]) => (
	<span
		className={cn(
			"rounded-full px-2 py-0.5 text-[11px] font-bold",
			status === "READY" &&
				"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
			status === "USED" &&
				"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
			status === "NOTREADY" &&
				"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
		)}
	>
		{status}
	</span>
);

const qScoreColor = (qScore: number): string =>
	qScore < 25
		? "text-red-600 dark:text-red-400"
		: qScore < 45
			? "text-amber-600 dark:text-amber-400"
			: "text-emerald-600 dark:text-emerald-400";

const fieldLabel =
	"block text-xs font-medium text-slate-600 dark:text-slate-400";
const fieldInput =
	"mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export const RdServiceTester = () => {
	const [phase, setPhase] = useState<TesterPhase>("idle");
	const [devices, setDevices] = useState<RdDevice[]>([]);
	const [probesDone, setProbesDone] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [config, setConfig] = useState<PidOptionsConfig>({
		modality: "fingerprint",
		count: 1,
		typeAttr: 2,
		format: 0,
		timeoutMs: 30000,
		env: "P",
		wadh: "",
	});
	const [useWadh, setUseWadh] = useState(false);
	const [wadhValue, setWadhValue] = useState(DEFAULT_EKYC_WADH);
	const [rawXmlOverride, setRawXmlOverride] = useState("");
	const [result, setResult] = useState<CaptureResult | null>(null);
	const [logs, setLogs] = useState<LogLine[]>([]);
	const abortRef = useRef<AbortController | null>(null);

	// Abort any in-flight discovery/capture when the page unmounts.
	useEffect(() => () => abortRef.current?.abort(), []);

	const log = (msg: string, level: LogLine["level"] = "info") =>
		setLogs((prev) => [...prev, { ts: nowTs(), msg, level }]);

	const selected = selectedIndex >= 0 ? devices[selectedIndex] : undefined;
	const effectiveConfig: PidOptionsConfig = {
		...config,
		wadh: useWadh ? wadhValue : "",
	};
	const pidOptionsXml =
		rawXmlOverride.trim() || buildPidOptionsXml(effectiveConfig);
	const busy = phase === "discovering" || phase === "capturing";

	const discover = async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setPhase("discovering");
		setDevices([]);
		setSelectedIndex(-1);
		setResult(null);
		setProbesDone(0);
		log(
			`Discovery started — probing 127.0.0.1 ports 11100–11120 (http + https, ${RD_PROBE_LIST.length} probes)…`,
		);
		try {
			const found = await discoverRdServices({
				signal: controller.signal,
				onLog: (msg, level) => {
					setProbesDone((n) => n + 1);
					log(msg, level);
				},
			});
			setDevices(found);
			const readyIndex = found.findIndex((d) => d.status === "READY");
			setSelectedIndex(readyIndex);
			setPhase(found.length ? "ready" : "error");
			log(
				found.length
					? `Discovery finished — ${found.length} RD Service(s) found, ${found.filter((d) => d.status === "READY").length} READY.`
					: "Discovery finished — no RD Service found. See the Troubleshooting section above.",
				found.length ? "info" : "error",
			);
		} catch (err) {
			setPhase("error");
			log(`Discovery failed: ${String(err)}`, "error");
		}
	};

	const capture = async () => {
		if (!selected) return;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setPhase("capturing");
		setResult(null);
		log(`CAPTURE → ${deviceOrigin(selected)}${selected.capturePath}`);
		log(`PidOptions: ${pidOptionsXml}`);
		try {
			const captured = await captureFromDevice(
				selected,
				pidOptionsXml,
				config.timeoutMs + 90_000,
				controller.signal,
			);
			setResult(captured);
			setPhase("done");
			const meaning =
				RD_ERROR_MESSAGES[captured.errCode] ?? captured.errInfo ?? "Unknown";
			log(
				`Capture response — errCode=${captured.errCode} (${meaning})` +
					(captured.qScore !== undefined ? `, qScore=${captured.qScore}` : ""),
				captured.errCode === "0" ? "info" : "error",
			);
		} catch (err) {
			setPhase("error");
			log(
				`Capture request failed (network/CORS/timeout): ${String(err)}`,
				"error",
			);
		}
	};

	const deviceInfo = async () => {
		if (!selected) return;
		log(
			`DEVICEINFO → ${deviceOrigin(selected)}${selected.deviceInfoPath ?? ""}`,
		);
		try {
			const xml = await fetchDeviceInfo(selected);
			if (!xml) {
				log("Driver advertises no DEVICEINFO interface.", "warn");
				return;
			}
			const parsed = parsePidData(xml).deviceInfo;
			log(`DeviceInfo: ${xml}`);
			if (parsed) log(`Parsed: ${JSON.stringify(parsed)}`);
		} catch (err) {
			log(`DEVICEINFO request failed: ${String(err)}`, "error");
		}
	};

	return (
		<div className="not-prose overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
				<div className="flex items-center gap-2">
					<Fingerprint className="h-5 w-5 text-eko-navy dark:text-eko-gold" />
					<span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
						RDService Device Tester
					</span>
				</div>
				<button
					type="button"
					onClick={discover}
					disabled={busy}
					className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-eko-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-eko-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<RefreshCw
						className={cn("h-4 w-4", phase === "discovering" && "animate-spin")}
					/>
					{phase === "discovering"
						? `Scanning… ${probesDone}/${RD_PROBE_LIST.length}`
						: "Discover devices"}
				</button>
			</div>

			<div className="space-y-4 p-4">
				{/* Device list */}
				{devices.length > 0 && (
					<fieldset>
						<legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
							Discovered RD Services
						</legend>
						<div className="space-y-2">
							{devices.map((device, i) => (
								<label
									key={`${device.protocol}-${device.port}-${device.info}`}
									className={cn(
										"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
										i === selectedIndex
											? "border-eko-navy bg-eko-navy/5 dark:border-eko-gold dark:bg-eko-gold/10"
											: "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500",
										device.status !== "READY" && "opacity-60",
									)}
								>
									<input
										type="radio"
										name="rd-device"
										checked={i === selectedIndex}
										disabled={device.status !== "READY"}
										onChange={() => setSelectedIndex(i)}
										className="accent-eko-navy"
									/>
									<span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">
										{device.info}
									</span>
									<code className="text-xs text-slate-500 dark:text-slate-400">
										{deviceOrigin(device)}
										{device.capturePath}
									</code>
									{statusBadge(device.status)}
								</label>
							))}
						</div>
					</fieldset>
				)}
				{phase === "error" && devices.length === 0 && (
					<p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
						No RD Service found. Make sure your device's RDService driver is
						installed and running, then rescan — see the Troubleshooting section
						above. (On this page the scan only works from a desktop browser with
						the driver installed locally.)
					</p>
				)}

				{/* Options */}
				<fieldset disabled={busy} className="space-y-3">
					<legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						PidOptions
					</legend>
					<div className="flex flex-wrap items-end gap-3">
						{/* Modality toggle */}
						<div
							role="radiogroup"
							aria-label="Biometric modality"
							className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600"
						>
							{(["fingerprint", "iris"] as const).map((modality) => (
								<button
									key={modality}
									type="button"
									role="radio"
									aria-checked={config.modality === modality}
									onClick={() =>
										setConfig((c) => ({
											...c,
											modality,
											typeAttr: modality === "iris" ? 0 : 2,
										}))
									}
									className={cn(
										"inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
										config.modality === modality
											? "bg-eko-navy text-white"
											: "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
									)}
								>
									{modality === "fingerprint" ? (
										<Fingerprint className="h-4 w-4" />
									) : (
										<ScanEye className="h-4 w-4" />
									)}
									{modality === "fingerprint" ? "Fingerprint" : "Iris"}
								</button>
							))}
						</div>

						<div className="w-20">
							<label className={fieldLabel}>
								{config.modality === "iris" ? "iCount" : "fCount"}
								<input
									type="number"
									min={1}
									max={config.modality === "iris" ? 2 : 10}
									value={config.count}
									onChange={(e) =>
										setConfig((c) => ({ ...c, count: +e.target.value || 1 }))
									}
									className={fieldInput}
								/>
							</label>
						</div>
						<div className="w-36">
							<label className={fieldLabel}>
								{config.modality === "iris" ? "iType" : "fType"}
								<select
									value={config.typeAttr}
									onChange={(e) =>
										setConfig((c) => ({ ...c, typeAttr: +e.target.value }))
									}
									className={fieldInput}
								>
									{config.modality === "iris" ? (
										<option value={0}>0 — IIR</option>
									) : (
										<>
											<option value={0}>0 — FMR</option>
											<option value={1}>1 — FIR</option>
											<option value={2}>2 — FMR + FIR</option>
										</>
									)}
								</select>
							</label>
						</div>
						<div className="w-32">
							<label className={fieldLabel}>
								format
								<select
									value={config.format}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											format: +e.target.value === 1 ? 1 : 0,
										}))
									}
									className={fieldInput}
								>
									<option value={0}>0 — XML</option>
									<option value={1}>1 — Protobuf</option>
								</select>
							</label>
						</div>
						<div className="w-28">
							<label className={fieldLabel}>
								timeout (ms)
								<input
									type="number"
									min={1000}
									step={1000}
									value={config.timeoutMs}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											timeoutMs: +e.target.value || 30000,
										}))
									}
									className={fieldInput}
								/>
							</label>
						</div>
						<div className="w-20">
							<label className={fieldLabel}>
								env
								<select
									value={config.env}
									onChange={(e) =>
										setConfig((c) => ({ ...c, env: e.target.value }))
									}
									className={fieldInput}
								>
									<option value="P">P</option>
									<option value="PP">PP</option>
									<option value="S">S</option>
								</select>
							</label>
						</div>
					</div>

					<label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
						<input
							type="checkbox"
							checked={useWadh}
							onChange={(e) => setUseWadh(e.target.checked)}
							className="accent-eko-navy"
						/>
						eKYC capture — include <code>wadh</code>
						{useWadh && (
							<input
								type="text"
								value={wadhValue}
								onChange={(e) => setWadhValue(e.target.value)}
								aria-label="wadh value"
								spellCheck={false}
								className={cn(
									fieldInput,
									"mt-0 max-w-md flex-1 font-mono text-xs",
								)}
							/>
						)}
					</label>

					<details className="text-sm">
						<summary className="cursor-pointer text-slate-600 dark:text-slate-400">
							Advanced: raw PidOptions XML override
						</summary>
						<textarea
							value={rawXmlOverride}
							onChange={(e) => setRawXmlOverride(e.target.value)}
							rows={4}
							spellCheck={false}
							placeholder={buildPidOptionsXml(effectiveConfig)}
							className={cn(fieldInput, "font-mono text-xs")}
						/>
						{rawXmlOverride.trim() && (
							<p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
								Raw override active — the form above is ignored and no
								validation is applied to this XML.
							</p>
						)}
					</details>

					{/* Effective request preview */}
					<div className="flex items-start justify-between gap-2 rounded-md bg-slate-100 p-2 dark:bg-slate-800">
						<code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-slate-700 dark:text-slate-300">
							{pidOptionsXml}
						</code>
						<CopyBtn text={pidOptionsXml} label="Copy" />
					</div>
				</fieldset>

				{/* Actions */}
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={capture}
						disabled={!selected || busy}
						className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Fingerprint className="h-4 w-4" />
						{phase === "capturing"
							? config.modality === "iris"
								? "Align your eye with the scanner…"
								: "Place your finger on the scanner…"
							: `Capture ${config.modality}`}
					</button>
					<button
						type="button"
						onClick={deviceInfo}
						disabled={!selected || busy}
						className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Device Info
					</button>
					{!selected && devices.length === 0 && phase === "idle" && (
						<span className="text-xs text-slate-500 dark:text-slate-400">
							Run discovery first.
						</span>
					)}
				</div>

				{/* Result */}
				{result && (
					<div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
								Capture result
							</span>
							<CopyBtn text={result.rawXml} label="Copy raw XML" />
						</div>
						<table className="w-full text-left text-sm">
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
								<tr>
									<th className="w-32 py-1 pr-3 font-medium text-slate-500 dark:text-slate-400">
										errCode
									</th>
									<td
										className={cn(
											"py-1 font-mono",
											result.errCode === "0"
												? "text-emerald-600 dark:text-emerald-400"
												: "text-red-600 dark:text-red-400",
										)}
									>
										{result.errCode} —{" "}
										{RD_ERROR_MESSAGES[result.errCode] ??
											"Unmapped vendor code"}
									</td>
								</tr>
								{result.errInfo && (
									<tr>
										<th className="py-1 pr-3 font-medium text-slate-500 dark:text-slate-400">
											errInfo
										</th>
										<td className="py-1 text-slate-700 dark:text-slate-300">
											{result.errInfo}
										</td>
									</tr>
								)}
								{result.qScore !== undefined && (
									<tr>
										<th className="py-1 pr-3 font-medium text-slate-500 dark:text-slate-400">
											qScore
										</th>
										<td
											className={cn(
												"py-1 font-semibold",
												qScoreColor(result.qScore),
											)}
										>
											{result.qScore}%{" "}
											<span className="font-normal text-slate-500 dark:text-slate-400">
												(Eko production retries below 45, blocks below 25)
											</span>
										</td>
									</tr>
								)}
								{result.nmPoints !== undefined && (
									<tr>
										<th className="py-1 pr-3 font-medium text-slate-500 dark:text-slate-400">
											nmPoints
										</th>
										<td className="py-1 text-slate-700 dark:text-slate-300">
											{result.nmPoints}
										</td>
									</tr>
								)}
								{result.deviceInfo &&
									Object.entries(result.deviceInfo).map(([key, value]) => (
										<tr key={key}>
											<th className="py-1 pr-3 font-medium text-slate-500 dark:text-slate-400">
												{key}
											</th>
											<td className="break-all py-1 font-mono text-xs text-slate-700 dark:text-slate-300">
												{value}
											</td>
										</tr>
									))}
							</tbody>
						</table>
						<pre className="max-h-56 overflow-auto rounded-md bg-slate-100 p-2 font-mono text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
							{result.rawXml}
						</pre>
					</div>
				)}

				{/* Log */}
				{logs.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
								Log
							</span>
							<CopyBtn
								text={logs.map((l) => `[${l.ts}] ${l.msg}`).join("\n")}
								label="Copy logs"
							/>
						</div>
						<pre className="max-h-56 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-xs leading-relaxed text-slate-300">
							{logs.map((line, i) => (
								<div
									key={i}
									className={cn(
										line.level === "error" && "text-red-400",
										line.level === "warn" && "text-amber-400",
									)}
								>
									[{line.ts}] {line.msg}
								</div>
							))}
						</pre>
					</div>
				)}

				<p className="text-xs text-slate-500 dark:text-slate-400">
					This tester runs entirely in your browser against{" "}
					<code>127.0.0.1</code> — nothing is sent to Eko. The captured PID
					block is encrypted for UIDAI and is never decoded here. Works best in
					Chrome/Edge on the desktop machine where the RDService driver is
					installed.
				</p>
			</div>
		</div>
	);
};
