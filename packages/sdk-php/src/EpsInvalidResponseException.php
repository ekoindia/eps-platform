<?php
namespace Eko\Eps;

/**
 * A 2xx response whose body is not a JSON object (empty, truncated, an HTML
 * error page from a proxy). EPS may well have processed the request, so this is
 * indeterminate, not decisive: a `financial` call gets the status inquiry and a
 * `retrySafe` one is retried. Still an EpsException, so existing catches hold.
 */
final class EpsInvalidResponseException extends EpsException
{
    public function __construct(
        public readonly int $status,
        public readonly string $url,
        public readonly string $raw
    ) {
        parent::__construct("EPS response from $url was not valid JSON.");
    }
}
