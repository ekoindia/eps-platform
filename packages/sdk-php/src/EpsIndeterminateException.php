<?php
namespace Eko\Eps;

/**
 * A non-GET call on a money-moving endpoint ended without a confirmed outcome
 * (timeout, transport failure, HTTP 429 or 5xx). The SDK never re-sends such a
 * request — that is how a customer gets debited twice — so it inquired by the
 * call's `client_ref_id` instead and reports what it found. `$statusCheck` is
 * the Transaction Inquiry envelope (`data.tx_status`: 0 success, 1 fail,
 * 2 awaited, …) or null when the inquiry itself failed, in which case
 * `$statusCheckError` says why. The original failure is `getPrevious()`.
 * Reconcile with the ref before retrying; never assume a timeout meant failure.
 */
final class EpsIndeterminateException extends EpsException
{
    /** HTTP status of the original attempt, or null for a transport failure. */
    public readonly ?int $status;

    public function __construct(
        public readonly string $slug,
        public readonly string $clientRefId,
        \Throwable $cause,
        public readonly ?array $statusCheck,
        public readonly ?\Throwable $statusCheckError
    ) {
        parent::__construct(
            "EPS request for \"$slug\" with client_ref_id \"$clientRefId\" has no confirmed outcome.",
            0,
            $cause
        );
        $this->status = $cause instanceof EpsHttpException ? $cause->status : null;
    }
}
