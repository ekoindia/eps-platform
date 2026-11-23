"""Debug mode: opt-in, masked diagnostics a developer can share with Eko support.

Port of ``packages/sdk-js/src/debug.ts``. Normative contract: "Debug mode
conformance" in ``docs/sdk-golden-vector.md``.

Everything here is best-effort and isolated: a failure while building, masking
or delivering an event is swallowed, so debug can never change a call's
outcome. Masking is fail-closed: only keys the surface classifies print
anything but ``****``.
"""

from __future__ import annotations

import json
import math
import os
import platform
import re
import secrets
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from importlib.metadata import version as _package_version
from typing import Any, Callable, Dict, List, Mapping, Optional, Tuple, Union

#: One masked debug event, e.g. ``{"logger": "eps-sdk", "event": "request", ...}``.
EpsDebugEvent = Dict[str, Any]
#: Where an event goes: receives the event and its serialized JSON line.
_Sink = Callable[[EpsDebugEvent, str], None]

MASK = "****"
UNAVAILABLE = "[unavailable]"
# Patterns are used with fullmatch(): Python's `$` also matches before a
# trailing newline, JavaScript's does not.
_SAFE_SHAPE = re.compile(r"[A-Za-z0-9_.:-]{0,64}")
_KEY_SHAPE = re.compile(r"[a-z][a-z0-9_]{0,39}")
_LAST4_URL = re.compile(r"\*\*\*\*[A-Za-z0-9]{4}")
_EXT_SHAPE = re.compile(r"[a-z0-9]{1,5}")
_PARAM_SEGMENT = re.compile(r"\{([^}]+)\}")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PAN = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]")
_DIGITS = re.compile(r"[0-9]{6,}")
#: A `%` not followed by two hex digits: decodeURIComponent throws on it.
_BAD_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")
#: Characters encodeURIComponent leaves as-is (besides ASCII letters/digits).
_URI_SAFE = "-_.!~*'()"
_WALKED = frozenset({"nest", "safe", "text"})
_MAX_DEPTH = 8
_MAX_EVENT_BYTES = 64 * 1024
_TEXT_CAP = 1024
_SAFE_TEXT_CAP = 256
_BODY_TEXT_CAP = 512


def _last4(s: str) -> str:
    """``****`` for 8 code points or fewer, else ``****`` + the last 4."""
    return MASK if len(s) <= 8 else MASK + s[-4:]


def _wire(value: Any) -> str:
    """A scalar's wire string, as JavaScript ``String(value)`` prints it."""
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return str(int(value))
    return str(value)


def _differs(masked: Any, value: Any) -> bool:
    """True when masking changed the value (``1 == 1.0`` must not count as equal)."""
    return type(masked) is not type(value) or masked != value


def _decode_component(s: str) -> str:
    """``decodeURIComponent``: strict, raises on a malformed escape or bad UTF-8."""
    if _BAD_ESCAPE.search(s):
        raise ValueError("malformed percent escape")
    return urllib.parse.unquote_to_bytes(s).decode("utf-8")


def _form_decode(s: str) -> str:
    """Query-string decoding: ``+`` is a space, then percent escapes."""
    return _decode_component(s.replace("+", " "))


def _collect_all(value: Any, out: List[str]) -> None:
    """Every scalar under a masked-whole value is a known value too."""
    if isinstance(value, dict):
        for child in value.values():
            _collect_all(child, out)
    elif isinstance(value, list):
        for child in value:
            _collect_all(child, out)
    elif value is not None and not isinstance(value, bool):
        s = _wire(value)
        if len(s) >= 4:
            out.append(s)


