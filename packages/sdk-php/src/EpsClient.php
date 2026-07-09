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
        // Client-level defaults for the near-constant common params; injected
        // into every call and overridable per call via the `params` array.
        private ?string $initiatorId = null,
        private ?string $userCode = null,
        // Test-only clock injection (not part of the public surface).
        private $now = null
    ) {
        $this->now = $this->now ?? fn () => (int) round(microtime(true) * 1000);
        // data/sdk-surface.json is a baked, shipped asset. A missing or invalid
        // file means the package was built/published incorrectly — fail with a
        // clear message instead of a downstream typed-property TypeError.
        $surfacePath = __DIR__ . '/../data/sdk-surface.json';
        $raw = @file_get_contents($surfacePath);
        if ($raw === false) {
            throw new \RuntimeException("EPS SDK surface not found at $surfacePath. The package is built incorrectly (run `npm run build` to bake it).");
        }
        $surface = json_decode($raw, true);
        if (!is_array($surface) || !isset($surface['environments'])) {
            throw new \RuntimeException("EPS SDK surface at $surfacePath is invalid or corrupt.");
        }
        $this->surface = $surface;
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
     * Generate a unique client_ref_id using PHP's random_bytes().
     * Produces a 32-character lowercase hex string.
     */
    private static function generateClientRefId(): string
    {
        return bin2hex(random_bytes(16));
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
            case 'file':
                // A CURLFile, or a path to an existing readable file.
                return $value instanceof \CURLFile || (is_string($value) && is_file($value));
            default:
                return true; // unknown/unsupported spec type → not enforced
        }
    }

    public function buildHeaders(bool $multipart = false): array
    {
        $timestamp = (string) ($this->now)();
        $headers = [
            'developer_key' => $this->developerKey,
            'secret-key' => self::signSecretKey($this->accessKey, $timestamp),
            'secret-key-timestamp' => $timestamp,
        ];
        // Multipart: no explicit content-type — cURL sets it (with the
        // generated boundary) when CURLOPT_POSTFIELDS is an array.
        if (!$multipart) $headers['content-type'] = 'application/json';
        return $headers;
    }

    /**
     * Resolve a slug + params into the wire target: the final URL (path tokens
     * filled, query string appended for GET) and the body — a JSON string for
     * regular non-GET endpoints, or an array (multipart/form-data with CURLFile
     * values) for file-upload endpoints. Exposed for testing; `call()` builds
     * on it.
     *
     * @return array{url: string, body: string|array|null, method: string, multipart: bool}
     */
    public function resolveTarget(string $slug, array $params = []): array
    {
        $endpoint = null;
        foreach ($this->surface['endpoints'] as $e) if ($e['slug'] === $slug) { $endpoint = $e; break; }
        if ($endpoint === null) throw new \InvalidArgumentException("Unknown endpoint slug: $slug");

        // Client-level defaults (initiator_id, user_code) are injected first; an
        // explicit per-call value overrides because $params wins the merge.
        $defaults = array_filter([
            'initiator_id' => $this->initiatorId,
            'user_code' => $this->userCode,
        ], fn ($v) => $v !== null);
        $params = array_merge($defaults, $params);

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

        // A `type:"file"` param flips the whole request to multipart/form-data.
        $fileParams = [];
        foreach ($endpoint['params'] as $p) {
            if ($p['type'] === 'file') $fileParams[$p['name']] = true;
        }
        $multipart = !empty($fileParams);

        // Path params (e.g. {customer_id}) fill the URL; the rest become the
        // query string on GET, an array body (multipart) when the endpoint has
        // file uploads, or the JSON body on every other method.
        $path = $endpoint['path'];
        $rest = [];
        foreach ($params as $k => $v) {
            $token = '{' . $k . '}';
            if (str_contains($path, $token)) $path = str_replace($token, rawurlencode((string) $v), $path);
            else $rest[$k] = $v;
        }

        // Auto-inject client_ref_id for non-GET requests when the caller has
        // not supplied one. This gives every mutating request a unique
        // idempotency key without requiring the caller to think about it.
        if ($endpoint['method'] !== 'GET' && !isset($rest['client_ref_id'])) {
            $rest['client_ref_id'] = self::generateClientRefId();
        }

        $url = $this->baseUrl . $path;
        $body = null;
        if ($endpoint['method'] === 'GET') {
            if (!empty($rest)) $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($rest);
        } elseif ($multipart) {
            // Array body → cURL sends multipart/form-data with its own boundary.
            // File params accept a CURLFile or a path string (wrapped here);
            // arrays become JSON-string fields; null values are omitted (a form
            // field has no null encoding).
            $body = [];
            foreach ($rest as $k => $v) {
                if ($v === null) continue;
                if (isset($fileParams[$k])) $body[$k] = $v instanceof \CURLFile ? $v : new \CURLFile((string) $v);
                elseif (is_array($v)) $body[$k] = json_encode($v);
                else $body[$k] = (string) $v;
            }
        } else {
            $body = json_encode($rest);
        }
        return ['url' => $url, 'body' => $body, 'method' => $endpoint['method'], 'multipart' => $multipart];
    }

    public function call(string $slug, array $params = []): array
    {
        $target = $this->resolveTarget($slug, $params);
        $ch = curl_init($target['url']);
        $headers = $this->buildHeaders($target['multipart']);
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
