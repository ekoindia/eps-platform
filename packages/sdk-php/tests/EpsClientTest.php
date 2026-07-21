<?php
use PHPUnit\Framework\TestCase;
use Eko\Eps\EpsClient;

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

    public function testMultipartEndpointBuildsArrayBodyWithCurlFiles(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', now: fn () => 1700000000000);
        $address = ['line' => 'Shop 5', 'city' => 'Patna', 'state' => 'Bihar', 'pincode' => '800001'];
        $target = $client->resolveTarget('activate-aeps-fingpay', [
            'initiator_id' => '9962981729',
            'user_code' => '20810200',
            'modelname' => 'Morpho 1300E3',
            'devicenumber' => 'SN1234567890',
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
        // Array fields become JSON-string form fields.
        $this->assertSame(json_encode($address), $target['body']['office_address']);
        $this->assertSame('Morpho 1300E3', $target['body']['modelname']);
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
}
