<?php
namespace Eko\Eps;

/**
 * A non-GET call on a money-moving endpoint ended without a confirmed outcome
 * (timeout, transport failure, HTTP 429 or 5xx, or a 2xx that was not an EPS envelope).
 * Inquiry key: the call's `client_ref_id`, or — on an endpoint that has none,
 * such as `initiate-refund` — the `tid` it acted on (then `$tid` is set and
 * `$clientRefId` is null). Only `tx_status` 4 (refunded) confirms the refund; 3
 * (refund pending) is also the state before a refund is requested, so it settles
 * nothing. The SDK never re-sends such a
 * request — that is how a customer gets debited twice — so it inquired by the
 * call's `client_ref_id` instead and reports what it found. `$statusCheck` is
 * the Transaction Inquiry envelope (`data.tx_status`: 0 success, 1 fail,
 * 2 awaited, …) or null when the inquiry itself failed, in which case
 * `$statusCheckError` says why. The original failure is `getPrevious()`.
 * Reconcile with the ref before retrying; never assume a timeout meant failure.
 */
final class EpsIndeterminateException extends EpsException
{
    /** HTTP status of the original attempt (a 2xx when its body was not an EPS envelope), or null for a transport failure. */
    public readonly ?int $status;

    public function __construct(
        public readonly string $slug,
        /** The call's ref, or null on an endpoint without one (see `$tid`). */
        public readonly ?string $clientRefId,
        \Throwable $cause,
        public readonly ?array $statusCheck,
        public readonly ?\Throwable $statusCheckError,
        /** The `tid` inquired by when there was no ref, else null. */
        public readonly ?string $tid = null
    ) {
        $subject = $clientRefId !== null
            ? "with client_ref_id \"$clientRefId\""
            : ($tid !== null ? "on tid \"$tid\"" : 'without a client_ref_id or tid');
        parent::__construct("EPS request for \"$slug\" $subject has no confirmed outcome.", 0, $cause);
        $this->status = $cause instanceof EpsHttpException || $cause instanceof EpsInvalidResponseException
            ? $cause->status
            : null;
    }
}
