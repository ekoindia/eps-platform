package in.eko.eps;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Backend-only Java client for Eko Platform Services (EPS) APIs — DMT, AePS, BBPS, KYC and
 * verification — with HMAC request signing built in.
 *
 * <p>Port of {@code packages/sdk-js/src/client.ts} and {@code packages/sdk-php/src/EpsClient.php}.
 * The signing algorithm, validation rules and error message formats are fixed by {@code
 * docs/sdk-golden-vector.md} — every SDK language must agree byte for byte.
 *
 * <p>Never run this anywhere a browser or mobile app can reach: {@code accessKey} signs every
 * request and must stay server-side.
 */
public final class EpsClient {

	/**
	 * Name of the single form field carrying every non-file value as one JSON object. Eko's upload
	 * APIs do not take a form field per parameter. Mirrors {@code MULTIPART_JSON_FIELD} in the
	 * website's {@code src/lib/data/api-specs-common.ts}.
	 */
	public static final String MULTIPART_JSON_FIELD = "form-data";

	/** Per-attempt budget, matching every other EPS SDK. */
	private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);
	/** Extra attempts for a GET that ended indeterminate. */
	private static final int DEFAULT_RETRIES = 2;
	/** Backoff base: attempt n waits a random slice of min(base × 2^(n-1), 2s). */
	private static final Duration DEFAULT_RETRY_BASE_DELAY = Duration.ofMillis(200);
	private static final long MAX_RETRY_DELAY_MS = 2_000;
	/** Generic status-check endpoint, keyed by TID or {@code client_ref_id:<ref>}. */
	private static final String INQUIRY_SLUG = "transaction-inquiry";
	/** Spec types whose values are scalars the value checks can stringify. */
	private static final Set<String> SCALAR_TYPES = Set.of("string", "number", "integer", "boolean");
	private static final Pattern NUMBER_RE = Pattern.compile("^-?\\d+(\\.\\d+)?$");
	private static final Pattern INTEGER_RE = Pattern.compile("^-?\\d+$");
	/**
	 * serializeNulls is REQUIRED for conformance, not a preference: Gson drops null fields by
	 * default, while JSON.stringify, json_encode, json.dumps and encoding/json all keep them. A
	 * null nested inside a value is real data (see docs/sdk-golden-vector.md), so dropping it would
	 * put different bytes on the wire from every other SDK.
	 */
	private static final Gson GSON = new com.google.gson.GsonBuilder().serializeNulls().create();
	private static final SecureRandom RANDOM = new SecureRandom();

	/** Client-side failure: unknown slug, missing param, bad type, bad config. */
	public static class EpsException extends RuntimeException {
		public EpsException(String message) {
			super(message);
		}

		public EpsException(String message, Throwable cause) {
			super(message, cause);
		}
	}

	/**
	 * Non-2xx response from EPS. The decoded envelope is kept on {@link #body} so callers can
	 * inspect it, but this is thrown rather than returned: an auth or infrastructure failure must
	 * never be mistaken for a successful call.
	 */
	public static final class EpsHttpException extends EpsException {
		public final int status;
		public final String url;
		public final Map<String, Object> body;
		public final String raw;

		EpsHttpException(int status, String url, Map<String, Object> body, String raw) {
			super("EPS request to " + url + " failed with HTTP " + status + ".");
			this.status = status;
			this.url = url;
			this.body = body;
			this.raw = raw;
		}
	}

	/**
	 * The request never produced a response: an I/O failure (DNS, connect, TLS) or the per-attempt
	 * timeout. The outcome is unknown, which is what separates it from the other {@link
	 * EpsException} cases — a GET is retried, a financial POST is followed by a status check.
	 */
	public static final class EpsTransportException extends EpsException {
		EpsTransportException(String message, Throwable cause) {
			super(message, cause);
		}
	}

	/**
	 * A non-GET call on a money-moving endpoint ended without a confirmed outcome (timeout,
	 * transport failure, HTTP 429 or 5xx). The SDK never re-sends such a request — that is how a
	 * customer gets debited twice — so it inquired by the call's {@code client_ref_id} instead and
	 * reports what it found. {@link #statusCheck} is the Transaction Inquiry envelope ({@code
	 * data.tx_status}: "0" success, "1" fail, "2" awaited, …) or null when the inquiry itself
	 * failed, in which case {@link #statusCheckError} says why. The original failure is {@link
	 * #getCause()}. Reconcile with the ref before retrying; never assume a timeout meant failure.
	 */
	public static final class EpsIndeterminateException extends EpsException {
		public final String slug;
		public final String clientRefId;
		/** HTTP status of the original attempt, or null for a transport failure. */
		public final Integer status;
		public final Map<String, Object> statusCheck;
		public final Throwable statusCheckError;

		EpsIndeterminateException(
				String slug,
				String clientRefId,
				Throwable cause,
				Map<String, Object> statusCheck,
				Throwable statusCheckError) {
			super(
					"EPS request for \"" + slug + "\" with client_ref_id \"" + clientRefId
							+ "\" has no confirmed outcome.",
					cause);
			this.slug = slug;
			this.clientRefId = clientRefId;
			this.status = cause instanceof EpsHttpException h ? h.status : null;
			this.statusCheck = statusCheck;
			this.statusCheckError = statusCheckError;
		}
	}

	/**
	 * True when the outcome is unknown: no response, or a 429/5xx that says nothing about whether
	 * the request was processed. A 4xx is a decisive no, and so is a 2xx that failed to decode.
	 */
	private static boolean isIndeterminate(EpsException e) {
		if (e instanceof EpsHttpException h) return h.status == 429 || h.status >= 500;
		return e instanceof EpsTransportException;
	}

	/** An in-memory upload, for callers that do not have the bytes on disk. */
	public record EpsFile(String name, byte[] content) {}

	/**
	 * The resolved wire target for one call — everything but the sending. {@code clientRefId} is
	 * the ref a non-GET call carries (generated or supplied), null on GET or when the endpoint omits
	 * the param; {@code financial} marks a money-moving endpoint; {@code initiatorId} is reused by
	 * the status check.
	 */
	public record Target(
			String method,
			String url,
			byte[] body,
			Map<String, String> headers,
			boolean multipart,
			String slug,
			boolean financial,
			String clientRefId,
			Object initiatorId) {}

	private record Param(
			String name,
			String type,
			boolean required,
			String format,
			@SerializedName("enum") List<Object> allowed,
			Double min,
			Double max,
			Integer maxLength) {}

	private record Endpoint(
			String slug,
			String method,
			String path,
			List<Param> params,
			List<String> requiredParams,
			boolean financial) {}

	private record Environment(String id, String baseUrl) {}

	private record Surface(
			List<Environment> environments, List<Endpoint> endpoints, Map<String, String> formats) {}

	/**
	 * The baked API surface, loaded once from the classpath. Generated by {@code
	 * scripts/bake-surface.mjs} and packaged from {@code data/} (see pom.xml) — a missing resource
	 * means the jar was built incorrectly.
	 */
	private static final Surface SURFACE = loadSurface();

	/**
	 * The surface's format table compiled once. A pattern that does not compile is corrupt package
	 * data, so it fails here like the surface itself — never silently skipping a validation. Every
	 * check uses {@code matches()}, so the whole string must match and a trailing newline cannot
	 * slip past.
	 */
	private static final Map<String, Pattern> FORMATS = compileFormats(SURFACE.formats());

	private static Map<String, Pattern> compileFormats(Map<String, String> formats) {
		Map<String, Pattern> compiled = new LinkedHashMap<>();
		if (formats == null) return compiled;
		for (Map.Entry<String, String> entry : formats.entrySet()) {
			try {
				compiled.put(entry.getKey(), Pattern.compile(entry.getValue()));
			} catch (PatternSyntaxException e) {
				throw new EpsException(
						"EPS SDK surface is invalid or corrupt: format \"" + entry.getKey()
								+ "\" does not compile.",
						e);
			}
		}
		return compiled;
	}

	private static Surface loadSurface() {
		try (InputStream in = EpsClient.class.getResourceAsStream("/sdk-surface.json")) {
			if (in == null) {
				throw new EpsException(
						"EPS SDK surface not found on the classpath (/sdk-surface.json). "
								+ "The package is built incorrectly (run `npm run build` to bake it).");
			}
			Surface surface =
					GSON.fromJson(new String(in.readAllBytes(), StandardCharsets.UTF_8), Surface.class);
			if (surface == null || surface.environments() == null || surface.endpoints() == null) {
				throw new EpsException("EPS SDK surface is invalid or corrupt.");
			}
			return surface;
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	private final String developerKey;
	private final String accessKey;
	private final String baseUrl;
	private final String initiatorId;
	private final String userCode;
	private final HttpClient http;
	private final int retries;
	private final Duration retryBaseDelay;
	private final boolean autoStatusCheck;
	/** Test-only clock injection (ms since the epoch); not part of the public surface. */
	java.util.function.LongSupplier now = System::currentTimeMillis;

	private EpsClient(Builder builder) {
		this.developerKey = builder.developerKey;
		this.accessKey = builder.accessKey;
		this.initiatorId = builder.initiatorId;
		this.userCode = builder.userCode;
		if (builder.retries < 0) {
			throw new EpsException(
					"Invalid retries: " + builder.retries + ". Expected a non-negative integer.");
		}
		if (builder.retryBaseDelay == null || builder.retryBaseDelay.isNegative()) {
			throw new EpsException(
					"Invalid retryBaseDelay: " + builder.retryBaseDelay
							+ ". Expected a non-negative duration.");
		}
		this.retries = builder.retries;
		this.retryBaseDelay = builder.retryBaseDelay;
		this.autoStatusCheck = builder.autoStatusCheck;
		this.http =
				builder.httpClient != null
						? builder.httpClient
						: HttpClient.newBuilder().connectTimeout(DEFAULT_TIMEOUT).build();
		this.baseUrl =
				SURFACE.environments().stream()
						.filter(e -> e.id().equals(builder.environment))
						.findFirst()
						.orElseThrow(
								() -> new EpsException("Unknown environment \"" + builder.environment + "\"."))
						.baseUrl();
	}

	public static Builder builder() {
		return new Builder();
	}

	/**
	 * Builds a client. {@code initiatorId} / {@code userCode} are near-constant per developer, so
	 * they are set once here and injected into every call; pass either in a call's params to
	 * override (including an explicit null to clear one).
	 */
	public static final class Builder {
		private String developerKey;
		private String accessKey;
		private String environment;
		private String initiatorId;
		private String userCode;
		private HttpClient httpClient;
		private int retries = DEFAULT_RETRIES;
		private Duration retryBaseDelay = DEFAULT_RETRY_BASE_DELAY;
		private boolean autoStatusCheck = true;

		public Builder developerKey(String v) {
			this.developerKey = v;
			return this;
		}

		public Builder accessKey(String v) {
			this.accessKey = v;
			return this;
		}

		/** An environment id from the surface: {@code sandbox} or {@code production}. */
		public Builder environment(String v) {
			this.environment = v;
			return this;
		}

		public Builder initiatorId(String v) {
			this.initiatorId = v;
			return this;
		}

		public Builder userCode(String v) {
			this.userCode = v;
			return this;
		}

		/** Supply your own client to control timeouts, proxies or redirects. */
		public Builder httpClient(HttpClient v) {
			this.httpClient = v;
			return this;
		}

		/**
		 * Extra attempts for a GET whose outcome was indeterminate (timeout, transport failure, HTTP
		 * 429/5xx). Default 2 — three tries in all. Non-GET calls are never retried. 0 disables.
		 */
		public Builder retries(int v) {
			this.retries = v;
			return this;
		}

		/**
		 * Backoff base: attempt n waits a random slice of min(base × 2^(n-1), 2s). Default 200ms;
		 * {@link Duration#ZERO} retries immediately (tests).
		 */
		public Builder retryBaseDelay(Duration v) {
			this.retryBaseDelay = v;
			return this;
		}

		/**
		 * After an indeterminate failure on a money-moving endpoint, look the transaction up by its
		 * {@code client_ref_id} and surface the result on {@link EpsIndeterminateException#statusCheck}.
		 * Default true.
		 */
		public Builder autoStatusCheck(boolean v) {
			this.autoStatusCheck = v;
			return this;
		}

		public EpsClient build() {
			return new EpsClient(this);
		}
	}

	/**
	 * secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))).
	 *
	 * <p>The HMAC key is the base64 <em>string's</em> bytes — the encoded text, not the decoded key.
	 * See docs/sdk-golden-vector.md.
	 */
	public static String sign(String accessKey, String timestamp) {
		try {
			String encodedKey =
					Base64.getEncoder().encodeToString(accessKey.getBytes(StandardCharsets.UTF_8));
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(encodedKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return Base64.getEncoder()
					.encodeToString(mac.doFinal(timestamp.getBytes(StandardCharsets.UTF_8)));
		} catch (java.security.GeneralSecurityException e) {
			throw new EpsException("HMAC-SHA256 unavailable", e);
		}
	}

	/** True for a number, excluding Boolean. */
	private static boolean isNumber(Object value) {
		return value instanceof Number n
				&& !(n instanceof Double d && (d.isNaN() || d.isInfinite()))
				&& !(n instanceof Float f && (f.isNaN() || f.isInfinite()));
	}

	/** Whole numbers count as integers, matching JS {@code Number.isInteger}. */
	private static boolean isWholeNumber(Object value) {
		if (!isNumber(value)) return false;
		double d = ((Number) value).doubleValue();
		return d == Math.rint(d);
	}

	/**
	 * A readable local file, or an in-memory {@link EpsFile}. Paths must exist, matching the PHP
	 * SDK: a typo'd path is caught before the request is signed rather than at read time.
	 */
	private static boolean isFileValue(Object value) {
		if (value instanceof EpsFile) return true;
		if (value instanceof Path p) return Files.isRegularFile(p);
		if (value instanceof java.io.File f) return f.isFile();
		return value instanceof String s && Files.isRegularFile(Path.of(s));
	}

	/**
	 * Lenient, coercion-aware type check against a spec type. Only present values are checked
	 * (presence is enforced separately). Unknown types pass. The wire sends everything as strings,
	 * so numeric/boolean strings are accepted.
	 */
	private static boolean matchesType(String type, Object value) {
		return switch (type) {
				// Strings and numbers (which coerce cleanly); not booleans/objects.
			case "string" -> value instanceof String || isNumber(value);
			case "file" -> isFileValue(value);
			case "number" -> isNumber(value)
					|| (value instanceof String s && NUMBER_RE.matcher(s).matches());
			case "integer" -> isWholeNumber(value)
					|| (value instanceof String s && INTEGER_RE.matcher(s).matches());
			case "boolean" -> value instanceof Boolean || "true".equals(value) || "false".equals(value);
				// unknown/unsupported spec type -> not enforced
			default -> true;
		};
	}

	/**
	 * Stringify a value for a URL path token or query param, matching JavaScript {@code
	 * String(value)} so every SDK puts identical bytes on the wire: lowercase booleans, and no
	 * trailing ".0" on whole numbers (Java's own {@code Double.toString(5.0)} would emit "5.0").
	 */
	private static String wireString(Object value) {
		if (value == null) return "null";
		if (value instanceof String s) return s;
		if (isWholeNumber(value)) {
			double d = ((Number) value).doubleValue();
			if (d >= Long.MIN_VALUE && d <= Long.MAX_VALUE) return Long.toString((long) d);
		}
		return String.valueOf(value);
	}

	/**
	 * Value check after the type check: enum → format → min/max → maxLength, on the wire string so
	 * {@code 5} and {@code "5"} behave alike. Returns the first problem as the reason text, or null.
	 * Formats are syntactic regexes from the surface, matched whole-string. {@code maxLength} counts
	 * UTF-8 bytes — the one length every language agrees on. Package-private for the conformance
	 * tests.
	 */
	static String valueProblem(Param p, Object value, Map<String, Pattern> formats) {
		if (!SCALAR_TYPES.contains(p.type())) return null;
		String wire = wireString(value);
		if (p.allowed() != null) {
			List<String> allowed = p.allowed().stream().map(EpsClient::wireString).toList();
			if (!allowed.contains(wire)) return "not one of: " + String.join(", ", allowed);
		}
		if (p.format() != null) {
			Pattern re = formats.get(p.format());
			if (re != null && !re.matcher(wire).matches()) return "expected format " + p.format();
		}
		if (p.min() != null || p.max() != null) {
			double n;
			try {
				n = Double.parseDouble(wire);
			} catch (NumberFormatException e) {
				n = Double.NaN;
			}
			if (p.min() != null && n < p.min()) return "below min " + wireString(p.min());
			if (p.max() != null && n > p.max()) return "above max " + wireString(p.max());
		}
		if (p.maxLength() != null && wire.getBytes(StandardCharsets.UTF_8).length > p.maxLength()) {
			return "longer than " + p.maxLength() + " bytes";
		}
		return null;
	}

	/** Test seam: a {@link Param} built from its constraints alone. */
	static Param param(
			String type, String format, List<Object> allowed, Double min, Double max, Integer maxLength) {
		return new Param("x", type, false, format, allowed, min, max, maxLength);
	}

	/**
	 * A {@code client_ref_id} for a non-GET call that did not supply one: base36 millisecond stamp
	 * (sortable, greppable against a log line) plus 7 random base36 chars, exactly 15 of {@code
	 * [0-9a-z]}. Under EPS's 20-char limit with ~7.8e10 distinct tails per millisecond, so
	 * concurrent processes cannot collide in practice. Same shape in every SDK — see
	 * docs/sdk-golden-vector.md.
	 */
	public static String generateClientRefId(long nowMs) {
		long bound = 78_364_164_096L; // 36^7
		String tail = Long.toString(Math.floorMod(RANDOM.nextLong(), bound), 36);
		tail = "0".repeat(7 - tail.length()) + tail;
		String ref = Long.toString(nowMs, 36) + tail;
		return ref.substring(ref.length() - 15);
	}

	private static Endpoint endpointFor(String slug) {
		return SURFACE.endpoints().stream()
				.filter(e -> e.slug().equals(slug))
				.findFirst()
				.orElseThrow(() -> new EpsException("Unknown endpoint slug \"" + slug + "\"."));
	}

	/**
	 * Signed auth headers. Multipart callers get no {@code content-type} here — the
	 * boundary-carrying value is set when the body is encoded.
	 */
	public Map<String, String> buildHeaders(boolean multipart) {
		String timestamp = Long.toString(now.getAsLong());
		Map<String, String> headers = new LinkedHashMap<>();
		headers.put("developer_key", developerKey);
		headers.put("secret-key", sign(accessKey, timestamp));
		headers.put("secret-key-timestamp", timestamp);
		if (!multipart) headers.put("content-type", "application/json");
		return headers;
	}

	/**
	 * Multipart body: one {@code form-data} part holding every non-file value as JSON, then a part
	 * per upload — the order the API documents. Null values are dropped (a form field has no null
	 * encoding), while nulls nested inside a value survive the JSON.
	 */
	static byte[] encodeMultipart(
			Map<String, Object> values, Set<String> fileParams, String boundary) {
		Map<String, Object> payload = new TreeMap<>();
		List<EpsFile> uploads = new ArrayList<>();
		List<String> uploadFields = new ArrayList<>();
		// Sorted: Java map iteration order must not decide the request bytes.
		for (Map.Entry<String, Object> entry : new TreeMap<>(values).entrySet()) {
			Object value = entry.getValue();
			if (value == null) continue;
			if (!fileParams.contains(entry.getKey())) {
				payload.put(entry.getKey(), value);
				continue;
			}
			uploadFields.add(entry.getKey());
			uploads.add(toFile(entry.getKey(), value));
		}

		var out = new java.io.ByteArrayOutputStream();
		try {
			out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
			out.write(
					("Content-Disposition: form-data; name=\"" + MULTIPART_JSON_FIELD + "\"\r\n\r\n")
							.getBytes(StandardCharsets.UTF_8));
			out.write(GSON.toJson(payload).getBytes(StandardCharsets.UTF_8));
			out.write("\r\n".getBytes(StandardCharsets.UTF_8));
			for (int i = 0; i < uploads.size(); i++) {
				EpsFile file = uploads.get(i);
				out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
				out.write(
						("Content-Disposition: form-data; name=\""
										+ uploadFields.get(i)
										+ "\"; filename=\""
										+ file.name()
										+ "\"\r\n")
								.getBytes(StandardCharsets.UTF_8));
				out.write("Content-Type: application/octet-stream\r\n\r\n".getBytes(StandardCharsets.UTF_8));
				out.write(file.content());
				out.write("\r\n".getBytes(StandardCharsets.UTF_8));
			}
			out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
		} catch (IOException e) {
			throw new UncheckedIOException(e); // ByteArrayOutputStream does not throw
		}
		return out.toByteArray();
	}

	private static EpsFile toFile(String name, Object value) {
		if (value instanceof EpsFile f) return f;
		Path path =
				value instanceof Path p
						? p
						: value instanceof java.io.File f ? f.toPath() : Path.of(String.valueOf(value));
		try {
			return new EpsFile(path.getFileName().toString(), Files.readAllBytes(path));
		} catch (IOException e) {
			throw new EpsException("Reading upload \"" + name + "\": " + e.getMessage(), e);
		}
	}

	/**
	 * Resolve a slug and params into the signed wire target.
	 *
	 * @throws EpsException on an unknown slug, a missing required param or a type mismatch — before
	 *     anything is signed or sent.
	 */
	public Target resolveTarget(String slug, Map<String, Object> params) {
		Endpoint endpoint = endpointFor(slug);

		// Client-level defaults first; an explicit per-call value wins, including an
		// explicit null that clears one.
		Map<String, Object> merged = new LinkedHashMap<>();
		if (initiatorId != null) merged.put("initiator_id", initiatorId);
		if (userCode != null) merged.put("user_code", userCode);
		if (params != null) merged.putAll(params);

		// Every non-GET call carries a client_ref_id — the key a partner reconciles a
		// lost response by. Generated only when the endpoint declares the param and
		// the caller sent none (absent or null); a supplied value, even "", is theirs
		// to own. Done before the required-param guard so a generated ref satisfies
		// endpoints that require one.
		boolean declaresRef =
				!"GET".equals(endpoint.method())
						&& endpoint.params().stream().anyMatch(p -> "client_ref_id".equals(p.name()));
		if (declaresRef && merged.get("client_ref_id") == null) {
			merged.put("client_ref_id", generateClientRefId(now.getAsLong()));
		}
		String clientRefId = declaresRef ? wireString(merged.get("client_ref_id")) : null;

		// Spec-driven guard: every requiredParam must be present and non-null before
		// we sign and send.
		List<String> missing =
				endpoint.requiredParams().stream().filter(p -> merged.get(p) == null).toList();
		if (!missing.isEmpty()) {
			throw new EpsException(
					"Missing required params for \"" + slug + "\": " + String.join(", ", missing) + ".");
		}

		// Type guard: every provided param known to the spec must match its type.
		// Unknown params (not in the surface) pass through untouched.
		List<String> badTypes =
				endpoint.params().stream()
						.filter(p -> merged.get(p.name()) != null && !matchesType(p.type(), merged.get(p.name())))
						.map(p -> p.name() + " (expected " + p.type() + ")")
						.toList();
		if (!badTypes.isEmpty()) {
			throw new EpsException(
					"Invalid param types for \"" + slug + "\": " + String.join(", ", badTypes) + ".");
		}

		// Value guard: enum / format / min / max / maxLength from the spec, on the
		// same provided params. Syntactic only — the server still owns semantics.
		List<String> badValues = new ArrayList<>();
		for (Param p : endpoint.params()) {
			Object value = merged.get(p.name());
			if (value == null) continue;
			String reason = valueProblem(p, value, FORMATS);
			if (reason != null) badValues.add(p.name() + " (" + reason + ")");
		}
		if (!badValues.isEmpty()) {
			throw new EpsException(
					"Invalid param values for \"" + slug + "\": " + String.join(", ", badValues) + ".");
		}

		// A type:"file" param flips the whole request to multipart/form-data.
		Set<String> fileParams = new HashSet<>();
		for (Param p : endpoint.params()) if ("file".equals(p.type())) fileParams.add(p.name());
		boolean multipart = !fileParams.isEmpty();

		// Path params (e.g. {customer_id}) fill the URL; the rest become the query
		// string on GET, a multipart body when the endpoint has file uploads, or the
		// JSON body on every other method.
		String path = endpoint.path();
		Map<String, Object> rest = new TreeMap<>();
		for (Map.Entry<String, Object> entry : merged.entrySet()) {
			String token = "{" + entry.getKey() + "}";
			if (path.contains(token)) {
				path = path.replace(token, encode(wireString(entry.getValue())));
			} else {
				rest.put(entry.getKey(), entry.getValue());
			}
		}

		String url = baseUrl + path;
		Map<String, String> headers = buildHeaders(multipart);
		byte[] body = null;
		if ("GET".equals(endpoint.method())) {
			StringBuilder query = new StringBuilder();
			for (Map.Entry<String, Object> entry : rest.entrySet()) {
				if (query.length() > 0) query.append('&');
				query.append(encode(entry.getKey())).append('=').append(encode(wireString(entry.getValue())));
			}
			if (query.length() > 0) url += (url.contains("?") ? "&" : "?") + query;
		} else if (multipart) {
			String boundary = "----EpsSdkBoundary" + new java.math.BigInteger(128, RANDOM).toString(16);
			body = encodeMultipart(rest, fileParams, boundary);
			headers.put("content-type", "multipart/form-data; boundary=" + boundary);
		} else {
			body = GSON.toJson(rest).getBytes(StandardCharsets.UTF_8);
		}
		return new Target(
				endpoint.method(),
				url,
				body,
				headers,
				multipart,
				slug,
				endpoint.financial(),
				clientRefId,
				merged.get("initiator_id"));
	}

	private static String encode(String value) {
		return URLEncoder.encode(value, StandardCharsets.UTF_8);
	}

	/**
	 * Sign and send one endpoint call, returning the decoded response envelope.
	 *
	 * <p>Validates first (throws {@link EpsException}, nothing sent), then sends. A GET whose outcome
	 * is indeterminate is retried; a non-GET never is — on a {@code financial} endpoint it is
	 * followed by a Transaction Inquiry on its {@code client_ref_id} and thrown as {@link
	 * EpsIndeterminateException}. An interrupted thread stops everything: no retry, no inquiry. See
	 * docs/sdk-golden-vector.md.
	 *
	 * @throws EpsIndeterminateException when a financial non-GET call has no confirmed outcome
	 * @throws EpsHttpException on any other non-2xx response; the envelope is on {@code body}
	 * @throws EpsTransportException on a transport failure that was not retried
	 * @throws EpsException on a 2xx body that is not JSON — never a silent empty map
	 */
	public Map<String, Object> call(String slug, Map<String, Object> params) {
		Target target = resolveTarget(slug, params);
		int attempts = "GET".equals(target.method()) ? retries + 1 : 1;
		for (int attempt = 1; ; attempt++) {
			try {
				return send(target);
			} catch (EpsException e) {
				if (!isIndeterminate(e) || Thread.currentThread().isInterrupted()) throw e;
				if (attempt < attempts) {
					backoff(attempt);
					continue;
				}
				// Never re-send a non-GET: that is how a customer is debited twice. Ask
				// EPS what happened to the ref instead, if there is one to ask by.
				if (autoStatusCheck && target.financial() && target.clientRefId() != null) {
					throw indeterminate(target, e);
				}
				throw e;
			}
		}
	}

	/** Attempt n sleeps a random slice of min(base × 2^(n-1), 2s) — full jitter. */
	private void backoff(int attempt) {
		long cap = Math.min(retryBaseDelay.toMillis() << (attempt - 1), MAX_RETRY_DELAY_MS);
		long delay = cap > 0 ? ThreadLocalRandom.current().nextLong(cap + 1) : 0;
		if (delay == 0) return;
		try {
			Thread.sleep(delay);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new EpsException("EPS retry was interrupted", e);
		}
	}

	/**
	 * One inquiry by {@code client_ref_id:<ref>}; its own failure is reported, never allowed to mask
	 * the original one.
	 */
	private EpsIndeterminateException indeterminate(Target target, EpsException cause) {
		Map<String, Object> params = new LinkedHashMap<>();
		params.put("transaction-reference", "client_ref_id:" + target.clientRefId());
		if (target.initiatorId() != null) params.put("initiator_id", target.initiatorId());
		Map<String, Object> statusCheck = null;
		Throwable statusCheckError = null;
		try {
			statusCheck = call(INQUIRY_SLUG, params);
		} catch (RuntimeException e) {
			statusCheckError = e;
		}
		return new EpsIndeterminateException(
				target.slug(), target.clientRefId(), cause, statusCheck, statusCheckError);
	}

	/**
	 * Sign (fresh timestamp) and send one attempt; decode per the contract. The multipart
	 * content-type, with its boundary, is kept from the target; every other header is re-signed so
	 * a retry never reuses a stale {@code secret-key-timestamp}.
	 */
	private Map<String, Object> send(Target target) {
		HttpRequest.Builder request =
				HttpRequest.newBuilder(URI.create(target.url())).timeout(DEFAULT_TIMEOUT);
		Map<String, String> headers = new LinkedHashMap<>(target.headers());
		headers.putAll(buildHeaders(target.multipart()));
		headers.forEach(request::header);
		request.method(
				target.method(),
				target.body() == null
						? HttpRequest.BodyPublishers.noBody()
						: HttpRequest.BodyPublishers.ofByteArray(target.body()));

		HttpResponse<String> response;
		try {
			response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
		} catch (IOException e) {
			throw new EpsTransportException(
					"EPS request to " + target.url() + " failed: " + e.getMessage(), e);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new EpsException("EPS request to " + target.url() + " was interrupted", e);
		}

		return handleResponse(response.statusCode(), target.url(), response.body());
	}

	/**
	 * Turn one raw response into the envelope callers expect. Package-private so the response
	 * contract shared by all five SDKs (see docs/sdk-golden-vector.md) is unit-testable without
	 * stubbing the abstract {@link HttpClient}.
	 *
	 * @throws EpsHttpException on any non-2xx response; the decoded envelope is on {@code body}.
	 * @throws EpsException when a 2xx body is not JSON — never a silent empty map.
	 */
	static Map<String, Object> handleResponse(int status, String url, String raw) {
		Map<String, Object> envelope = decodeOrNull(raw);
		if (status < 200 || status >= 300) {
			throw new EpsHttpException(status, url, envelope, raw);
		}
		if (envelope == null) {
			throw new EpsException("EPS response from " + url + " was not valid JSON.");
		}
		return envelope;
	}

	private static Map<String, Object> decodeOrNull(String raw) {
		try {
			return GSON.fromJson(raw, new TypeToken<Map<String, Object>>() {}.getType());
		} catch (JsonSyntaxException e) {
			return null;
		}
	}
}
