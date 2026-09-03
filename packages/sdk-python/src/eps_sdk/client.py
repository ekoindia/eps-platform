"""Backend-only Python client for Eko Platform Services (EPS).

Port of ``packages/sdk-js/src/client.ts`` and ``packages/sdk-php/src/EpsClient.php``.
The signing algorithm, validation rules and error message formats are fixed by
``docs/sdk-golden-vector.md`` — every SDK language must agree byte for byte.

Standard library only: no runtime dependencies to keep up to date.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import math
import mimetypes
import os
import random
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Tuple

__all__ = [
    "EpsClient",
    "EpsError",
    "EpsHttpError",
    "EpsIndeterminateError",
    "MULTIPART_JSON_FIELD",
    "Target",
    "generate_client_ref_id",
    "sign_secret_key",
]

#: Name of the single form field carrying every non-file value as one JSON
#: object. Eko's upload APIs do not take a form field per parameter. Mirrors
#: ``MULTIPART_JSON_FIELD`` in the website's ``src/lib/data/api-specs-common.ts``.
MULTIPART_JSON_FIELD = "form-data"

#: Per-attempt budget in seconds, matching every other EPS SDK.
_DEFAULT_TIMEOUT = 30.0
#: Extra attempts for a GET that ended indeterminate.
_DEFAULT_RETRIES = 2
#: Backoff base in seconds: attempt n waits a random slice of min(base * 2**(n-1), 2s).
_DEFAULT_RETRY_BASE_DELAY = 0.2
_MAX_RETRY_DELAY = 2.0
#: Generic status-check endpoint, keyed by TID or ``client_ref_id:<ref>``.
_INQUIRY_SLUG = "transaction-inquiry"

_NUMBER_RE = re.compile(r"^-?\d+(\.\d+)?$")
_INTEGER_RE = re.compile(r"^-?\d+$")
_BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"
#: Spec types whose values are scalars the value checks can stringify.
_SCALAR_TYPES = frozenset({"string", "number", "integer", "boolean"})


class EpsError(Exception):
    """Client-side failure: unknown slug, missing param, bad type, bad config."""


class EpsHttpError(EpsError):
    """Non-2xx response from EPS.

    The decoded envelope (when the body was JSON) is kept on ``body`` so callers
    can inspect it, but this is raised rather than returned: an auth or infra
    failure must never be mistaken for a successful call.
    """

    def __init__(self, status: int, url: str, body: Any, raw: bytes) -> None:
        super().__init__(f"EPS request to {url} failed with HTTP {status}.")
        self.status = status
        self.url = url
        self.body = body
        self.raw = raw


class EpsIndeterminateError(EpsError):
    """A non-GET call on a money-moving endpoint ended without a confirmed outcome.

    Timeout, transport failure, HTTP 429 or 5xx. The SDK never re-sends such a
    request -- that is how a customer gets debited twice -- so it inquired by the
    call's ``client_ref_id`` instead. ``status_check`` is the Transaction Inquiry
    envelope (``data.tx_status``: 0 success, 1 fail, 2 awaited, ...) or ``None``
    when the inquiry itself failed, in which case ``status_check_error`` says
    why. The original failure is ``__cause__``. Reconcile with the ref before
    retrying; never assume a timeout meant failure.
    """

    def __init__(
        self,
        slug: str,
        client_ref_id: str,
        cause: BaseException,
        status_check: Any,
        status_check_error: Optional[BaseException],
    ) -> None:
        super().__init__(
            f'EPS request for "{slug}" with client_ref_id "{client_ref_id}" '
            "has no confirmed outcome."
        )
        self.slug = slug
        self.client_ref_id = client_ref_id
        #: HTTP status of the original attempt, or None for a transport failure.
        self.status = cause.status if isinstance(cause, EpsHttpError) else None
        self.status_check = status_check
        self.status_check_error = status_check_error
        self.__cause__ = cause


def _is_indeterminate(exc: BaseException) -> bool:
    """True when the outcome is unknown: no response, or a 429/5xx that says
    nothing about whether the request was processed. A 4xx is a decisive no."""
    if isinstance(exc, EpsHttpError):
        return exc.status == 429 or exc.status >= 500
    return not isinstance(exc, EpsError)


def _base36(n: int) -> str:
    digits = ""
    while n:
        n, rem = divmod(n, 36)
        digits = _BASE36[rem] + digits
    return digits or "0"


def generate_client_ref_id(now_ms: int) -> str:
    """client_ref_id for a non-GET call that did not supply one.

    Base36 millisecond stamp (sortable, greppable against a log line) plus 7
    random base36 chars: exactly 15 of ``[0-9a-z]``. Under EPS's 20-char limit
    with ~7.8e10 distinct tails per millisecond, so concurrent processes cannot
    collide in practice. Same shape in every SDK -- see docs/sdk-golden-vector.md.
    """
    tail = _base36(secrets.randbelow(36**7)).rjust(7, "0")
    return (_base36(now_ms) + tail)[-15:]


def sign_secret_key(access_key: str, timestamp: str) -> str:
    """secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))).

    The HMAC key is the base64 *string's* bytes — the encoded text, not the
    decoded key. See docs/sdk-golden-vector.md.
    """
    encoded_key = base64.b64encode(access_key.encode("utf-8"))
    digest = hmac.new(encoded_key, timestamp.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")


def _is_real_number(value: Any) -> bool:
    """True for a number, excluding ``bool`` (a Python ``int`` subclass)."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_file_value(value: Any) -> bool:
    """A readable local file path, or an in-memory ``(filename, bytes)`` pair.

    Paths must exist, matching the PHP SDK: a typo'd path is caught before the
    request is signed rather than at read time.
    """
    if isinstance(value, tuple):
        return (
            len(value) == 2
            and isinstance(value[0], str)
            and isinstance(value[1], (bytes, bytearray))
        )
    if isinstance(value, (str, os.PathLike)):
        try:
            return Path(os.fspath(value)).is_file()
        except (OSError, ValueError):
            return False
    return False


