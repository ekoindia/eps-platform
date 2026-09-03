<?php
namespace Eko\Eps;

/** Backend-only EPS client. Never expose access_key in a frontend. */
final class EpsClient
{
    /**
     * Name of the single form field carrying every non-file value as one JSON
     * object. Eko's upload APIs do not take a form field per parameter. Mirrors
     * `MULTIPART_JSON_FIELD` in the website's `src/lib/data/api-specs-common.ts`.
     */
    public const MULTIPART_JSON_FIELD = 'form-data';

    /** Generic status-check endpoint, keyed by TID or `client_ref_id:<ref>`. */
    private const INQUIRY_SLUG = 'transaction-inquiry';
    /** Backoff cap in milliseconds. */
    private const MAX_RETRY_DELAY_MS = 2000;
    /** Spec types whose values are scalars the value checks can stringify. */
    private const SCALAR_TYPES = ['string', 'number', 'integer', 'boolean'];

    private array $surface;
    private string $baseUrl;
    /** @var array<string, string> format name → delimited PCRE, compiled at construction. */
    private array $formats = [];

    public function __construct(
        private string $developerKey,
        private string $accessKey,
        string $environment,
        // Client-level defaults for the near-constant common params; injected
        // into every call and overridable per call via the `params` array.
        private ?string $initiatorId = null,
        private ?string $userCode = null,
        // Per-attempt budget in SECONDS, matching Python's `timeout=30.0`.
        // Node names its knob `timeoutMs` because it is milliseconds there.
        private float $timeout = 30.0,
        // Extra attempts for a GET whose outcome was indeterminate (timeout,
        // transport failure, HTTP 429/5xx). Non-GET calls are never retried.
        private int $retries = 2,
        // Backoff base in seconds: attempt n waits a random slice of
        // min(base × 2^(n-1), 2s). 0 retries immediately (tests).
        private float $retryBaseDelay = 0.2,
        // After an indeterminate failure on a `financial` endpoint, look the
        // transaction up by its client_ref_id and surface the result on
        // EpsIndeterminateException::$statusCheck.
        private bool $autoStatusCheck = true,
        // Test-only clock injection (not part of the public surface).
        private $now = null,
        // Test-only transport injection: fn(array $target, array $curlOptions):
        // array{0: int, 1: string} (status, raw), or throws EpsTransportException.
        private $transport = null
    ) {
        if (!is_finite($this->timeout) || $this->timeout <= 0) {
            throw new \InvalidArgumentException("Invalid timeout: " . var_export($this->timeout, true) . ". Expected a positive number of seconds.");
        }
        if ($this->retries < 0) {
            throw new \InvalidArgumentException("Invalid retries: {$this->retries}. Expected a non-negative integer.");
        }
        if (!is_finite($this->retryBaseDelay) || $this->retryBaseDelay < 0) {
            throw new \InvalidArgumentException("Invalid retryBaseDelay: " . var_export($this->retryBaseDelay, true) . ". Expected a non-negative number of seconds.");
        }
        $this->now = $this->now ?? fn () => (int) round(microtime(true) * 1000);
        // data/sdk-surface.json is a baked, shipped asset. A missing or invalid
        // file means the package was built/published incorrectly — fail with a
        // clear message instead of a downstream typed-property TypeError.
        $surfacePath = __DIR__ . '/../data/sdk-surface.json';
        $raw = @file_get_contents($surfacePath);
        if ($raw === false) {
            throw new EpsException("EPS SDK surface not found at $surfacePath. The package is built incorrectly (run `npm run build` to bake it).");
        }
        $surface = json_decode($raw, true);
        if (!is_array($surface) || !isset($surface['environments'])) {
            throw new EpsException("EPS SDK surface at $surfacePath is invalid or corrupt.");
        }
        $this->surface = $surface;
        // Compiled once. A pattern that does not compile is corrupt package
        // data — fail here, loudly, rather than silently skipping a validation.
        // The `D` modifier makes `$` the true end of the string, so a trailing
        // newline cannot slip past (PCRE's default `$` allows one).
        foreach ($surface['formats'] ?? [] as $name => $pattern) {
            $regex = '~' . str_replace('~', '\\~', $pattern) . '~D';
            if (@preg_match($regex, '') === false) {
                throw new EpsException("EPS SDK surface at $surfacePath is invalid or corrupt: format \"$name\" does not compile.");
            }
            $this->formats[$name] = $regex;
        }
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
            case 'file':
                // A CURLFile, or a path to an existing readable file.
                return $value instanceof \CURLFile || (is_string($value) && is_file($value));
            default:
                return true; // unknown/unsupported spec type → not enforced
        }
    }

    /**
     * Stringify a value the way JavaScript's String() does, so every SDK checks
     * the same bytes: lowercase booleans, no trailing ".0" on whole floats.
     */
    private static function wireString($value): string
    {
        if (is_bool($value)) return $value ? 'true' : 'false';
        if ($value === null) return 'null';
        if (is_float($value) && is_finite($value) && floor($value) === $value) return (string) (int) $value;
        return (string) $value;
    }

    /**
     * Value check after the type check: enum → format → min/max → maxLength,
     * on the wire string so `5` and `"5"` behave alike. Returns the first
     * problem as the reason text, or null. Formats are syntactic regexes from
     * the surface, matched whole-string. `maxLength` counts UTF-8 bytes — the
     * one length every language agrees on without mbstring.
     *
     * @param array<string, string> $formats format name → delimited PCRE
     */
    public static function valueProblem(array $p, $value, array $formats): ?string
    {
        if (!in_array($p['type'] ?? '', self::SCALAR_TYPES, true)) return null;
        $wire = self::wireString($value);
        if (isset($p['enum'])) {
            $allowed = array_map([self::class, 'wireString'], $p['enum']);
            if (!in_array($wire, $allowed, true)) return 'not one of: ' . implode(', ', $allowed);
        }
        if (isset($p['format']) && isset($formats[$p['format']])
            && preg_match($formats[$p['format']], $wire) !== 1) {
            return "expected format {$p['format']}";
        }
        if (isset($p['min']) || isset($p['max'])) {
            $n = (float) $wire;
            if (isset($p['min']) && $n < $p['min']) return 'below min ' . self::wireString($p['min']);
            if (isset($p['max']) && $n > $p['max']) return 'above max ' . self::wireString($p['max']);
        }
        if (isset($p['maxLength']) && strlen($wire) > $p['maxLength']) {
            return "longer than {$p['maxLength']} bytes";
        }
        return null;
    }

    /**
     * client_ref_id for a non-GET call that did not supply one: base36
     * millisecond stamp (sortable, greppable against a log line) plus 7 random
     * base36 chars, exactly 15 of `[0-9a-z]`. Under EPS's 20-char limit with
     * ~7.8e10 distinct tails per millisecond, so concurrent processes cannot
     * collide in practice. Same shape in every SDK — see docs/sdk-golden-vector.md.
     */
    public static function generateClientRefId(int $nowMs): string
    {
        $tail = str_pad(base_convert((string) random_int(0, 36 ** 7 - 1), 10, 36), 7, '0', STR_PAD_LEFT);
        return substr(base_convert((string) $nowMs, 10, 36) . $tail, -15);
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
     * regular non-GET endpoints, or an array (multipart/form-data: one
     * `form-data` JSON field plus CURLFile values) for file-upload endpoints.
     * Exposed for testing; `call()` builds on it.
     *
     * @return array{url: string, body: string|array|null, method: string, multipart: bool, slug: string, financial: bool, clientRefId: ?string, initiatorId: mixed}
     * @throws \InvalidArgumentException On an unknown slug, a missing required param, a type mismatch or a bad value.
     * @throws \JsonException When a multipart endpoint's non-file params cannot be JSON-encoded.
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

        // Every non-GET call carries a client_ref_id — the key a partner reconciles
        // a lost response by. Generated only when the endpoint declares the param
        // and the caller sent none (absent or null); a supplied value, even "",
        // is theirs to own. Done before the required-param guard so a generated
        // ref satisfies endpoints that require one.
        $declaresRef = $endpoint['method'] !== 'GET'
            && in_array('client_ref_id', array_column($endpoint['params'], 'name'), true);
        if ($declaresRef && !isset($params['client_ref_id'])) {
            $params['client_ref_id'] = self::generateClientRefId(($this->now)());
        }
        $clientRefId = $declaresRef ? self::wireString($params['client_ref_id']) : null;

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

        // Value guard: enum / format / min / max / maxLength from the spec, on the
        // same provided params. Syntactic only — the server still owns semantics.
        $badValues = [];
        foreach ($endpoint['params'] as $p) {
            if (!isset($params[$p['name']])) continue;
            $reason = self::valueProblem($p, $params[$p['name']], $this->formats);
            if ($reason !== null) $badValues[] = "{$p['name']} ($reason)";
        }
        if (!empty($badValues)) {
            throw new \InvalidArgumentException(
                "Invalid param values for \"$slug\": " . implode(', ', $badValues) . '.'
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
        $url = $this->baseUrl . $path;
        $body = null;
        if ($endpoint['method'] === 'GET') {
            if (!empty($rest)) $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($rest);
        } elseif ($multipart) {
            // Array body → cURL sends multipart/form-data with its own boundary.
            // Every non-file value rides in ONE `form-data` field as JSON; file
            // params accept a CURLFile or a path string (wrapped here). Top-level
            // nulls are dropped (a form field has no null encoding); nulls nested
            // inside an array value survive json_encode.
            $payload = [];
            $uploads = [];
            foreach ($rest as $k => $v) {
                if ($v === null) continue;
                if (isset($fileParams[$k])) $uploads[$k] = $v instanceof \CURLFile ? $v : new \CURLFile((string) $v);
                else $payload[$k] = $v;
            }
            // Envelope first, then the uploads — the order the API documents.
            // JSON_THROW_ON_ERROR: a silent false here would blank the whole
            // non-file payload and the request would fail far from its cause.
            $body = [self::MULTIPART_JSON_FIELD => json_encode($payload, JSON_THROW_ON_ERROR)] + $uploads;
        } else {
            $body = json_encode($rest);
        }
        return [
            'url' => $url,
            'body' => $body,
            'method' => $endpoint['method'],
            'multipart' => $multipart,
            'slug' => $slug,
            'financial' => (bool) ($endpoint['financial'] ?? false),
            'clientRefId' => $clientRefId,
            'initiatorId' => $params['initiator_id'] ?? null,
        ];
    }

    /**
     * cURL options for one resolved target. Exposed for testing; `call()` builds
     * on it — the timeout wiring is otherwise unreachable from a unit test.
     *
     * CURLOPT_TIMEOUT_MS, not CURLOPT_TIMEOUT: the latter takes whole seconds
     * and would silently truncate a sub-second budget to 0 (= no timeout).
     */
    public function curlOptions(array $target): array
    {
        $headers = $this->buildHeaders($target['multipart']);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $target['method'],
            CURLOPT_HTTPHEADER => array_map(fn ($k, $v) => "$k: $v", array_keys($headers), $headers),
            CURLOPT_TIMEOUT_MS => (int) round($this->timeout * 1000),
        ];
        if ($target['body'] !== null) $options[CURLOPT_POSTFIELDS] = $target['body'];
        return $options;
    }

    /**
     * Turn one raw response into the envelope callers expect. Exposed for
     * testing; `call()` builds on it. PHP has no injectable transport, so this
     * pure function is the seam for the response contract shared by all five
     * SDKs (see docs/sdk-golden-vector.md).
     *
     * ponytail: the `array` return type cannot represent a valid JSON scalar or
     * `null`, so those are reported as "not valid JSON". EPS always returns an
     * object envelope; widen to `mixed` if that ever stops being true.
     *
     * @throws EpsHttpException On any non-2xx response.
     * @throws EpsException When a 2xx body is not a JSON object — never a silent [].
     */
    public static function decodeResponse(int $status, string $url, string $raw): array
    {
        $decoded = json_decode($raw, true);
        $body = is_array($decoded) ? $decoded : null;
        if ($status < 200 || $status >= 300) {
            throw new EpsHttpException($status, $url, $body, $raw);
        }
        if ($body === null) {
            throw new EpsException("EPS response from $url was not valid JSON.");
        }
        return $body;
    }

    /**
     * Sign and send one endpoint call, returning the decoded response envelope.
     *
     * Validates first (throws, nothing sent), then sends. A GET whose outcome is
     * indeterminate is retried; a non-GET never is — on a `financial` endpoint
     * it is followed by a Transaction Inquiry on its `client_ref_id` and thrown
     * as EpsIndeterminateException. See docs/sdk-golden-vector.md.
     *
     * @throws \InvalidArgumentException On an unknown slug, a missing required param, a type mismatch or a bad value.
     * @throws \JsonException When a multipart endpoint's non-file params cannot be JSON-encoded.
     * @throws EpsIndeterminateException When a financial non-GET call has no confirmed outcome.
     * @throws EpsHttpException On any other non-2xx response (the envelope is on `$body`).
     * @throws EpsTransportException On a transport failure that was not retried.
     * @throws EpsException On a 2xx body that is not JSON.
     */
    public function call(string $slug, array $params = []): array
    {
        $target = $this->resolveTarget($slug, $params);
        $attempts = $target['method'] === 'GET' ? $this->retries + 1 : 1;
        for ($attempt = 1; ; $attempt++) {
            try {
                return $this->send($target);
            } catch (EpsException $e) {
                if (!self::isIndeterminate($e)) throw $e;
                if ($attempt < $attempts) {
                    $this->backoff($attempt);
                    continue;
                }
                // Never re-send a non-GET: that is how a customer is debited twice.
                // Ask EPS what happened to the ref instead, if there is one to ask by.
                if ($this->autoStatusCheck && $target['financial'] && $target['clientRefId'] !== null) {
                    throw $this->indeterminate($target, $e);
                }
                throw $e;
            }
        }
    }

    /**
     * True when the outcome is unknown: no response, or a 429/5xx that says
     * nothing about whether the request was processed. A 4xx is a decisive no.
     */
    private static function isIndeterminate(EpsException $e): bool
    {
        if ($e instanceof EpsHttpException) return $e->status === 429 || $e->status >= 500;
        return $e instanceof EpsTransportException;
    }

    /** Attempt n sleeps a random slice of min(base × 2^(n-1), 2s) — full jitter. */
    private function backoff(int $attempt): void
    {
        $capMs = (int) min($this->retryBaseDelay * 1000 * 2 ** ($attempt - 1), self::MAX_RETRY_DELAY_MS);
        $delayMs = $capMs > 0 ? random_int(0, $capMs) : 0;
        if ($delayMs > 0) usleep($delayMs * 1000);
    }

    /**
     * One inquiry by `client_ref_id:<ref>`; its own failure is reported, never
     * allowed to mask the original one.
     */
    private function indeterminate(array $target, \Throwable $cause): EpsIndeterminateException
    {
        $statusCheck = null;
        $statusCheckError = null;
        $params = ['transaction-reference' => 'client_ref_id:' . $target['clientRefId']];
        if ($target['initiatorId'] !== null) $params['initiator_id'] = $target['initiatorId'];
        try {
            $statusCheck = $this->call(self::INQUIRY_SLUG, $params);
        } catch (\Throwable $e) {
            $statusCheckError = $e;
        }
        return new EpsIndeterminateException($target['slug'], $target['clientRefId'], $cause, $statusCheck, $statusCheckError);
    }

    /**
     * Sign (fresh timestamp, via curlOptions) and send one attempt; decode per
     * the contract. The injected `$transport`, when present, stands in for cURL.
     */
    private function send(array $target): array
    {
        $options = $this->curlOptions($target);
        if ($this->transport !== null) {
            [$status, $raw] = ($this->transport)($target, $options);
            return self::decodeResponse($status, $target['url'], $raw);
        }
        $ch = curl_init($target['url']);
        curl_setopt_array($ch, $options);
        $res = curl_exec($ch);
        // Read the status and the error BEFORE closing the handle.
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($res === false) {
            throw new EpsTransportException("EPS request to {$target['url']} failed: $curlError");
        }
        return self::decodeResponse($status, $target['url'], $res);
    }
}
