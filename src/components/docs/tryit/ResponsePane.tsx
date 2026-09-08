import type { ApiSpec } from "@/lib/data/api-specs-common";
import { responseTypeFor } from "@/lib/data/api-specs-common";
import {
	ekoOutcome,
	matchErrorScenario,
	txStatusLabel,
	type TryItEnv,
} from "@/lib/docs/tryit-request";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, Download, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { codeColor } from "../ResponseAccordion";
import { CopyButton, NumberedCode, TabButton } from "../code-ui";
import type { TryItState } from "./useTryItState";

const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const HeaderList = ({
	title,
	headers,
	mask,
	extra,
}: {
	title: string;
	headers: Record<string, string>;
	mask?: string[];
	extra?: ReactNode;
}) => {
	const entries = Object.entries(headers);
	return (
		<details className="group border-b border-[var(--rp-line)]">
			<summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--rp-fg)] [&::-webkit-details-marker]:hidden">
				<ChevronRight className="h-3.5 w-3.5 text-[var(--rp-fg3)] transition-transform group-open:rotate-90" />
				{title}
				<span className="rounded-full bg-[var(--rp-accbg)] px-1.5 text-[0.625rem] text-[var(--rp-acc)]">
					{entries.length}
				</span>
			</summary>
			<div className="space-y-1 px-4 pb-3 font-mono text-[0.7rem]">
				{extra}
				{entries.map(([k, v]) => (
					<div key={k} className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2">
						<span className="text-[var(--rp-fg3)]">{k}</span>
						<span className="break-all text-[var(--rp-fg)]">
							{mask?.includes(k) ? "•".repeat(Math.min(24, v.length)) : v}
						</span>
					</div>
				))}
			</div>
		</details>
	);
};

const Callout = ({
	tone,
	children,
}: {
	tone: "warn" | "error" | "info";
	children: ReactNode;
}) => (
	<div
		className={cn(
			"mx-4 my-3 flex gap-2 rounded-lg border px-3 py-2 text-xs",
			tone === "warn" &&
				"border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
			tone === "error" &&
				"border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
			tone === "info" &&
				"border-[var(--rp-accline)] bg-[var(--rp-accbg)] text-[var(--rp-fg)]",
		)}
	>
		<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
		<div className="space-y-1">{children}</div>
	</div>
);

/**
 * Right pane: HTTP status + timing + size, Eko's own verdict, honest
 * callouts (UAT flakiness, unknown financial outcome, matched documented
 * error), headers on demand, and the body as highlighted JSON or raw text
 * with copy/download.
 */
