package in.eko.eps;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.ToNumberPolicy;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Debug mode: opt-in, masked diagnostics a developer can share with Eko support. Port of {@code
 * packages/sdk-js/src/debug.ts}; the normative contract is "Debug mode conformance" in {@code
 * docs/sdk-golden-vector.md}.
 *
 * <p>Everything here is best-effort and isolated: a failure while building, masking or delivering
 * an event is swallowed, so debug can never change a call's outcome. Masking is fail-closed: only
 * keys the surface classifies print anything but {@code ****}.
 */
final class EpsDebug {

	/** Environment lookup for {@code EPS_SDK_DEBUG}; a test seam (Java cannot set env vars). */
	static Function<String, String> env = System::getenv;

	static final String MASK = "****";
	private static final String UNAVAILABLE = "[unavailable]";
	private static final Pattern SAFE_SHAPE = Pattern.compile("^[A-Za-z0-9_.:-]{0,64}$");
	private static final Pattern KEY_SHAPE = Pattern.compile("^[a-z][a-z0-9_]{0,39}$");
	private static final Pattern LAST4_URL = Pattern.compile("^\\*\\*\\*\\*[A-Za-z0-9]{4}$");
	private static final Pattern EXT_SHAPE = Pattern.compile("^[a-z0-9]{1,5}$");
	private static final Pattern TEMPLATE_PARAM = Pattern.compile("^\\{([^}]+)\\}$");
	private static final Pattern EMAIL =
			Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
	private static final Pattern PAN = Pattern.compile("[A-Z]{5}[0-9]{4}[A-Z]");
	private static final Pattern DIGITS = Pattern.compile("[0-9]{6,}");
	private static final int MAX_DEPTH = 8;
	private static final int MAX_EVENT_BYTES = 64 * 1024;
	static final int TEXT_CAP = 1024;
	private static final int SAFE_TEXT_CAP = 256;
	private static final int BODY_TEXT_CAP = 512;
	private static final DateTimeFormatter TS =
			DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);
	private static final SecureRandom RANDOM = new SecureRandom();
	/** Strict JSON parsing (like JSON.parse); numbers keep their lexeme, so 0 never becomes 0.0. */
	private static final Gson PARSE =
			new GsonBuilder()
					.setStrictness(Strictness.STRICT)
					.setObjectToNumberStrategy(ToNumberPolicy.LAZILY_PARSED_NUMBER)
					.create();
	/** Event output: nulls kept, no HTML escaping, LinkedHashMap key order preserved. */
	private static final Gson WRITE = new GsonBuilder().disableHtmlEscaping().serializeNulls().create();

	/** Key classes from the surface's {@code redact} lists. */
	enum Cls {
		SAFE,
		LAST4,
		TEXT,
		NEST,
		DEFAULT
	}

	/** Multipart metadata captured while the form was built: the form-data JSON and file facts. */
	record Multipart(String fields, List<Map<String, Object>> files) {}

	/** File metadata for a multipart part: extension (when tidy) and size. Never the name. */
	static Map<String, Object> fileMeta(String param, String filename, Integer bytes) {
		String ext = "";
		if (filename != null) {
			int dot = filename.lastIndexOf('.');
			// Like Node's path.extname: a leading dot (".bashrc") is no extension.
			if (dot > 0) ext = filename.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
		}
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("param", param);
		out.put("ext", EXT_SHAPE.matcher(ext).matches() ? ext : null);
		out.put("bytes", bytes);
		return out;
	}

	/** {@code ****} for 8 code points or fewer, else {@code ****} + the last 4. */
	static String last4(String s) {
		if (s == null || s.codePointCount(0, s.length()) <= 8) return MASK;
		return MASK + s.substring(s.offsetByCodePoints(s.length(), -4));
	}

	/** Classifies keys by the surface's lists and masks values accordingly. */
	static final class Masker {
		private final Map<String, Cls> classes = new HashMap<>();
		private final Pattern clientRef;

		Masker(Map<String, List<String>> redact, Pattern clientRef) {
			this.clientRef = clientRef;
			// Later lists win, so last4 beats every other class.
			for (Cls cls : List.of(Cls.NEST, Cls.TEXT, Cls.SAFE, Cls.LAST4)) {
				List<String> keys = redact == null ? null : redact.get(cls.name().toLowerCase());
				if (keys != null) for (String key : keys) classes.put(key, cls);
			}
		}

		private Cls classOf(String key) {
			return classes.getOrDefault(key.toLowerCase(java.util.Locale.ROOT), Cls.DEFAULT);
		}

		/** A key name prints when it is classified or looks like a field name. */
		private boolean printable(String key) {
			return classes.containsKey(key.toLowerCase(java.util.Locale.ROOT))
					|| KEY_SHAPE.matcher(key).matches();
		}

		/** Class of a child key: an unprintable name is always default. */
		private Cls childClass(String key, Cls parent) {
			if (!printable(key)) return Cls.DEFAULT;
			return parent == Cls.TEXT ? Cls.TEXT : classOf(key);
		}

		/**
		 * Mask {@code value} held under {@code key} of class {@code cls}. Every request scalar the
		 * masker changes is added to {@code changed} (when given) so later text can be scrubbed of it.
		 */
		Object mask(
				Object value, Cls cls, String key, List<String> known, List<String> changed, int depth) {
			if (value == null || value instanceof Boolean) return value;
			if (value instanceof Map<?, ?> || value instanceof Collection<?>) {
				boolean walk = cls == Cls.NEST || cls == Cls.SAFE || cls == Cls.TEXT;
				if (!walk || depth >= MAX_DEPTH) {
					if (changed != null) collectAll(value, changed);
					return MASK;
				}
				if (value instanceof Collection<?> list) {
					List<Object> out = new ArrayList<>();
					for (Object v : list) out.add(mask(v, cls, key, known, changed, depth + 1));
					return out;
				}
				Map<String, Object> out = new LinkedHashMap<>();
				int unnamed = 0;
				for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
					String k = String.valueOf(entry.getKey());
					String name = printable(k) ? k : "#" + ++unnamed;
					out.put(name, mask(entry.getValue(), childClass(k, cls), k, known, changed, depth + 1));
				}
				return out;
			}
			String s = String.valueOf(value);
			Object masked = scalar(value, s, cls, key, known);
			if (changed != null && !Objects.equals(masked, value) && s.codePointCount(0, s.length()) >= 4)
				changed.add(s);
			return masked;
		}

		private Object scalar(Object value, String s, Cls cls, String key, List<String> known) {
			switch (cls) {
				case LAST4:
					return last4(s);
				case SAFE:
					if ("client_ref_id".equalsIgnoreCase(key)
							&& clientRef != null
							&& !clientRef.matcher(s).matches()) return MASK;
					if (SAFE_SHAPE.matcher(s).matches()) {
						for (String k : known) if (s.contains(k)) return MASK;
						return value;
					}
					return text(s, SAFE_TEXT_CAP, known);
				case TEXT:
				case NEST:
					return text(s, TEXT_CAP, known);
				default:
					return MASK;
			}
		}

		/** Every scalar under a masked-whole value is a known value too. */
		private void collectAll(Object value, List<String> out) {
			if (value instanceof Map<?, ?> map) {
				for (Object v : map.values()) collectAll(v, out);
			} else if (value instanceof Collection<?> list) {
				for (Object v : list) collectAll(v, out);
			} else if (value != null && !(value instanceof Boolean)) {
				String s = String.valueOf(value);
				if (s.codePointCount(0, s.length()) >= 4) out.add(s);
			}
		}

		/** Mask a whole JSON document (request or response body) from the root. */
		Object root(Object value, List<String> known, List<String> changed) {
			return mask(value, Cls.NEST, null, known, changed, 0);
		}

		/**
		 * Text scrub: digit runs first (so a short known value cannot match inside a longer number and
		 * leave its ends visible), then known values and their encoded forms, PAN shapes and e-mails,
		 * then a code-point cap.
		 */
		String text(String s, int cap, List<String> known) {
			String out =
					DIGITS.matcher(s)
							.replaceAll(
									m ->
											Matcher.quoteReplacement(
													m.group().length() >= 9 ? MASK + m.group().substring(m.group().length() - 4) : MASK));
			List<String> sorted = new ArrayList<>();
			for (String k : known) if (k != null && !k.isEmpty()) sorted.add(k);
			sorted.sort((a, b) -> b.length() - a.length());
			for (String k : sorted) {
				out = out.replace(k, MASK);
				String encoded = encodeUriComponent(k);
				if (!encoded.equals(k)) out = out.replace(encoded, MASK);
				// This SDK form-encodes path and query values (space as "+"), so that form is
				// on the wire, and in any error message that quotes the URL, too.
				String form = URLEncoder.encode(k, StandardCharsets.UTF_8);
				if (!form.equals(k)) out = out.replace(form, MASK);
			}
			out = PAN.matcher(out).replaceAll(MASK);
			out = EMAIL.matcher(out).replaceAll(MASK + "@" + MASK);
			int cps = out.codePointCount(0, out.length());
			return cps > cap
					? out.substring(0, out.offsetByCodePoints(0, cap)) + "…(+" + (cps - cap) + " chars)"
					: out;
		}

		/** Headers: an allowlist, matched case-insensitively. */
		Map<String, String> headers(Map<String, String> headers) {
			Map<String, String> out = new LinkedHashMap<>();
			headers.forEach(
					(name, value) -> {
						String lower = name.toLowerCase(java.util.Locale.ROOT);
						out.put(
								name,
								lower.equals("secret-key-timestamp") || lower.equals("content-type")
										? value
										: lower.equals("developer_key") ? last4(value) : MASK);
					});
			return out;
		}

		/**
		 * The URL actually sent, masked by the endpoint's path template. Any mismatch with the base URL
		 * or the template fails closed.
		 */
		String url(String url, String baseUrl, String template, List<String> known, List<String> changed) {
			try {
				if (!url.startsWith(baseUrl)) return UNAVAILABLE;
				String rest = url.substring(baseUrl.length());
				int q = rest.indexOf('?');
				String pathPart = q < 0 ? rest : rest.substring(0, q);
				String query = q < 0 ? "" : rest.substring(q + 1);
				String[] tSegs = template.split("/", -1);
				String[] pSegs = pathPart.split("/", -1);
				if (tSegs.length != pSegs.length) return UNAVAILABLE;
				List<String> segs = new ArrayList<>();
				for (int i = 0; i < tSegs.length; i++) {
					Matcher param = TEMPLATE_PARAM.matcher(tSegs[i]);
					if (!param.matches()) {
						if (!tSegs[i].equals(pSegs[i])) return UNAVAILABLE;
						segs.add(tSegs[i]);
					} else {
						// ponytail: path segments are form-decoded, the inverse of this SDK's
						// URLEncoder-built path (JS percent-decodes; it never emits "+").
						segs.add(urlValue(param.group(1), formDecode(pSegs[i]), pSegs[i], known, changed));
					}
				}
				int unnamed = 0;
				List<String> pairs = new ArrayList<>();
				for (String pair : query.split("&")) {
					if (pair.isEmpty()) continue;
					int eq = pair.indexOf('=');
					String rawKey = eq < 0 ? pair : pair.substring(0, eq);
					String rawValue = eq < 0 ? "" : pair.substring(eq + 1);
					String k = formDecode(rawKey);
					boolean named = printable(k);
					String value = urlValue(named ? k : null, formDecode(rawValue), rawValue, known, changed);
					pairs.add((named ? rawKey : "#" + ++unnamed) + "=" + value);
				}
				return baseUrl + String.join("/", segs) + (pairs.isEmpty() ? "" : "?" + String.join("&", pairs));
			} catch (RuntimeException | CharacterCodingException e) {
				return UNAVAILABLE;
			}
		}

		private String urlValue(
				String key, String decoded, String raw, List<String> known, List<String> changed) {
			Cls cls = key == null ? Cls.DEFAULT : classOf(key);
			Object masked = mask(decoded, cls, key, known, changed, 0);
			if (Objects.equals(masked, decoded)) return raw;
			String s = String.valueOf(masked);
			return cls == Cls.LAST4 && LAST4_URL.matcher(s).matches() ? s : MASK;
		}
	}

	/**
	 * encodeURIComponent-equivalent: URLEncoder escapes {@code !'()~} that JS leaves alone, and
	 * writes a space as "+".
	 */
	static String encodeUriComponent(String s) {
		return URLEncoder.encode(s, StandardCharsets.UTF_8)
				.replace("+", "%20")
				.replace("%21", "!")
				.replace("%27", "'")
				.replace("%28", "(")
				.replace("%29", ")")
				.replace("%7E", "~");
	}

	/**
	 * Strict form decoding ({@code +} is a space): a malformed escape, invalid UTF-8 or a non-ASCII
	 * character throws, so the URL fails closed. {@link java.net.URLDecoder} would silently substitute
	 * U+FFFD instead.
	 */
	static String formDecode(String raw) throws CharacterCodingException {
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();
		for (int i = 0; i < raw.length(); i++) {
			char c = raw.charAt(i);
			if (c == '%') {
				if (i + 2 >= raw.length()) throw new IllegalArgumentException("incomplete escape");
				int hi = Character.digit(raw.charAt(i + 1), 16);
				int lo = Character.digit(raw.charAt(i + 2), 16);
				if (hi < 0 || lo < 0) throw new IllegalArgumentException("bad escape");
				bytes.write(hi * 16 + lo);
				i += 2;
			} else if (c == '+') {
				bytes.write(' ');
			} else if (c < 0x80) {
				bytes.write(c);
			} else {
				throw new IllegalArgumentException("non-ASCII in URL");
			}
		}
		return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
	}

	/**
	 * Resolve the debug option against {@code EPS_SDK_DEBUG} and start debug, or return null when it
	 * is off or setting it up fails (debug must never break a client). {@code option}: null = unset,
	 * a Boolean, or a sink.
	 */
	@SuppressWarnings("unchecked")
	static EpsDebug start(
			Object option,
			String environment,
			String baseUrl,
			String bundleVersion,
			Map<String, List<String>> redact,
			Pattern clientRef,
			String developerKey,
			long timeoutMs,
			int retries,
			boolean autoStatusCheck) {
		try {
			Consumer<Map<String, Object>> callback = null;
			String source = "option";
			if (option instanceof Consumer<?> sink) callback = (Consumer<Map<String, Object>>) sink;
			else if (Boolean.FALSE.equals(option)) return null;
			else if (option == null) {
				String flag = env.apply("EPS_SDK_DEBUG");
				flag = flag == null ? "" : flag.trim().toLowerCase(java.util.Locale.ROOT);
				if (!flag.equals("1") && !flag.equals("true")) return null;
				source = "env";
			}
			EpsDebug debug =
					new EpsDebug(callback, environment, baseUrl, bundleVersion, redact, clientRef, developerKey);
			Map<String, Object> init = new LinkedHashMap<>();
			init.put("base_url", baseUrl);
			init.put("runtime", "java " + Runtime.version());
			init.put("developer_key", last4(developerKey));
			init.put("timeout_ms", timeoutMs);
			init.put("retries", retries);
			init.put("auto_status_check", autoStatusCheck);
			init.put("source", source);
			debug.emit("init", init, null);
			return debug;
		} catch (Exception e) {
			return null;
		}
	}

	/** Null = the default text sink (stderr). */
	private final Consumer<Map<String, Object>> callback;
	private final Masker masker;
	private final Map<String, Object> common = new LinkedHashMap<>();
	private final String baseUrl;
	private final String developerKey;

	private EpsDebug(
			Consumer<Map<String, Object>> callback,
			String environment,
			String baseUrl,
			String bundleVersion,
			Map<String, List<String>> redact,
			Pattern clientRef,
			String developerKey) {
		this.callback = callback;
		this.masker = new Masker(redact, clientRef);
		this.baseUrl = baseUrl;
		this.developerKey = developerKey;
		String version = EpsClient.class.getPackage().getImplementationVersion();
		common.put("sdk", "java");
		common.put("sdk_version", version != null ? version : "unknown");
		common.put("surface", bundleVersion);
		common.put("env", environment);
	}

	/** A fresh known-values list holding the developer key (an empty one would match everywhere). */
	private List<String> developerKeyOnly() {
		List<String> out = new ArrayList<>();
		if (developerKey != null && !developerKey.isEmpty()) out.add(developerKey);
		return out;
	}

	/** Start tracing one {@code call()}; null if even that fails. */
	Trace trace(String slug) {
		try {
			return new Trace(slug);
		} catch (Exception e) {
			return null;
		}
	}

	/** Build, bound, serialize and deliver one event; never throws. */
	private void emit(String event, Map<String, Object> fields, Map<String, Object> call) {
		try {
			Map<String, Object> out = new LinkedHashMap<>();
			out.put("logger", "eps-sdk");
			out.put("ts", TS.format(Instant.now()));
			out.put("event", event);
			out.putAll(common);
			if (call != null) out.putAll(call);
			out.putAll(fields);
			String line = WRITE.toJson(out);
			int size = line.getBytes(StandardCharsets.UTF_8).length;
			if (size > MAX_EVENT_BYTES && out.containsKey("body")) {
				out.put("body", "[" + size + " bytes omitted]");
				line = WRITE.toJson(out);
			}
			if (callback == null) System.err.println(line);
			else callback.accept(out);
		} catch (Exception e) {
			// Debug output must never affect the call.
		}
	}

	/** Per-call state: the call id and the values later text is scrubbed of. */
	final class Trace {
		private final Map<String, Object> ids = new LinkedHashMap<>();
		/** Pre-send, only the developer key is known. */
		private List<String> known = developerKeyOnly();
		private long started;
		private String template;
		private Multipart multipart;

		private Trace(String slug) {
			byte[] id = new byte[4];
			RANDOM.nextBytes(id);
			ids.put("call_id", HexFormat.of().formatHex(id));
			ids.put("slug", slug);
		}

		private void emit(String event, Map<String, Object> fields) {
			EpsDebug.this.emit(event, fields, ids);
		}

		/** The resolved endpoint's path template and multipart metadata, for the request event. */
		void target(String template, Multipart multipart) {
			this.template = template;
			this.multipart = multipart;
		}

		/** Mask and log the request as sent; remember its values for later scrubs. */
		void request(int attempt, String method, String url, Map<String, String> headers, byte[] body) {
			try {
				started = System.nanoTime();
				List<String> base = developerKeyOnly();
				headers.forEach(
						(name, value) -> {
							if (name.equalsIgnoreCase("secret-key") && value != null && !value.isEmpty())
								base.add(value);
						});
				List<String> changed = new ArrayList<>();
				String maskedUrl = masker.url(url, baseUrl, template, base, changed);
				Object maskedBody = null;
				if (multipart != null) {
					Map<String, Object> mp = new LinkedHashMap<>();
					mp.put("fields", masker.root(PARSE.fromJson(multipart.fields(), Object.class), base, changed));
					mp.put("files", multipart.files());
					maskedBody = mp;
				} else if (body != null) {
					String json = new String(body, StandardCharsets.UTF_8);
					maskedBody = masker.root(PARSE.fromJson(json, Object.class), base, changed);
				}
				List<String> next = new ArrayList<>(base);
				next.addAll(changed);
				known = next;
				Map<String, Object> fields = new LinkedHashMap<>();
				fields.put("attempt", attempt);
				fields.put("method", method);
				fields.put("url", maskedUrl);
				fields.put("headers", masker.headers(headers));
				fields.put("body", maskedBody);
				emit("request", fields);
			} catch (Exception e) {
				// isolated
			}
		}

		void response(int attempt, int status, String raw) {
			try {
				Object body;
				try {
					// Gson reads an empty body as null; JSON.parse rejects it, so it is text here too.
					if (raw == null || raw.isBlank()) throw new IllegalArgumentException("not JSON");
					body = masker.root(PARSE.fromJson(raw, Object.class), known, null);
				} catch (Exception e) {
					body = masker.text(String.valueOf(raw), BODY_TEXT_CAP, known);
				}
				Map<String, Object> fields = new LinkedHashMap<>();
				fields.put("attempt", attempt);
				fields.put("status", status);
				fields.put("ms", elapsed());
				fields.put("body", body);
				emit("response", fields);
			} catch (Exception e) {
				// isolated
			}
		}

		void transportError(int attempt, Throwable err) {
			try {
				Map<String, Object> fields = new LinkedHashMap<>();
				fields.put("attempt", attempt);
				fields.put("ms", elapsed());
				fields.put("error", err.getClass().getSimpleName());
				fields.put("message", masker.text(message(err), TEXT_CAP, known));
				emit("transport_error", fields);
			} catch (Exception e) {
				// isolated
			}
		}

		void retry(int attempt, long delayMs) {
			try {
				Map<String, Object> fields = new LinkedHashMap<>();
				fields.put("attempt", attempt);
				fields.put("delay_ms", delayMs);
				emit("retry", fields);
			} catch (Exception e) {
				// isolated
			}
		}

		void error(Throwable err) {
			try {
				Map<String, Object> fields = new LinkedHashMap<>();
				fields.put("error", err.getClass().getSimpleName());
				fields.put("message", masker.text(message(err), TEXT_CAP, known));
				if (err instanceof EpsClient.EpsIndeterminateException e) {
					if (e.clientRefId != null)
						fields.put("client_ref_id", masker.mask(e.clientRefId, Cls.SAFE, "client_ref_id", known, null, 0));
					if (e.tid != null) fields.put("tid", masker.mask(e.tid, Cls.SAFE, "tid", known, null, 0));
				}
				emit("error", fields);
			} catch (Exception e) {
				// isolated
			}
		}

		private long elapsed() {
			return Math.round((System.nanoTime() - started) / 1e6);
		}
	}

	private static String message(Throwable err) {
		return err.getMessage() == null ? "" : err.getMessage();
	}
}
