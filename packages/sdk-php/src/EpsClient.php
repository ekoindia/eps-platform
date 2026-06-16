<?php
namespace Eko\Eps;

/** Backend-only EPS client. Never expose access_key in a frontend. */
final class EpsClient
{
    private array $surface;
    private string $baseUrl;

    public function __construct(
        private string $developerKey,
        private string $accessKey,
        string $environment,
        private $now = null
    ) {
        $this->now = $this->now ?? fn () => (int) round(microtime(true) * 1000);
        $this->surface = json_decode(file_get_contents(__DIR__ . '/../data/sdk-surface.json'), true);
        foreach ($this->surface['environments'] as $env) {
            if ($env['id'] === $environment) { $this->baseUrl = $env['baseUrl']; break; }
        }
        if (!isset($this->baseUrl)) throw new \InvalidArgumentException("Unknown environment: $environment");
    }

    /** secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))). */
    public static function signSecretKey(string $accessKey, string $timestamp): string
    {
        $encodedKey = base64_encode($accessKey);
        return base64_encode(hash_hmac('sha256', $timestamp, $encodedKey, true));
    }

    public function buildHeaders(): array
    {
        $timestamp = (string) ($this->now)();
        return [
            'developer_key' => $this->developerKey,
            'secret-key' => self::signSecretKey($this->accessKey, $timestamp),
            'secret-key-timestamp' => $timestamp,
            'content-type' => 'application/json',
        ];
    }

    public function call(string $slug, array $params = []): array
    {
        $endpoint = null;
        foreach ($this->surface['endpoints'] as $e) if ($e['slug'] === $slug) { $endpoint = $e; break; }
        if ($endpoint === null) throw new \InvalidArgumentException("Unknown endpoint slug: $slug");

        $path = $endpoint['path'];
        $body = [];
        foreach ($params as $k => $v) {
            $token = '{' . $k . '}';
            if (str_contains($path, $token)) $path = str_replace($token, rawurlencode((string) $v), $path);
            else $body[$k] = $v;
        }
        $ch = curl_init($this->baseUrl . $path);
        $headers = $this->buildHeaders();
        $headerLines = array_map(fn ($k, $v) => "$k: $v", array_keys($headers), $headers);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $endpoint['method'],
            CURLOPT_HTTPHEADER => $headerLines,
        ]);
        if ($endpoint['method'] !== 'GET') curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $res = curl_exec($ch);
        curl_close($ch);
        return json_decode($res, true) ?? [];
    }
}
