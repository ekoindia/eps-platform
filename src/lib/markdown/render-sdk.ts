/**
 * Markdown twins for the SDK section: `/docs/sdk.md` and `/docs/sdk/<lang>.md`.
 *
 * The HTML pages and these twins read the SAME data (`@/lib/data/sdk-guides`,
 * `SDK_INSTALL`, `sdkSampleFor`, `API_ENVIRONMENTS`, `HTTP_STATUS_CODES`), so
 * they cannot drift. A language guide's prose comes from its `.mdx` source read
 * verbatim; every `<SdkFacts section="…" />` tag in it is expanded here to real
 * markdown.
 *
 * Like `renderGuideMarkdown`, the expansion THROWS on any unrecognised form
 * rather than letting raw JSX leak into a `.md` — a new `SdkFacts` section that
 * forgets its substitution fails the build, not production.
 */
import { SITE_URL } from "@/lib/config/site";
import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { HTTP_STATUS_CODES } from "@/lib/data/api-error-codes";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import {
	SDK_GUIDES,
	type SdkGuideMeta,
	sdkGuideHref,
} from "@/lib/data/sdk-guides";
import { SDK_INSTALL, sdkSampleFor } from "@/lib/docs/code-samples";
import {
	bulletList,
	canonicalNotice,
	frontMatter,
	h2,
	joinBlocks,
	markdownTable,
} from "./shared";

/** The endpoint every quickstart calls — the same one the HTML pages use. */
const SHOWCASE_SLUG = "pan-lite";

/** Fenced block tag per language, matching the `.mdx`/Prism language ids. */
const FENCE: Record<string, string> = {
	javascript: "javascript",
	python: "python",
	php: "php",
	go: "go",
	java: "java",
};

const fence = (lang: string, code: string): string =>
	["```" + lang, code.trim(), "```"].join("\n");

const installBlock = (guide: SdkGuideMeta): string => {
	const install = SDK_INSTALL[guide.lang];
	const facts = markdownTable(
		["Fact", "Value"],
		[
			["Package", `\`${guide.packageName}\``],
			["Requires", guide.minRuntime],
			["Dependencies", guide.dependencies],
			["Source", guide.sourceUrl],
		],
	);
	return joinBlocks([
		install ? fence("bash", install.command) : "",
		install ? `Registry: ${install.registry} — ${install.registryUrl}` : "",
		facts,
		guide.installNotes?.length ? bulletList(guide.installNotes) : "",
	]);
};

const quickstartBlock = (guide: SdkGuideMeta): string => {
	const spec = API_SPECS_MAP[SHOWCASE_SLUG];
	if (!spec) return "";
	return fence(FENCE[guide.lang] ?? "text", sdkSampleFor(spec, guide.lang));
};

const configBlock = (guide: SdkGuideMeta): string =>
	markdownTable(
		["Option", "Type", "Required", "Notes"],
		guide.config.map((o) => [
			`\`${o.name}\``,
			`\`${o.type}\``,
			o.required ? "Yes" : "No",
			o.units ? `${o.description} (${o.units})` : o.description,
		]),
	);

const membersBlock = (guide: SdkGuideMeta): string =>
	markdownTable(
		["Member", "Kind", "Signature", "What it does"],
		guide.members.map((m) => [
			`\`${m.name}\``,
			m.kind,
			`\`${m.signature}\``,
			m.description,
		]),
	);

const errorsBlock = (guide: SdkGuideMeta): string =>
	joinBlocks([
		markdownTable(
			["Type", "Raised when", "Fields"],
			guide.errorTypes.map((e) => [`\`${e.name}\``, e.when, e.fields ?? "—"]),
		),
		markdownTable(
			["HTTP status", "Meaning"],
			HTTP_STATUS_CODES.map((c) => [String(c.code), c.meaning]),
		),
	]);

const environmentsBlock = (): string =>
	markdownTable(
		["Environment", "Base URL", "Notes"],
		Object.entries(API_ENVIRONMENTS).map(([id, env]) => [
			`\`${id}\` (${env.label})`,
			env.baseUrl,
			env.note ?? "—",
		]),
	);

/** Every section `<SdkFacts>` supports, and its markdown form. */
const SECTIONS: Record<string, (guide: SdkGuideMeta) => string> = {
	install: installBlock,
	quickstart: quickstartBlock,
	config: configBlock,
	members: membersBlock,
	files: (g) => bulletList(g.fileValues),
	errors: errorsBlock,
	environments: () => environmentsBlock(),
	notes: (g) => (g.notes?.length ? bulletList(g.notes) : ""),
};

