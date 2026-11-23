package in.eko.eps;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Flow;
import java.util.regex.Pattern;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Cross-language conformance suite for the Java SDK.
 *
 * <p>Ported case for case from {@code packages/sdk-php/tests/EpsClientTest.php}, which is itself
 * the executable form of {@code docs/sdk-golden-vector.md}. Any divergence here is a divergence on
 * the wire.
 */
class EpsClientTest {

	// from docs/sdk-golden-vector.md
	private static final String GOLDEN = "u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=";
	private static final String ACCESS_KEY = "TEST_ACCESS_KEY_DO_NOT_USE";
	private static final long FIXED_MS = 1700000000000L;

	/** An existing readable path, so a test needs no fixture binary of its own. */
	private static final String THIS_FILE =
			Path.of("src/test/java/in/eko/eps/EpsClientTest.java").toAbsolutePath().toString();

	private static final Map<String, Object> ADDRESS =
			Map.of("line", "Shop 5", "city", "Patna", "state", "Bihar", "pincode", "800001");

	private static final Gson GSON = new Gson();

	private static EpsClient client() {
		return client(null, null);
	}

	private static EpsClient client(String initiatorId, String userCode) {
		EpsClient c =
				EpsClient.builder()
						.developerKey("dev123")
						.accessKey(ACCESS_KEY)
						.environment("sandbox")
						.initiatorId(initiatorId)
						.userCode(userCode)
						.build();
		c.now = () -> FIXED_MS;
		return c;
	}

	/**
	 * Every required param of {@code activate-aeps-fingpay}, so a test targeting one guard is not
	 * short-circuited by the missing-param guard.
	 */
	private static Map<String, Object> aepsParams(Map<String, Object> overrides) {
		Map<String, Object> params = new LinkedHashMap<>();
		params.put("initiator_id", "9962981729");
		params.put("user_code", "20810200");
		params.put("modelname", "Morpho 1300E3");
		params.put("devicenumber", "SN1234567890");
		params.put("account", "38759149196");
		params.put("ifsc", "SBIN0007515");
		params.put("shop_type", 4215);
		params.put("office_address", ADDRESS);
		params.put("address_as_per_proof", ADDRESS);
		params.put("pan_card", THIS_FILE);
		params.put("aadhar", "123456789012");
		params.put("aadhar_front", THIS_FILE);
		params.put("aadhar_back", THIS_FILE);
		params.put("latlong", "28.6139,77.2090");
		if (overrides != null) params.putAll(overrides);
		return params;
	}

	private static Map<String, Object> map(Object... pairs) {
		Map<String, Object> out = new LinkedHashMap<>();
		for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
		return out;
	}

	/** Pull the {@code form-data} JSON envelope back out of an encoded multipart body. */
	private static Map<String, Object> multipartPayload(byte[] body) {
		String text = new String(body, StandardCharsets.UTF_8);
		int start = text.indexOf("name=\"" + EpsClient.MULTIPART_JSON_FIELD + "\"");
		start = text.indexOf("\r\n\r\n", start) + 4;
		int end = text.indexOf("\r\n--", start);
		return GSON.fromJson(
				text.substring(start, end), new TypeToken<Map<String, Object>>() {}.getType());
	}

	@Nested
	@DisplayName("signing")
	class Signing {
		@Test
		void goldenVector() {
			assertEquals(GOLDEN, EpsClient.sign(ACCESS_KEY, "1700000000000"));
		}

		@Test
		void buildsSignedHeaders() {
			Map<String, String> headers = client().buildHeaders(false);
			assertAll(
					() -> assertEquals("dev123", headers.get("developer_key")),
					() -> assertEquals(GOLDEN, headers.get("secret-key")),
					() -> assertEquals("1700000000000", headers.get("secret-key-timestamp")));
		}

		@Test
		void multipartHeadersOmitContentType() {
			EpsClient c = client();
			assertAll(
					() -> assertFalse(c.buildHeaders(true).containsKey("content-type")),
					// still signed
					() -> assertEquals(GOLDEN, c.buildHeaders(true).get("secret-key")),
					() -> assertEquals("application/json", c.buildHeaders(false).get("content-type")));
		}

