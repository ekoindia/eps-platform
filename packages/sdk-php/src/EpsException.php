<?php
namespace Eko\Eps;

/**
 * Client-side failure: a bad option, a malformed surface asset, a transport
 * failure, or a response that could not be read. Extends \RuntimeException so
 * existing `catch (\RuntimeException)` callers keep matching.
 *
 * Note the deliberate asymmetry with the other SDKs: input-validation failures
 * stay \InvalidArgumentException, which is a \LogicException and therefore
 * cannot share this base. SPL already has the semantically right class for bad
 * arguments, and re-classing them would break existing catchers.
 */
class EpsException extends \RuntimeException
{
}