const SDK_FACTS_TAG = /<SdkFacts\s+section="([^"]+)"\s*\/>/g;
const CALLOUT_BLOCK = /<Callout\b[^>]*>([\s\S]*?)<\/Callout\s*>/g;
const BUTTON_LINK =
	/<Button\b[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/Button\s*>/g;

/** Expand every `<SdkFacts section="…" />` into its markdown block. Throws on an
 * unknown section or any unrecognised tag form rather than leaking JSX. */
function expandSdkFacts(body: string, guide: SdkGuideMeta): string {
	const out = body.replace(SDK_FACTS_TAG, (_match, section: string) => {
		const render = SECTIONS[section];
		if (!render)
			throw new Error(
				`renderSdkGuideMarkdown: unknown <SdkFacts section="${section}"> — add it to SECTIONS in render-sdk.ts`,
			);
		return render(guide);
	});
	if (/<SdkFacts\b/.test(out))
		throw new Error(
			'renderSdkGuideMarkdown: unrecognised <SdkFacts> form — expected <SdkFacts section="…" />',
		);
	return out;
}

/** Flatten `<Callout>` to a blockquote and `<Button><a>` to a plain link — the
 * styled affordances are HTML-page only. Mirrors `expandCallouts` in
 * `render-doc.ts`; kept local so the two sections stay independently testable. */
function expandCallouts(body: string): string {
	const out = body.replace(CALLOUT_BLOCK, (_match, inner: string) =>
		inner
			.replace(
				BUTTON_LINK,
				(_button, href: string, label: string) =>
					`[${label.trim().replace(/\s+/g, " ")}](${href})`,
			)
			.trim()
			.split("\n")
			.map((line) => (line.trim() ? `> ${line.trim()}` : ">"))
			.join("\n"),
	);
	const flattened = out.replace(
		BUTTON_LINK,
		(_button, href: string, label: string) =>
			`[${label.trim().replace(/\s+/g, " ")}](${href})`,
	);
	if (/<(?:Callout|Button)\b/.test(flattened))
		throw new Error(
			"renderSdkGuideMarkdown: unrecognised <Callout>/<Button> form — expected a paired <Callout …> … </Callout>",
		);
	return flattened;
}

/** Render `/docs/sdk/<slug>.md` from the guide metadata and its raw MDX body. */
export function renderSdkGuideMarkdown(
	guide: SdkGuideMeta,
	rawBody: string,
): string {
	const canonical = `${SITE_URL}${sdkGuideHref(guide.slug)}`;
	return joinBlocks([
		frontMatter({
			title: guide.title,
			description: guide.summary,
			canonical,
		}),
		canonicalNotice(canonical),
		expandCallouts(expandSdkFacts(rawBody.trim(), guide)),
	]);
}

/** Render the `/docs/sdk.md` hub: every SDK, with install and requirements. */
export function renderSdkIndexMarkdown(): string {
	const canonical = `${SITE_URL}${sdkGuideHref()}`;
	const ordered = [...SDK_GUIDES].sort((a, b) => a.order - b.order);
	return joinBlocks([
		frontMatter({
			title: "EPS SDKs",
			description:
				"Backend SDKs for the EPS APIs in Node.js, Python, PHP, Go and Java.",
			canonical,
		}),
		canonicalNotice(canonical),
		"# EPS SDKs",
		"Every SDK embeds the same API surface these docs are built from, so one generic `call(slug, params)` reaches every endpoint. Each signs your requests, validates params before sending, and reports failures the same way.",
		"Backend only: the access key signs every request and must never reach a browser or a mobile app.",
		h2("Available SDKs"),
		markdownTable(
			["SDK", "Package", "Install", "Requires", "Guide"],
			ordered.map((g) => [
				g.title,
				`\`${g.packageName}\``,
				SDK_INSTALL[g.lang] ? `\`${SDK_INSTALL[g.lang]!.command}\`` : "—",
				g.minRuntime,
				`${SITE_URL}${sdkGuideHref(g.slug)}`,
			]),
		),
		h2("Shared behaviour"),
		bulletList([
			"**Signs the request** — `developer_key`, `secret-key` and `secret-key-timestamp` headers on every call.",
			"**Validates first** — missing required params and wrong types fail before a request goes out.",
			"**Routes the params** — path tokens, query string, JSON body, or `multipart/form-data` for file-upload endpoints.",
			"**Fails loudly** — a non-2xx response raises a typed HTTP error carrying the decoded envelope; a non-JSON body raises rather than returning an empty result.",
			"**Times out** — 30 seconds by default in every language, overridable.",
		]),
		h2("Environments"),
		environmentsBlock(),
	]);
}