def _matches_type(spec_type: str, value: Any) -> bool:
    """Lenient, coercion-aware type check against a spec type.

    Only present values are checked (presence is enforced separately). Unknown
    types pass. The wire sends everything as strings, so numeric/boolean strings
    are accepted.
    """
    if spec_type == "string":
        # Strings and numbers (which coerce cleanly); not booleans/objects.
        return isinstance(value, str) or _is_real_number(value)
    if spec_type == "file":
        # A local file path (read by the SDK) or an ``(filename, bytes)`` pair.
        return _is_file_value(value)
    if spec_type == "number":
        if _is_real_number(value):
            return math.isfinite(value)
        return isinstance(value, str) and _NUMBER_RE.match(value) is not None
    if spec_type == "integer":
        if isinstance(value, bool):
            return False
        if isinstance(value, int):
            return True
        # Matches JS `Number.isInteger`: a whole float counts as an integer.
        if isinstance(value, float):
            return math.isfinite(value) and value.is_integer()
        return isinstance(value, str) and _INTEGER_RE.match(value) is not None
    if spec_type == "boolean":
        return isinstance(value, bool) or value in ("true", "false")
    return True  # unknown/unsupported spec type -> not enforced


def _to_wire_str(value: Any) -> str:
    """Stringify a value for a URL path token or query param.

    Matches JavaScript ``String(value)`` so the four SDKs put identical bytes on
    the wire: lowercase booleans, no trailing ``.0`` on whole floats.
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, float) and value.is_integer() and math.isfinite(value):
        return str(int(value))
    return str(value)


def value_problem(
    param: Mapping[str, Any], value: Any, formats: Mapping[str, "re.Pattern[str]"]
) -> Optional[str]:
    """Value check after the type check: enum -> format -> min/max -> maxLength.

    Runs on the wire string so ``5`` and ``"5"`` behave alike. Returns the first
    problem as the reason text, or ``None``. Formats are syntactic regexes from
    the surface, matched whole-string (``fullmatch``, so a trailing newline is
    rejected). ``maxLength`` counts UTF-8 bytes -- the one length every language
    agrees on without an ICU dependency.
    """
    if param.get("type") not in _SCALAR_TYPES:
        return None
    wire = _to_wire_str(value)
    allowed = param.get("enum")
    if allowed is not None and not any(_to_wire_str(a) == wire for a in allowed):
        return "not one of: " + ", ".join(_to_wire_str(a) for a in allowed)
    fmt = param.get("format")
    if fmt is not None:
        pattern = formats.get(fmt)
        if pattern is not None and pattern.fullmatch(wire) is None:
            return f"expected format {fmt}"
    if param.get("min") is not None or param.get("max") is not None:
        number = float(wire)
        if param.get("min") is not None and number < param["min"]:
            return f"below min {_to_wire_str(param['min'])}"
        if param.get("max") is not None and number > param["max"]:
            return f"above max {_to_wire_str(param['max'])}"
    max_length = param.get("maxLength")
    if max_length is not None and len(wire.encode("utf-8")) > max_length:
        return f"longer than {max_length} bytes"
    return None


def _load_surface() -> Dict[str, Any]:
    """Load the baked ``sdk-surface.json`` asset.

    Two locations, in order: next to the installed package (the wheel puts it
    there via ``force-include``), then the monorepo's ``data/`` directory for a
    source checkout. A missing file means the package was built incorrectly.
    """
    here = Path(__file__).resolve().parent
    candidates = (
        here / "data" / "sdk-surface.json",  # installed wheel
        here.parent.parent / "data" / "sdk-surface.json",  # monorepo src layout
    )
    for path in candidates:
        if path.is_file():
            surface = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(surface, dict) or "environments" not in surface:
                raise EpsError(f"EPS SDK surface at {path} is invalid or corrupt.")
            return surface
    raise EpsError(
        f"EPS SDK surface not found at {candidates[0]}. The package is built "
        "incorrectly (run `npm run build` to bake it)."
    )


_SURFACE = _load_surface()


def _compile_formats(surface: Mapping[str, Any]) -> Dict[str, "re.Pattern[str]"]:
    """Compiled once. A pattern that does not compile is corrupt package data --
    fail here, loudly, rather than silently skipping a validation."""
    compiled: Dict[str, "re.Pattern[str]"] = {}
    for name, pattern in (surface.get("formats") or {}).items():
        try:
            compiled[name] = re.compile(pattern)
        except re.error as exc:
            raise EpsError(
                f'EPS SDK surface is invalid or corrupt: format "{name}" does not compile.'
            ) from exc
    return compiled


_FORMATS = _compile_formats(_SURFACE)


@dataclass
class Target:
    """The resolved wire target for one call — everything but the sending."""

    method: str
    url: str
    body: Optional[bytes]
    headers: Dict[str, str]
    multipart: bool
    slug: str = ""
    #: Money-moving endpoint (surface ``financial``).
    financial: bool = False
    #: The ref this non-GET call carries (generated or supplied); None on GET.
    client_ref_id: Optional[str] = None
    #: The initiator the call resolved, reused by the status check.
    initiator_id: Any = None


def _encode_multipart(
    values: Mapping[str, Any], file_params: Iterable[str]
) -> Tuple[bytes, str]:
    """Build a multipart/form-data body.

    One ``form-data`` part holds every non-file value as JSON, followed by a part
    per upload — the order the API documents. ``None`` values are dropped (a form
    field has no null encoding); nulls nested inside a value survive the JSON.
    """
    file_params = set(file_params)
    payload: Dict[str, Any] = {}
    uploads: list[Tuple[str, str, bytes]] = []
    for name, value in values.items():
        if value is None:
            continue
        if name in file_params:
            if isinstance(value, tuple):
                filename, content = value[0], bytes(value[1])
            else:
                path = Path(os.fspath(value))
                filename, content = path.name, path.read_bytes()
            uploads.append((name, filename, content))
        else:
            payload[name] = value

    boundary = f"----EpsSdkBoundary{secrets.token_hex(16)}"
    crlf = b"\r\n"
    chunks: list[bytes] = []

    def part_header(header: str) -> None:
        chunks.append(f"--{boundary}".encode() + crlf)
        chunks.append(header.encode() + crlf + crlf)

    part_header(f'Content-Disposition: form-data; name="{MULTIPART_JSON_FIELD}"')
    chunks.append(_dump_json(payload) + crlf)
    for name, filename, content in uploads:
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        chunks.append(f"--{boundary}".encode() + crlf)
        chunks.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
            + crlf
        )
        chunks.append(f"Content-Type: {mime}".encode() + crlf + crlf)
        chunks.append(bytes(content) + crlf)
    chunks.append(f"--{boundary}--".encode() + crlf)
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


@dataclass
class EpsClient:
    """Signed EPS API client. Backend-only — never ship ``access_key`` to a browser.

    ``initiator_id`` / ``user_code`` are near-constant per developer, so they are
    set once here and injected into every call; pass either in a call's ``params``
    to override (including an explicit ``None`` to clear one).
    """

    developer_key: str
    access_key: str
    environment: str
    initiator_id: Optional[str] = None
    user_code: Optional[str] = None
    #: Per-attempt budget in seconds.
    timeout: float = _DEFAULT_TIMEOUT
    #: Extra attempts for a GET whose outcome was indeterminate (timeout,
    #: transport failure, HTTP 429/5xx). Non-GET calls are never retried.
    retries: int = _DEFAULT_RETRIES
    #: Backoff base in seconds: attempt n waits a random slice of
    #: min(base * 2**(n-1), 2.0). 0 retries immediately (tests).
    retry_base_delay: float = _DEFAULT_RETRY_BASE_DELAY
    #: After an indeterminate failure on a ``financial`` endpoint, look the
    #: transaction up by its client_ref_id and surface the result on
    #: ``EpsIndeterminateError.status_check``.
    auto_status_check: bool = True
    #: Test-only clock injection (milliseconds since the epoch).
    now: Callable[[], int] = field(
        default_factory=lambda: (lambda: int(time.time() * 1000))
    )
    base_url: str = field(init=False)

    def __post_init__(self) -> None:
        if not math.isfinite(self.timeout) or self.timeout <= 0:
            raise EpsError(
                f"Invalid timeout: {self.timeout}. Expected a positive number of seconds."
            )
        if isinstance(self.retries, bool) or not isinstance(self.retries, int) or self.retries < 0:
            raise EpsError(
                f"Invalid retries: {self.retries}. Expected a non-negative integer."
            )
        if not math.isfinite(self.retry_base_delay) or self.retry_base_delay < 0:
            raise EpsError(
                f"Invalid retry_base_delay: {self.retry_base_delay}. "
                "Expected a non-negative number of seconds."
            )
        for env in _SURFACE["environments"]:
            if env["id"] == self.environment:
                self.base_url = env["baseUrl"]
                break
        else:
            raise EpsError(f'Unknown environment "{self.environment}".')

    def _endpoint(self, slug: str) -> Dict[str, Any]:
        for endpoint in _SURFACE["endpoints"]:
            if endpoint["slug"] == slug:
                return endpoint
        raise EpsError(f'Unknown endpoint slug "{slug}".')

    def build_headers(self, multipart: bool = False) -> Dict[str, str]:
        """Signed auth headers. Multipart callers get no ``content-type`` here —
        the boundary-carrying value is set when the body is encoded."""
        timestamp = str(self.now())
        headers = {
            "developer_key": self.developer_key,
            "secret-key": sign_secret_key(self.access_key, timestamp),
            "secret-key-timestamp": timestamp,
        }
        if not multipart:
            headers["content-type"] = "application/json"
        return headers

    def resolve_target(
        self, slug: str, params: Optional[Mapping[str, Any]] = None
    ) -> Target:
        """Resolve a slug + params into the signed wire target.

        Raises :class:`EpsError` on an unknown slug, a missing required param or a
        type mismatch — before anything is signed or sent.
        """
        endpoint = self._endpoint(slug)

        # Client-level defaults first; an explicit per-call value wins, including
        # an explicit None that clears one.
        merged: Dict[str, Any] = {}
        if self.initiator_id is not None:
            merged["initiator_id"] = self.initiator_id
        if self.user_code is not None:
            merged["user_code"] = self.user_code
        merged.update(params or {})

        # Every non-GET call carries a client_ref_id -- the key a partner
        # reconciles a lost response by. Generated only when the endpoint
        # declares the param and the caller sent none (absent or None); a
        # supplied value, even "", is theirs to own. Done before the
        # required-param guard so a generated ref satisfies endpoints that
        # require one.
        declares_ref = endpoint["method"] != "GET" and any(
            p["name"] == "client_ref_id" for p in endpoint["params"]
        )
        if declares_ref and merged.get("client_ref_id") is None:
            merged["client_ref_id"] = generate_client_ref_id(self.now())
        client_ref_id = _to_wire_str(merged["client_ref_id"]) if declares_ref else None

        # Spec-driven guard: every requiredParam must be present and non-null
        # before we sign and send.
        missing = [p for p in endpoint["requiredParams"] if merged.get(p) is None]
        if missing:
            raise EpsError(
                f'Missing required params for "{slug}": {", ".join(missing)}.'
            )

        # Type guard: every provided param known to the spec must match its type.
        # Unknown params (not in the surface) pass through untouched.
        bad_types = [
            f'{p["name"]} (expected {p["type"]})'
            for p in endpoint["params"]
            if merged.get(p["name"]) is not None
            and not _matches_type(p["type"], merged[p["name"]])
        ]
        if bad_types:
            raise EpsError(
                f'Invalid param types for "{slug}": {", ".join(bad_types)}.'
            )

        # Value guard: enum / format / min / max / maxLength from the spec, on
        # the same provided params. Syntactic only -- the server owns semantics.
        bad_values = []
        for p in endpoint["params"]:
            value = merged.get(p["name"])
            if value is None:
                continue
            reason = value_problem(p, value, _FORMATS)
            if reason is not None:
                bad_values.append(f'{p["name"]} ({reason})')
        if bad_values:
            raise EpsError(
                f'Invalid param values for "{slug}": {", ".join(bad_values)}.'
            )

        # A `type: "file"` param flips the whole request to multipart/form-data.
        file_params = {p["name"] for p in endpoint["params"] if p["type"] == "file"}
        multipart = bool(file_params)

        # Path params (e.g. {customer_id}) fill the URL; the rest become the query
        # string on GET, a multipart body when the endpoint has file uploads, or
        # the JSON body on every other method.
        path = endpoint["path"]
        rest: Dict[str, Any] = {}
        for key, value in merged.items():
            token = "{" + key + "}"
            if token in path:
                path = path.replace(token, urllib.parse.quote(_to_wire_str(value), safe=""))
            else:
                rest[key] = value

        url = f"{self.base_url}{path}"
        headers = self.build_headers(multipart)
        body: Optional[bytes] = None
        if endpoint["method"] == "GET":
            query = urllib.parse.urlencode(
                [(k, _to_wire_str(v)) for k, v in rest.items()]
            )
            if query:
                url += ("&" if "?" in url else "?") + query
        elif multipart:
            body, content_type = _encode_multipart(rest, file_params)
            headers["content-type"] = content_type
        else:
            body = _dump_json(rest)

        return Target(
            method=endpoint["method"],
            url=url,
            body=body,
            headers=headers,
            multipart=multipart,
            slug=slug,
            financial=bool(endpoint.get("financial")),
            client_ref_id=client_ref_id,
            initiator_id=merged.get("initiator_id"),
        )

    def call(self, slug: str, params: Optional[Mapping[str, Any]] = None) -> Any:
        """Sign and send one endpoint call, returning the decoded response envelope.

        Validates first (raises :class:`EpsError`, nothing sent), then sends. A
        GET whose outcome is indeterminate is retried; a non-GET never is -- on a
        ``financial`` endpoint it is followed by a Transaction Inquiry on its
        ``client_ref_id`` and raised as :class:`EpsIndeterminateError`. Otherwise
        raises :class:`EpsHttpError` on a non-2xx response and
        :class:`urllib.error.URLError` on a transport failure. A body that is
        not JSON is an error, never a silent ``{}``. See docs/sdk-golden-vector.md.
        """
        target = self.resolve_target(slug, params)
        attempts = self.retries + 1 if target.method == "GET" else 1
        attempt = 0
        while True:
            attempt += 1
            try:
                return self._send(target)
            except Exception as exc:
                if not _is_indeterminate(exc):
                    raise
                if attempt < attempts:
                    self._backoff(attempt)
                    continue
                # Never re-send a non-GET: that is how a customer is debited
                # twice. Ask EPS what happened to the ref instead, if there is
                # one to ask by.
                if (
                    self.auto_status_check
                    and target.financial
                    and target.client_ref_id is not None
                ):
                    raise self._indeterminate(target, exc) from exc
                raise

    def _backoff(self, attempt: int) -> None:
        """Attempt n sleeps a random slice of min(base * 2**(n-1), 2s) -- full jitter."""
        cap = min(self.retry_base_delay * 2 ** (attempt - 1), _MAX_RETRY_DELAY)
        delay = random.uniform(0, cap)
        if delay > 0:
            time.sleep(delay)

    def _indeterminate(
        self, target: Target, cause: BaseException
    ) -> EpsIndeterminateError:
        """One inquiry by ``client_ref_id:<ref>``; its own failure is reported,
        never allowed to mask the original one."""
        status_check: Any = None
        status_check_error: Optional[BaseException] = None
        params: Dict[str, Any] = {
            "transaction-reference": f"client_ref_id:{target.client_ref_id}"
        }
        if target.initiator_id is not None:
            params["initiator_id"] = target.initiator_id
        try:
            status_check = self.call(_INQUIRY_SLUG, params)
        except Exception as exc:  # reported on the error, not raised
            status_check_error = exc
        return EpsIndeterminateError(
            target.slug, str(target.client_ref_id), cause, status_check, status_check_error
        )

    def _send(self, target: Target) -> Any:
        """Sign (fresh timestamp) and send one attempt; decode per the contract."""
        request = urllib.request.Request(
            target.url, data=target.body, method=target.method
        )
        # Re-sign every attempt so a retry never reuses a stale timestamp; the
        # multipart content-type (with its boundary) is kept from the target.
        headers = dict(target.headers)
        headers.update(self.build_headers(target.multipart))
        for name, value in headers.items():
            request.add_header(name, value)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                status = response.status
        except urllib.error.HTTPError as exc:  # non-2xx: body still worth decoding
            raw = exc.read()
            raise EpsHttpError(
                exc.code, target.url, _decode_json_or_none(raw), raw
            ) from exc
        if not 200 <= status < 300:
            raise EpsHttpError(status, target.url, _decode_json_or_none(raw), raw)
        try:
            return json.loads(raw)
        except ValueError as exc:
            raise EpsError(
                f"EPS response from {target.url} was not valid JSON: {raw[:200]!r}"
            ) from exc


def _dump_json(payload: Mapping[str, Any]) -> bytes:
    """Compact JSON, matching ``JSON.stringify`` byte for byte.

    A value the encoder cannot handle raises here rather than silently blanking
    the payload — the request would otherwise fail far from its cause.
    """
    try:
        return json.dumps(payload, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise EpsError(f"Params could not be JSON-encoded: {exc}") from exc


def _decode_json_or_none(raw: bytes) -> Any:
    try:
        return json.loads(raw)
    except ValueError:
        return None
