import { LangIcon } from "@/components/icons/LangIcon";
import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import { resolveContentType } from "@/lib/data/api-specs-common";
import {
	SAMPLE_LANGS,
	SDK_LANGS,
	sampleFor,
	sdkSampleFor,
	toSampleLang,
	toSdkLang,
} from "@/lib/docs/code-samples";
import { prismLangFor } from "@/lib/docs/prism-rp-theme";
import { usePreferredLang } from "@/lib/docs/use-preferred-lang";
import { cn } from "@/lib/utils";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CopyButton, NumberedCode, TabButton } from "../code-ui";
import { fieldInput, ParamField } from "./ParamField";
import type { TryItController } from "./useTryItState";

/** Collapsible section; `<details>` so it needs no state and stays accessible. */
const Section = ({
	title,
	hint,
	defaultOpen,
	children,
}: {
	title: string;
	hint?: ReactNode;
	defaultOpen?: boolean;
	children: ReactNode;
}) => (
	<details
		open={defaultOpen}
		className="group rounded-xl border border-[var(--rp-line)] bg-[var(--rp-card)]"
	>
		<summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--rp-fg)] [&::-webkit-details-marker]:hidden">
			<ChevronRight className="h-4 w-4 text-[var(--rp-fg3)] transition-transform group-open:rotate-90" />
			{title}
			{hint && (
				<span className="ml-auto text-xs font-normal text-[var(--rp-fg3)]">
					{hint}
				</span>
			)}
		</summary>
		<div className="border-t border-[var(--rp-line)] px-4 py-3">{children}</div>
	</details>
);

const AutoRefToggle = ({ ctl }: { ctl: TryItController }) => (
	<label className="flex cursor-pointer items-center gap-1.5 text-[0.7rem] text-[var(--rp-fg3)]">
		<input
			type="checkbox"
			className="h-3.5 w-3.5 accent-[var(--rp-acc)]"
			checked={ctl.state.autoRef}
			onChange={(e) =>
				ctl.dispatch({ type: "setAutoRef", autoRef: e.target.checked })
			}
		/>
		auto-generate per send
	</label>
);

/**
 * Left pane of the Try-it dialog: credentials (collapsed), URL params (only
 * when the endpoint has any), the request body (form ↔ raw JSON) and live
 * code snippets (collapsed) generated from the current values.
 */
