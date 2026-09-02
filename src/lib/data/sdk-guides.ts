/**
 * Per-language facts for the SDK guides at `/docs/sdk` — the SINGLE SOURCE for
 * the HTML pages, their markdown twins, and the `list_sdks` / `get_sdk` tools in
 * the context MCP.
 *
 * PLAIN DATA — no React, no `.mdx`, no browser globals — so this module stays
 * loadable from Node (`ssg/routes.ts`, the markdown plugin, the agent-bundle
 * builder and unit tests) without pulling in the MDX toolchain.
 *
 * What lives HERE vs elsewhere:
 * - install command / registry / registry URL → `SDK_INSTALL` in
 *   `src/lib/docs/code-samples.ts` (already the source for `/docs` and every
 *   endpoint's right rail). Not duplicated here.
 * - worked `call()` snippets → `sdkSampleFor(spec, lang)`, same module.
 * - base URLs → `API_ENVIRONMENTS` in `src/lib/data/api-auth.ts`.
 * - HTTP status meanings → `HTTP_STATUS_CODES` in `src/lib/data/api-error-codes.ts`.
 *
 * The response/error and timeout contract described by `errorTypes` and the
 * `timeout` option is pinned across all five SDKs by the "Response and error
 * contract conformance" section of `docs/sdk-golden-vector.md`.
 */
import type { SdkLang } from "@/lib/docs/code-samples";

/** URL segment for one language guide: `/docs/sdk/<slug>`. */
export type SdkSlug = "nodejs" | "python" | "php" | "go" | "java";

/** One constructor / builder / config option on the client. */
export interface SdkConfigOption {
	name: string;
	type: string;
	required: boolean;
	description: string;
	/** Unit and default, where the option carries one (e.g. "ms, default 30_000"). */
	units?: string;
}

/** One public class, method, function, type or constant in the SDK. */
export interface SdkMember {
	kind: "class" | "method" | "function" | "type" | "constant";
	name: string;
	signature: string;
	description: string;
}

/** How one SDK reports failure. Same outcome everywhere, idiomatic taxonomy. */
export interface SdkErrorType {
	name: string;
	/** When it is raised/thrown/returned. */
	when: string;
	/** Fields a caller can read off it, if any. */
	fields?: string;
}

export interface SdkGuideMeta {
	/** Language id shared with `SDK_LANGS` / `SDK_INSTALL` / `sdkSampleFor`. */
	lang: SdkLang;
	/** URL segment — NOT derivable from `lang` (javascript → nodejs). */
	slug: SdkSlug;
	title: string;
	summary: string;
	/** Sort order in the nav and on the index page. */
	order: number;
	/** Registry coordinates as a developer types them. */
	packageName: string;
	minRuntime: string;
	dependencies: string;
	/** Public source (the read-only split mirror where one exists). */
	sourceUrl: string;
	/** Extra install notes — repositories to add, build-tool snippets. */
	installNotes?: string[];
	config: SdkConfigOption[];
	members: SdkMember[];
	errorTypes: SdkErrorType[];
	/** Values this language accepts for a `type: "file"` param. */
	fileValues: string[];
	/** Language-specific gotchas worth calling out on the page. */
	notes?: string[];
}

const REPO = "https://github.com/ekoindia/eps-platform/tree/main/packages";

/** Every client takes these four, whatever the language spells them. */
const commonConfig = (
	developerKey: string,
	accessKey: string,
	environment: string,
	initiatorId: string,
	userCode: string,
	stringType: string,
): SdkConfigOption[] => [
	{
		name: developerKey,
		type: stringType,
		required: true,
		description: "Your EPS developer key, sent as the `developer_key` header.",
	},
	{
		name: accessKey,
		type: stringType,
		required: true,
		description:
			"Server-side secret used to sign every request. Never ships to a browser.",
	},
	{
		name: environment,
		type: '"sandbox" | "production"',
		required: true,
		description: "Selects the base URL from the embedded surface.",
	},
	{
		name: initiatorId,
		type: stringType,
		required: false,
		description:
			"Default `initiator_id` (registered mobile of the API user) injected into every call.",
	},
	{
		name: userCode,
		type: stringType,
		required: false,
		description:
			"Default `user_code` (retailer/agent code) injected into every call.",
	},
];

