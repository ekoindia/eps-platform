<?php
namespace Eko\Eps;

/**
 * The request never produced a response: cURL failed (DNS, connect, TLS) or
 * the per-attempt timeout elapsed. The outcome is unknown, which is what
 * separates it from the other EpsException cases — a GET is retried, a
 * financial POST is followed by a status check (see EpsIndeterminateException).
 */
final class EpsTransportException extends EpsException
{
}
