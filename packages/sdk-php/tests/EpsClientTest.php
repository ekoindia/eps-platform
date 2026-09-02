<?php
use PHPUnit\Framework\TestCase;
use Eko\Eps\EpsClient;
use Eko\Eps\EpsException;
use Eko\Eps\EpsHttpException;

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
}
