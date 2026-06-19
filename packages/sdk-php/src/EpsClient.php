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

    /**
     * Lenient, coercion-aware type check against a spec type. Only present
     * values are checked. Unknown types pass. The wire sends everything as
     * strings, so numeric/boolean strings are accepted.
     */
    private static function matchesType(string $type, $value): bool
    {
        switch ($type) {
            case 'string':
                return is_string($value) || is_int($value) || is_float($value);
            case 'number':
                return is_int($value) || is_float($value)
                    || (is_string($value) && preg_match('/^-?\d+(\.\d+)?$/', $value) === 1);
            case 'integer':
                return is_int($value)
                    || (is_string($value) && preg_match('/^-?\d+$/', $value) === 1);
            case 'boolean':
                return is_bool($value) || $value === 'true' || $value === 'false';
            default:
                return true; // unknown/unsupported spec type → not enforced
        }
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

    /**
     * Resolve a slug + params into the wire target: the final URL (path tokens
     * filled, query string appended for GET) and the JSON body (non-GET only).
     * Exposed for testing; `call()` builds on it.
     *
     * @return array{url: string, body: ?string}
     */
    public function resolveTarget(string $slug, array $params = []): array
    {
        $endpoint = null;
        foreach ($this->surface['endpoints'] as $e) if ($e['slug'] === $slug) { $endpoint = $e; break; }
        if ($endpoint === null) throw new \InvalidArgumentException("Unknown endpoint slug: $slug");

        // Spec-driven guard: every requiredParam (from the API spec, baked into the
        // surface) must be present and non-null before we sign and send.
        $missing = array_values(array_filter(
            $endpoint['requiredParams'],
            fn ($p) => !isset($params[$p])
        ));
        if (!empty($missing)) {
            throw new \InvalidArgumentException(
                "Missing required params for \"$slug\": " . implode(', ', $missing) . '.'
            );
        }

        // Type guard: every provided param known to the spec must match its type.
        // Unknown params (not in the surface) pass through untouched.
        $badTypes = [];
        foreach ($endpoint['params'] as $p) {
            $name = $p['name'];
            if (!isset($params[$name])) continue;
            if (!self::matchesType($p['type'], $params[$name])) {
                $badTypes[] = "$name (expected {$p['type']})";
            }
        }
        if (!empty($badTypes)) {
            throw new \InvalidArgumentException(
                "Invalid param types for \"$slug\": " . implode(', ', $badTypes) . '.'
            );
        }

        // Path params (e.g. {customer_id}) fill the URL; the rest become the
        // query string on GET, or the JSON body on every other method.
        $path = $endpoint['path'];
        $rest = [];
        foreach ($params as $k => $v) {
            $token = '{' . $k . '}';
            if (str_contains($path, $token)) $path = str_replace($token, rawurlencode((string) $v), $path);
            else $rest[$k] = $v;
        }
        $url = $this->baseUrl . $path;
        $body = null;
        if ($endpoint['method'] === 'GET') {
            if (!empty($rest)) $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($rest);
        } else {
            $body = json_encode($rest);
        }
        return ['url' => $url, 'body' => $body, 'method' => $endpoint['method']];
    }

    public function call(string $slug, array $params = []): array
    {
        $target = $this->resolveTarget($slug, $params);
        $ch = curl_init($target['url']);
        $headers = $this->buildHeaders();
        $headerLines = array_map(fn ($k, $v) => "$k: $v", array_keys($headers), $headers);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $target['method'],
            CURLOPT_HTTPHEADER => $headerLines,
        ]);
        if ($target['body'] !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $target['body']);
        $res = curl_exec($ch);
        curl_close($ch);
        return json_decode($res, true) ?? [];
    }
}
