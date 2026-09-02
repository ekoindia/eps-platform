<?php
namespace Eko\Eps;

/**
 * Non-2xx response from EPS. The decoded envelope is kept on `$body` so callers
 * can inspect it, but this is THROWN rather than returned: an auth or
 * infrastructure failure must never be mistaken for a successful call.
 */
final class EpsHttpException extends EpsException
{
    public function __construct(
        public readonly int $status,
        public readonly string $url,
        public readonly ?array $body,
        public readonly string $raw
    ) {
        parent::__construct("EPS request to $url failed with HTTP $status.");
    }
}
