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
			assertTrue(e.getMessage().contains("Unknown endpoint slug"));
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
							() -> EpsClient.handleResponse(403, URL, "{\"status\":403}"));
			assertEquals(403, e.status);
			assertEquals(URL, e.url);
			assertEquals(403.0, e.body.get("status"));
			assertEquals("{\"status\":403}", e.raw);
			assertEquals("EPS request to " + URL + " failed with HTTP 403.", e.getMessage());
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
			EpsClient.EpsException e =
					assertThrows(
							EpsClient.EpsException.class, () -> EpsClient.handleResponse(200, URL, "not json"));
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

	/** One scripted outcome: a response, or an I/O failure to throw. */
	private record Step(int status, String body, IOException failure) {
		static Step ok() {
			return new Step(200, OK, null);
		}

		static Step http(int status) {
			return new Step(status, "{\"status\":1}", null);
		}

		static Step transportFailure() {
			return new Step(0, null, new IOException("Connection refused"));
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
				throws IOException {
			sent.add(new Sent(request, drain(request)));
			Step step = steps.size() > 1 ? steps.remove(0) : steps.get(0);
			if (step.failure() != null) throw step.failure();
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
			Scripted t = new Scripted(Step.ok());
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
			assertTrue(
					inq.uri().toString().contains(
							"/tools/reference/transaction/client_ref_id%3A" + ref + "?initiator_id=9962981729"),
					inq.uri().toString());
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
			assertTrue(t.sent.get(1).request().uri().toString().contains("client_ref_id%3AMY-REF"));
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
		void financialPost4xxIsPlainHttpException() {
			Scripted t = new Scripted(Step.http(403));
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
		void financialWithoutRefParamNoInquiry() {
			Scripted t = new Scripted(Step.http(500));
			assertThrows(
					EpsClient.EpsHttpException.class,
					() ->
							fast(t).call(
									"initiate-refund",
									Map.of("initiator_id", "9962981729", "tid", "1", "otp", "1")));
			assertEquals(1, t.sent.size());
		}

		@Test
		void autoStatusCheckOff() {
			Scripted t = new Scripted(Step.http(500));
			assertThrows(
					EpsClient.EpsHttpException.class,
					() -> fast(t, b -> b.autoStatusCheck(false)).call("dmt-initiate-transfer", TRANSFER));
			assertEquals(1, t.sent.size());
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
}