export const RequestPane = ({
	spec,
	ctl,
}: {
	spec: ApiSpec;
	ctl: TryItController;
}) => {
	const { state, dispatch, params } = ctl;
	const [showKey, setShowKey] = useState(false);
	const [lang, setLang] = usePreferredLang();
	const [snippetKind, setSnippetKind] = useState<"http" | "sdk">("http");

	const urlParams = params.filter((p) => p.in === "path" || p.in === "query");
	const bodyParams = params.filter((p) => p.in === "body");
	const hasBody = spec.method !== "GET" && bodyParams.length > 0;
	const contentType = resolveContentType(spec);
	const rawText = state.rawDraft ?? JSON.stringify(state.body, null, 2);

	const overrides = {
		baseUrl: API_ENVIRONMENTS[state.env].baseUrl,
		environment: state.env,
		params: state.params,
		body: state.body,
	};
	const code =
		snippetKind === "sdk"
			? sdkSampleFor(spec, toSdkLang(lang), overrides)
			: sampleFor(spec, toSampleLang(lang), overrides);
	const codeLang =
		snippetKind === "sdk"
			? prismLangFor(toSdkLang(lang))
			: prismLangFor(toSampleLang(lang));

	return (
		<div className="space-y-3">
			<Section
				title="Authentication"
				hint={
					state.env === "sandbox"
						? "UAT demo keys prefilled"
						: "your production keys"
				}
			>
				<div className="space-y-3">
					<div className="space-y-1">
						<label
							htmlFor="tryit-developer-key"
							className="font-mono text-xs font-semibold text-[var(--rp-fg)]"
						>
							developer_key
						</label>
						<input
							id="tryit-developer-key"
							type="text"
							autoComplete="off"
							spellCheck={false}
							value={state.creds.developerKey}
							className={fieldInput}
							onChange={(e) =>
								dispatch({
									type: "setCreds",
									creds: { developerKey: e.target.value },
								})
							}
						/>
					</div>
					<div className="space-y-1">
						<label
							htmlFor="tryit-access-key"
							className="font-mono text-xs font-semibold text-[var(--rp-fg)]"
						>
							access_key
						</label>
						<div className="relative">
							<input
								id="tryit-access-key"
								type={showKey ? "text" : "password"}
								autoComplete="off"
								spellCheck={false}
								value={state.creds.accessKey}
								className={cn(fieldInput, "pr-9")}
								onChange={(e) =>
									dispatch({
										type: "setCreds",
										creds: { accessKey: e.target.value },
									})
								}
							/>
							<button
								type="button"
								aria-label={showKey ? "Hide access key" : "Show access key"}
								onClick={() => setShowKey((v) => !v)}
								className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--rp-fg3)] hover:text-[var(--rp-fg)]"
							>
								{showKey ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						</div>
						<p className="text-xs text-[var(--rp-fg3)]">
							Used only to compute <code>secret-key</code> in your browser when
							you press Send. It is never stored and never leaves this page.
						</p>
					</div>
				</div>
			</Section>

			{urlParams.length > 0 && (
				<Section
					title={spec.method === "GET" ? "Query parameters" : "URL parameters"}
					defaultOpen
				>
					<div className="space-y-3">
						{urlParams.map((p) => (
							<ParamField
								key={p.name}
								param={p}
								value={state.params[p.name]}
								error={state.fieldErrors[p.name]}
								onChange={(v) =>
									dispatch({
										type: "setParam",
										name: p.name,
										value: v == null ? "" : String(v),
									})
								}
								trailing={
									p.name === "client_ref_id" ? (
										<AutoRefToggle ctl={ctl} />
									) : undefined
								}
							/>
						))}
					</div>
				</Section>
			)}

			{hasBody && (
				<Section
					title="Request body"
					defaultOpen
					hint={
						<span className="rounded border border-[var(--rp-accline)] bg-[var(--rp-accbg)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--rp-acc)]">
							{contentType}
						</span>
					}
				>
					<div
						className="mb-3 flex gap-1 border-b border-[var(--rp-line)] pb-2"
						role="tablist"
					>
						<TabButton
							active={!state.rawMode}
							onClick={() => dispatch({ type: "setRawMode", rawMode: false })}
						>
							Form
						</TabButton>
						<TabButton
							active={state.rawMode}
							onClick={() => dispatch({ type: "setRawMode", rawMode: true })}
						>
							Raw JSON
						</TabButton>
						{state.rawMode && state.rawError && (
							<span className="ml-auto self-center text-xs text-rose-600 dark:text-rose-400">
								{state.rawError}
							</span>
						)}
					</div>
					{state.rawMode ? (
						<textarea
							aria-label="Raw JSON body"
							rows={Math.min(24, Math.max(6, rawText.split("\n").length + 1))}
							value={rawText}
							spellCheck={false}
							className={cn(
								fieldInput,
								"resize-y",
								state.rawError && "border-rose-500",
							)}
							onChange={(e) =>
								dispatch({ type: "setRaw", text: e.target.value })
							}
						/>
					) : (
						<div className="space-y-3">
							{bodyParams.map((p) =>
								p.type === "file" ? (
									<ParamField
										key={p.name}
										param={p}
										value={undefined}
										error={state.fieldErrors[p.name]}
										onChange={() => {}}
										onFile={(file) =>
											dispatch({ type: "setFile", name: p.name, file })
										}
									/>
								) : (
									<ParamField
										key={p.name}
										param={p}
										value={state.body[p.name]}
										error={state.fieldErrors[p.name]}
										onChange={(v) =>
											dispatch({ type: "setBodyField", name: p.name, value: v })
										}
										onError={(err) =>
											dispatch({
												type: "setFieldError",
												name: p.name,
												error: err,
											})
										}
										trailing={
											p.name === "client_ref_id" ? (
												<AutoRefToggle ctl={ctl} />
											) : undefined
										}
									/>
								),
							)}
							{contentType === "multipart/form-data" && (
								<p className="text-xs text-[var(--rp-fg3)]">
									Non-file fields are sent together as one JSON{" "}
									<code>form-data</code> part; each upload is its own part.
								</p>
							)}
						</div>
					)}
				</Section>
			)}

			<Section title="Code snippet" hint="reflects the values above">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-1" role="tablist">
						<TabButton
							active={snippetKind === "http"}
							onClick={() => setSnippetKind("http")}
						>
							HTTP
						</TabButton>
						<TabButton
							active={snippetKind === "sdk"}
							onClick={() => setSnippetKind("sdk")}
						>
							EPS SDK
						</TabButton>
						<span className="mx-1 h-4 w-px bg-[var(--rp-line)]" />
						{(snippetKind === "sdk" ? SDK_LANGS : SAMPLE_LANGS).map((l) => (
							<TabButton
								key={l.id}
								active={
									(snippetKind === "sdk"
										? toSdkLang(lang)
										: toSampleLang(lang)) === l.id
								}
								onClick={() => setLang(l.id)}
							>
								<LangIcon id={l.id} className="h-3.5 w-3.5 shrink-0" />
								{l.label}
							</TabButton>
						))}
						<div className="ml-auto">
							<CopyButton text={code} />
						</div>
					</div>
					<div className="overflow-hidden rounded-lg border border-[var(--rp-line)]">
						<NumberedCode code={code} lang={codeLang} />
					</div>
					<p className="text-xs text-[var(--rp-fg3)]">
						Auth headers stay as placeholders — your keys are never written into
						snippets.
					</p>
				</div>
			</Section>
		</div>
	);
};
