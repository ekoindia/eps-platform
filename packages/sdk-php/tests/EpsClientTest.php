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
