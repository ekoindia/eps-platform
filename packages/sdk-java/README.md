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
That surface is pinned to the SDK release: a newly launched API returns
"Unknown endpoint slug" until you upgrade (`bump com.github.ekoindia:eps-sdk-java to the latest tag`).

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
- **Never loses a transaction** — every non-GET call carries a `client_ref_id` (yours, or a generated 15-char one). A money-moving call that times out (or gets back an unreadable response) is looked up by that ref (or, on a refund, which has no ref, by its `tid`) and surfaced as `EpsClient.EpsIndeterminateException` with the inquiry result attached, never silently re-sent.
- **Retries the safe things** — a call that times out or gets a 429/5xx or an unreadable 2xx is retried with jittered backoff (`.retries(…)`, default 2) only when the endpoint is marked `retrySafe` (idempotent, free, moves no money). Paid lookups and money-moving calls are never re-sent.
- **Validates values too** — spec-driven format / enum / range / length rules (dates, PAN, IFSC, `client_ref_id` …) fail before the request is signed. A `client_ref_id` you pass to a money-moving call must not be blank (whitespace, incl. no-break and zero-width spaces) — it is the only key a lost response can be reconciled by.

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
    // client.call("transaction-inquiry", Map.of("client_ref_id", e.clientRefId));
}
```

Knobs: `.retries(2)`, `.retryBaseDelay(Duration.ofMillis(200))`,
`.autoStatusCheck(true)`. Off skips only the
inquiry — a financial call still fails with the indeterminate error carrying
its ref (or `tid`). A transport failure throws
`EpsClient.EpsTransportException`.

## Debugging

Debug mode shows what the SDK sends and receives: the environment, the full URL,
headers, body, HTTP status, the raw EPS response, validation failures, retries
and the automatic status check. Each event is one JSON object per line. Turn it
on when a call misbehaves and share the output with Eko support instead of just
the response body.

No code change: set the env var and rerun.

```bash
EPS_SDK_DEBUG=1 java -jar app.jar
```

Or in code:

```java
EpsClient.builder()....debug(true).build();  // JSON lines on System.err
EpsClient.builder()....debug(event -> log.debug("{}", event)).build(); // your logger
EpsClient.builder()....debug(false).build(); // off, even when EPS_SDK_DEBUG is set
```

A request line looks like this:

```json
{"logger":"eps-sdk","ts":"2026-11-23T11:31:25.884Z","event":"request","sdk":"java","sdk_version":"3.1.0","surface":"48eb0cf2","env":"sandbox","call_id":"f020eef5","slug":"bbps-operator-code-circle","attempt":1,"method":"GET","url":"https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210/operator?initiator_id=****1729","headers":{"developer_key":"****wxyz","secret-key":"****","secret-key-timestamp":"1763897485884","content-type":"application/json"},"body":null}
```

Events: `init` (once per client), `request` and `response` (per attempt),
`transport_error` (no usable response), `retry`, and `error` (the call threw;
a validation failure has no `request` before it, so nothing was sent). Lines of
one call share a `call_id`.

What is masked: `developer_key` shows its last 4 characters and `secret-key` is
hidden. Aadhaar, PAN, account and mobile numbers show their last 4. OTPs,
biometrics, names, addresses, e-mails, dates of birth and any field the SDK does
not recognise print as `****`. Ids, status codes, amounts and the EPS `message`
print as-is so support can trace the call. Debug mode never changes a call's
outcome, and costs nothing while off.

> ⚠️ Masking is best-effort. Free text (upstream error pages, messages) is
> scrubbed but may still contain credentials or personal data, and id and status
> fields print as-is. Review the output before sharing it, share it only with
> Eko support, and turn debug mode off when you are done.

The format is identical across all five EPS SDKs; see "Debug mode conformance"
in [docs/sdk-golden-vector.md](../../docs/sdk-golden-vector.md).

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