		@Test
		void unknownEnvironmentRejected() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() ->
									EpsClient.builder()
											.developerKey("dev123")
											.accessKey(ACCESS_KEY)
											.environment("moon")
											.build());
			assertTrue(e.getMessage().contains("Unknown environment"));
		}

		@Test
		void unknownSlugRejected() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class, () -> client().resolveTarget("no-such-endpoint", null));
			assertTrue(e.getMessage().startsWith("Unknown endpoint slug"));
			assertTrue(e.getMessage().contains("upgrade the SDK"));
		}
	}

	@Nested
	@DisplayName("routing")
	class Routing {
		@Test
		void getPutsNonPathParamsInQueryStringNoBody() {
			EpsClient.Target target =
					client()
							.resolveTarget(
									"dmt-get-sender",
									map(
											"customer_id", "9123456789",
											"initiator_id", "9962981729",
											"user_code", "20810200"));
			assertAll(
					() ->
							assertTrue(
									target.url().contains("/customer/payment/dmt-fino/sender/9123456789"),
									target.url()),
					() -> assertTrue(target.url().contains("initiator_id=9962981729"), target.url()),
					() -> assertTrue(target.url().contains("user_code=20810200"), target.url()),
					() -> assertFalse(target.url().contains("{customer_id}"), target.url()),
					() -> assertNull(target.body()));
		}

		@Test
		void jsonEndpointStillSendsJsonBody() {
			EpsClient.Target target =
					client()
							.resolveTarget(
									"pan-lite",
									map(
											"initiator_id", "9962981729",
											"pan_number", "ABCDE1234F",
											"name", "Test Name",
											"dob", "1990-01-01"));
			assertFalse(target.multipart());
			assertTrue(
					new String(target.body(), StandardCharsets.UTF_8).contains("\"pan_number\":\"ABCDE1234F\""));
		}
	}

	@Nested
	@DisplayName("validation")
	class Validation {
		@Test
		void throwsWhenRequiredParamMissing() {
			// dmt-get-sender requires initiator_id, customer_id and user_code.
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> client().resolveTarget("dmt-get-sender", map("user_code", "20810200")));
			assertTrue(e.getMessage().contains("Missing required params"), e.getMessage());
			assertTrue(e.getMessage().contains("initiator_id"), e.getMessage());
			assertTrue(e.getMessage().contains("customer_id"), e.getMessage());
		}

		@Test
		void throwsWhenRequiredParamNull() {
			Map<String, Object> params = new HashMap<>();
			params.put("initiator_id", "9962981729");
			params.put("user_code", "20810200");
			params.put("customer_id", null);
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class, () -> client().resolveTarget("dmt-get-sender", params));
			assertTrue(e.getMessage().contains("customer_id"), e.getMessage());
		}

		@Test
		void acceptsNumericStringForNumberParam() {
			// bbps-get-operators: category is an optional `number` param.
			EpsClient.Target target =
					client()
							.resolveTarget(
									"bbps-get-operators",
									map("initiator_id", "9962981729", "user_code", "20810200", "category", "5"));
			assertTrue(target.url().contains("category=5"), target.url());
		}

		@Test
		void acceptsPlainNumberForNumberParam() {
			// A whole number must serialize as "5", never "5.0" — JS String(5) is "5".
			EpsClient.Target target =
					client()
							.resolveTarget(
									"bbps-get-operators",
									map("initiator_id", "9962981729", "user_code", "20810200", "category", 5.0));
			assertTrue(target.url().contains("category=5&") || target.url().endsWith("category=5"), target.url());
		}

		@Test
		void throwsOnTypeMismatch() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() ->
									client()
											.resolveTarget(
													"bbps-get-operators",
													map(
															"initiator_id", "9962981729",
															"user_code", "20810200",
															"category", "abc")));
			assertTrue(e.getMessage().contains("category (expected number)"), e.getMessage());
		}

		@Test
		void throwsOnObjectForNumberParam() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() ->
									client()
											.resolveTarget(
													"bbps-get-operators",
													map(
															"initiator_id", "9962981729",
															"user_code", "20810200",
															"category", Map.of())));
			assertTrue(e.getMessage().contains("category (expected number)"), e.getMessage());
		}

		@Test
		void rejectsNonFileValueForFileParam() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() ->
									client()
											.resolveTarget(
													"activate-aeps-fingpay",
													aepsParams(map("pan_card", "/no/such/file.jpg"))));
			assertTrue(e.getMessage().contains("pan_card (expected file)"), e.getMessage());
		}
	}

	@Nested
	@DisplayName("client-level defaults")
	class Defaults {
		@Test
		void injectsClientLevelInitiatorIdAndUserCode() {
			EpsClient.Target target =
					client("9962981729", "20810200")
							.resolveTarget("dmt-get-sender", map("customer_id", "9123456789"));
			assertAll(
					() -> assertTrue(target.url().contains("initiator_id=9962981729"), target.url()),
					() -> assertTrue(target.url().contains("user_code=20810200"), target.url()));
		}

		@Test
		void perCallParamOverridesClientLevelDefault() {
			EpsClient.Target target =
					client("9962981729", "20810200")
							.resolveTarget(
									"dmt-get-sender",
									map("customer_id", "9123456789", "initiator_id", "1111111111"));
			assertAll(
					() -> assertTrue(target.url().contains("initiator_id=1111111111"), target.url()),
					() -> assertFalse(target.url().contains("initiator_id=9962981729"), target.url()),
					// untouched default still applies
					() -> assertTrue(target.url().contains("user_code=20810200"), target.url()));
		}

		@Test
		void explicitNullPerCallClearsTheDefault() {
			Map<String, Object> params = new HashMap<>();
			params.put("customer_id", "9123456789");
			params.put("initiator_id", null);
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> client("9962981729", "20810200").resolveTarget("dmt-get-sender", params));
			assertTrue(e.getMessage().contains("initiator_id"), e.getMessage());
		}
	}

	@Nested
	@DisplayName("multipart")
	class Multipart {
		@Test
		void multipartEndpointBuildsJsonEnvelopeWithFiles() {
			EpsClient.Target target = client().resolveTarget("activate-aeps-fingpay", aepsParams(null));
			assertTrue(target.multipart());
			assertTrue(
					target.url().contains("/admin/network/agent/20810200/aeps-fingpay/activate"), target.url());
			assertTrue(target.headers().get("content-type").startsWith("multipart/form-data;"));

			Map<String, Object> payload = multipartPayload(target.body());
			String text = new String(target.body(), StandardCharsets.UTF_8);
			assertAll(
					// Every non-file value rides in ONE form-data JSON field...
					() -> assertEquals("Morpho 1300E3", payload.get("modelname")),
					() -> assertEquals("38759149196", payload.get("account")),
					// ...and nested objects stay nested rather than being stringified.
					() ->
							assertEquals(
									"Patna", ((Map<?, ?>) payload.get("office_address")).get("city")),
					() -> assertFalse(payload.containsKey("pan_card")),
					// user_code filled the path
					() -> assertFalse(payload.containsKey("user_code")),
					() -> assertTrue(text.contains("name=\"pan_card\"; filename="), "pan_card part"),
					() -> assertTrue(text.contains("name=\"aadhar_front\"; filename="), "aadhar_front part"));
		}

		@Test
		void acceptsInMemoryFile() {
			EpsClient.Target target =
					client()
							.resolveTarget(
									"activate-aeps-fingpay",
									aepsParams(
											map(
													"pan_card",
													new EpsClient.EpsFile(
															"pan.jpg", "not-really-a-png".getBytes(StandardCharsets.UTF_8)))));
			String text = new String(target.body(), StandardCharsets.UTF_8);
			assertAll(
					() -> assertTrue(text.contains("name=\"pan_card\"; filename=\"pan.jpg\""), text),
					() -> assertTrue(text.contains("not-really-a-png")));
		}

		@Test
		void multipartOmitsNullParamsButKeepsNestedNulls() {
			Map<String, Object> nested = new HashMap<>();
			nested.put("line", "Shop 5");
			nested.put("state", null);
			Map<String, Object> values = new HashMap<>();
			// A null param has no form encoding, so it is dropped entirely...
			values.put("extra_note", null);
			// ...but a null INSIDE a value is real data JSON preserves.
			values.put("office_address", nested);
			values.put("pan_card", THIS_FILE);

			byte[] body = EpsClient.encodeMultipart(values, Set.of("pan_card"), "TESTBOUNDARY");
			Map<String, Object> payload = multipartPayload(body);
			assertAll(
					() -> assertFalse(payload.containsKey("extra_note")),
					() -> {
						Map<?, ?> address = (Map<?, ?>) payload.get("office_address");
						assertEquals("Shop 5", address.get("line"));
						// Gson drops nulls unless told otherwise, and every other SDK keeps
						// them — assert the key SURVIVES, not just that it reads as null,
						// which a missing key would also satisfy.
						assertTrue(address.containsKey("state"), "nested null was dropped: " + address);
						assertNull(address.get("state"));
					});
		}

		@Test
		void multipartFailsOnAnUnreadableUpload() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() ->
									EpsClient.encodeMultipart(
											map("pan_card", "/no/such/file.jpg"), Set.of("pan_card"), "B"));
			assertTrue(e.getMessage().contains("Reading upload"), e.getMessage());
		}
	}

	@Nested
	@DisplayName("response contract")
	class Responses {
		// ---- Response and error contract (docs/sdk-golden-vector.md) ----------

		private static final String URL = "https://staging.eko.in/ekoapi/v3/tools/kyc/pan-lite";

		@Test
		void handleResponseReturnsEnvelopeOn2xx() {
			Map<String, Object> body = EpsClient.handleResponse(200, URL, "{\"status\":0}");
			assertEquals(0.0, body.get("status"));
		}

		@Test
		void handleResponseThrowsOnNon2xxKeepingTheEnvelope() {
			EpsClient.EpsHttpException e =
					assertThrows(
							EpsClient.EpsHttpException.class,
							() -> EpsClient.handleResponse(401, URL, "{\"status\":401}"));
			assertEquals(401, e.status);
			assertEquals(URL, e.url);
			assertEquals(401.0, e.body.get("status"));
			assertEquals("{\"status\":401}", e.raw);
			assertEquals("EPS request to " + URL + " failed with HTTP 401.", e.getMessage());
		}

		@Test
		void handleResponseKeepsNullBodyForNonJsonErrorPayload() {
			EpsClient.EpsHttpException e =
					assertThrows(
							EpsClient.EpsHttpException.class,
							() -> EpsClient.handleResponse(502, URL, "<html>502</html>"));
			assertNull(e.body);
			assertEquals("<html>502</html>", e.raw);
		}

		@Test
		void handleResponseThrowsWhenSuccessBodyIsNotJson() {
			EpsClient.EpsInvalidResponseException e =
					assertThrows(
							EpsClient.EpsInvalidResponseException.class,
							() -> EpsClient.handleResponse(200, URL, "not json"));
			assertEquals("EPS response from " + URL + " was not valid JSON.", e.getMessage());
		}
	}

	// ── Shared fixtures for the suites below (docs/sdk-golden-vector.md) ────────

	private static final Pattern REF = Pattern.compile("^[0-9a-z]{15}$");
	/** pan-lite: POST, not financial. */
	private static final Map<String, Object> PAN =
			Map.of(
					"initiator_id", "9962981729",
					"pan_number", "BNZAA2318J",
					"name", "Rahul Sharma",
					"dob", "1990-01-01");
	/** dmt-initiate-transfer: POST, financial, client_ref_id required. */
	private static final Map<String, Object> TRANSFER =
			Map.of(
					"initiator_id", "9962981729",
					"customer_id", "9123456789",
					"recipient_id", "1",
					"amount", 100,
					"otp", "123456",
					"otp_ref_id", "ref1");
	private static final Map<String, Object> GET = Map.of("initiator_id", "9962981729");
	private static final String OK = "{\"status\":0}";
	/** A financial endpoint's envelope also carries a numeric response_status_id. */
	private static final String OK_FINANCIAL = "{\"status\":0,\"response_status_id\":0}";

	/** One scripted outcome: a response, or an I/O failure to throw. */
	private record Step(int status, String body, Exception failure) {
		static Step ok() {
			return new Step(200, OK, null);
		}

		static Step http(int status) {
			return new Step(status, "{\"status\":1}", null);
		}

		static Step transportFailure() {
			return new Step(0, null, new IOException("Connection refused"));
		}

		/** What HttpClient.send throws when the calling thread is interrupted mid-request. */
		static Step interrupted() {
			return new Step(0, null, new InterruptedException());
		}

		static Step body(String json) {
			return new Step(200, json, null);
		}
	}

	/** Recorded request with its body already drained. */
	private record Sent(HttpRequest request, String body) {
		Map<String, Object> json() {
			return GSON.fromJson(body, new TypeToken<Map<String, Object>>() {}.getType());
		}
	}

	/**
	 * Scripted HttpClient standing in for the transport: replays steps in order (the last one
	 * repeats) and records every request so URLs, bodies and headers can be asserted.
	 */
	private static final class Scripted extends HttpClient {
		final List<Step> steps;
		final List<Sent> sent = new ArrayList<>();

		Scripted(Step... steps) {
			this.steps = new ArrayList<>(List.of(steps));
		}

		@Override
		public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handler)
				throws IOException, InterruptedException {
			sent.add(new Sent(request, drain(request)));
			Step step = steps.size() > 1 ? steps.remove(0) : steps.get(0);
			if (step.failure() instanceof InterruptedException ie) throw ie;
			if (step.failure() instanceof IOException io) throw io;
			return response(request, step.status(), step.body());
		}

		private static String drain(HttpRequest request) {
			var out = new java.io.ByteArrayOutputStream();
			request
					.bodyPublisher()
					.ifPresent(
							p ->
									p.subscribe(
											new Flow.Subscriber<>() {
												@Override
												public void onSubscribe(Flow.Subscription s) {
													s.request(Long.MAX_VALUE);
												}

												@Override
												public void onNext(ByteBuffer item) {
													byte[] b = new byte[item.remaining()];
													item.get(b);
													out.writeBytes(b);
												}

												@Override
												public void onError(Throwable t) {}

												@Override
												public void onComplete() {}
											}));
			return out.toString(StandardCharsets.UTF_8);
		}

		@SuppressWarnings("unchecked")
		private static <T> HttpResponse<T> response(HttpRequest request, int status, String body) {
			return new HttpResponse<>() {
				public int statusCode() {
					return status;
				}

				public HttpRequest request() {
					return request;
				}

				public Optional<HttpResponse<T>> previousResponse() {
					return Optional.empty();
				}

				public HttpHeaders headers() {
					return HttpHeaders.of(Map.of(), (a, b) -> true);
				}

				public T body() {
					return (T) body;
				}

				public Optional<javax.net.ssl.SSLSession> sslSession() {
					return Optional.empty();
				}

				public URI uri() {
					return request.uri();
				}

				public HttpClient.Version version() {
					return HttpClient.Version.HTTP_1_1;
				}
			};
		}

		// The abstract surface nobody here needs.
		public Optional<CookieHandler> cookieHandler() {
			return Optional.empty();
		}

		public Optional<Duration> connectTimeout() {
			return Optional.empty();
		}

		public Redirect followRedirects() {
			return Redirect.NEVER;
		}

		public Optional<ProxySelector> proxy() {
			return Optional.empty();
		}

		public SSLContext sslContext() {
			throw new UnsupportedOperationException();
		}

		public SSLParameters sslParameters() {
			throw new UnsupportedOperationException();
		}

		public Optional<Authenticator> authenticator() {
			return Optional.empty();
		}

		public Version version() {
			return Version.HTTP_1_1;
		}

		public Optional<Executor> executor() {
			return Optional.empty();
		}

		public <T> CompletableFuture<HttpResponse<T>> sendAsync(
				HttpRequest r, HttpResponse.BodyHandler<T> h) {
			throw new UnsupportedOperationException();
		}

		public <T> CompletableFuture<HttpResponse<T>> sendAsync(
				HttpRequest r, HttpResponse.BodyHandler<T> h, HttpResponse.PushPromiseHandler<T> p) {
			throw new UnsupportedOperationException();
		}
	}

	/** A client on the scripted transport whose retries never sleep. */
	private static EpsClient fast(Scripted transport, java.util.function.UnaryOperator<EpsClient.Builder> tweak) {
		EpsClient.Builder b =
				EpsClient.builder()
						.developerKey("dev123")
						.accessKey(ACCESS_KEY)
						.environment("sandbox")
						.httpClient(transport)
						.retryBaseDelay(Duration.ZERO);
		EpsClient c = tweak.apply(b).build();
		c.now = () -> FIXED_MS;
		return c;
	}

	private static EpsClient fast(Scripted transport) {
		return fast(transport, b -> b);
	}

	private static Map<String, Object> with(Map<String, Object> base, Object... pairs) {
		Map<String, Object> out = new LinkedHashMap<>(base);
		for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
		return out;
	}

	@Nested
	@DisplayName("client_ref_id")
	class ClientRefId {
		@Test
		void generateClientRefIdShape() {
			String a = EpsClient.generateClientRefId(FIXED_MS);
			String b = EpsClient.generateClientRefId(FIXED_MS);
			assertTrue(REF.matcher(a).matches(), a);
			assertTrue(a.startsWith(Long.toString(FIXED_MS, 36)), a);
			assertFalse(a.equals(b));
		}

		@Test
		void generatedForNonGetWithoutOne() {
			Scripted t = new Scripted(Step.ok());
			fast(t).call("pan-lite", PAN);
			assertTrue(REF.matcher((String) t.sent.get(0).json().get("client_ref_id")).matches());
		}

		@Test
		void suppliedValueKept() {
			Scripted t = new Scripted(Step.ok());
			fast(t).call("pan-lite", with(PAN, "client_ref_id", "MY-REF_1"));
			assertEquals("MY-REF_1", t.sent.get(0).json().get("client_ref_id"));
		}

		@Test
		void satisfiesARequiredClientRefId() {
			Scripted t = new Scripted(Step.body(OK_FINANCIAL));
			fast(t).call("dmt-initiate-transfer", TRANSFER);
			assertTrue(REF.matcher((String) t.sent.get(0).json().get("client_ref_id")).matches());
		}

		@Test
		void notAddedToGet() {
			Scripted t = new Scripted(Step.ok());
			fast(t).call("bbps-get-operators", GET);
			assertFalse(t.sent.get(0).request().uri().toString().contains("client_ref_id"));
		}

		@Test
		void notAddedWhenEndpointOmitsIt() {
			Scripted t = new Scripted(Step.ok());
			fast(t).call("get-refund-otp", Map.of("initiator_id", "9962981729", "tid", "1"));
			assertFalse(t.sent.get(0).json().containsKey("client_ref_id"));
		}

		@Test
		void differsBetweenCalls() {
			Scripted t = new Scripted(Step.ok());
			EpsClient c = fast(t);
			c.call("pan-lite", PAN);
			c.call("pan-lite", PAN);
			assertFalse(t.sent.get(0).json().get("client_ref_id").equals(t.sent.get(1).json().get("client_ref_id")));
		}

		@org.junit.jupiter.params.ParameterizedTest
		// ASCII and Unicode whitespace (NBSP, em space, ideographic space) and zero-width characters.
		@org.junit.jupiter.params.provider.ValueSource(
				strings = {"", "   ", "\t", "\u00A0", "\u2003", "\u3000", "\u200B", "\uFEFF", " \u00A0\t\u2003"})
		void blankRefOnFinancialCallIsRefused(String blank) {
			Scripted t = new Scripted(Step.body(OK_FINANCIAL));
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> fast(t).call("dmt-initiate-transfer", with(TRANSFER, "client_ref_id", blank)));
			assertEquals(
					"Invalid param values for \"dmt-initiate-transfer\": client_ref_id (must not be blank on a financial call).",
					e.getMessage());
			assertEquals(0, t.sent.size());
		}

		@Test
		void emptyStringCountsAsSupplied() {
			Scripted t = new Scripted(Step.ok());
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> fast(t).call("pan-lite", with(PAN, "client_ref_id", "")));
			assertTrue(e.getMessage().contains("client_ref_id (expected format client-ref)"), e.getMessage());
			assertEquals(0, t.sent.size());
		}
	}

	@Nested
	@DisplayName("retry and status check")
	class RetryAndStatusCheck {
		@Test
		void getRetries500ThenSucceedsResigning() {
			Scripted t = new Scripted(Step.http(500), Step.ok());
			EpsClient c = fast(t);
			long[] clock = {FIXED_MS};
			c.now = () -> clock[0]++;
			assertEquals(0.0, c.call("bbps-get-operators", GET).get("status"));
			assertEquals(2, t.sent.size());
			String ts0 = t.sent.get(0).request().headers().firstValue("secret-key-timestamp").get();
			String ts1 = t.sent.get(1).request().headers().firstValue("secret-key-timestamp").get();
			assertFalse(ts0.equals(ts1));
		}

		@Test
		void getIndeterminateEveryAttemptThenThrows() {
			for (Step failure : List.of(Step.transportFailure(), Step.http(429), Step.http(503))) {
				Scripted t = new Scripted(failure);
				assertThrows(EpsClient.EpsException.class, () -> fast(t).call("bbps-get-operators", GET));
				assertEquals(3, t.sent.size(), failure.toString());
			}
		}

		@Test
		void getTransportFailureIsATransportException() {
			Scripted t = new Scripted(Step.transportFailure());
			EpsClient.EpsTransportException e =
					assertThrows(
							EpsClient.EpsTransportException.class,
							() -> fast(t).call("bbps-get-operators", GET));
			assertTrue(e.getCause() instanceof IOException);
		}

		@Test
		void getDoesNotRetry4xx() {
			Scripted t = new Scripted(Step.http(400));
			assertThrows(EpsClient.EpsHttpException.class, () -> fast(t).call("bbps-get-operators", GET));
			assertEquals(1, t.sent.size());
		}

		@Test
		void retriesZeroDisables() {
			Scripted t = new Scripted(Step.http(500));
			assertThrows(
					EpsClient.EpsHttpException.class,
					() -> fast(t, b -> b.retries(0)).call("bbps-get-operators", GET));
			assertEquals(1, t.sent.size());
		}

		@Test
		void interruptedThreadStopsRetrying() {
			Scripted t = new Scripted(Step.transportFailure());
			Thread.currentThread().interrupt();
			try {
				assertThrows(EpsClient.EpsException.class, () -> fast(t).call("bbps-get-operators", GET));
			} finally {
				assertTrue(Thread.interrupted()); // clears the flag for the next test
			}
			assertEquals(1, t.sent.size());
		}

		@Test
		void billableGetNotRetried() {
			Scripted t = new Scripted(Step.http(503));
			assertThrows(
					EpsClient.EpsHttpException.class,
					() ->
							fast(t)
									.call(
											"get-ifsc-details",
											Map.of("initiator_id", "9962981729", "ifsc", "SBIN0000001")));
			assertEquals(1, t.sent.size());
		}

		@Test
		void retrySafePutIsRetried() {
			Scripted t = new Scripted(Step.http(503), Step.ok());
			fast(t)
					.call(
							"deactivate-user-service",
							Map.of("initiator_id", "9962981729", "user_code", "20810200", "service_code", "43"));
			assertEquals(2, t.sent.size());
		}

		@Test
		void postNeverRetried() {
			Scripted t = new Scripted(Step.http(500));
			assertThrows(EpsClient.EpsHttpException.class, () -> fast(t).call("pan-lite", PAN));
			assertEquals(1, t.sent.size());
		}

		@Test
		void financialPost5xxInquiresAndThrowsIndeterminate() {
			String inquiry = "{\"status\":0,\"data\":{\"tx_status\":\"0\",\"tid\":\"1\"}}";
			Scripted t = new Scripted(Step.http(502), Step.body(inquiry));
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t).call("dmt-initiate-transfer", TRANSFER));
			String ref = (String) t.sent.get(0).json().get("client_ref_id");
			assertEquals(ref, e.clientRefId);
			assertEquals("dmt-initiate-transfer", e.slug);
			assertEquals(502, e.status);
			assertEquals("0", ((Map<?, ?>) e.statusCheck.get("data")).get("tx_status"));
			assertNull(e.statusCheckError);
			assertTrue(e.getCause() instanceof EpsClient.EpsHttpException);
			assertEquals(
					"EPS request for \"dmt-initiate-transfer\" with client_ref_id \"" + ref
							+ "\" has no confirmed outcome.",
					e.getMessage());
			assertEquals(2, t.sent.size());
			HttpRequest inq = t.sent.get(1).request();
			assertEquals("GET", inq.method());
			String uri = inq.uri().toString();
			assertTrue(inq.uri().getPath().endsWith("/tools/reference/transaction"), uri);
			assertTrue(uri.contains("client_ref_id=" + ref), uri);
			assertTrue(uri.contains("initiator_id=9962981729"), uri);
			assertFalse(uri.contains("transaction-reference"), uri);
		}

		@Test
		void financialPostTransportFailureReusesSuppliedRef() {
			Scripted t = new Scripted(Step.transportFailure(), Step.ok());
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t).call("dmt-initiate-transfer", with(TRANSFER, "client_ref_id", "MY-REF")));
			assertEquals("MY-REF", e.clientRefId);
			assertNull(e.status);
			assertTrue(e.getCause() instanceof EpsClient.EpsTransportException);
			assertTrue(t.sent.get(1).request().uri().toString().contains("client_ref_id=MY-REF"));
		}

		@Test
		void failingInquiryLandsOnStatusCheckError() {
			Scripted t = new Scripted(Step.http(500), Step.http(503));
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t).call("dmt-initiate-transfer", TRANSFER));
			assertNull(e.statusCheck);
			assertEquals(503, ((EpsClient.EpsHttpException) e.statusCheckError).status);
			assertEquals(500, ((EpsClient.EpsHttpException) e.getCause()).status);
			assertEquals(1 + 3, t.sent.size());
		}

		@Test
		void financialPostUnparseable2xxInquiresAndThrowsIndeterminate() {
			String inquiry = "{\"status\":0,\"data\":{\"tx_status\":\"0\",\"tid\":\"1\"}}";
			Scripted t = new Scripted(Step.body("{\"status\":0,\"da"), Step.body(inquiry));
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t).call("dmt-initiate-transfer", TRANSFER));
			String ref = (String) t.sent.get(0).json().get("client_ref_id");
			assertEquals(ref, e.clientRefId);
			assertEquals(200, e.status);
			assertEquals("0", ((Map<?, ?>) e.statusCheck.get("data")).get("tx_status"));
			assertTrue(e.getCause() instanceof EpsClient.EpsInvalidResponseException);
			assertEquals("{\"status\":0,\"da", ((EpsClient.EpsInvalidResponseException) e.getCause()).raw);
			assertEquals(2, t.sent.size());
			assertTrue(t.sent.get(1).request().uri().toString().contains("client_ref_id=" + ref));
		}

		@org.junit.jupiter.params.ParameterizedTest
		@org.junit.jupiter.params.provider.ValueSource(
				strings = {
					"null", "\"ok\"", "5", "[]", "[{\"status\":0}]",
					"{}", "{\"error\":\"Bad Gateway\"}", "{\"status\":\"0\"}", "{\"status\":true}", "{\"status\":null}",
					"{\"status\":502,\"error\":\"Bad Gateway\"}", "{\"status\":0}",
					"{\"status\":0,\"response_status_id\":\"0\"}"
				})
		void financialPostNonObjectJson2xxInquires(String body) {
			String inquiry = "{\"status\":0,\"data\":{\"tx_status\":\"0\",\"tid\":\"1\"}}";
			Scripted t = new Scripted(Step.body(body), Step.body(inquiry));
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t).call("dmt-initiate-transfer", TRANSFER));
			assertEquals(200, e.status);
			assertEquals("0", ((Map<?, ?>) e.statusCheck.get("data")).get("tx_status"));
			assertTrue(e.getCause() instanceof EpsClient.EpsInvalidResponseException);
			assertEquals(2, t.sent.size());
		}

		@Test
		void financialEnvelopeNeedsResponseStatusIdNonFinancialOnlyStatus() {
			Map<String, Object> got =
					fast(new Scripted(Step.body("{\"status\":0,\"response_status_id\":0,\"data\":{\"tid\":\"1\"}}")))
							.call("dmt-initiate-transfer", TRANSFER);
			assertEquals(0.0, got.get("response_status_id"));
			// pan-fetch-style success with no response_status_id stays a result off the financial path
			assertEquals(0.0, fast(new Scripted(Step.ok())).call("pan-lite", PAN).get("status"));
		}

		@Test
		void nonFinancialPostUnparseable2xxNoInquiry() {
			Scripted t = new Scripted(Step.body(""));
			assertThrows(EpsClient.EpsInvalidResponseException.class, () -> fast(t).call("pan-lite", PAN));
			assertEquals(1, t.sent.size());
		}

		@Test
		void financialPostInterruptedKeepsGeneratedRef() {
			Scripted t = new Scripted(Step.interrupted(), Step.ok());
			try {
				EpsClient.EpsIndeterminateException e =
						assertThrows(
								EpsClient.EpsIndeterminateException.class,
								() -> fast(t).call("dmt-initiate-transfer", TRANSFER));
				assertEquals(t.sent.get(0).json().get("client_ref_id"), e.clientRefId);
				assertNull(e.tid);
				assertNull(e.statusCheck);
				assertTrue(e.statusCheckError instanceof InterruptedException);
				assertTrue(e.getCause().getCause() instanceof InterruptedException);
				assertEquals(1, t.sent.size()); // no inquiry
				assertTrue(Thread.currentThread().isInterrupted()); // flag preserved for the caller
			} finally {
				Thread.interrupted();
			}
		}

		@Test
		void refundInterruptedKeepsTid() {
			Scripted t = new Scripted(Step.interrupted(), Step.ok());
			try {
				EpsClient.EpsIndeterminateException e =
						assertThrows(
								EpsClient.EpsIndeterminateException.class,
								() ->
										fast(t).call(
												"initiate-refund",
												Map.of("initiator_id", "9962981729", "tid", "777", "otp", "1")));
				assertNull(e.clientRefId);
				assertEquals("777", e.tid);
				assertEquals(1, t.sent.size());
			} finally {
				Thread.interrupted();
			}
		}

		@Test
		void nonFinancialInterruptedIsPlainException() {
			Scripted t = new Scripted(Step.interrupted());
			try {
				EpsClient.EpsException e =
						assertThrows(EpsClient.EpsException.class, () -> fast(t).call("pan-lite", PAN));
				assertFalse(e instanceof EpsClient.EpsIndeterminateException);
				assertTrue(e.getCause() instanceof InterruptedException);
				assertEquals(1, t.sent.size());
			} finally {
				Thread.interrupted();
			}
		}

		@Test
		void financialPost4xxIsPlainHttpException() {
			Scripted t = new Scripted(Step.http(401));
			assertThrows(
					EpsClient.EpsHttpException.class, () -> fast(t).call("dmt-initiate-transfer", TRANSFER));
			assertEquals(1, t.sent.size());
		}

		@Test
		void nonFinancialPost5xxNoInquiry() {
			Scripted t = new Scripted(Step.http(500));
			assertThrows(EpsClient.EpsHttpException.class, () -> fast(t).call("pan-lite", PAN));
			assertEquals(1, t.sent.size());
		}

		@Test
		void financialWithoutRefParamInquiresByTid() {
			String inquiry = "{\"status\":0,\"data\":{\"tx_status\":\"4\",\"tid\":\"777\"}}";
			Map<Step, Class<?>> cases =
					Map.of(Step.http(500), EpsClient.EpsHttpException.class, Step.body("null"), EpsClient.EpsInvalidResponseException.class);
			for (Map.Entry<Step, Class<?>> c : cases.entrySet()) {
				Scripted t = new Scripted(c.getKey(), Step.body(inquiry));
				EpsClient.EpsIndeterminateException e =
						assertThrows(
								EpsClient.EpsIndeterminateException.class,
								() ->
										fast(t).call(
												"initiate-refund",
												Map.of("initiator_id", "9962981729", "tid", "777", "otp", "1")));
				assertNull(e.clientRefId);
				assertEquals("777", e.tid);
				assertEquals("4", ((Map<?, ?>) e.statusCheck.get("data")).get("tx_status"));
				assertTrue(c.getValue().isInstance(e.getCause()), c.getValue().getName());
				assertEquals("EPS request for \"initiate-refund\" on tid \"777\" has no confirmed outcome.", e.getMessage());
				assertEquals(2, t.sent.size());
				String uri = t.sent.get(1).request().uri().toString();
				assertTrue(uri.contains("tid=777"), uri);
				assertFalse(uri.contains("client_ref_id"), uri);
			}
		}

		@Test
		void autoStatusCheckOffSkipsOnlyTheInquiry() {
			Scripted t = new Scripted(Step.http(500));
			EpsClient.EpsIndeterminateException e =
					assertThrows(
							EpsClient.EpsIndeterminateException.class,
							() -> fast(t, b -> b.autoStatusCheck(false)).call("dmt-initiate-transfer", TRANSFER));
			assertEquals(t.sent.get(0).json().get("client_ref_id"), e.clientRefId);
			assertEquals(500, e.status);
			assertNull(e.statusCheck);
			assertNull(e.statusCheckError);
			assertTrue(e.getCause() instanceof EpsClient.EpsHttpException);
			assertEquals(1, t.sent.size());
		}

		@Test
		void autoStatusCheckOffInterruptedKeepsGeneratedRef() {
			Scripted t = new Scripted(Step.interrupted());
			try {
				EpsClient.EpsIndeterminateException e =
						assertThrows(
								EpsClient.EpsIndeterminateException.class,
								() -> fast(t, b -> b.autoStatusCheck(false)).call("dmt-initiate-transfer", TRANSFER));
				assertEquals(t.sent.get(0).json().get("client_ref_id"), e.clientRefId);
				assertEquals(1, t.sent.size());
			} finally {
				Thread.interrupted();
			}
		}

		@Test
		void rejectsBadRetryKnobsAtBuild() {
			assertThrows(EpsClient.EpsException.class, () -> fast(new Scripted(), b -> b.retries(-1)));
			assertThrows(
					EpsClient.EpsException.class,
					() -> fast(new Scripted(), b -> b.retryBaseDelay(Duration.ofMillis(-1))));
		}
	}

	@Nested
	@DisplayName("value validation")
	class Values {
		@Test
		void rejectsBadFormatAndSendsNothing() {
			Scripted t = new Scripted(Step.ok());
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> fast(t).call("pan-lite", with(PAN, "dob", "01-01-1990")));
			assertEquals("Invalid param values for \"pan-lite\": dob (expected format date).", e.getMessage());
			assertEquals(0, t.sent.size());
		}

		@Test
		void listsEveryOffenderInSurfaceOrder() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> client().resolveTarget("pan-lite", with(PAN, "pan_number", "bad", "dob", "1990-1-1")));
			assertEquals(
					"Invalid param values for \"pan-lite\": pan_number (expected format pan), dob (expected format date).",
					e.getMessage());
		}

		@Test
		void wholeStringMatchRejectsTrailingNewline() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> client().resolveTarget("pan-lite", with(PAN, "dob", "1990-01-01\n")));
			assertTrue(e.getMessage().contains("dob (expected format date)"));
		}

		@Test
		void unconstrainedParamPasses() {
			Scripted t = new Scripted(Step.ok());
			fast(t).call("pan-lite", with(PAN, "name", "anything at all \n"));
			assertEquals(1, t.sent.size());
		}

		@Test
		void valueProblemHelper() {
			Map<String, Pattern> formats = Map.of("date", Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$"));
			assertNull(EpsClient.valueProblem(EpsClient.param("string", null, List.of(1, 2), null, null, null), "1", formats));
			assertEquals("not one of: 1, 2", EpsClient.valueProblem(EpsClient.param("string", null, List.of(1, 2), null, null, null), 3, formats));
			assertNull(EpsClient.valueProblem(EpsClient.param("number", null, null, 1.0, 5.0, null), "1", formats));
			assertNull(EpsClient.valueProblem(EpsClient.param("number", null, null, 1.0, 5.0, null), 5, formats));
			assertEquals("below min 1", EpsClient.valueProblem(EpsClient.param("number", null, null, 1.0, null, null), 0.5, formats));
			assertEquals("above max 5", EpsClient.valueProblem(EpsClient.param("number", null, null, null, 5.0, null), "6", formats));
			assertNull(EpsClient.valueProblem(EpsClient.param("string", null, null, null, null, 3), "abc", formats));
			assertEquals("longer than 3 bytes", EpsClient.valueProblem(EpsClient.param("string", null, null, null, null, 3), "é€", formats));
			assertEquals("not one of: a", EpsClient.valueProblem(EpsClient.param("string", "date", List.of("a"), null, null, null), "b", formats));
			assertEquals("expected format date", EpsClient.valueProblem(EpsClient.param("string", "date", null, null, null, 1), "x", formats));
			assertNull(EpsClient.valueProblem(EpsClient.param("object", null, null, null, null, 1), Map.of("a", 1), formats));
		}
	}

	/**
	 * Debug mode: port of {@code packages/sdk-js/src/debug.test.ts} plus the fixture table in
	 * "Debug mode conformance" (docs/sdk-golden-vector.md).
	 */
	@Nested
	@DisplayName("debug mode")
	class Debug {
		private static final String DEV = "abcd1234wxyz";
		private static final String SECRET = EpsClient.sign(ACCESS_KEY, Long.toString(FIXED_MS));
		private static final List<String> SECRETS =
				List.of(
						DEV,
						SECRET,
						"123456789012",
						"9876543210",
						"000111222333",
						"654321",
						"k@x.in",
						"john@example.com",
						"Kumar",
						"KUMAR_123456789012");
		/** Event output as the text sink writes it: no HTML escaping, so "=" stays scannable. */
		private static final Gson OUT = new com.google.gson.GsonBuilder().disableHtmlEscaping().serializeNulls().create();
		private static final Map<String, Object> PAN_LITE =
				Map.of("pan_number", "ABCDE1234F", "name", "Kumar", "dob", "1990-01-01");
		private static final Map<String, Object> BBPS = Map.of("customer_mobile", "9876543210");

		private final List<Map<String, Object>> events = new ArrayList<>();

		@org.junit.jupiter.api.BeforeEach
		void noEnv() {
			EpsDebug.env = name -> null;
		}

		@org.junit.jupiter.api.AfterEach
		void restoreEnv() {
			EpsDebug.env = System::getenv;
		}

		private EpsClient.Builder base(Scripted t) {
			return EpsClient.builder()
					.developerKey(DEV)
					.accessKey(ACCESS_KEY)
					.environment("sandbox")
					.initiatorId("9962981729")
					.httpClient(t)
					.retryBaseDelay(Duration.ZERO);
		}

		private EpsClient make(Scripted t, java.util.function.UnaryOperator<EpsClient.Builder> tweak) {
			EpsClient c = tweak.apply(base(t).debug(events::add)).build();
			c.now = () -> FIXED_MS;
			return c;
		}

		private EpsClient make(Scripted t) {
			return make(t, b -> b);
		}

		private static String okJson(String extra) {
			return "{\"status\":0,\"response_status_id\":0" + (extra.isEmpty() ? "" : "," + extra) + "}";
		}

		private List<Map<String, Object>> ofType(String type) {
			return events.stream().filter(e -> type.equals(e.get("event"))).toList();
		}

		private List<Object> names() {
			return events.stream().map(e -> e.get("event")).toList();
		}

		@SuppressWarnings("unchecked")
		private static Map<String, Object> obj(Object o) {
			return (Map<String, Object>) o;
		}

		private void assertNoSecrets(String all) {
			for (String secret : SECRETS) assertFalse(all.contains(secret), secret + " leaked: " + all);
		}

		private void assertNoSecrets() {
			assertNoSecrets(OUT.toJson(events));
		}

		private static String captureStderr(Runnable r) {
			java.io.PrintStream saved = System.err;
			var buf = new java.io.ByteArrayOutputStream();
			System.setErr(new java.io.PrintStream(buf, true, StandardCharsets.UTF_8));
			try {
				r.run();
			} finally {
				System.setErr(saved);
			}
			return buf.toString(StandardCharsets.UTF_8);
		}

		// ── switch ──────────────────────────────────────────────────────────────

		@Test
		void offByDefaultWritesNothing() {
			String err =
					captureStderr(
							() -> {
								EpsClient c = base(new Scripted(Step.ok())).build();
								c.now = () -> FIXED_MS;
								c.call("bbps-operator-code-circle", BBPS);
							});
			assertEquals("", err);
		}

		@Test
		void envWritesOneJsonObjectPerLineToStderr() {
			for (String flag : List.of(" TRUE ", "1")) {
				EpsDebug.env = name -> "EPS_SDK_DEBUG".equals(name) ? flag : null;
				String err =
						captureStderr(
								() -> {
									EpsClient c = base(new Scripted(Step.ok())).build();
									c.now = () -> FIXED_MS;
									c.call("bbps-operator-code-circle", BBPS);
								});
				String[] lines = err.split(System.lineSeparator());
				assertEquals(3, lines.length, err); // init, request, response
				assertTrue(err.endsWith(System.lineSeparator()));
				for (String line : lines) {
					assertTrue(line.startsWith("{\"logger\":\"eps-sdk\""), line);
					GSON.fromJson(line, Map.class);
				}
				Map<String, Object> init = obj(GSON.fromJson(lines[0], Map.class));
				assertAll(
						() -> assertEquals("init", init.get("event")),
						() -> assertEquals("env", init.get("source")),
						() -> assertEquals("****wxyz", init.get("developer_key")),
						() -> assertEquals("sandbox", init.get("env")),
						() -> assertEquals("java", init.get("sdk")),
						() -> assertEquals(30000.0, init.get("timeout_ms")),
						() -> assertEquals(2.0, init.get("retries")),
						() -> assertEquals(true, init.get("auto_status_check")),
						() -> assertTrue(((String) init.get("runtime")).startsWith("java ")),
						// No jar manifest under test: the documented fallback.
						() -> assertEquals("unknown", init.get("sdk_version")),
						() -> assertTrue(Pattern.matches("^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z$", (String) init.get("ts"))));
				assertNoSecrets(err);
			}
		}

		@Test
		void explicitFalseBeatsEnv() {
			EpsDebug.env = name -> "1";
			String err =
					captureStderr(
							() -> {
								EpsClient c = base(new Scripted(Step.ok())).debug(false).build();
								c.now = () -> FIXED_MS;
								c.call("bbps-operator-code-circle", BBPS);
							});
			assertEquals("", err);
		}

		@Test
		void explicitTrueWritesToStderrWithSourceOption() {
			String err = captureStderr(() -> base(new Scripted(Step.ok())).debug(true).build());
			assertTrue(err.contains("\"source\":\"option\""), err);
		}

		@Test
		void rejectsANullSink() {
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class,
							() -> base(new Scripted(Step.ok())).debug((java.util.function.Consumer<Map<String, Object>>) null).build());
			assertTrue(e.getMessage().startsWith("Invalid debug"), e.getMessage());
		}

		// ── events ──────────────────────────────────────────────────────────────

		@Test
		void masksGetUrlAndHeadersInKeyOrder() {
			make(new Scripted(Step.ok())).call("bbps-operator-code-circle", BBPS);
			assertEquals(List.of("init", "request", "response"), names());
			Map<String, Object> request = events.get(1);
			Map<String, Object> response = events.get(2);
			assertEquals(
					List.of("logger", "ts", "event", "sdk", "sdk_version", "surface", "env", "call_id", "slug"),
					new ArrayList<>(request.keySet()).subList(0, 9));
			assertTrue(Pattern.matches("^[0-9a-f]{8}$", (String) request.get("call_id")));
			assertEquals(request.get("call_id"), response.get("call_id"));
			assertEquals(
					"https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210/operator?initiator_id=****1729",
					request.get("url"));
			assertEquals(
					"{\"developer_key\":\"****wxyz\",\"secret-key\":\"****\",\"secret-key-timestamp\":\""
							+ FIXED_MS + "\",\"content-type\":\"application/json\"}",
					OUT.toJson(request.get("headers")));
			assertTrue(request.containsKey("body"));
			assertNull(request.get("body"));
			assertEquals(200, response.get("status"));
			assertEquals("{\"status\":0}", OUT.toJson(response.get("body")));
			assertTrue(response.get("ms") instanceof Long);
			assertNoSecrets();
		}

		@Test
		void masksJsonBodyAndResponseByKeyClass() {
			String response =
					"{\"message\":\"sent to k@x.in, ref 9876543210\",\"data\":{\"tid\":\"2611230001\",\"name\":\"Kumar\","
							+ "\"email\":\"k@x.in\",\"dob\":\"1990-01-01\",\"photo\":\"" + "A".repeat(5000) + "\","
							+ "\"reference_id\":\"123456789012\",\"john@example.com\":\"x\",\"123456789012\":\"y\"},"
							+ "\"otp_code\":{\"reference_id\":\"r1\"},\"foo\":[{\"tid\":\"t1\"}]}";
			Map<String, Object> params = new LinkedHashMap<>(PAN_LITE);
			params.put("AADHAR", "123456789012");
			params.put("otp_code", "654321");
			params.put("otp", "7777"); // 4 chars: asserted by field
			params.put("foo_bar", "x");
			params.put(
					"entries",
					List.of(map("reference_id", "r1", "bank_account", "000111222333", "ifsc", "SBIN0000001")));
			make(new Scripted(Step.body(okJson(response.substring(1, response.length() - 1))))).call("pan-lite", params);
			Map<String, Object> body = obj(ofType("request").get(0).get("body"));
			assertAll(
					() -> assertEquals("****234F", body.get("pan_number")),
					() -> assertEquals("****", body.get("name")),
					() -> assertEquals("****", body.get("dob")),
					() -> assertEquals("****9012", body.get("AADHAR")),
					() -> assertEquals("****", body.get("otp_code")),
					() -> assertEquals("****", body.get("otp")),
					() -> assertEquals("****", body.get("foo_bar")),
					() -> assertEquals("****1729", body.get("initiator_id")),
					() ->
							assertEquals(
									"[{\"reference_id\":\"r1\",\"bank_account\":\"****2333\",\"ifsc\":\"SBIN0000001\"}]",
									OUT.toJson(body.get("entries"))),
					() -> assertTrue(REF.matcher((String) body.get("client_ref_id")).matches()));
			Map<String, Object> res = obj(ofType("response").get(0).get("body"));
			assertAll(
					() -> assertEquals("sent to ****@****, ref ****3210", res.get("message")),
					() ->
							assertEquals(
									"{\"tid\":\"2611230001\",\"name\":\"****\",\"email\":\"****\",\"dob\":\"****\","
											+ "\"photo\":\"****\",\"reference_id\":\"****\",\"#1\":\"****\",\"#2\":\"****\"}",
									OUT.toJson(res.get("data"))),
					() -> assertEquals("****", res.get("otp_code")),
					() -> assertEquals("****", res.get("foo")),
					// numbers stay numbers, never 0.0
					() -> assertEquals("0", res.get("status").toString()));
			assertNoSecrets();
		}

		@Test
		void masksAClientRefIdFailingTheFormatInUrlAndEcho() {
			make(new Scripted(Step.body(okJson("\"data\":{\"client_ref_id\":\"KUMAR 123456789012\"}"))))
					.call(
							"bbps-fetch-bill",
							map(
									"phone_operator_code", "1",
									"utility_acc_no", "000111222333",
									"confirmation_mobile_no", "9876543210",
									"sender_name", "Kumar",
									"category", 1,
									"client_ref_id", "KUMAR 123456789012",
									"source_ip", "10.0.0.1"));
			String url = (String) ofType("request").get(0).get("url");
			assertTrue(url.contains("client_ref_id=****&"), url);
			assertTrue(url.contains("utility_acc_no=****2333"), url);
			assertTrue(url.contains("phone_operator_code=1"), url);
			assertEquals("****", obj(obj(ofType("response").get(0).get("body")).get("data")).get("client_ref_id"));
			assertNoSecrets();
		}

		@Test
		void scrubsAndCapsANonJsonErrorPageAndTheErrorMessage() {
			String page =
					"<html><title>502 Bad Gateway</title>" + "x".repeat(600) + " 123456789012 "
							+ EpsDebug.encodeUriComponent("Kumar Abhi") + " " + DEV + "</html>";
			String echoFirst = "<html>123456789012 Kumar%20Abhi Kumar+Abhi " + DEV + "</html>";
			Map<String, Object> params = new LinkedHashMap<>(PAN_LITE);
			params.put("name", "Kumar Abhi");
			params.put("AADHAR", "123456789012");
			EpsClient c = make(new Scripted(new Step(502, echoFirst + page, null)));
			EpsClient.EpsHttpException e =
					assertThrows(EpsClient.EpsHttpException.class, () -> c.call("pan-lite", params));
			assertEquals(502, e.status);
			Map<String, Object> response = ofType("response").get(0);
			String body = (String) response.get("body");
			assertEquals(502, response.get("status"));
			assertTrue(body.startsWith("<html>****9012 **** **** ****</html>"), body);
			assertTrue(Pattern.compile("…\\(\\+\\d+ chars\\)$").matcher(body).find(), body);
			String capped = body.replaceAll("…\\(\\+\\d+ chars\\)$", "");
			assertEquals(512, capped.codePointCount(0, capped.length()));
			assertEquals("EpsHttpException", ofType("error").get(0).get("error"));
			assertNoSecrets();
		}

		@Test
		void logsAMultipartBodyAsMaskedFieldsPlusFileMetadata(@org.junit.jupiter.api.io.TempDir Path dir)
				throws IOException {
			Path pan = dir.resolve("KUMAR_123456789012.JPG");
			java.nio.file.Files.writeString(pan, "12345");
			Map<String, Object> params = new LinkedHashMap<>();
			params.put("user_code", "20810200");
			params.put("modelname", "MANTRA");
			params.put("devicenumber", "D1");
			params.put("account", "000111222333");
			params.put("ifsc", "SBIN0000001");
			params.put("shop_type", "1");
			params.put("office_address", Map.of("line", "Kumar House"));
			params.put("address_as_per_proof", Map.of("line", "Kumar House"));
			params.put("aadhar", "123456789012");
			params.put("pan_card", pan.toString());
			params.put("aadhar_front", new EpsClient.EpsFile("front.PNG", "abc".getBytes(StandardCharsets.UTF_8)));
			params.put("aadhar_back", new EpsClient.EpsFile("blob", "abcd".getBytes(StandardCharsets.UTF_8)));
			params.put("latlong", "28.6,77.2");
			Scripted t = new Scripted(Step.ok());
			make(t).call("activate-aeps-fingpay", params);
			Map<String, Object> request = ofType("request").get(0);
			assertTrue(
					((String) request.get("url")).contains("/admin/network/agent/20810200/aeps-fingpay/activate"),
					(String) request.get("url"));
			Map<String, Object> fields = obj(obj(request.get("body")).get("fields"));
			assertAll(
					() -> assertEquals("****2333", fields.get("account")),
					() -> assertEquals("****9012", fields.get("aadhar")),
					() -> assertEquals("MANTRA", fields.get("modelname")),
					() -> assertEquals("****", fields.get("office_address")),
					() -> assertEquals("****", fields.get("latlong")));
			assertEquals(
					Set.of(
							map("param", "pan_card", "ext", "jpg", "bytes", 5),
							map("param", "aadhar_front", "ext", "png", "bytes", 3),
							map("param", "aadhar_back", "ext", null, "bytes", 4)),
					Set.copyOf((List<?>) obj(request.get("body")).get("files")));
			assertNoSecrets();
			// The wire is untouched: the file still went up.
			assertTrue(t.sent.get(0).body().contains("12345"));
		}

		@Test
		void logsAPreSendFailureAsASingleErrorEvent() {
			Scripted t = new Scripted(Step.ok());
			EpsClient c = make(t);
			EpsClient.EpsException unknown =
					assertThrows(EpsClient.EpsException.class, () -> c.call("no-such-slug", null));
			assertTrue(unknown.getMessage().startsWith("Unknown endpoint"));
			EpsClient.EpsException missing =
					assertThrows(EpsClient.EpsException.class, () -> c.call("pan-lite", map("name", "Kumar")));
			assertTrue(missing.getMessage().startsWith("Missing"));
			assertEquals(List.of("init", "error", "error"), names());
			assertEquals("EpsException", events.get(1).get("error"));
			assertEquals("no-such-slug", events.get(1).get("slug"));
			assertEquals(0, t.sent.size());
		}

		@Test
		void logsATransportFailureThenTheError() {
			EpsClient c =
					make(
							new Scripted(new Step(0, null, new IOException("fetch failed for " + DEV + " 9876543210"))),
							b -> b.retries(0));
			assertThrows(EpsClient.EpsTransportException.class, () -> c.call("bbps-operator-code-circle", BBPS));
			assertEquals(List.of("init", "request", "transport_error", "error"), names());
			Map<String, Object> te = ofType("transport_error").get(0);
			assertAll(
					() -> assertEquals(1, te.get("attempt")),
					() -> assertEquals("IOException", te.get("error")),
					() -> assertEquals("fetch failed for **** ****3210", te.get("message")),
					() -> assertTrue(te.get("ms") instanceof Long),
					() -> assertFalse(te.containsKey("status")));
			assertEquals("EpsTransportException", ofType("error").get(0).get("error"));
			assertNoSecrets();
		}

		@Test
		void logsEachRetryWithItsDelay() {
			make(new Scripted(new Step(503, "busy", null), Step.ok()), b -> b.retries(1))
					.call("bbps-operator-code-circle", BBPS);
			assertEquals(
					List.of(
							java.util.Arrays.asList("init", null),
							List.of("request", 1),
							List.of("response", 1),
							List.of("retry", 1),
							List.of("request", 2),
							List.of("response", 2)),
					events.stream().map(e -> java.util.Arrays.asList(e.get("event"), e.get("attempt"))).toList());
			assertEquals(0L, ofType("retry").get(0).get("delay_ms"));
		}

		@Test
		void logsTheStatusCheckInquiryUnderItsOwnCallId() {
			EpsClient c =
					make(new Scripted(new Step(503, "busy", null), Step.body(okJson("\"data\":{\"tx_status\":0}"))));
			assertThrows(EpsClient.EpsIndeterminateException.class, () -> c.call("dmt-initiate-transfer", transfer()));
			assertEquals(
					List.of("dmt-initiate-transfer", "transaction-inquiry"),
					ofType("request").stream().map(e -> e.get("slug")).toList());
			List<Map<String, Object>> errors = ofType("error");
			Map<String, Object> last = errors.get(errors.size() - 1);
			assertEquals("EpsIndeterminateException", last.get("error"));
			assertEquals("ref123", last.get("client_ref_id"));
			assertEquals(
					2,
					events.stream().map(e -> e.get("call_id")).filter(java.util.Objects::nonNull).distinct().count());
		}

		@Test
		void boundsDeepAndHugeBodies() {
			String deep = "\"data\":" + "{\"data\":".repeat(11) + "\"leaf\"" + "}".repeat(11);
			make(new Scripted(Step.body(okJson(deep)))).call("bbps-operator-code-circle", BBPS);
			String out = OUT.toJson(ofType("response").get(0).get("body"));
			assertTrue(out.contains("\"****\""), out);
			assertFalse(out.contains("leaf"), out);

			events.clear();
			StringBuilder big = new StringBuilder("\"data\":[");
			for (int i = 0; i < 3000; i++) {
				if (i > 0) big.append(',');
				String tid = "t" + i;
				big.append("{\"tid\":\"").append(tid).append("0".repeat(50 - tid.length())).append("\"}");
			}
			big.append(']');
			make(new Scripted(Step.body(okJson(big.toString())))).call("bbps-operator-code-circle", BBPS);
			assertTrue(
					Pattern.matches("^\\[\\d+ bytes omitted\\]$", (String) ofType("response").get(0).get("body")));
		}

		// ── isolation ───────────────────────────────────────────────────────────

		private Map<String, Object> transfer() {
			return map(
					"recipient_id", 1,
					"amount", 100,
					"customer_id", "9876543210",
					"otp", "4321",
					"otp_ref_id", "ref1",
					"client_ref_id", "ref123");
		}

		/** The call's outcome (value or error class, message, status check) plus the request count. */
		private List<Object> outcome(
				java.util.function.UnaryOperator<EpsClient.Builder> debug,
				Scripted t,
				String slug,
				Map<String, Object> params) {
			EpsClient c = debug.apply(base(t)).build();
			c.now = () -> FIXED_MS;
			try {
				return List.of("ok", c.call(slug, params), t.sent.size());
			} catch (EpsClient.EpsException e) {
				Object check = e instanceof EpsClient.EpsIndeterminateException i ? i.statusCheck : null;
				return java.util.Arrays.asList(e.getClass().getSimpleName(), e.getMessage(), check, t.sent.size());
			}
		}

		@Test
		void aThrowingSinkLeavesEveryOutcomeUnchanged() {
			java.util.function.UnaryOperator<EpsClient.Builder> off = b -> b.debug(false);
			java.util.function.UnaryOperator<EpsClient.Builder> throwing =
					b ->
							b.debug(
									e -> {
										throw new IllegalStateException("sink exploded");
									});
			List<java.util.function.Supplier<Scripted>> transports =
					List.of(
							() -> new Scripted(Step.ok()),
							() -> new Scripted(Step.body(okJson("\"data\":{\"tid\":\"1\"}"))),
							() ->
									new Scripted(
											new Step(503, "busy", null), Step.body(okJson("\"data\":{\"tx_status\":0}"))));
			List<String> slugs = List.of("pan-lite", "dmt-initiate-transfer", "dmt-initiate-transfer");
			List<Map<String, Object>> params = List.of(map("name", "x"), transfer(), transfer());
			for (int i = 0; i < 3; i++) {
				List<Object> a = outcome(off, transports.get(i).get(), slugs.get(i), params.get(i));
				List<Object> b = outcome(throwing, transports.get(i).get(), slugs.get(i), params.get(i));
				assertEquals(a, b, slugs.get(i));
			}
		}

		@Test
		void anEmptyDeveloperKeyIsNeverAKnownValue() {
			EpsClient c = base(new Scripted(Step.ok())).developerKey("").debug(events::add).build();
			c.now = () -> FIXED_MS;
			c.call("bbps-operator-code-circle", BBPS);
			assertEquals("{\"status\":0}", OUT.toJson(ofType("response").get(0).get("body")));
		}

		@Test
		void anEmptyBodyIsTextNotNull() {
			EpsClient c = make(new Scripted(new Step(200, "", null)), b -> b.retries(0));
			assertThrows(
					EpsClient.EpsInvalidResponseException.class, () -> c.call("bbps-operator-code-circle", BBPS));
			assertEquals("", ofType("response").get(0).get("body"));
		}

		// ── URL alignment ───────────────────────────────────────────────────────

		private final EpsDebug.Masker masker =
				new EpsDebug.Masker(
						Map.of("safe", List.of("tid", "user_code"), "last4", List.of("customer_id")), null);
		private static final String BASE = "https://h/v3";

		private String url(String u) {
			return masker.url(u, BASE, "/x/{customer_id}/y", List.of(), new ArrayList<>());
		}

		@Test
		void urlMasksPathParamsAndQueryValuesByClass() {
			assertEquals(BASE + "/x/****3210/y?tid=1&#1=****", url(BASE + "/x/9876543210/y?tid=1&k%40x=2"));
		}

		@Test
		void urlKeepsAnEncodedSlashInsideItsSegment() {
			assertEquals(BASE + "/x/****3210/y", url(BASE + "/x/98765%2F43210/y"));
		}

		@Test
		void urlMasksASafeQueryValueThatIsNotSafeShaped() {
			assertEquals(BASE + "/x/****/y?tid=****", url(BASE + "/x/1/y?tid=KUMAR%20123456789012"));
			assertEquals(BASE + "/x/****/y?tid=****", url(BASE + "/x/1/y?tid=KUMAR+123456789012"));
		}

		@Test
		void urlFailsClosed() {
			for (String u :
					List.of(
							"https://evil/v3/x/1/y", // another base
							BASE + "/z/1/y", // a different literal segment
							BASE + "/x/1/y/z", // an extra segment
							BASE + "/x/%E0%A4%A/y", // a malformed escape
							BASE + "/x/%E0%A4/y")) { // invalid UTF-8
				assertEquals("[unavailable]", url(u), u);
			}
		}
	}
}