export const ResponsePane = ({
	spec,
	state,
	env,
	onAbort,
}: {
	spec: ApiSpec;
	state: TryItState;
	env: TryItEnv;
	onAbort: () => void;
}) => {
	const [view, setView] = useState<"preview" | "raw">("preview");
	const { status, result, error } = state;

	if (status === "sending") {
		return (
			<div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-sm text-[var(--rp-fg3)]">
				<Loader2 className="h-5 w-5 animate-spin" />
				Sending…
				<button
					type="button"
					onClick={onAbort}
					className="cursor-pointer rounded-md border border-[var(--rp-btnline)] bg-[var(--rp-btn)] px-2.5 py-1 text-xs text-[var(--rp-fg)]"
				>
					Cancel
				</button>
			</div>
		);
	}

	const unknownNotice = state.outcomeUnknown && (
		<Callout tone="error">
			<p className="font-semibold">Outcome unknown</p>
			<p>
				The request was dispatched but no answer came back. Check the
				transaction status
				{state.lastSentRef && (
					<>
						{" "}
						for <code>client_ref_id {state.lastSentRef}</code>
					</>
				)}{" "}
				before sending again.
			</p>
		</Callout>
	);

	if (!result) {
		return (
			<div className="flex h-full min-h-40 flex-col justify-center">
				{unknownNotice}
				{error ? (
					<Callout tone="error">
						<p>{error}</p>
					</Callout>
				) : (
					<p className="px-6 text-center text-sm text-[var(--rp-fg3)]">
						Press{" "}
						<kbd className="rounded border border-[var(--rp-line)] px-1">
							Send
						</kbd>{" "}
						(or ⌘/Ctrl + Enter) to see the live response here.
					</p>
				)}
			</div>
		);
	}

	const outcome = ekoOutcome(result.json);
	const responseType = result.json
		? responseTypeFor(spec, result.json)
		: undefined;
	const scenario = matchErrorScenario(spec, result.json);
	const tx = spec.financial ? txStatusLabel(result.json) : undefined;
	const failed = !result.ok || outcome === "failure";
	const pretty = result.json
		? JSON.stringify(result.json, null, 2)
		: result.bodyText;
	const contentType = result.responseHeaders["content-type"] ?? "";
	const isJson = result.json !== null;

	const download = () => {
		const blob = new Blob([result.bodyBytes], {
			type: contentType || "application/octet-stream",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${spec.slug}-response${isJson ? ".json" : ".txt"}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex h-full flex-col">
			{/* Summary strip */}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--rp-line)] bg-[var(--rp-codehdr)] px-4 py-2.5 font-mono text-xs">
				<span
					className={cn(
						"text-sm font-bold",
						codeColor(String(result.httpStatus)),
					)}
				>
					{result.httpStatus}
				</span>
				<span className="text-[var(--rp-fg3)]">{result.ms} ms</span>
				<span className="text-[var(--rp-fg3)]">
					{formatBytes(result.bytes)}
				</span>
				<span
					className={cn(
						"rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide",
						outcome === "success" &&
							"border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
						outcome === "failure" &&
							"border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
						outcome === "unknown" &&
							"border-[var(--rp-line)] text-[var(--rp-fg3)]",
					)}
					title="Eko's own verdict: status === 0 means success"
				>
					Eko: {outcome}
				</span>
				{tx && <span className="text-[var(--rp-fg2)]">{tx}</span>}
				{responseType && (
					<span
						className="min-w-0 flex-1 truncate text-[var(--rp-fg3)]"
						title={responseType.meaning}
					>
						{responseType.id} — {responseType.meaning}
					</span>
				)}
			</div>

			{error && (
				<Callout tone="error">
					<p>{error}</p>
				</Callout>
			)}
			{unknownNotice}
			{failed && env === "sandbox" && (
				<Callout tone="warn">
					<p className="font-semibold">UAT test failed?</p>
					<p>
						UAT tests may fail because of changes at the API provider's end in
						their own sandbox environment. We are working with them to fix UAT;
						production is unaffected.
					</p>
				</Callout>
			)}
			{scenario && (
				<Callout tone="info">
					<p>
						<span className="font-semibold">Documented scenario:</span>{" "}
						{scenario.scenario}
					</p>
				</Callout>
			)}

			<HeaderList
				title="Request headers"
				headers={result.requestHeaders}
				mask={["secret-key"]}
				extra={
					<div className="mb-2 break-all text-[var(--rp-fg2)]">
						{spec.method} {result.requestUrl}
					</div>
				}
			/>
			<HeaderList title="Response headers" headers={result.responseHeaders} />

			{/* Body */}
			<div className="flex items-center gap-1 px-3 py-2" role="tablist">
				<span className="mr-1 font-mono text-[0.7rem] text-[var(--rp-fg3)]">
					{contentType || "body"}
				</span>
				<TabButton
					active={view === "preview"}
					onClick={() => setView("preview")}
				>
					Preview
				</TabButton>
				<TabButton active={view === "raw"} onClick={() => setView("raw")}>
					Raw
				</TabButton>
				<div className="ml-auto flex items-center gap-1">
					<button
						type="button"
						onClick={download}
						aria-label="Download response"
						className="cursor-pointer rounded-md border border-[var(--rp-btnline)] bg-[var(--rp-btn)] p-1.5 text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]"
					>
						<Download className="h-4 w-4" />
					</button>
					<CopyButton text={view === "preview" ? pretty : result.bodyText} />
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto border-t border-[var(--rp-line)]">
				{view === "preview" && isJson ? (
					<NumberedCode code={pretty} lang="json" />
				) : (
					<pre className="whitespace-pre-wrap break-all p-4 font-mono text-xs text-[var(--rp-txt)]">
						{result.bodyText || "(empty body)"}
					</pre>
				)}
			</div>
		</div>
	);
};
