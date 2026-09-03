# EPS Java SDK

Backend-only Java client for [Eko Platform Services](https://eps.eko.in/docs/sdk/java)
APIs — DMT, AePS, BBPS, KYC and verification — with HMAC request signing built
in. Java 17+.

Published from a git tag via [JitPack](https://jitpack.io/#ekoindia/eps-sdk-java)
— no Maven Central coordinates to wait on.

**Gradle**

```groovy
repositories {
    mavenCentral()
    maven { url 'https://jitpack.io' }   // required
}
dependencies {
    implementation 'com.github.ekoindia:eps-sdk-java:v1.0.2'
}
```

**Maven**

```xml
<repositories>
  <repository><id>jitpack.io</id><url>https://jitpack.io</url></repository>
</repositories>

<dependency>
  <groupId>com.github.ekoindia</groupId>
  <artifactId>eps-sdk-java</artifactId>
  <version>v1.0.2</version>
</dependency>
```

```java
import in.eko.eps.EpsClient;
import java.util.Map;

EpsClient client = EpsClient.builder()
    .developerKey(System.getenv("EPS_DEVELOPER_KEY"))
    .accessKey(System.getenv("EPS_ACCESS_KEY"))
    .initiatorId("9962981729")   // registered mobile of the API user
    .userCode("20810200")        // retailer/agent code
    .environment("sandbox")      // or "production"
    .build();

Map<String, Object> sender = client.call("dmt-get-sender", Map.of(
    "customer_id", "9123456789"
));
```

One generic `call(slug, params)` covers every endpoint. The slug list, each
endpoint's params and which of them are required all come from the same
generated API surface the docs are built from, so the client validates your
input **before** it signs and sends anything.

## Backend only

`accessKey` signs every request. Never ship it in an Android app or any client
binary — a leaked access key lets anyone transact as you.

## What it does for you

- **Signs the request** — `secret-key`, `secret-key-timestamp` and
  `developer_key` headers on every call.
- **Validates first** — missing required params and wrong types throw
  `EpsClient.EpsException` before a request goes out.
- **Routes the params** — path tokens, query string, JSON body, or
  `multipart/form-data` for file-upload endpoints, per the endpoint's spec.
- **Fails loudly** — a non-2xx response throws `EpsClient.EpsHttpException`
  (with the decoded envelope on `.body`); a non-JSON body throws rather than
  returning an empty map.
- **Never loses a transaction** — every non-GET call carries a `client_ref_id` (yours, or a generated 15-char one). A money-moving call that times out is looked up by that ref and surfaced as `EpsClient.EpsIndeterminateException` with the inquiry result attached, never silently re-sent.
- **Retries the safe things** — a GET that times out or gets a 429/5xx is retried with jittered backoff (`.retries(…)`, default 2); non-GET calls are never re-sent.
- **Validates values too** — spec-driven format / enum / range / length rules (dates, PAN, IFSC, `client_ref_id` …) fail before the request is signed.

Uploads take a path or in-memory bytes:

```java
client.call("activate-aeps-fingpay", Map.of(
    "pan_card", "/path/to/pan.jpg",
    "aadhar_front", new EpsClient.EpsFile("aadhar.jpg", imageBytes)
    // ...
));
```

Pass `.httpClient(...)` to control timeouts, proxies or redirects; the default
is a `java.net.http.HttpClient` with a 30s connect timeout.

Reconciling an indeterminate transaction:

```java
try {
    client.call("bbps-pay-bill", params);
} catch (EpsClient.EpsIndeterminateException e) {
    // e.clientRefId — persist it; ((Map<?,?>) e.statusCheck.get("data")).get("tx_status"):
    // "0" success, "1" fail, "2" awaited. Inquire again later with
    // client.call("transaction-inquiry", Map.of("transaction-reference", "client_ref_id:" + e.clientRefId));
}
```

Knobs: `.retries(2)`, `.retryBaseDelay(Duration.ofMillis(200))`,
`.autoStatusCheck(true)`. A transport failure throws
`EpsClient.EpsTransportException`.

## Dependencies

One: [Gson](https://github.com/google/gson), because Java has no JSON parser in
the standard library. The Node.js, PHP, Python and Go SDKs are dependency-free.
HTTP uses the JDK's own `java.net.http`.

## Development

The packaged asset `data/sdk-surface.json` is generated from the API specs and
is **not** committed. From the repo root:

```bash
npm run build            # bakes packages/sdk-java/data/sdk-surface.json
cd packages/sdk-java
mvn test
```

The test suite is the cross-language conformance suite described in
`docs/sdk-golden-vector.md` — the same cases the Node.js, PHP, Python and Go
SDKs must pass.

MIT licensed.
