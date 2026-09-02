package in.eko.eps;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
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
}