class Masker:
    """Classifies keys by the surface's ``redact`` lists and masks values."""

    def __init__(
        self,
        redact: Optional[Mapping[str, Any]],
        client_ref: Optional["re.Pattern[str]"],
    ) -> None:
        self._classes: Dict[str, str] = {}
        # Later lists win, so `last4` beats every other class.
        for cls in ("nest", "text", "safe", "last4"):
            for key in (redact or {}).get(cls) or []:
                self._classes[key] = cls
        self._client_ref = client_ref

    def _class_of(self, key: str) -> str:
        return self._classes.get(key.lower(), "default")

    def _printable(self, key: str) -> bool:
        """A key name prints when it is classified or looks like a field name."""
        return key.lower() in self._classes or _KEY_SHAPE.fullmatch(key) is not None

    def _child_class(self, key: str, parent: str) -> str:
        """Class of a child key: an unprintable name is always ``default``."""
        if not self._printable(key):
            return "default"
        return "text" if parent == "text" else self._class_of(key)

    def mask(
        self,
        value: Any,
        cls: str,
        key: Optional[str],
        known: List[str],
        changed: Optional[List[str]] = None,
        depth: int = 0,
    ) -> Any:
        """Mask ``value`` held under ``key`` of class ``cls``. Every request scalar
        the masker changes is appended to ``changed`` (when given) so later text
        can be scrubbed of it."""
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, (dict, list)):
            if cls not in _WALKED or depth >= _MAX_DEPTH:
                if changed is not None:
                    _collect_all(value, changed)
                return MASK
            if isinstance(value, list):
                return [
                    self.mask(v, cls, key, known, changed, depth + 1) for v in value
                ]
            out: Dict[str, Any] = {}
            unnamed = 0
            for k, v in value.items():
                k = str(k)
                if self._printable(k):
                    name = k
                else:
                    unnamed += 1
                    name = f"#{unnamed}"
                out[name] = self.mask(
                    v, self._child_class(k, cls), k, known, changed, depth + 1
                )
            return out
        s = _wire(value)
        masked = self._scalar(value, s, cls, key, known)
        if changed is not None and _differs(masked, value) and len(s) >= 4:
            changed.append(s)
        return masked

    def _scalar(
        self, value: Any, s: str, cls: str, key: Optional[str], known: List[str]
    ) -> Any:
        if cls == "last4":
            return _last4(s)
        if cls == "safe":
            if (
                key is not None
                and key.lower() == "client_ref_id"
                and self._client_ref is not None
                and self._client_ref.fullmatch(s) is None
            ):
                return MASK
            if _SAFE_SHAPE.fullmatch(s):
                return MASK if any(k in s for k in known) else value
            return self.text(s, _SAFE_TEXT_CAP, known)
        if cls in ("text", "nest"):
            return self.text(s, _TEXT_CAP, known)
        return MASK

    def root(
        self, value: Any, known: List[str], changed: Optional[List[str]] = None
    ) -> Any:
        """Mask a whole JSON document (request or response body) from the root."""
        return self.mask(value, "nest", None, known, changed)

    def text(self, s: str, cap: int, known: List[str]) -> str:
        """Text scrub: digit runs first (so a short known value cannot match inside
        a longer number and leave its ends visible), then known values and their
        percent-encoded form, PAN shapes and e-mails, then a code-point cap."""
        out = _DIGITS.sub(
            lambda m: MASK + m.group()[-4:] if len(m.group()) >= 9 else MASK, s
        )
        for k in sorted(known, key=len, reverse=True):
            if not k:
                continue
            out = out.replace(k, MASK)
            encoded = urllib.parse.quote(k, safe=_URI_SAFE)
            if encoded != k:
                out = out.replace(encoded, MASK)
        out = _EMAIL.sub(f"{MASK}@{MASK}", _PAN.sub(MASK, out))
        return out if len(out) <= cap else f"{out[:cap]}…(+{len(out) - cap} chars)"

    def headers(self, headers: Mapping[str, str]) -> Dict[str, str]:
        """Headers: an allowlist, matched case-insensitively."""
        out: Dict[str, str] = {}
        for name, value in headers.items():
            lower = name.lower()
            if lower in ("secret-key-timestamp", "content-type"):
                out[name] = value
            elif lower == "developer_key":
                out[name] = _last4(str(value))
            else:
                out[name] = MASK
        return out

    def url(
        self,
        url: str,
        base_url: str,
        template: str,
        known: List[str],
        changed: List[str],
    ) -> str:
        """The URL actually sent, masked by the endpoint's path template. Any
        mismatch with the base URL or the template fails closed."""
        try:
            if not url.startswith(base_url):
                return UNAVAILABLE
            path_part, _, query = url[len(base_url):].partition("?")
            t_segs = template.split("/")
            p_segs = path_part.split("/")
            if len(t_segs) != len(p_segs):
                return UNAVAILABLE
            segs: List[str] = []
            for t_seg, p_seg in zip(t_segs, p_segs):
                param = _PARAM_SEGMENT.fullmatch(t_seg)
                if param is None:
                    if t_seg != p_seg:
                        return UNAVAILABLE
                    segs.append(t_seg)
                else:
                    segs.append(
                        self._url_value(
                            param.group(1),
                            _decode_component(p_seg),
                            p_seg,
                            known,
                            changed,
                        )
                    )
            pairs: List[str] = []
            unnamed = 0
            for pair in query.split("&"):
                if not pair:
                    continue
                raw_key, _, raw_value = pair.partition("=")
                k = _form_decode(raw_key)
                named = self._printable(k)
                value = self._url_value(
                    k if named else None,
                    _form_decode(raw_value),
                    raw_value,
                    known,
                    changed,
                )
                if named:
                    name = raw_key
                else:
                    unnamed += 1
                    name = f"#{unnamed}"
                pairs.append(f"{name}={value}")
            return base_url + "/".join(segs) + (f"?{'&'.join(pairs)}" if pairs else "")
        except Exception:
            return UNAVAILABLE

    def _url_value(
        self,
        key: Optional[str],
        decoded: str,
        raw: str,
        known: List[str],
        changed: List[str],
    ) -> str:
        """A raw value keeps its original encoding; a ``last4`` result keeps its
        last 4 only when they are alphanumeric; anything else is ``****``."""
        cls = "default" if key is None else self._class_of(key)
        masked = self.mask(decoded, cls, key, known, changed)
        if not _differs(masked, decoded):
            return raw
        s = str(masked)
        return s if cls == "last4" and _LAST4_URL.fullmatch(s) else MASK


