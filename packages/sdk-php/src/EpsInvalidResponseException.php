<?php
namespace Eko\Eps;

/**
 * A 2xx response whose body is not an EPS envelope — a JSON object with a
 * numeric `status` (empty, truncated, an HTML error page from a proxy, valid
 * JSON such as `null` / `[]`, or an object such as `{}` / a proxy's error). EPS may well have processed the request, so this is
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
