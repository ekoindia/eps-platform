<?php
namespace Eko\Eps;

/**
 * Debug mode: opt-in, masked diagnostics a developer can share with Eko
 * support. Normative contract: "Debug mode conformance" in
 * docs/sdk-golden-vector.md; a port of packages/sdk-js/src/debug.ts.
 *
 * Everything here is best-effort and isolated: a failure while building,
 * masking or delivering an event is swallowed, so debug can never change a
 * call's outcome. Masking is fail-closed: only keys the surface classifies
 * print anything but `****`.
 *
 * One class plays two roles so PSR-4 autoloading needs one file: the instance
 * EpsClient holds emits `init`; `trace()` returns a clone carrying one call's
 * state (call id, slug, the values later text is scrubbed of).
 *
 * @internal Not part of the public API. Switch it on with EpsClient's `debug:`
 *     option or the env var `EPS_SDK_DEBUG`.
 */
final class EpsDebug
{
    private const MASK = '****';
    private const UNAVAILABLE = '[unavailable]';
    private const SAFE_SHAPE = '/^[A-Za-z0-9_.:\-]{0,64}$/D';
    private const KEY_SHAPE = '/^[a-z][a-z0-9_]{0,39}$/D';
    private const LAST4_URL = '/^\*\*\*\*[A-Za-z0-9]{4}$/D';
    private const EXT_SHAPE = '/^[a-z0-9]{1,5}$/D';
    private const EMAIL = '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/';
    private const PAN = '/[A-Z]{5}[0-9]{4}[A-Z]/';
    private const DIGITS = '/[0-9]{6,}/';
    private const MAX_DEPTH = 8;
    private const MAX_EVENT_BYTES = 65536;
    private const TEXT_CAP = 1024;
    private const SAFE_TEXT_CAP = 256;
    private const BODY_TEXT_CAP = 512;
    private const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR;

    /** @var array<string, string> lowercased key → class (later lists win, so `last4` beats all). */
    private array $classes = [];
    /** @var array<string, string> slug → path template */
    private array $templates = [];
    /** @var array<string, mixed> sdk, sdk_version, surface, env */
    private array $common;
    /** @var array{call_id: string, slug: string}|null set on a trace only */
    private ?array $call = null;
    /** @var list<string> values later text is scrubbed of */
    private array $known = [];
    /** hrtime(true) when the current attempt was sent. */
    private int $started = 0;

