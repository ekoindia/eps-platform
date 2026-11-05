# Changelog

## Unreleased

### Changed

- **Minimum Python version is now 3.10.** Python 3.9 is no longer supported: it
  has reached end of life, and GitHub Actions has no 3.9 build for Ubuntu 26.04,
  so it can no longer be tested on the current runner image. On Python 3.9, `pip`
  keeps installing the last release that supports it.
