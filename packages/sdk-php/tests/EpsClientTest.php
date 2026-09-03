<?php
use PHPUnit\Framework\TestCase;
use Eko\Eps\EpsClient;
use Eko\Eps\EpsException;
use Eko\Eps\EpsHttpException;
use Eko\Eps\EpsIndeterminateException;
use Eko\Eps\EpsTransportException;

final class EpsClientTest extends TestCase
{
    // from docs/sdk-golden-vector.md
    private const GOLDEN = 'u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=';

    public function testGoldenVector(): void
    {
        $this->assertSame(
            self::GOLDEN,
            EpsClient::signSecretKey('TEST_ACCESS_KEY_DO_NOT_USE', '1700000000000')
        );
    }

    public function testBuildsSignedHeaders(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $headers = $client->buildHeaders();
        $this->assertSame('dev123', $headers['developer_key']);
        $this->assertSame(self::GOLDEN, $headers['secret-key']);
        $this->assertSame('1700000000000', $headers['secret-key-timestamp']);
    }

    public function testGetPutsNonPathParamsInQueryStringNoBody(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $target = $client->resolveTarget('dmt-get-sender', [
            'customer_id' => '9123456789',
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
        ]);
        $this->assertStringContainsString('/customer/payment/dmt-fino/sender/9123456789', $target['url']);
        $this->assertStringContainsString('initiator_id=9962981729', $target['url']);
        $this->assertStringContainsString('user_code=20810200', $target['url']);
        $this->assertStringNotContainsString('{customer_id}', $target['url']);
        $this->assertNull($target['body']);
    }

    public function testThrowsWhenRequiredParamMissing(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $this->expectException(\InvalidArgumentException::class);
        // dmt-get-sender requires initiator_id and customer_id (user_code is optional).
        $this->expectExceptionMessageMatches('/Missing required params.*initiator_id.*customer_id/');
        $client->resolveTarget('dmt-get-sender', ['user_code' => '20810200']);
    }

    public function testThrowsWhenRequiredParamNull(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/Missing required params.*customer_id/');
        $client->resolveTarget('dmt-get-sender', [
            'initiator_id' => '9962981729',
            'customer_id' => null,
        ]);
    }

