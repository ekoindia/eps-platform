# Changelog

## Unreleased

### Changed

- A financial endpoint without a `client_ref_id` param (`initiate-refund`) now
  raises `EpsIndeterminateError` on an indeterminate outcome too, after a
  Transaction Inquiry by the call's `tid` (`tx_status` 3/4 = refund
  initiated/done). `EpsIndeterminateError.client_ref_id` is `None` there and the
  new `tid` attribute holds the key. Previously the 5xx / invalid-response error
  was raised as is, with no inquiry.
- A 2xx response whose body is not a JSON object (unparseable, or a bare
  `null` / string / number / array) now raises `EpsInvalidResponseError`
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