export const SDK_GUIDES: SdkGuideMeta[] = [
	{
		lang: "javascript",
		slug: "nodejs",
		title: "Node.js SDK",
		summary:
			"Backend-only Node.js client for every EPS API, with HMAC signing, input validation and typed errors built in.",
		order: 1,
		packageName: "@ekoindia/eps-sdk",
		minRuntime: "Node.js 18 or newer",
		dependencies: "None — standard library only (`node:crypto`, global `fetch`).",
		sourceUrl: `${REPO}/sdk-js`,
		config: [
			...commonConfig(
				"developerKey",
				"accessKey",
				"environment",
				"initiatorId",
				"userCode",
				"string",
			),
			{
				name: "timeoutMs",
				type: "number",
				required: false,
				units: "milliseconds, default 30_000",
				description:
					"Aborts a request that takes longer. Named for its unit — Python and PHP use seconds.",
			},
			{
				name: "fetch",
				type: "typeof fetch",
				required: false,
				description: "Inject a custom fetch implementation (proxies, tests).",
			},
		],
		members: [
			{
				kind: "class",
				name: "EpsClient",
				signature: "new EpsClient(options: EpsClientOptions)",
				description:
					"The client. Throws immediately if constructed where `window` exists — `accessKey` must never reach a browser.",
			},
			{
				kind: "method",
				name: "call",
				signature:
					"client.call<T = unknown>(slug: string, params?: Record<string, unknown>): Promise<T>",
				description:
					"Validates, signs and sends one endpoint call; resolves with the decoded envelope.",
			},
			{
				kind: "function",
				name: "signSecretKey",
				signature: "signSecretKey(accessKey: string, timestamp: string): string",
				description:
					"The raw signing primitive, exported for debugging. `call()` applies it for you.",
			},
			{
				kind: "constant",
				name: "MULTIPART_JSON_FIELD",
				signature: 'MULTIPART_JSON_FIELD = "form-data"',
				description:
					"Name of the single form field carrying the JSON envelope on file-upload endpoints.",
			},
			{
				kind: "type",
				name: "EpsClientOptions",
				signature: "interface EpsClientOptions",
				description: "The constructor options above.",
			},
			{
				kind: "type",
				name: "SdkEndpoint / SdkParam",
				signature: "interface SdkEndpoint, interface SdkParam",
				description:
					"Shape of one endpoint in the embedded surface (slug, method, path, params).",
			},
		],
		errorTypes: [
			{
				name: "EpsHttpError",
				when: "Any non-2xx response.",
				fields: "`status`, `url`, `body` (decoded envelope or null), `raw`",
			},
			{
				name: "EpsError",
				when: "Unknown slug, missing required param, wrong param type, bad option, or a 2xx body that is not JSON. `EpsHttpError` extends it.",
			},
			{
				name: "TimeoutError (DOMException)",
				when: "The request exceeded `timeoutMs`. Surfaced raw, as Node reports it.",
			},
		],
		fileValues: [
			"A local file path (read from disk; the filename is the basename)",
			"A `Blob` or `File` (a `File` keeps its own name)",
		],
		notes: [
			"ESM only (`\"type\": \"module\"`). Use `import`, or `await import()` from CommonJS.",
			"A per-call cancellation signal is not supported yet — `timeoutMs` is the only abort source.",
		],
	},
	{
		lang: "python",
		slug: "python",
		title: "Python SDK",
		summary:
			"Backend-only Python client for every EPS API, dependency-free and typed, with HMAC signing built in.",
		order: 2,
		packageName: "eps-sdk",
		minRuntime: "Python 3.9 or newer",
		dependencies:
			"None — standard library only (`urllib`, `hmac`, `hashlib`, `mimetypes`).",
		sourceUrl: `${REPO}/sdk-python`,
		config: [
			...commonConfig(
				"developer_key",
				"access_key",
				"environment",
				"initiator_id",
				"user_code",
				"str",
			),
			{
				name: "timeout",
				type: "float",
				required: false,
				units: "seconds, default 30.0",
				description: "Whole-request budget passed through to `urlopen`.",
			},
		],
		members: [
			{
				kind: "class",
				name: "EpsClient",
				signature:
					"EpsClient(developer_key, access_key, environment, initiator_id=None, user_code=None, timeout=30.0)",
				description: "The client — a dataclass, so keyword arguments read well.",
			},
			{
				kind: "method",
				name: "call",
				signature:
					"client.call(slug: str, params: Mapping[str, Any] | None = None) -> Any",
				description:
					"Validates, signs and sends one endpoint call; returns the decoded envelope.",
			},
			{
				kind: "method",
				name: "resolve_target",
				signature:
					"client.resolve_target(slug, params=None) -> Target",
				description:
					"The signed method/url/body/headers for a call, without sending it. Useful for debugging.",
			},
			{
				kind: "method",
				name: "build_headers",
				signature: "client.build_headers(multipart: bool = False) -> dict[str, str]",
				description: "The four auth headers for a single request.",
			},
			{
				kind: "function",
				name: "sign_secret_key",
				signature: "sign_secret_key(access_key: str, timestamp: str) -> str",
				description: "The raw signing primitive, exported for debugging.",
			},
			{
				kind: "constant",
				name: "MULTIPART_JSON_FIELD",
				signature: 'MULTIPART_JSON_FIELD = "form-data"',
				description:
					"Name of the single form field carrying the JSON envelope on file-upload endpoints.",
			},
			{
				kind: "type",
				name: "Target",
				signature: "@dataclass Target(method, url, body, headers, multipart)",
				description: "What `resolve_target` returns.",
			},
		],
		errorTypes: [
			{
				name: "EpsHttpError",
				when: "Any non-2xx response.",
				fields: "`.status`, `.url`, `.body` (decoded envelope or None), `.raw` (bytes)",
			},
			{
				name: "EpsError",
				when: "Unknown slug, missing required param, wrong param type, bad config, or a 2xx body that is not JSON. `EpsHttpError` subclasses it.",
			},
			{
				name: "urllib.error.URLError",
				when: "Transport failure or timeout. Surfaced raw.",
			},
		],
		fileValues: [
			"A path `str` or `os.PathLike` (the MIME type is guessed, falling back to `application/octet-stream`)",
			"An in-memory `(filename, bytes)` tuple",
		],
		notes: [
			"Paths are checked for existence during validation, so a typo fails before the request is signed.",
		],
	},
	{
		lang: "php",
		slug: "php",
		title: "PHP SDK",
		summary:
			"Backend-only PHP client for every EPS API, with HMAC signing, input validation and typed errors built in.",
		order: 3,
		packageName: "ekoindia/eps-sdk",
		minRuntime: "PHP 8.1 or newer",
		dependencies: "None beyond the `curl` and `json` extensions.",
		sourceUrl: `${REPO}/sdk-php`,
		installNotes: [
			"Published from a read-only mirror (`ekoindia/eps-sdk-php`), subtree-split from the monorepo.",
		],
		config: [
			...commonConfig(
				"$developerKey",
				"$accessKey",
				"$environment",
				"$initiatorId",
				"$userCode",
				"string",
			),
			{
				name: "$timeout",
				type: "float",
				required: false,
				units: "seconds, default 30.0",
				description:
					"Whole-request budget, applied as `CURLOPT_TIMEOUT_MS` so sub-second values are not truncated.",
			},
		],
		members: [
			{
				kind: "class",
				name: "Eko\\Eps\\EpsClient",
				signature:
					"new EpsClient(string $developerKey, string $accessKey, string $environment, ?string $initiatorId = null, ?string $userCode = null, float $timeout = 30.0)",
				description: "The client. Use named arguments.",
			},
			{
				kind: "method",
				name: "call",
				signature: "$client->call(string $slug, array $params = []): array",
				description:
					"Validates, signs and sends one endpoint call; returns the decoded envelope.",
			},
			{
				kind: "method",
				name: "resolveTarget",
				signature: "$client->resolveTarget(string $slug, array $params = []): array",
				description:
					"The signed url/body/method for a call, without sending it. Exposed for testing.",
			},
			{
				kind: "method",
				name: "curlOptions",
				signature: "$client->curlOptions(array $target): array",
				description:
					"The cURL option map `call()` uses, including the timeout. Exposed for testing.",
			},
			{
				kind: "method",
				name: "decodeResponse",
				signature:
					"EpsClient::decodeResponse(int $status, string $url, string $raw): array",
				description:
					"Static. Applies the shared response contract to one raw response — the seam the conformance tests drive.",
			},
			{
				kind: "method",
				name: "signSecretKey",
				signature:
					"EpsClient::signSecretKey(string $accessKey, string $timestamp): string",
				description: "Static. The raw signing primitive, exposed for debugging.",
			},
			{
				kind: "constant",
				name: "EpsClient::MULTIPART_JSON_FIELD",
				signature: "const MULTIPART_JSON_FIELD = 'form-data'",
				description:
					"Name of the single form field carrying the JSON envelope on file-upload endpoints.",
			},
		],
		errorTypes: [
			{
				name: "Eko\\Eps\\EpsHttpException",
				when: "Any non-2xx response.",
				fields: "`->status`, `->url`, `->body` (decoded envelope or null), `->raw`",
			},
			{
				name: "Eko\\Eps\\EpsException",
				when: "Transport failure, a malformed surface asset, or a 2xx body that is not JSON. Extends `\\RuntimeException`.",
			},
			{
				name: "\\InvalidArgumentException",
				when: "Unknown environment or slug, missing required param, wrong param type. SPL already has the right class, and it is a `\\LogicException`, so it cannot share a base with the runtime failures.",
			},
		],
		fileValues: [
			"A local file path (wrapped in a `CURLFile` for you)",
			"A `\\CURLFile` you built yourself",
		],
		notes: [
			"Presence is checked with `isset()`, so a param explicitly set to `null` counts as missing — matching every other SDK.",
		],
	},
	{
		lang: "go",
		slug: "go",
		title: "Go SDK",
		summary:
			"Backend-only Go client for every EPS API — standard library only, context-aware, with HMAC signing built in.",
		order: 4,
		packageName: "github.com/ekoindia/eps-sdk-go",
		minRuntime: "Go 1.22 or newer",
		dependencies:
			"None — `go.mod` has no `require` block and there is no `go.sum`.",
		sourceUrl: `${REPO}/sdk-go`,
		installNotes: [
			"Published from a read-only mirror (`ekoindia/eps-sdk-go`) as a git tag; there is no separate registry.",
		],
		config: [
			...commonConfig(
				"DeveloperKey",
				"AccessKey",
				"Environment",
				"InitiatorID",
				"UserCode",
				"string",
			),
			{
				name: "HTTPClient",
				type: "*http.Client",
				required: false,
				units: "default: 30s timeout",
				description:
					"Control timeouts, proxies or retries by supplying your own client.",
			},
		],
		members: [
			{
				kind: "function",
				name: "eps.New",
				signature: "eps.New(cfg eps.Config) (*eps.Client, error)",
				description:
					"Builds a client. Safe for concurrent use once constructed.",
			},
			{
				kind: "method",
				name: "Call",
				signature:
					"client.Call(ctx context.Context, slug string, params map[string]any) (map[string]any, error)",
				description:
					"Validates, signs and sends one endpoint call. The only SDK with per-call cancellation.",
			},
			{
				kind: "method",
				name: "ResolveTarget",
				signature:
					"client.ResolveTarget(slug string, params map[string]any) (*eps.Target, error)",
				description: "The signed request for a call, without sending it.",
			},
			{
				kind: "method",
				name: "BuildHeaders",
				signature: "client.BuildHeaders(multipartBody bool) map[string]string",
				description: "The four auth headers for a single request.",
			},
			{
				kind: "function",
				name: "eps.Sign",
				signature: "eps.Sign(accessKey, timestamp string) string",
				description: "The raw signing primitive, exported for debugging.",
			},
			{
				kind: "type",
				name: "eps.File",
				signature: "eps.File{Name string; Content []byte}",
				description: "An in-memory upload.",
			},
			{
				kind: "constant",
				name: "eps.MultipartJSONField",
				signature: 'MultipartJSONField = "form-data"',
				description:
					"Name of the single form field carrying the JSON envelope on file-upload endpoints.",
			},
		],
		errorTypes: [
			{
				name: "*eps.HTTPError",
				when: "Any non-2xx response. Match it with `errors.As`.",
				fields: "`StatusCode`, `URL`, `Body` (decoded envelope or nil), `Raw`",
			},
			{
				name: "error",
				when: "Unknown slug, missing required param, wrong param type, a 2xx body that is not JSON, or a transport failure. Messages are lowercase and `eps:`-prefixed, per Go convention.",
			},
		],
		fileValues: [
			"A local file path `string`",
			"An `eps.File{Name, Content}` (or `*eps.File`) for an in-memory upload",
		],
		notes: [
			"Map keys are sorted before encoding, so query strings and multipart bodies are byte-deterministic.",
			"The surface is embedded with `go:embed`, so the package needs no network call to resolve a slug.",
		],
	},
	{
		lang: "java",
		slug: "java",
		title: "Java SDK",
		summary:
			"Backend-only Java client for every EPS API, published from a git tag via JitPack, with HMAC signing built in.",
		order: 5,
		packageName: "com.github.ekoindia:eps-sdk-java",
		minRuntime: "Java 17 or newer",
		dependencies:
			"One: Gson, because Java has no JSON parser in the standard library. HTTP uses the JDK's own `java.net.http`.",
		sourceUrl: `${REPO}/sdk-java`,
		installNotes: [
			"Published through JitPack from a git tag — add the JitPack repository alongside Maven Central.",
			"Gradle: `maven { url 'https://jitpack.io' }`, then `implementation 'com.github.ekoindia:eps-sdk-java:<tag>'`.",
			"Maven: a `<repository>` with id `jitpack.io` and url `https://jitpack.io`, then the `com.github.ekoindia:eps-sdk-java` dependency.",
		],
		config: [
			...commonConfig(
				".developerKey(…)",
				".accessKey(…)",
				".environment(…)",
				".initiatorId(…)",
				".userCode(…)",
				"String",
			),
			{
				name: ".httpClient(…)",
				type: "HttpClient",
				required: false,
				units: "default: 30s connect + 30s per request",
				description:
					"Control timeouts, proxies or redirects by supplying your own client.",
			},
		],
		members: [
			{
				kind: "class",
				name: "in.eko.eps.EpsClient",
				signature: "EpsClient.builder()…build()",
				description: "The client, built through a fluent builder.",
			},
			{
				kind: "method",
				name: "call",
				signature:
					"client.call(String slug, Map<String, Object> params): Map<String, Object>",
				description:
					"Validates, signs and sends one endpoint call; returns the decoded envelope.",
			},
			{
				kind: "method",
				name: "resolveTarget",
				signature:
					"client.resolveTarget(String slug, Map<String, Object> params): Target",
				description: "The signed request for a call, without sending it.",
			},
			{
				kind: "method",
				name: "buildHeaders",
				signature: "client.buildHeaders(boolean multipart): Map<String, String>",
				description: "The four auth headers for a single request.",
			},
			{
				kind: "method",
				name: "sign",
				signature: "EpsClient.sign(String accessKey, String timestamp): String",
				description: "Static. The raw signing primitive, exposed for debugging.",
			},
			{
				kind: "type",
				name: "EpsClient.EpsFile",
				signature: "record EpsFile(String name, byte[] content)",
				description: "An in-memory upload.",
			},
			{
				kind: "constant",
				name: "EpsClient.MULTIPART_JSON_FIELD",
				signature: 'MULTIPART_JSON_FIELD = "form-data"',
				description:
					"Name of the single form field carrying the JSON envelope on file-upload endpoints.",
			},
		],
		errorTypes: [
			{
				name: "EpsClient.EpsHttpException",
				when: "Any non-2xx response.",
				fields: "`status`, `url`, `body` (decoded envelope or null), `raw`",
			},
			{
				name: "EpsClient.EpsException",
				when: "Unknown slug, missing required param, wrong param type, transport failure, or a 2xx body that is not JSON. Unchecked — it extends `RuntimeException`.",
			},
		],
		fileValues: [
			"A `String` path, a `java.nio.file.Path`, or a `java.io.File`",
			"An `EpsClient.EpsFile(name, content)` for an in-memory upload",
		],
		notes: [
			"Upload parts are sent as `application/octet-stream`; the MIME type is not sniffed.",
			"Gson is configured with `serializeNulls()` — required for wire conformance, since every other SDK keeps explicit nulls.",
		],
	},
];

const BY_SLUG = new Map(SDK_GUIDES.map((g) => [g.slug, g]));

/** `/docs/sdk` (no argument) or `/docs/sdk/<slug>`. */
export const sdkGuideHref = (slug?: string): string =>
	slug ? `/docs/sdk/${slug}` : "/docs/sdk";

export const getSdkGuide = (slug: string): SdkGuideMeta | undefined =>
	BY_SLUG.get(slug as SdkSlug);

/** Every SDK guide slug, in nav order — feeds the SSG prerender list. */
export const getAllSdkSlugs = (): SdkSlug[] =>
	[...SDK_GUIDES].sort((a, b) => a.order - b.order).map((g) => g.slug);