def _stderr_sink(event: EpsDebugEvent, line: str) -> None:
    """The default text sink: one JSON line per event, in a single write."""
    sys.stderr.write(line + "\n")


def resolve_sink(
    option: Union[bool, Callable[[EpsDebugEvent], None], None],
    env: Optional[str],
) -> Optional[Tuple[_Sink, str]]:
    """Resolve the ``debug`` option against ``EPS_SDK_DEBUG``: an explicit option
    wins, then the env var, else off (None). Returns ``(sink, source)``."""
    if callable(option):
        callback = option
        return (lambda event, line: callback(event)), "option"
    if option is True:
        return _stderr_sink, "option"
    if option is False:
        return None
    flag = (env or "").strip().lower()
    return (_stderr_sink, "env") if flag in ("1", "true") else None


def _sdk_version() -> str:
    """Installed package version, else ``"unknown"`` (e.g. a source checkout)."""
    try:
        return _package_version("eps-sdk")
    except Exception:
        return "unknown"


def _now_iso() -> str:
    """Real wall clock (never the injected signing clock), ISO-8601 UTC, ms, ``Z``."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _dumps(event: EpsDebugEvent) -> str:
    """Compact JSON, matching JavaScript ``JSON.stringify`` output."""
    return json.dumps(event, ensure_ascii=False, separators=(",", ":"))


def file_meta(param: str, filename: str, size: Optional[int]) -> Dict[str, Any]:
    """File metadata for a multipart part: extension (when tidy) and size.
    The file name itself is never logged."""
    ext = os.path.splitext(filename)[1][1:].lower()
    return {
        "param": param,
        "ext": ext if _EXT_SHAPE.fullmatch(ext) else None,
        "bytes": size,
    }


class Debug:
    """Emits events for one client. Every public method swallows its own errors."""

    def __init__(
        self,
        *,
        sink: _Sink,
        source: str,
        env: str,
        base_url: str,
        surface: Mapping[str, Any],
        client_ref: Optional["re.Pattern[str]"],
        developer_key: str,
        timeout_ms: int,
        retries: int,
        auto_status_check: bool,
    ) -> None:
        self._sink = sink
        self.base_url = base_url
        self.developer_key = str(developer_key)
        self.templates: Dict[str, str] = {
            e.get("slug"): e.get("path") for e in surface.get("endpoints") or []
        }
        self.masker = Masker(surface.get("redact"), client_ref)
        self._common: Dict[str, Any] = {
            "sdk": "python",
            "sdk_version": _sdk_version(),
            "surface": surface.get("bundleVersion"),
            "env": env,
        }
        self.emit(
            "init",
            {
                "base_url": base_url,
                "runtime": "python " + platform.python_version(),
                "developer_key": _last4(self.developer_key),
                "timeout_ms": timeout_ms,
                "retries": retries,
                "auto_status_check": auto_status_check,
                "source": source,
            },
        )

    def trace(self, slug: str) -> Optional["Trace"]:
        """Start tracing one ``call()``; None if even that fails."""
        try:
            return Trace(self, slug)
        except Exception:
            return None

    def emit(
        self,
        event: str,
        fields: Mapping[str, Any],
        call: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Build, bound, serialize and deliver one event; never raises."""
        try:
            out: EpsDebugEvent = {
                "logger": "eps-sdk",
                "ts": _now_iso(),
                "event": event,
                **self._common,
                **(call or {}),
                **fields,
            }
            line = _dumps(out)
            size = len(line.encode("utf-8"))
            if size > _MAX_EVENT_BYTES and "body" in out:
                out["body"] = f"[{size} bytes omitted]"
                line = _dumps(out)
            self._sink(out, line)
        except Exception:
            pass  # Debug output must never affect the call.


