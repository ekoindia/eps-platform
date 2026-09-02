/**
 * `<SdkFacts section="…" />` — the generated blocks of an SDK guide page.
 *
 * The five language guides are a HYBRID: the structured facts live in
 * `@/lib/data/sdk-guides` (and are reused by the markdown twins and the context
 * MCP), while the narrative around them is authored per language in
 * `src/content/sdk/<slug>.mdx`. This component is the bridge — an author drops
 * a section where the prose wants it and never repeats a fact.
 *
 * The language comes from `SdkGuideContext`, set once by the page, so the MDX
 * never has to name it.
 *
 * Every section here MUST have a matching substitution in
 * `renderSdkGuideMarkdown` (`src/lib/markdown/render-sdk.ts`), or the markdown
 * twin would leak raw JSX — that renderer throws rather than let it through.
 */
import { CodeCard } from "@/components/docs/CodeCard";
import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { HTTP_STATUS_CODES } from "@/lib/data/api-error-codes";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import type { SdkGuideMeta } from "@/lib/data/sdk-guides";
import { SDK_INSTALL, sdkSampleFor } from "@/lib/docs/code-samples";
import { ArrowUpRight } from "lucide-react";
import { type ReactNode, createContext, useContext } from "react";

/** The guide being rendered. Set by `SdkGuidePage`; `<SdkFacts>` reads it. */
export const SdkGuideContext = createContext<SdkGuideMeta | null>(null);

/** The endpoint every language's quickstart calls — the same one `/docs` uses. */
export const SHOWCASE_SLUG = "pan-lite";

export type SdkFactsSection =
	| "install"
	| "quickstart"
	| "config"
	| "members"
	| "files"
	| "errors"
	| "environments"
	| "notes";

const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
	<div className="not-prose my-6 overflow-x-auto rounded-xl border border-border">
		<table className="w-full border-collapse text-left text-sm">
			<thead className="bg-muted/50">
				<tr>
					{head.map((h) => (
						<th
							key={h}
							className="whitespace-nowrap px-4 py-2.5 font-semibold text-foreground"
						>
							{h}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, i) => (
					<tr key={i} className="border-t border-border align-top">
						{row.map((cell, j) => (
							<td key={j} className="px-4 py-2.5 text-muted-foreground">
								{cell}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/**
 * Render `backticked` spans in a data string as inline code. The data in
 * `sdk-guides.ts` is written once and consumed by both this component and the
 * markdown twins, so it carries markdown-style backticks; the twin emits them
 * verbatim and this turns them into real `<code>`.
 * ponytail: backticks only — the data is deliberately not full markdown.
 */
const InlineMd = ({ text }: { text: string }) => (
	<>
		{text.split(/(`[^`]+`)/g).map((part, i) =>
			part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
				<Code key={i}>{part.slice(1, -1)}</Code>
			) : (
				part
			),
		)}
	</>
);

const Code = ({ children }: { children: ReactNode }) => (
	<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
		{children}
	</code>
);

const Install = ({ guide }: { guide: SdkGuideMeta }) => {
	const install = SDK_INSTALL[guide.lang];
	return (
		<div className="not-prose my-6 space-y-4">
			{install && (
				<>
					<CodeCard code={install.command} language="bash" />
					<a
						href={install.registryUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-sm font-medium text-eko-gold hover:underline"
					>
						View {guide.packageName} on {install.registry}
						<ArrowUpRight className="h-3.5 w-3.5" />
					</a>
				</>
			)}
			<dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
				<dt className="font-semibold text-foreground">Package</dt>
				<dd className="text-muted-foreground">
					<Code>{guide.packageName}</Code>
				</dd>
				<dt className="font-semibold text-foreground">Requires</dt>
				<dd className="text-muted-foreground">{guide.minRuntime}</dd>
				<dt className="font-semibold text-foreground">Dependencies</dt>
				<dd className="text-muted-foreground">
					<InlineMd text={guide.dependencies} />
				</dd>
				<dt className="font-semibold text-foreground">Source</dt>
				<dd>
					<a
						href={guide.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-eko-gold hover:underline"
					>
						GitHub
					</a>
				</dd>
			</dl>
			{guide.installNotes?.length ? (
				<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
					{guide.installNotes.map((note) => (
						<li key={note}>
							<InlineMd text={note} />
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
};

export const SdkFacts = ({ section }: { section: SdkFactsSection }) => {
	const guide = useContext(SdkGuideContext);
	if (!guide) return null;

	switch (section) {
		case "install":
			return <Install guide={guide} />;

		case "quickstart": {
			const spec = API_SPECS_MAP[SHOWCASE_SLUG];
			if (!spec) return null;
			return (
				<div className="not-prose my-6">
					<CodeCard
						code={sdkSampleFor(spec, guide.lang)}
						language={guide.lang}
					/>
				</div>
			);
		}

		case "config":
			return (
				<Table
					head={["Option", "Type", "Required", "Notes"]}
					rows={guide.config.map((o) => [
						<Code>{o.name}</Code>,
						<Code>{o.type}</Code>,
						o.required ? "Yes" : "No",
						<>
							<InlineMd text={o.description} />
							{o.units ? (
								<>
									{" "}
									<span className="text-foreground">({o.units})</span>
								</>
							) : null}
						</>,
					])}
				/>
			);

		case "members":
			return (
				<Table
					head={["Member", "Signature", "What it does"]}
					rows={guide.members.map((m) => [
						<>
							<Code>{m.name}</Code>
							<div className="mt-1 text-xs uppercase tracking-wide">
								{m.kind}
							</div>
						</>,
						<Code>{m.signature}</Code>,
						<InlineMd text={m.description} />,
					])}
				/>
			);

		case "notes":
			if (!guide.notes?.length) return null;
			return (
				<ul className="my-6 list-disc space-y-1 pl-5">
					{guide.notes.map((n) => (
						<li key={n}>
							<InlineMd text={n} />
						</li>
					))}
				</ul>
			);

		case "files":
			return (
				<ul className="my-6 list-disc space-y-1 pl-5">
					{guide.fileValues.map((v) => (
						<li key={v}>
							<InlineMd text={v} />
						</li>
					))}
				</ul>
			);

		case "errors":
			return (
				<>
					<Table
						head={["Type", "Raised when", "Fields"]}
						rows={guide.errorTypes.map((e) => [
							<Code>{e.name}</Code>,
							<InlineMd text={e.when} />,
							e.fields ? <InlineMd text={e.fields} /> : "—",
						])}
					/>
					<Table
						head={["HTTP status", "Meaning"]}
						rows={HTTP_STATUS_CODES.map((c) => [
							<Code>{c.code}</Code>,
							c.meaning,
						])}
					/>
				</>
			);

		case "environments":
			return (
				<Table
					head={["Environment", "Base URL", "Notes"]}
					rows={Object.entries(API_ENVIRONMENTS).map(([id, env]) => [
						<>
							<Code>{id}</Code>
							<div className="mt-1 text-xs">{env.label}</div>
						</>,
						<Code>{env.baseUrl}</Code>,
						env.note ?? "—",
					])}
				/>
			);
	}
};