    /**
     * Resolve the `debug` option against `EPS_SDK_DEBUG` (an explicit option
     * wins, then the env var, else off) and start debug. Null when off, or when
     * setting it up fails: debug must never break a client.
     *
     * @param array<string, mixed> $surface the baked surface (redact, endpoints, bundleVersion)
     * @param ?string $clientRef the compiled `client-ref` format regex, if any
     */
    public static function create(
        bool|\Closure|null $option,
        string $env,
        string $baseUrl,
        array $surface,
        ?string $clientRef,
        string $developerKey,
        int $timeoutMs,
        int $retries,
        bool $autoStatusCheck
    ): ?self {
        try {
            if ($option === false) return null;
            if ($option === null) {
                $flag = getenv('EPS_SDK_DEBUG');
                $flag = is_string($flag) ? strtolower(trim($flag)) : '';
                if ($flag !== '1' && $flag !== 'true') return null;
            }
            $debug = new self(
                $option instanceof \Closure ? $option : null,
                $baseUrl,
                $surface,
                $clientRef,
                $developerKey,
                $env
            );
            $debug->emit('init', [
                'base_url' => $baseUrl,
                'runtime' => 'php ' . PHP_VERSION,
                'developer_key' => self::last4($developerKey),
                'timeout_ms' => $timeoutMs,
                'retries' => $retries,
                'auto_status_check' => $autoStatusCheck,
                'source' => $option === null ? 'env' : 'option',
            ]);
            return $debug;
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param ?\Closure $sink a callback sink, or null for the default text sink */
    private function __construct(
        private ?\Closure $sink,
        private string $baseUrl,
        array $surface,
        private ?string $clientRef,
        private string $developerKey,
        string $env
    ) {
        foreach (['nest', 'text', 'safe', 'last4'] as $cls) {
            foreach ($surface['redact'][$cls] ?? [] as $key) $this->classes[strtolower((string) $key)] = $cls;
        }
        foreach ($surface['endpoints'] ?? [] as $e) $this->templates[$e['slug']] = $e['path'];
        $this->common = [
            'sdk' => 'php',
            'sdk_version' => self::sdkVersion(),
            'surface' => $surface['bundleVersion'] ?? null,
            'env' => $env,
        ];
    }

    /** Package version from Composer's metadata, else "unknown". */
    private static function sdkVersion(): string
    {
        try {
            if (class_exists(\Composer\InstalledVersions::class)
                && \Composer\InstalledVersions::isInstalled('ekoindia/eps-sdk')) {
                return \Composer\InstalledVersions::getPrettyVersion('ekoindia/eps-sdk') ?? 'unknown';
            }
        } catch (\Throwable) {
            // fall through
        }
        return 'unknown';
    }

    /** Start tracing one `call()`: a clone with its own call id; null if even that fails. */
    public function trace(string $slug): ?self
    {
        try {
            $trace = clone $this;
            $trace->call = ['call_id' => bin2hex(random_bytes(4)), 'slug' => $slug];
            $trace->known = self::nonEmpty([$this->developerKey]);
            return $trace;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Mask and log the request as sent; remember its values for later scrubs.
     *
     * @param list<string> $headerLines CURLOPT_HTTPHEADER, `name: value` each
     * @param string|array|null $body JSON string, multipart array, or null (GET)
     */
    public function request(int $attempt, string $method, string $url, array $headerLines, mixed $body): void
    {
        try {
            $this->started = hrtime(true);
            $headers = [];
            foreach ($headerLines as $line) {
                $parts = explode(': ', (string) $line, 2);
                $headers[$parts[0]] = $parts[1] ?? '';
            }
            $secret = null;
            foreach ($headers as $name => $value) {
                if (strtolower((string) $name) === 'secret-key') $secret = $value;
            }
            $base = self::nonEmpty([$this->developerKey, $secret]);
            $changed = [];
            $maskedUrl = $this->url($url, $this->templates[$this->call['slug'] ?? ''] ?? null, $base, $changed);
            $maskedBody = null;
            if (is_array($body)) {
                $fields = $body[EpsClient::MULTIPART_JSON_FIELD] ?? null;
                $maskedBody = [
                    'fields' => is_string($fields) ? $this->root(self::decode($fields), $base, $changed) : null,
                    'files' => self::files($body),
                ];
            } elseif (is_string($body)) {
                $maskedBody = $this->root(self::decode($body), $base, $changed);
            }
            $this->known = array_merge($base, $changed);
            $this->emit('request', [
                'attempt' => $attempt,
                'method' => $method,
                'url' => $maskedUrl,
                'headers' => $this->headers($headers),
                'body' => $maskedBody,
            ]);
        } catch (\Throwable) {
            // isolated
        }
    }

    /** Log one HTTP response (any status). Untyped inputs: they come from the transport. */
    public function response(int $attempt, mixed $status, mixed $raw): void
    {
        try {
            $body = null;
            if (is_string($raw)) {
                try {
                    $body = $this->root(self::decode($raw), $this->known);
                } catch (\Throwable) {
                    $body = $this->text($raw, self::BODY_TEXT_CAP, $this->known);
                }
            }
            $this->emit('response', ['attempt' => $attempt, 'status' => $status, 'ms' => $this->elapsed(), 'body' => $body]);
        } catch (\Throwable) {
            // isolated
        }
    }

    /** Log an attempt that produced no usable response. */
    public function transportError(int $attempt, \Throwable $e, ?int $status = null): void
    {
        try {
            $fields = [
                'attempt' => $attempt,
                'ms' => $this->elapsed(),
                'error' => self::errorName($e),
                'message' => $this->text($e->getMessage(), self::TEXT_CAP, $this->known),
            ];
            if ($status !== null) $fields['status'] = $status;
            $this->emit('transport_error', $fields);
        } catch (\Throwable) {
            // isolated
        }
    }

    /** Log a retry, before its backoff sleep. */
    public function retry(int $attempt, int $delayMs): void
    {
        $this->emit('retry', ['attempt' => $attempt, 'delay_ms' => $delayMs]);
    }

    /** Log the exception `call()` is about to throw, with its masked ref / tid. */
    public function error(\Throwable $e): void
    {
        try {
            $fields = [
                'error' => self::errorName($e),
                'message' => $this->text($e->getMessage(), self::TEXT_CAP, $this->known),
            ];
            if ($e instanceof EpsIndeterminateException) {
                if ($e->clientRefId !== null) $fields['client_ref_id'] = $this->mask($e->clientRefId, 'safe', 'client_ref_id', $this->known);
                if ($e->tid !== null) $fields['tid'] = $this->mask($e->tid, 'safe', 'tid', $this->known);
            }
            $this->emit('error', $fields);
        } catch (\Throwable) {
            // isolated
        }
    }

    /** Build, bound, serialize and deliver one event; never throws. */
    private function emit(string $event, array $fields): void
    {
        try {
            $ts = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
            $out = ['logger' => 'eps-sdk', 'ts' => $ts, 'event' => $event] + $this->common + ($this->call ?? []) + $fields;
            $line = json_encode($out, self::JSON_FLAGS);
            if (strlen($line) > self::MAX_EVENT_BYTES && array_key_exists('body', $out)) {
                $out['body'] = '[' . strlen($line) . ' bytes omitted]';
                $line = json_encode($out, self::JSON_FLAGS);
            }
            if ($this->sink !== null) {
                // A freshly built associative array: exactly what the text sink would print.
                ($this->sink)(json_decode($line, true, 512, JSON_THROW_ON_ERROR));
            } elseif (PHP_SAPI === 'cli' && defined('STDERR')) {
                fwrite(STDERR, $line . "\n");
            } else {
                error_log($line);
            }
        } catch (\Throwable) {
            // Debug output must never affect the call.
        }
    }

    // ── Masker ───────────────────────────────────────────────────────────────

    private function classOf(string $key): string
    {
        return $this->classes[strtolower($key)] ?? 'default';
    }

    /** A key name prints when it is classified or looks like a field name. */
    private function printable(string $key): bool
    {
        return isset($this->classes[strtolower($key)]) || preg_match(self::KEY_SHAPE, $key) === 1;
    }

    /** Class of a child key: an unprintable name is always `default`. */
    private function childClass(string $key, string $parent): string
    {
        if (!$this->printable($key)) return 'default';
        return $parent === 'text' ? 'text' : $this->classOf($key);
    }

    /** Mask a whole JSON document (request or response body) from the root. */
    private function root(mixed $value, array $known, ?array &$changed = null): mixed
    {
        return $this->mask($value, 'nest', null, $known, $changed);
    }

    /**
     * Mask `$value` held under `$key` of class `$cls`. JSON objects arrive as
     * \stdClass (and leave as one, so `{}` stays `{}`), arrays as lists. Every
     * request scalar the masker changes is pushed to `$changed` (when given) so
     * later text can be scrubbed of it.
     */
    private function mask(mixed $value, string $cls, ?string $key, array $known, ?array &$changed = null, int $depth = 0): mixed
    {
        if ($value === null || is_bool($value)) return $value;
        if (is_array($value) || is_object($value)) {
            $walk = $cls === 'nest' || $cls === 'safe' || $cls === 'text';
            if (!$walk || $depth >= self::MAX_DEPTH) {
                if ($changed !== null) self::collectAll($value, $changed);
                return self::MASK;
            }
            if (is_array($value)) {
                $out = [];
                foreach ($value as $v) $out[] = $this->mask($v, $cls, $key, $known, $changed, $depth + 1);
                return $out;
            }
            $out = new \stdClass();
            $unnamed = 0;
            foreach ($value as $k => $v) {
                $k = (string) $k;
                $name = $this->printable($k) ? $k : '#' . ++$unnamed;
                $out->{$name} = $this->mask($v, $this->childClass($k, $cls), $k, $known, $changed, $depth + 1);
            }
            return $out;
        }
        $s = self::wire($value);
        $masked = $this->scalar($value, $s, $cls, $key, $known);
        if ($changed !== null && $masked !== $value && count(self::codePoints($s)) >= 4) $changed[] = $s;
        return $masked;
    }

    private function scalar(mixed $value, string $s, string $cls, ?string $key, array $known): mixed
    {
        switch ($cls) {
            case 'last4':
                return self::last4($s);
            case 'safe':
                if ($key !== null && strtolower($key) === 'client_ref_id'
                    && $this->clientRef !== null && preg_match($this->clientRef, $s) !== 1) {
                    return self::MASK;
                }
                if (preg_match(self::SAFE_SHAPE, $s) === 1) {
                    foreach ($known as $k) if (str_contains($s, $k)) return self::MASK;
                    return $value;
                }
                return $this->text($s, self::SAFE_TEXT_CAP, $known);
            case 'text':
            case 'nest':
                return $this->text($s, self::TEXT_CAP, $known);
            default:
                return self::MASK;
        }
    }

    /** Every scalar under a masked-whole value is a known value too. */
    private static function collectAll(mixed $value, array &$out): void
    {
        if (is_array($value) || is_object($value)) {
            foreach ($value as $v) self::collectAll($v, $out);
            return;
        }
        if ($value === null || is_bool($value)) return;
        $s = self::wire($value);
        if (count(self::codePoints($s)) >= 4) $out[] = $s;
    }

    /**
     * Text scrub: digit runs first (so a short known value cannot match inside a
     * longer number and leave its ends visible), then known values and their
     * percent-encoded forms, PAN shapes and e-mails, then a code-point cap.
     * Byte-oriented patterns (no `u`), so invalid UTF-8 cannot fail a scrub.
     */
    private function text(string $s, int $cap, array $known): string
    {
        $out = preg_replace_callback(
            self::DIGITS,
            fn (array $m) => strlen($m[0]) >= 9 ? self::MASK . substr($m[0], -4) : self::MASK,
            $s
        ) ?? throw new \RuntimeException('scrub failed');
        usort($known, fn (string $a, string $b) => strlen($b) <=> strlen($a));
        foreach ($known as $k) {
            $out = str_replace($k, self::MASK, $out);
            // rawurlencode = encodeURIComponent's form; urlencode = the `+` form
            // http_build_query puts in this SDK's own GET query strings.
            foreach ([rawurlencode($k), urlencode($k)] as $encoded) {
                if ($encoded !== $k) $out = str_replace($encoded, self::MASK, $out);
            }
        }
        $out = preg_replace(self::PAN, self::MASK, $out) ?? throw new \RuntimeException('scrub failed');
        $out = preg_replace(self::EMAIL, self::MASK . '@' . self::MASK, $out) ?? throw new \RuntimeException('scrub failed');
        $cps = self::codePoints($out);
        return count($cps) > $cap
            ? implode('', array_slice($cps, 0, $cap)) . '…(+' . (count($cps) - $cap) . ' chars)'
            : $out;
    }

    /** Headers: an allowlist, matched case-insensitively. */
    private function headers(array $headers): array
    {
        $out = [];
        foreach ($headers as $name => $value) {
            $lower = strtolower((string) $name);
            $out[$name] = $lower === 'secret-key-timestamp' || $lower === 'content-type'
                ? $value
                : ($lower === 'developer_key' ? self::last4((string) $value) : self::MASK);
        }
        return $out;
    }

    /**
     * The URL actually sent, masked by the endpoint's path template. Any
     * mismatch with the base URL or the template fails closed.
     */
    private function url(string $url, ?string $template, array $known, array &$changed): string
    {
        try {
            if ($template === null || !str_starts_with($url, $this->baseUrl)) return self::UNAVAILABLE;
            $rest = substr($url, strlen($this->baseUrl));
            $q = strpos($rest, '?');
            $path = $q === false ? $rest : substr($rest, 0, $q);
            $query = $q === false ? '' : substr($rest, $q + 1);
            $tSegs = explode('/', $template);
            $pSegs = explode('/', $path);
            if (count($tSegs) !== count($pSegs)) return self::UNAVAILABLE;
            $segs = [];
            foreach ($tSegs as $i => $t) {
                if (preg_match('/^\{([^}]+)\}$/D', $t, $m) !== 1) {
                    if ($t !== $pSegs[$i]) return self::UNAVAILABLE;
                    $segs[] = $t;
                } else {
                    $segs[] = $this->urlValue($m[1], self::decodeUri($pSegs[$i], false), $pSegs[$i], $known, $changed);
                }
            }
            $pairs = [];
            $unnamed = 0;
            foreach (explode('&', $query) as $pair) {
                if ($pair === '') continue;
                $eq = strpos($pair, '=');
                $rawKey = $eq === false ? $pair : substr($pair, 0, $eq);
                $rawValue = $eq === false ? '' : substr($pair, $eq + 1);
                $k = self::decodeUri($rawKey, true);
                $named = $this->printable($k);
                $value = $this->urlValue($named ? $k : null, self::decodeUri($rawValue, true), $rawValue, $known, $changed);
                $pairs[] = ($named ? $rawKey : '#' . ++$unnamed) . '=' . $value;
            }
            return $this->baseUrl . implode('/', $segs) . ($pairs ? '?' . implode('&', $pairs) : '');
        } catch (\Throwable) {
            return self::UNAVAILABLE;
        }
    }

    private function urlValue(?string $key, string $decoded, string $raw, array $known, array &$changed): string
    {
        $cls = $key === null ? 'default' : $this->classOf($key);
        $masked = $this->mask($decoded, $cls, $key, $known, $changed);
        if ($masked === $decoded) return $raw;
        $s = (string) $masked;
        return $cls === 'last4' && preg_match(self::LAST4_URL, $s) === 1 ? $s : self::MASK;
    }

    /**
     * Percent-decode as strictly as JS decodeURIComponent: a malformed escape or
     * a result that is not UTF-8 throws. `$form` also turns `+` into a space.
     */
    private static function decodeUri(string $s, bool $form): string
    {
        if (preg_match('/%(?![0-9A-Fa-f]{2})/', $s) === 1) throw new \UnexpectedValueException('malformed escape');
        $decoded = $form ? urldecode($s) : rawurldecode($s);
        if (preg_match('//u', $decoded) !== 1) throw new \UnexpectedValueException('not UTF-8');
        return $decoded;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Multipart file metadata from the CURLFile values already in hand: param,
     * tidy extension of the upload name, and a warning-free stat (never a read).
     */
    private static function files(array $body): array
    {
        $files = [];
        foreach ($body as $param => $value) {
            if (!$value instanceof \CURLFile) continue;
            $path = $value->getFilename();
            $name = $value->getPostFilename() ?: $path;
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $size = is_file($path) ? @filesize($path) : false;
            $files[] = [
                'param' => (string) $param,
                'ext' => preg_match(self::EXT_SHAPE, $ext) === 1 ? $ext : null,
                'bytes' => $size === false ? null : $size,
            ];
        }
        return $files;
    }

    /** JSON decode keeping objects as \stdClass and big integers' digits; throws on invalid JSON. */
    private static function decode(string $raw): mixed
    {
        return json_decode($raw, false, 512, JSON_BIGINT_AS_STRING | JSON_THROW_ON_ERROR);
    }

    /** A scalar's wire string, as JS String() prints it (no trailing ".0"). */
    private static function wire(mixed $value): string
    {
        if (is_float($value) && is_finite($value) && floor($value) === $value && abs($value) < 1e15) {
            return (string) (int) $value;
        }
        return (string) $value;
    }

    /** `****` for 8 code points or fewer, else `****` + the last 4. */
    private static function last4(string $s): string
    {
        $cps = self::codePoints($s);
        return count($cps) <= 8 ? self::MASK : self::MASK . implode('', array_slice($cps, -4));
    }

    /** Code points without mbstring; bytes when the string is not valid UTF-8. */
    private static function codePoints(string $s): array
    {
        return preg_match_all('/./us', $s, $m) === false ? str_split($s) : $m[0];
    }

    /** @return list<string> the non-empty strings among `$values` (an empty known value would match everywhere). */
    private static function nonEmpty(array $values): array
    {
        return array_values(array_filter($values, fn ($v) => is_string($v) && $v !== ''));
    }

    private static function errorName(\Throwable $e): string
    {
        return (new \ReflectionClass($e))->getShortName();
    }

    private function elapsed(): int
    {
        return (int) round((hrtime(true) - $this->started) / 1e6);
    }
}