class Trace:
    """Per-call state: the call id and the values later text is scrubbed of."""

    def __init__(self, debug: Debug, slug: str) -> None:
        self._debug = debug
        self._slug = slug
        self._call = {"call_id": secrets.token_hex(4), "slug": slug}
        self._known: List[str] = [k for k in (debug.developer_key,) if k]
        self._started = 0.0

    def _emit(self, event: str, fields: Mapping[str, Any]) -> None:
        self._debug.emit(event, fields, self._call)

    def request(
        self,
        attempt: int,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Optional[bytes],
        multipart: Optional[Mapping[str, Any]],
    ) -> None:
        """Mask and log the request as sent; remember its values for later scrubs.
        ``body`` is the exact JSON bytes sent (None on GET); ``multipart`` the
        metadata the form builder captured."""
        try:
            self._started = time.perf_counter()
            masker = self._debug.masker
            secret = next(
                (v for n, v in headers.items() if n.lower() == "secret-key"), None
            )
            base = [k for k in (self._debug.developer_key, secret) if k]
            changed: List[str] = []
            masked_url = masker.url(
                url,
                self._debug.base_url,
                self._debug.templates.get(self._slug),  # type: ignore[arg-type]
                base,
                changed,
            )
            masked_body: Any = None
            if multipart is not None:
                masked_body = {
                    "fields": masker.root(json.loads(multipart["fields"]), base, changed),
                    "files": [dict(f) for f in multipart["files"]],
                }
            elif body is not None:
                masked_body = masker.root(json.loads(body), base, changed)
            self._known = base + changed
            self._emit(
                "request",
                {
                    "attempt": attempt,
                    "method": method,
                    "url": masked_url,
                    "headers": masker.headers(headers),
                    "body": masked_body,
                },
            )
        except Exception:
            pass  # isolated

    def response(self, attempt: int, status: int, raw: Union[bytes, str]) -> None:
        """Log one HTTP response (any status): masked JSON, else scrubbed text."""
        try:
            masker = self._debug.masker
            try:
                body: Any = masker.root(json.loads(raw), self._known)
            except Exception:
                text = (
                    raw.decode("utf-8", errors="replace")
                    if isinstance(raw, (bytes, bytearray))
                    else str(raw)
                )
                body = masker.text(text, _BODY_TEXT_CAP, self._known)
            self._emit(
                "response",
                {"attempt": attempt, "status": status, "ms": self._elapsed(), "body": body},
            )
        except Exception:
            pass  # isolated

    def transport_error(
        self, attempt: int, exc: BaseException, status: Optional[int] = None
    ) -> None:
        """Log an attempt with no usable response (``status`` if one arrived)."""
        try:
            fields: Dict[str, Any] = {
                "attempt": attempt,
                "ms": self._elapsed(),
                "error": type(exc).__name__,
                "message": self._debug.masker.text(str(exc), _TEXT_CAP, self._known),
            }
            if status is not None:
                fields["status"] = status
            self._emit("transport_error", fields)
        except Exception:
            pass  # isolated

    def retry(self, attempt: int, delay_ms: int) -> None:
        """Log the backoff before attempt ``attempt + 1``."""
        self._emit("retry", {"attempt": attempt, "delay_ms": delay_ms})

    def error(self, exc: BaseException) -> None:
        """Log the exception ``call()`` is about to raise."""
        try:
            masker = self._debug.masker
            fields: Dict[str, Any] = {
                "error": type(exc).__name__,
                "message": masker.text(str(exc), _TEXT_CAP, self._known),
            }
            for key in ("client_ref_id", "tid"):
                value = getattr(exc, key, None)
                if value is not None:
                    fields[key] = masker.mask(value, "safe", key, self._known)
            self._emit("error", fields)
        except Exception:
            pass  # isolated

    def _elapsed(self) -> int:
        return round((time.perf_counter() - self._started) * 1000)