    public function testAcceptsNumericStringForNumberParam(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        // bbps-get-operators: category is an optional `number` param.
        $target = $client->resolveTarget('bbps-get-operators', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'category' => '5',
        ]);
        $this->assertStringContainsString('category=5', $target['url']);
    }

    public function testThrowsOnTypeMismatch(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/Invalid param types.*category \(expected number\)/');
        $client->resolveTarget('bbps-get-operators', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'category' => 'abc',
        ]);
    }

    public function testInjectsClientLevelInitiatorIdAndUserCode(): void
    {
        $client = new EpsClient(
            'dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox',
            initiatorId: '9962981729', userCode: '20810200',
            now: fn () => 1700000000000
        );
        // No initiator_id / user_code passed per call — the client supplies them.
        $target = $client->resolveTarget('dmt-get-sender', ['customer_id' => '9123456789']);
        $this->assertStringContainsString('initiator_id=9962981729', $target['url']);
        $this->assertStringContainsString('user_code=20810200', $target['url']);
    }

    public function testPerCallParamOverridesClientLevelDefault(): void
    {
        $client = new EpsClient(
            'dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox',
            initiatorId: '9962981729', userCode: '20810200',
            now: fn () => 1700000000000
        );
        $target = $client->resolveTarget('dmt-get-sender', [
            'customer_id' => '9123456789',
            'initiator_id' => '1111111111',
        ]);
        $this->assertStringContainsString('initiator_id=1111111111', $target['url']);
        $this->assertStringNotContainsString('initiator_id=9962981729', $target['url']);
        $this->assertStringContainsString('user_code=20810200', $target['url']); // default still used
    }

    public function testMultipartEndpointBuildsJsonEnvelopeWithCurlFiles(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $address = ['line' => 'Shop 5', 'city' => 'Patna', 'state' => 'Bihar', 'pincode' => '800001'];
        $target = $client->resolveTarget('activate-aeps-fingpay', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'modelname' => 'Morpho 1300E3',
            'devicenumber' => 'SN1234567890',
            'account' => '38759149196',
            'ifsc' => 'SBIN0007515',
            'shop_type' => 4215,
            'office_address' => $address,
            'address_as_per_proof' => $address,
            // Path string is wrapped in a CURLFile; a CURLFile passes through.
            'pan_card' => __FILE__,
            'aadhar' => '123456789012',
            'aadhar_front' => new \CURLFile(__FILE__),
            'aadhar_back' => __FILE__,
            'latlong' => '28.6139,77.2090',
        ]);
        $this->assertStringContainsString('/admin/network/agent/20810200/aeps-fingpay/activate', $target['url']);
        $this->assertTrue($target['multipart']);
        $this->assertIsArray($target['body']);
        $this->assertInstanceOf(\CURLFile::class, $target['body']['pan_card']);
        $this->assertInstanceOf(\CURLFile::class, $target['body']['aadhar_front']);
        // Every non-file value rides in ONE `form-data` JSON field, never a form
        // field of its own; arrays stay nested rather than being stringified.
        $this->assertArrayNotHasKey('modelname', $target['body']);
        $this->assertArrayNotHasKey('office_address', $target['body']);
        $payload = json_decode($target['body'][EpsClient::MULTIPART_JSON_FIELD], true);
        $this->assertSame('Morpho 1300E3', $payload['modelname']);
        $this->assertSame('38759149196', $payload['account']);
        $this->assertSame($address, $payload['office_address']);
        $this->assertArrayNotHasKey('pan_card', $payload);
        $this->assertArrayNotHasKey('user_code', $payload); // filled the path
    }

    public function testMultipartOmitsNullParamsButKeepsNestedNulls(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $target = $client->resolveTarget('activate-aeps-fingpay', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'modelname' => 'Morpho 1300E3',
            'devicenumber' => 'SN1234567890',
            'account' => '38759149196',
            'ifsc' => 'SBIN0007515',
            'shop_type' => 4215,
            // Not a declared param, so it exercises the top-level-null rule
            // without inventing an optional field on a spec that has none.
            'extra_note' => null,
            'office_address' => ['line' => 'Shop 5', 'state' => null],
            'address_as_per_proof' => [],
            'pan_card' => __FILE__,
            'aadhar' => '123456789012',
            'aadhar_front' => __FILE__,
            'aadhar_back' => __FILE__,
            'latlong' => '28.6139,77.2090',
        ]);
        $payload = json_decode($target['body'][EpsClient::MULTIPART_JSON_FIELD], true);
        // A null param has no form encoding, so it is dropped entirely...
        $this->assertArrayNotHasKey('extra_note', $payload);
        // ...but a null INSIDE an array value is real data JSON preserves.
        $this->assertSame(['line' => 'Shop 5', 'state' => null], $payload['office_address']);
    }

    public function testMultipartThrowsWhenTheEnvelopeCannotBeEncoded(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $this->expectException(\JsonException::class);
        $client->resolveTarget('activate-aeps-fingpay', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'modelname' => 'Morpho 1300E3',
            'devicenumber' => 'SN1234567890',
            'account' => '38759149196',
            'ifsc' => 'SBIN0007515',
            'shop_type' => 4215,
            // Invalid UTF-8 cannot be JSON-encoded; without JSON_THROW_ON_ERROR
            // this would silently blank the whole non-file payload.
            'office_address' => ['line' => "\xB1\x31"],
            'address_as_per_proof' => [],
            'pan_card' => __FILE__,
            'aadhar' => '123456789012',
            'aadhar_front' => __FILE__,
            'aadhar_back' => __FILE__,
            'latlong' => '28.6139,77.2090',
        ]);
    }

    public function testMultipartHeadersOmitContentType(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $headers = $client->buildHeaders(multipart: true);
        $this->assertArrayNotHasKey('content-type', $headers);
        $this->assertSame(self::GOLDEN, $headers['secret-key']); // still signed
        // Regular endpoints keep the JSON content-type.
        $this->assertSame('application/json', $client->buildHeaders()['content-type']);
    }

    public function testRejectsNonFileValueForFileParam(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/Invalid param types.*pan_card \(expected file\)/');
        $client->resolveTarget('activate-aeps-fingpay', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'modelname' => 'Morpho 1300E3',
            'devicenumber' => 'SN1234567890',
            // Every required param must be present, or the missing-param guard
            // fires first and this never reaches the type guard under test.
            'account' => '38759149196',
            'ifsc' => 'SBIN0007515',
            'shop_type' => 4215,
            'office_address' => [],
            'address_as_per_proof' => [],
            'pan_card' => '/no/such/file.jpg', // nonexistent path fails early
            'aadhar' => '123456789012',
            'aadhar_front' => new \CURLFile(__FILE__),
            'aadhar_back' => new \CURLFile(__FILE__),
            'latlong' => '28.6139,77.2090',
        ]);
    }

    public function testJsonEndpointStillSendsJsonBody(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $target = $client->resolveTarget('pan-lite', [
            'initiator_id' => '9962981729',
            'pan_number' => 'ABCDE1234F',
            'name' => 'Test Name',
            'dob' => '1990-01-01',
        ]);
        $this->assertFalse($target['multipart']);
        $this->assertIsString($target['body']);
        $this->assertStringContainsString('"pan_number":"ABCDE1234F"', $target['body']);
    }

    public function testExplicitNullPerCallClearsTheDefault(): void
    {
        $client = new EpsClient(
            'dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox',
            initiatorId: '9962981729', userCode: '20810200',
            now: fn () => 1700000000000
        );
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/Missing required params.*initiator_id/');
        $client->resolveTarget('dmt-get-sender', [
            'customer_id' => '9123456789',
            'initiator_id' => null,
        ]);
    }

    // ---- Response and error contract (docs/sdk-golden-vector.md) ----------

    private const URL = 'https://staging.eko.in/ekoapi/v3/tools/kyc/pan-lite';

    public function testDecodeResponseReturnsEnvelopeOn2xx(): void
    {
        $this->assertSame(
            ['status' => 0, 'message' => 'Success'],
            EpsClient::decodeResponse(200, self::URL, '{"status":0,"message":"Success"}')
        );
    }

    public function testDecodeResponseThrowsEpsHttpExceptionOnNon2xx(): void
    {
        try {
            EpsClient::decodeResponse(403, self::URL, '{"status":403,"message":"Forbidden"}');
            $this->fail('expected EpsHttpException');
        } catch (EpsHttpException $e) {
            $this->assertSame(403, $e->status);
            $this->assertSame(self::URL, $e->url);
            $this->assertSame(['status' => 403, 'message' => 'Forbidden'], $e->body);
            $this->assertSame('{"status":403,"message":"Forbidden"}', $e->raw);
            $this->assertSame('EPS request to ' . self::URL . ' failed with HTTP 403.', $e->getMessage());
        }
    }

    public function testDecodeResponseKeepsNullBodyForNonJsonErrorPayload(): void
    {
        try {
            EpsClient::decodeResponse(502, self::URL, '<html>502</html>');
            $this->fail('expected EpsHttpException');
        } catch (EpsHttpException $e) {
            $this->assertNull($e->body);
            $this->assertSame('<html>502</html>', $e->raw);
        }
    }

    /** Regression for the old `json_decode($res, true) ?? []`. */
    public function testDecodeResponseThrowsWhenSuccessBodyIsNotJson(): void
    {
        $this->expectException(EpsException::class);
        $this->expectExceptionMessage('was not valid JSON');
        EpsClient::decodeResponse(200, self::URL, 'not json');
    }

    public function testCurlOptionsCarryTheTimeoutInMilliseconds(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $target = $client->resolveTarget('pan-lite', [
            'initiator_id' => '9962981729',
            'pan_number' => 'BNZAA2318J',
            'name' => 'Rahul Sharma',
            'dob' => '1990-01-01',
        ]);
        $this->assertSame(30000, $client->curlOptions($target)[CURLOPT_TIMEOUT_MS]);

        $fast = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', timeout: 1.5, now: fn () => 1700000000000);
        $this->assertSame(1500, $fast->curlOptions($target)[CURLOPT_TIMEOUT_MS]);
    }

    public function testRejectsNonPositiveTimeout(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', timeout: 0.0);
    }

    // ── Shared fixtures for the suites below (docs/sdk-golden-vector.md) ────────

    private const REF = '/^[0-9a-z]{15}$/';
    /** pan-lite: POST, not financial. */
    private const PAN = [
        'initiator_id' => '9962981729',
        'pan_number' => 'BNZAA2318J',
        'name' => 'Rahul Sharma',
        'dob' => '1990-01-01',
    ];
    /** dmt-initiate-transfer: POST, financial, client_ref_id required. */
    private const TRANSFER = [
        'initiator_id' => '9962981729',
        'customer_id' => '9123456789',
        'recipient_id' => '1',
        'amount' => 100,
        'otp' => '123456',
        'otp_ref_id' => 'ref1',
    ];
    private const GET_ARGS = ['bbps-get-operators', ['initiator_id' => '9962981729']];
    private const OK = '{"status":0}';

    /**
     * Scripted transport standing in for cURL: each step is [status, raw], a
     * \Throwable to throw, or a closure. Records every target + options so
     * URLs, bodies and headers can be asserted.
     */
    private static function transport(array $script): object
    {
        return new class($script) {
            public array $requests = [];
            public function __construct(private array $script) {}
            public function __invoke(array $target, array $options): array
            {
                $this->requests[] = ['target' => $target, 'options' => $options];
                $step = count($this->script) > 1 ? array_shift($this->script) : $this->script[0];
                if ($step instanceof \Throwable) throw $step;
                return $step;
            }
            public function body(int $i = 0): array { return json_decode($this->requests[$i]['target']['body'], true); }
            public function url(int $i = 0): string { return $this->requests[$i]['target']['url']; }
            public function timestamp(int $i = 0): string
            {
                foreach ($this->requests[$i]['options'][CURLOPT_HTTPHEADER] as $h) {
                    if (str_starts_with($h, 'secret-key-timestamp: ')) return substr($h, 22);
                }
                return '';
            }
        };
    }

    private static function fast($transport, array $opts = []): EpsClient
    {
        return new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox',
            ...array_merge(['retryBaseDelay' => 0.0, 'now' => fn () => 1700000000000, 'transport' => $transport], $opts));
    }

    private static function http(int $status): array { return [$status, '{"status":1}']; }
    private static function transportFailure(): EpsTransportException
    {
        return new EpsTransportException('EPS request to x failed: Could not resolve host');
    }

    // ── client_ref_id ──────────────────────────────────────────────────────────

    public function testGenerateClientRefIdShape(): void
    {
        $a = EpsClient::generateClientRefId(1700000000000);
        $b = EpsClient::generateClientRefId(1700000000000);
        $this->assertMatchesRegularExpression(self::REF, $a);
        $this->assertStringStartsWith(base_convert('1700000000000', 10, 36), $a);
        $this->assertNotSame($a, $b);
    }

    public function testClientRefIdGeneratedForNonGet(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call('pan-lite', self::PAN);
        $this->assertMatchesRegularExpression(self::REF, $t->body()['client_ref_id']);
    }

    public function testClientRefIdSuppliedValueKept(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call('pan-lite', self::PAN + ['client_ref_id' => 'MY-REF_1']);
        $this->assertSame('MY-REF_1', $t->body()['client_ref_id']);
    }

    public function testClientRefIdSatisfiesRequiredParam(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call('dmt-initiate-transfer', self::TRANSFER);
        $this->assertMatchesRegularExpression(self::REF, $t->body()['client_ref_id']);
    }

    public function testClientRefIdNotAddedToGet(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call(...self::GET_ARGS);
        $this->assertStringNotContainsString('client_ref_id', $t->url());
    }

    public function testClientRefIdNotAddedWhenEndpointOmitsIt(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call('get-refund-otp', ['initiator_id' => '9962981729', 'tid' => '1']);
        $this->assertArrayNotHasKey('client_ref_id', $t->body());
    }

    public function testClientRefIdDiffersBetweenCalls(): void
    {
        $t = self::transport([[200, self::OK]]);
        $client = self::fast($t);
        $client->call('pan-lite', self::PAN);
        $client->call('pan-lite', self::PAN);
        $this->assertNotSame($t->body(0)['client_ref_id'], $t->body(1)['client_ref_id']);
    }

    public function testEmptyClientRefIdCountsAsSupplied(): void
    {
        $t = self::transport([[200, self::OK]]);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/client_ref_id \(expected format client-ref\)/');
        try {
            self::fast($t)->call('pan-lite', self::PAN + ['client_ref_id' => '']);
        } finally {
            $this->assertSame([], $t->requests);
        }
    }

    // ── retry and status check ─────────────────────────────────────────────────

    public function testGetRetries500ThenSucceedsResigning(): void
    {
        $clock = 1700000000000;
        $t = self::transport([self::http(500), [200, self::OK]]);
        $client = self::fast($t, ['now' => function () use (&$clock) { return $clock++; }]);
        $this->assertSame(['status' => 0], $client->call(...self::GET_ARGS));
        $this->assertCount(2, $t->requests);
        $this->assertNotSame($t->timestamp(0), $t->timestamp(1));
    }

    public function testGetIndeterminateEveryAttemptThenThrows(): void
    {
        foreach ([self::transportFailure(), self::http(429), self::http(503)] as $failure) {
            $t = self::transport([$failure]);
            try {
                self::fast($t)->call(...self::GET_ARGS);
                $this->fail('expected an exception');
            } catch (EpsException $e) {
                $this->assertCount(3, $t->requests);
            }
        }
    }

    public function testGetDoesNotRetry4xx(): void
    {
        $t = self::transport([self::http(400)]);
        $this->expectException(EpsHttpException::class);
        try { self::fast($t)->call(...self::GET_ARGS); } finally { $this->assertCount(1, $t->requests); }
    }

    public function testRetriesZeroDisables(): void
    {
        $t = self::transport([self::http(500)]);
        $this->expectException(EpsHttpException::class);
        try { self::fast($t, ['retries' => 0])->call(...self::GET_ARGS); } finally { $this->assertCount(1, $t->requests); }
    }

    public function testPostNeverRetried(): void
    {
        $t = self::transport([self::http(500)]);
        $this->expectException(EpsHttpException::class);
        try { self::fast($t)->call('pan-lite', self::PAN); } finally { $this->assertCount(1, $t->requests); }
    }

    public function testFinancialPost5xxInquiresAndThrowsIndeterminate(): void
    {
        $inquiry = ['status' => 0, 'data' => ['tx_status' => '0', 'tid' => '1']];
        $t = self::transport([self::http(502), [200, json_encode($inquiry)]]);
        try {
            self::fast($t)->call('dmt-initiate-transfer', self::TRANSFER);
            $this->fail('expected EpsIndeterminateException');
        } catch (EpsIndeterminateException $e) {
            $ref = $t->body(0)['client_ref_id'];
            $this->assertSame($ref, $e->clientRefId);
            $this->assertSame('dmt-initiate-transfer', $e->slug);
            $this->assertSame(502, $e->status);
            $this->assertSame($inquiry, $e->statusCheck);
            $this->assertNull($e->statusCheckError);
            $this->assertInstanceOf(EpsHttpException::class, $e->getPrevious());
            $this->assertSame(
                "EPS request for \"dmt-initiate-transfer\" with client_ref_id \"$ref\" has no confirmed outcome.",
                $e->getMessage()
            );
            $this->assertCount(2, $t->requests);
            $this->assertStringContainsString(
                "/tools/reference/transaction/client_ref_id%3A$ref?initiator_id=9962981729",
                $t->url(1)
            );
            $this->assertSame('GET', $t->requests[1]['target']['method']);
        }
    }

    public function testFinancialPostTransportFailureReusesSuppliedRef(): void
    {
        $t = self::transport([self::transportFailure(), [200, self::OK]]);
        try {
            self::fast($t)->call('dmt-initiate-transfer', self::TRANSFER + ['client_ref_id' => 'MY-REF']);
            $this->fail('expected EpsIndeterminateException');
        } catch (EpsIndeterminateException $e) {
            $this->assertSame('MY-REF', $e->clientRefId);
            $this->assertNull($e->status);
            $this->assertInstanceOf(EpsTransportException::class, $e->getPrevious());
            $this->assertStringContainsString('client_ref_id%3AMY-REF', $t->url(1));
        }
    }

    public function testFailingInquiryLandsOnStatusCheckError(): void
    {
        $t = self::transport([self::http(500), self::http(503)]);
        try {
            self::fast($t)->call('dmt-initiate-transfer', self::TRANSFER);
            $this->fail('expected EpsIndeterminateException');
        } catch (EpsIndeterminateException $e) {
            $this->assertNull($e->statusCheck);
            $this->assertSame(503, $e->statusCheckError->status);
            $this->assertSame(500, $e->getPrevious()->status);
            $this->assertCount(1 + 3, $t->requests);
        }
    }

    public function testFinancialPost4xxIsPlainHttpException(): void
    {
        $t = self::transport([self::http(403)]);
        $this->expectException(EpsHttpException::class);
        try { self::fast($t)->call('dmt-initiate-transfer', self::TRANSFER); } finally { $this->assertCount(1, $t->requests); }
    }

    public function testNonFinancialPost5xxNoInquiry(): void
    {
        $t = self::transport([self::http(500)]);
        $this->expectException(EpsHttpException::class);
        try { self::fast($t)->call('pan-lite', self::PAN); } finally { $this->assertCount(1, $t->requests); }
    }

    public function testFinancialWithoutRefParamNoInquiry(): void
    {
        $t = self::transport([self::http(500)]);
        $this->expectException(EpsHttpException::class);
        try {
            self::fast($t)->call('initiate-refund', ['initiator_id' => '9962981729', 'tid' => '1', 'otp' => '1']);
        } finally {
            $this->assertCount(1, $t->requests);
        }
    }

    public function testAutoStatusCheckOff(): void
    {
        $t = self::transport([self::http(500)]);
        $this->expectException(EpsHttpException::class);
        try {
            self::fast($t, ['autoStatusCheck' => false])->call('dmt-initiate-transfer', self::TRANSFER);
        } finally {
            $this->assertCount(1, $t->requests);
        }
    }

    public function testRejectsBadRetryKnobsAtConstruction(): void
    {
        foreach ([['retries' => -1], ['retryBaseDelay' => -1.0], ['retryBaseDelay' => NAN]] as $bad) {
            try {
                self::fast(null, $bad);
                $this->fail('expected InvalidArgumentException');
            } catch (\InvalidArgumentException $e) {
                $this->assertStringStartsWith('Invalid retr', $e->getMessage());
            }
        }
    }

    // ── value validation ───────────────────────────────────────────────────────

    public function testRejectsBadFormatAndSendsNothing(): void
    {
        $t = self::transport([[200, self::OK]]);
        try {
            self::fast($t)->call('pan-lite', ['dob' => '01-01-1990'] + self::PAN);
            $this->fail('expected InvalidArgumentException');
        } catch (\InvalidArgumentException $e) {
            $this->assertSame('Invalid param values for "pan-lite": dob (expected format date).', $e->getMessage());
            $this->assertSame([], $t->requests);
        }
    }

    public function testListsEveryOffenderInSurfaceOrder(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid param values for "pan-lite": pan_number (expected format pan), dob (expected format date).');
        self::fast(null)->resolveTarget('pan-lite', ['pan_number' => 'bad', 'dob' => '1990-1-1'] + self::PAN);
    }

    public function testWholeStringMatchRejectsTrailingNewline(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/dob \(expected format date\)/');
        self::fast(null)->resolveTarget('pan-lite', ['dob' => "1990-01-01\n"] + self::PAN);
    }

    public function testUnconstrainedParamPasses(): void
    {
        $t = self::transport([[200, self::OK]]);
        self::fast($t)->call('pan-lite', ['name' => "anything at all \n"] + self::PAN);
        $this->assertCount(1, $t->requests);
    }

    public function testValueProblemHelper(): void
    {
        $formats = ['date' => '~^\d{4}-\d{2}-\d{2}$~D'];
        $check = fn ($value, array $p) => EpsClient::valueProblem($p + ['name' => 'x', 'type' => 'string'], $value, $formats);
        $this->assertNull($check('1', ['enum' => [1, 2]]));
        $this->assertSame('not one of: 1, 2', $check(3, ['enum' => [1, 2]]));
        $this->assertNull($check('1', ['type' => 'number', 'min' => 1, 'max' => 5]));
        $this->assertNull($check(5, ['type' => 'number', 'min' => 1, 'max' => 5]));
        $this->assertSame('below min 1', $check(0.5, ['type' => 'number', 'min' => 1]));
        $this->assertSame('above max 5', $check('6', ['type' => 'number', 'max' => 5]));
        $this->assertNull($check('abc', ['maxLength' => 3]));
        $this->assertSame('longer than 3 bytes', $check('é€', ['maxLength' => 3]));
        $this->assertSame('not one of: a', $check('b', ['enum' => ['a'], 'format' => 'date']));
        $this->assertSame('expected format date', $check('x', ['format' => 'date', 'maxLength' => 1]));
        $this->assertNull($check(['a' => 1], ['type' => 'object', 'maxLength' => 1]));
    }
}
