<?php
use PHPUnit\Framework\TestCase;
use Eko\Eps\EpsClient;
use Eko\Eps\EpsDebug;
use Eko\Eps\EpsIndeterminateException;
use Eko\Eps\EpsTransportException;

/**
 * Debug mode, against the fixtures of "Debug mode conformance" in
 * docs/sdk-golden-vector.md (a port of packages/sdk-js/src/debug.test.ts).
 */
final class EpsDebugTest extends TestCase
{
    private const DEV = 'abcd1234wxyz';
    private const ACCESS = 'TEST_ACCESS_KEY_DO_NOT_USE';
    private const NOW = 1700000000000;
    /** signSecretKey(ACCESS, NOW): the golden vector. */
    private const SECRET = 'u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=';
    private const SECRETS = [
        self::DEV, self::SECRET, '123456789012', '9876543210', '000111222333',
        '654321', 'k@x.in', 'john@example.com', 'Kumar', 'KUMAR_123456789012',
    ];
    private const PAN_LITE = ['pan_number' => 'ABCDE1234F', 'name' => 'Kumar', 'dob' => '1990-01-01'];
    private const TRANSFER = [
        'recipient_id' => 1,
        'amount' => 100,
        'customer_id' => '9876543210',
        'otp' => '4321',
        'otp_ref_id' => 'ref1',
        'client_ref_id' => 'ref123',
    ];

    private string|false $savedEnv = false;

    protected function setUp(): void
    {
        $this->savedEnv = getenv('EPS_SDK_DEBUG');
        putenv('EPS_SDK_DEBUG');
    }

