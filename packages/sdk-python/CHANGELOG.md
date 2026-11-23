# Changelog

## Unreleased

### Changed

- `auto_status_check=False` now skips only the Transaction Inquiry: an
  indeterminate outcome on a financial endpoint still raises
  `EpsIndeterminateError` carrying the `client_ref_id` (or `tid`), with
  `status_check` and `status_check_error` both `None`. Previously the raw
  5xx / transport / invalid-response error was raised and a generated ref was
  lost.
- A financial endpoint without a `client_ref_id` param (`initiate-refund`) now
  raises `EpsIndeterminateError` on an indeterminate outcome too, after a
  Transaction Inquiry by the call's `tid` (only `tx_status` 4 = refunded
  confirms the refund; 3, refund pending, is also the pre-refund state). `EpsIndeterminateError.client_ref_id` is `None` there and the
  new `tid` attribute holds the key. Previously the 5xx / invalid-response error
  was raised as is, with no inquiry.
- A 2xx response whose body is not an EPS envelope (unparseable; a bare
  `null` / string / number / array; or an object without a numeric `status`,
  such as `{}` or a proxy's error object) now raises `EpsInvalidResponseError`
  (still an `EpsError`) and counts as an indeterminate outcome: a financial call
  runs the Transaction Inquiry by `client_ref_id` and raises
  `EpsIndeterminateError`, and a retry-safe call is retried. Previously it was a
  plain `EpsError` with no inquiry, leaving a possibly-processed transaction
  without a reconciliation path.
- The "Unknown endpoint slug" error now says to check the spelling or upgrade
  the SDK (`pip install -U eps-sdk`), since the slug list is pinned to the release.
- **Minimum Python version is now 3.10.** Python 3.9 is no longer supported: it
  has reached end of life, and GitHub Actions has no 3.9 build for Ubuntu 26.04,
  so it can no longer be tested on the current runner image. On Python 3.9, `pip`
  keeps installing the last release that supports it.