    protected function tearDown(): void
    {
        putenv($this->savedEnv === false ? 'EPS_SDK_DEBUG' : 'EPS_SDK_DEBUG=' . $this->savedEnv);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** A transport that plays `$replies` in order (the last one repeats); counts calls. */
    private static function transportOf(array ...$replies): object
    {
        return new class($replies) {
            public int $calls = 0;
            public function __construct(private array $replies) {}
            public function __invoke(array $target, array $options): array
            {
                $reply = $this->replies[min($this->calls++, count($this->replies) - 1)];
                if ($reply[0] instanceof \Throwable) throw $reply[0];
                return $reply;
            }
        };
    }

    private static function ok(array $extra = []): array
    {
        return [200, json_encode(['status' => 0, 'response_status_id' => 0] + $extra)];
    }

    /** @return array{0: EpsClient, 1: \ArrayObject} the client and the events its callback sink received */
    private static function make(object $transport, array $opts = []): array
    {
        $events = new \ArrayObject();
        $client = new EpsClient(self::DEV, self::ACCESS, 'sandbox', ...array_merge([
            'initiatorId' => '9962981729',
            'retryBaseDelay' => 0.0,
            'now' => fn () => self::NOW,
            'transport' => $transport,
            'debug' => function (array $event) use ($events): void { $events->append($event); },
        ], $opts));
        return [$client, $events];
    }

    private static function ofType(\ArrayObject $events, string $type): array
    {
        return array_values(array_filter($events->getArrayCopy(), fn ($e) => $e['event'] === $type));
    }

    private function assertNoSecrets(string $all): void
    {
        foreach (self::SECRETS as $secret) $this->assertStringNotContainsString($secret, $all, $secret);
    }

    /**
     * Run one bbps-operator-code-circle call in a child PHP process (the text
     * sink writes to the real STDERR) and return [stdout, stderr].
     */
    private static function child(string $debugOption, ?string $env): array
    {
        $script = sys_get_temp_dir() . '/eps-debug-' . bin2hex(random_bytes(4)) . '.php';
        $src = var_export(dirname(__DIR__) . '/src/', true);
        file_put_contents($script, <<<PHP
        <?php
        spl_autoload_register(function (\$c) { \$f = $src . basename(str_replace('\\\\', '/', \$c)) . '.php'; if (is_file(\$f)) require \$f; });
        \$client = new Eko\Eps\EpsClient('abcd1234wxyz', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox',
            initiatorId: '9962981729', now: fn () => 1700000000000,
            transport: fn () => [200, '{"status":0,"response_status_id":0}'], debug: $debugOption);
        \$client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        PHP);
        $vars = getenv();
        unset($vars['EPS_SDK_DEBUG']);
        if ($env !== null) $vars['EPS_SDK_DEBUG'] = $env;
        $proc = proc_open([PHP_BINARY, $script], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $vars);
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($proc);
        unlink($script);
        return [$out, $err];
    }

    // ── Switch ─────────────────────────────────────────────────────────────────

    public function testOffByDefaultWritesNothing(): void
    {
        [$out, $err] = self::child('null', null);
        $this->assertSame('', $out);
        $this->assertSame('', $err);
    }

    public function testEnvVarWritesOneJsonObjectPerLineToStderr(): void
    {
        [$out, $err] = self::child('null', ' TRUE ');
        $this->assertSame('', $out);
        $lines = explode("\n", $err);
        $this->assertSame('', array_pop($lines)); // every event ends with "\n"
        $this->assertCount(3, $lines); // init, request, response
        foreach ($lines as $line) {
            $this->assertStringStartsWith('{"logger":"eps-sdk"', $line);
            $this->assertIsArray(json_decode($line, true));
        }
        $init = json_decode($lines[0], true);
        $this->assertSame('init', $init['event']);
        $this->assertSame('env', $init['source']);
        $this->assertSame('****wxyz', $init['developer_key']);
        $this->assertSame('sandbox', $init['env']);
        $this->assertSame('php', $init['sdk']);
        $this->assertSame(30000, $init['timeout_ms']);
        $this->assertSame(2, $init['retries']);
        $this->assertTrue($init['auto_status_check']);
        $this->assertSame('php ' . PHP_VERSION, $init['runtime']);
        $this->assertIsString($init['sdk_version']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/', $init['ts']);
        $this->assertNoSecrets($err);
    }

    public function testExplicitFalseBeatsTheEnvVar(): void
    {
        [$out, $err] = self::child('false', '1');
        $this->assertSame('', $out . $err);
    }

    public function testExplicitSinkBeatsTheEnvVar(): void
    {
        putenv('EPS_SDK_DEBUG=1');
        [, $events] = self::make(self::transportOf(self::ok()));
        $this->assertSame('option', $events[0]['source']);
    }

    public function testRejectsADebugOptionOfTheWrongType(): void
    {
        $this->expectException(\TypeError::class);
        new EpsClient(self::DEV, self::ACCESS, 'sandbox', debug: []);
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    public function testMasksTheGetUrlAndHeadersInKeyOrder(): void
    {
        [$client, $events] = self::make(self::transportOf(self::ok()));
        $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        $this->assertSame(['init', 'request', 'response'], array_column($events->getArrayCopy(), 'event'));
        [, $request, $response] = $events->getArrayCopy();
        $this->assertSame(
            ['logger', 'ts', 'event', 'sdk', 'sdk_version', 'surface', 'env', 'call_id', 'slug'],
            array_slice(array_keys($request), 0, 9)
        );
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $request['call_id']);
        $this->assertSame($request['call_id'], $response['call_id']);
        $this->assertSame(
            'https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210/operator?initiator_id=****1729',
            $request['url']
        );
        $this->assertSame([
            'developer_key' => '****wxyz',
            'secret-key' => '****',
            'secret-key-timestamp' => (string) self::NOW,
            'content-type' => 'application/json',
        ], $request['headers']);
        $this->assertNull($request['body']);
        $this->assertSame(200, $response['status']);
        $this->assertSame(['status' => 0, 'response_status_id' => 0], $response['body']);
        $this->assertIsInt($response['ms']);
        $this->assertNoSecrets(json_encode($events->getArrayCopy()));
    }

    public function testMasksAJsonBodyAndResponseByKeyClass(): void
    {
        $response = [
            'message' => 'sent to k@x.in, ref 9876543210',
            'data' => [
                'tid' => '2611230001',
                'name' => 'Kumar',
                'email' => 'k@x.in',
                'dob' => '1990-01-01',
                'photo' => str_repeat('A', 5000),
                'reference_id' => '123456789012',
                'john@example.com' => 'x',
                '123456789012' => 'y',
            ],
            'otp_code' => ['reference_id' => 'r1'],
            'foo' => [['tid' => 't1']],
        ];
        [$client, $events] = self::make(self::transportOf(self::ok($response)));
        $client->call('pan-lite', self::PAN_LITE + [
            'AADHAR' => '123456789012',
            'otp_code' => '654321',
            'otp' => '7777', // 4 chars: asserted by field, not by the byte scan
            'foo_bar' => 'x',
            'entries' => [['reference_id' => 'r1', 'bank_account' => '000111222333', 'ifsc' => 'SBIN0000001']],
        ]);
        $body = self::ofType($events, 'request')[0]['body'];
        foreach ([
            'pan_number' => '****234F', 'name' => '****', 'dob' => '****', 'AADHAR' => '****9012',
            'otp_code' => '****', 'otp' => '****', 'foo_bar' => '****', 'initiator_id' => '****1729',
        ] as $key => $expected) {
            $this->assertSame($expected, $body[$key], $key);
        }
        $this->assertSame([['reference_id' => 'r1', 'bank_account' => '****2333', 'ifsc' => 'SBIN0000001']], $body['entries']);
        $this->assertMatchesRegularExpression('/^[0-9a-z]{15}$/', $body['client_ref_id']); // generated, safe
        $out = self::ofType($events, 'response')[0]['body'];
        $this->assertSame('sent to ****@****, ref ****3210', $out['message']);
        $this->assertEquals([
            'tid' => '2611230001',
            'name' => '****',
            'email' => '****',
            'dob' => '****',
            'photo' => '****',
            'reference_id' => '****', // a request secret echoed under a safe key
            '#1' => '****',
            '#2' => '****',
        ], $out['data']);
        $this->assertSame('****', $out['otp_code']);
        $this->assertSame('****', $out['foo']);
        $this->assertNoSecrets(json_encode($events->getArrayCopy()));
    }

    public function testMasksAClientRefIdThatFailsTheFormat(): void
    {
        [$client, $events] = self::make(self::transportOf(self::ok(['data' => ['client_ref_id' => 'KUMAR 123456789012']])));
        $client->call('bbps-fetch-bill', [
            'phone_operator_code' => '1',
            'utility_acc_no' => '000111222333',
            'confirmation_mobile_no' => '9876543210',
            'sender_name' => 'Kumar',
            'category' => 1,
            'client_ref_id' => 'KUMAR 123456789012',
            'source_ip' => '10.0.0.1',
        ]);
        $url = self::ofType($events, 'request')[0]['url'];
        $this->assertStringContainsString('client_ref_id=****&', $url);
        $this->assertStringContainsString('utility_acc_no=****2333', $url);
        $this->assertStringContainsString('phone_operator_code=1', $url);
        $this->assertSame('****', self::ofType($events, 'response')[0]['body']['data']['client_ref_id']);
        $all = json_encode($events->getArrayCopy());
        $this->assertNoSecrets($all);
        $this->assertStringNotContainsString('123456789012', $all);
    }

    public function testScrubsAndCapsANonJsonErrorPage(): void
    {
        $page = '<html><title>502 Bad Gateway</title>' . str_repeat('x', 600) . ' 123456789012 ' . rawurlencode('Kumar Abhi') . ' ' . self::DEV . '</html>';
        $echoFirst = '<html>123456789012 Kumar%20Abhi ' . self::DEV . '</html>';
        [$client, $events] = self::make(self::transportOf([502, $echoFirst . $page]));
        try {
            $client->call('pan-lite', ['name' => 'Kumar Abhi', 'AADHAR' => '123456789012'] + self::PAN_LITE);
            $this->fail('expected EpsHttpException');
        } catch (\Eko\Eps\EpsHttpException $e) {
            $this->assertStringContainsString('HTTP 502', $e->getMessage());
        }
        $response = self::ofType($events, 'response')[0];
        $this->assertSame(502, $response['status']);
        $this->assertMatchesRegularExpression('/^<html>\*\*\*\*9012 \*\*\*\* \*\*\*\*<\/html>/', $response['body']);
        $this->assertMatchesRegularExpression('/…\(\+\d+ chars\)$/u', $response['body']);
        preg_match_all('/./us', preg_replace('/…\(\+\d+ chars\)$/u', '', $response['body']), $m);
        $this->assertCount(512, $m[0]);
        $this->assertSame('EpsHttpException', self::ofType($events, 'error')[0]['error']);
        $this->assertNoSecrets(json_encode($events->getArrayCopy()));
    }

    public function testLogsAMultipartBodyAsMaskedFieldsPlusFileMetadata(): void
    {
        $dir = sys_get_temp_dir() . '/eps-debug-' . bin2hex(random_bytes(4));
        mkdir($dir);
        $pan = "$dir/KUMAR_123456789012.JPG";
        $front = "$dir/front-upload";
        $back = "$dir/back-upload";
        file_put_contents($pan, '12345');
        file_put_contents($front, 'abc');
        file_put_contents($back, 'abcd');
        try {
            [$client, $events] = self::make(self::transportOf(self::ok()));
            $client->call('activate-aeps-fingpay', [
                'user_code' => '20810200',
                'modelname' => 'MANTRA',
                'devicenumber' => 'D1',
                'account' => '000111222333',
                'ifsc' => 'SBIN0000001',
                'shop_type' => '1',
                'office_address' => ['line' => 'Kumar House'],
                'address_as_per_proof' => ['line' => 'Kumar House'],
                'aadhar' => '123456789012',
                'pan_card' => $pan,
                'aadhar_front' => new \CURLFile($front, null, 'front.PNG'),
                'aadhar_back' => new \CURLFile($back),
                'latlong' => '28.6,77.2',
            ]);
            $request = self::ofType($events, 'request')[0];
            $this->assertStringContainsString('/admin/network/agent/20810200/aeps-fingpay/activate', $request['url']);
            foreach (['account' => '****2333', 'aadhar' => '****9012', 'modelname' => 'MANTRA', 'office_address' => '****', 'latlong' => '****'] as $key => $expected) {
                $this->assertSame($expected, $request['body']['fields'][$key], $key);
            }
            $this->assertEquals([
                ['param' => 'pan_card', 'ext' => 'jpg', 'bytes' => 5],
                ['param' => 'aadhar_front', 'ext' => 'png', 'bytes' => 3],
                ['param' => 'aadhar_back', 'ext' => null, 'bytes' => 4],
            ], $request['body']['files']);
            $this->assertNoSecrets(json_encode($events->getArrayCopy()));
        } finally {
            array_map('unlink', [$pan, $front, $back]);
            rmdir($dir);
        }
    }

    public function testLogsAPreSendFailureAsASingleErrorEvent(): void
    {
        $transport = self::transportOf(self::ok());
        [$client, $events] = self::make($transport);
        foreach ([['no-such-slug', [], '/Unknown endpoint/'], ['pan-lite', ['name' => 'Kumar'], '/Missing/']] as [$slug, $params, $pattern]) {
            try {
                $client->call($slug, $params);
                $this->fail('expected InvalidArgumentException');
            } catch (\InvalidArgumentException $e) {
                $this->assertMatchesRegularExpression($pattern, $e->getMessage());
            }
        }
        $this->assertSame(['init', 'error', 'error'], array_column($events->getArrayCopy(), 'event'));
        $this->assertSame('InvalidArgumentException', $events[1]['error']);
        $this->assertSame('no-such-slug', $events[1]['slug']);
        $this->assertSame(0, $transport->calls);
    }

    public function testLogsATransportFailureThenTheError(): void
    {
        [$client, $events] = self::make(
            self::transportOf([new EpsTransportException('fetch failed for ' . self::DEV . ' 9876543210')]),
            ['retries' => 0]
        );
        try {
            $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
            $this->fail('expected EpsTransportException');
        } catch (EpsTransportException) {
        }
        $this->assertSame(['init', 'request', 'transport_error', 'error'], array_column($events->getArrayCopy(), 'event'));
        $failure = self::ofType($events, 'transport_error')[0];
        $this->assertSame(1, $failure['attempt']);
        $this->assertSame('EpsTransportException', $failure['error']);
        $this->assertSame('fetch failed for **** ****3210', $failure['message']);
        $this->assertIsInt($failure['ms']);
        $this->assertNoSecrets(json_encode($events->getArrayCopy()));
    }

    public function testLogsEachRetryWithItsDelay(): void
    {
        [$client, $events] = self::make(self::transportOf([503, 'busy'], self::ok()), ['retries' => 1]);
        $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        $this->assertSame(
            [['init', null], ['request', 1], ['response', 1], ['retry', 1], ['request', 2], ['response', 2]],
            array_map(fn ($e) => [$e['event'], $e['attempt'] ?? null], $events->getArrayCopy())
        );
        $this->assertSame(0, self::ofType($events, 'retry')[0]['delay_ms']);
    }

    public function testLogsTheStatusCheckInquiryUnderItsOwnCallId(): void
    {
        [$client, $events] = self::make(self::transportOf([503, 'busy'], self::ok(['data' => ['tx_status' => 0]])));
        try {
            $client->call('dmt-initiate-transfer', self::TRANSFER);
            $this->fail('expected EpsIndeterminateException');
        } catch (EpsIndeterminateException) {
        }
        $this->assertSame(
            ['dmt-initiate-transfer', 'transaction-inquiry'],
            array_column(self::ofType($events, 'request'), 'slug')
        );
        $errors = self::ofType($events, 'error');
        $last = end($errors);
        $this->assertSame('EpsIndeterminateException', $last['error']);
        $this->assertSame('ref123', $last['client_ref_id']);
        $ids = array_unique(array_filter(array_column($events->getArrayCopy(), 'call_id')));
        $this->assertCount(2, $ids);
    }

    public function testBoundsDeepAndHugeBodies(): void
    {
        $deep = 'leaf';
        for ($i = 0; $i < 12; $i++) $deep = ['data' => $deep];
        [$client, $events] = self::make(self::transportOf(self::ok($deep)));
        $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        $body = json_encode(self::ofType($events, 'response')[0]['body']);
        $this->assertStringContainsString('"****"', $body);
        $this->assertStringNotContainsString('leaf', $body);

        $big = ['data' => array_map(fn ($i) => ['tid' => str_pad("t$i", 50, '0')], range(0, 2999))];
        [$client, $events] = self::make(self::transportOf(self::ok($big)));
        $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        $this->assertMatchesRegularExpression('/^\[\d+ bytes omitted\]$/', self::ofType($events, 'response')[0]['body']);
    }

    public function testAnEmptyDeveloperKeyIsNeverAKnownValue(): void
    {
        $events = new \ArrayObject();
        $client = new EpsClient('', self::ACCESS, 'sandbox', initiatorId: '9962981729', now: fn () => self::NOW,
            transport: self::transportOf(self::ok(['data' => ['tid' => '2611230001']])),
            debug: function (array $event) use ($events): void { $events->append($event); });
        $client->call('bbps-operator-code-circle', ['customer_mobile' => '9876543210']);
        $this->assertSame('2611230001', self::ofType($events, 'response')[0]['body']['data']['tid']);
    }

    // ── Isolation ──────────────────────────────────────────────────────────────

    /** The call's outcome and request count under one `debug` option. */
    private static function outcome(bool|\Closure $debug, object $transport, string $slug, array $params): array
    {
        $client = new EpsClient(self::DEV, self::ACCESS, 'sandbox',
            initiatorId: '9962981729', retryBaseDelay: 0.0, now: fn () => self::NOW,
            transport: $transport, debug: $debug);
        try {
            return ['value' => $client->call($slug, $params), 'calls' => $transport->calls];
        } catch (\Throwable $e) {
            return [
                'error' => [get_class($e), $e->getMessage(), $e instanceof EpsIndeterminateException ? $e->statusCheck : null],
                'calls' => $transport->calls,
            ];
        }
    }

    public function testAThrowingSinkLeavesTheOutcomeUnchanged(): void
    {
        // Throwing on `init` too would leave debug off for the call, so the
        // second sink spares it to exercise every per-call emit point.
        $sinks = [
            'every event' => function (array $event): void { throw new \RuntimeException('sink exploded'); },
            'every event after init' => function (array $event): void {
                if ($event['event'] !== 'init') throw new \RuntimeException('sink exploded');
            },
        ];
        $cases = [
            'a validation failure' => fn () => [self::transportOf(self::ok()), 'pan-lite', ['name' => 'x']],
            'a successful financial call' => fn () => [self::transportOf(self::ok(['data' => ['tid' => '1']])), 'dmt-initiate-transfer', self::TRANSFER],
            'an indeterminate financial call' => fn () => [
                self::transportOf([503, 'busy'], self::ok(['data' => ['tx_status' => 0]])),
                'dmt-initiate-transfer',
                self::TRANSFER,
            ],
            'a retried GET' => fn () => [
                self::transportOf([503, 'busy'], self::ok()),
                'bbps-operator-code-circle',
                ['customer_mobile' => '9876543210'],
            ],
        ];
        foreach ($cases as $name => $setup) {
            $off = self::outcome(false, ...$setup());
            foreach ($sinks as $sinkName => $sink) {
                $this->assertEquals($off, self::outcome($sink, ...$setup()), "$name, sink throwing on $sinkName");
            }
        }
    }

    // ── URL alignment ──────────────────────────────────────────────────────────

    private static function url(string $url): string
    {
        $debug = EpsDebug::create(
            fn () => null, 'sandbox', 'https://h/v3',
            [
                'redact' => ['safe' => ['tid', 'user_code'], 'last4' => ['customer_id'], 'text' => [], 'nest' => []],
                'endpoints' => [['slug' => 'x', 'path' => '/x/{customer_id}/y']],
            ],
            null, self::DEV, 30000, 2, true
        );
        $changed = [];
        return (new \ReflectionMethod(EpsDebug::class, 'url'))->invokeArgs($debug, [$url, '/x/{customer_id}/y', [], &$changed]);
    }

    public function testUrlMasksPathParamsAndQueryValuesByClass(): void
    {
        $this->assertSame('https://h/v3/x/****3210/y?tid=1&#1=****', self::url('https://h/v3/x/9876543210/y?tid=1&k%40x=2'));
    }

    public function testUrlKeepsAnEncodedSlashInsideItsSegment(): void
    {
        $this->assertSame('https://h/v3/x/****3210/y', self::url('https://h/v3/x/98765%2F43210/y'));
    }

    public function testUrlMasksASafeQueryValueThatIsNotSafeShaped(): void
    {
        $this->assertSame('https://h/v3/x/****/y?tid=****', self::url('https://h/v3/x/1/y?tid=KUMAR%20123456789012'));
    }

    public function testUrlFailsClosedOnAMismatch(): void
    {
        foreach ([
            'another base' => 'https://evil/v3/x/1/y',
            'a different literal segment' => 'https://h/v3/z/1/y',
            'an extra segment' => 'https://h/v3/x/1/y/z',
            'a malformed escape' => 'https://h/v3/x/%E0%A4%A/y',
        ] as $name => $url) {
            $this->assertSame('[unavailable]', self::url($url), $name);
        }
    }
}
