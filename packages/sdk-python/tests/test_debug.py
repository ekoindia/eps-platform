"""Debug mode conformance for the Python SDK.

Ported from `packages/sdk-js/src/debug.test.ts`; the fixtures are the table in
"Debug mode conformance" in docs/sdk-golden-vector.md.
"""

import io
import json
import os
import re
import tempfile
import unittest
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from eps_sdk import EpsClient, EpsError, EpsIndeterminateError, sign_secret_key
from eps_sdk.debug import Masker
from test_client import Transport, _response, patched

DEV = "abcd1234wxyz"
ACCESS = "TEST_ACCESS_KEY_DO_NOT_USE"
NOW = 1700000000000
SECRET = sign_secret_key(ACCESS, str(NOW))
SECRETS = [
    DEV,
    SECRET,
    "123456789012",
    "9876543210",
    "000111222333",
    "654321",
    "k@x.in",
    "john@example.com",
    "Kumar",
    "KUMAR_123456789012",
]
PAN_LITE = {"pan_number": "ABCDE1234F", "name": "Kumar", "dob": "1990-01-01"}
TRANSFER = {
    "recipient_id": 1,
    "amount": 100,
    "customer_id": "9876543210",
    "otp": "4321",
    "otp_ref_id": "ref1",
    "client_ref_id": "ref123",
}
MOBILE = ("bbps-operator-code-circle", {"customer_mobile": "9876543210"})


def ok(**extra):
    """A 200 EPS envelope (financial-shaped) carrying ``extra``."""
    return _response(json.dumps({"status": 0, "response_status_id": 0, **extra}).encode())


def http(status, body):
    """A non-2xx reply with a custom body."""
    return urllib.error.HTTPError("https://x/y", status, "err", {}, io.BytesIO(body))


def make(**extra):
    """A client whose callback sink collects every event; retries never sleep."""
    events = []
    kwargs = {
        "initiator_id": "9962981729",
        "now": lambda: NOW,
        "retry_base_delay": 0,
        "debug": events.append,
        **extra,
    }
    return EpsClient(DEV, ACCESS, "sandbox", **kwargs), events


def of_type(events, kind):
    return [e for e in events if e["event"] == kind]


class Lines:
    """A stand-in for sys.stderr that records each write call."""

    def __init__(self):
        self.writes = []

    def write(self, s):
        self.writes.append(s)
        return len(s)

    def flush(self):
        pass


class DebugCase(unittest.TestCase):
    def setUp(self):
        env = mock.patch.dict(os.environ)
        env.start()
        self.addCleanup(env.stop)
        os.environ.pop("EPS_SDK_DEBUG", None)

    def assertNoSecrets(self, payload):
        text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        for secret in SECRETS:
            self.assertNotIn(secret, text, secret)


class DebugSwitch(DebugCase):
    def run_plain(self, **extra):
        lines = Lines()
        t = Transport(ok())
        with patched(t), mock.patch("sys.stderr", lines):
            EpsClient(
                DEV, ACCESS, "sandbox", initiator_id="9962981729", now=lambda: NOW, **extra
            ).call(*MOBILE)
        return lines.writes

    def test_off_by_default_nothing_written(self):
        self.assertEqual(self.run_plain(), [])

    def test_env_var_writes_one_json_object_per_line(self):
        for flag in ("1", " TRUE "):
            with self.subTest(flag=flag):
                os.environ["EPS_SDK_DEBUG"] = flag
                writes = self.run_plain()
                self.assertEqual(len(writes), 3)  # init, request, response
                for line in writes:
                    self.assertTrue(line.endswith("\n"))
                    self.assertEqual(line.count("\n"), 1)
                    self.assertTrue(line.startswith('{"logger":"eps-sdk"'))
                    json.loads(line)
                init = json.loads(writes[0])
                self.assertEqual(init["event"], "init")
                self.assertEqual(init["source"], "env")
                self.assertEqual(init["developer_key"], "****wxyz")
                self.assertEqual(init["env"], "sandbox")
                self.assertEqual(init["sdk"], "python")
                self.assertEqual(init["timeout_ms"], 30000)
                self.assertEqual(init["retries"], 2)
                self.assertIs(init["auto_status_check"], True)
                self.assertRegex(init["runtime"], r"^python \d+\.\d+")
                self.assertIsInstance(init["sdk_version"], str)
                self.assertTrue(init["sdk_version"])
                self.assertNoSecrets("".join(writes))

    def test_env_var_other_values_stay_off(self):
        for flag in ("0", "yes", "false", ""):
            with self.subTest(flag=flag):
                os.environ["EPS_SDK_DEBUG"] = flag
                self.assertEqual(self.run_plain(), [])

    def test_explicit_false_beats_env_var(self):
        os.environ["EPS_SDK_DEBUG"] = "1"
        self.assertEqual(self.run_plain(debug=False), [])

    def test_explicit_true_uses_stderr_with_source_option(self):
        writes = self.run_plain(debug=True)
        self.assertEqual(json.loads(writes[0])["source"], "option")

    def test_rejects_a_debug_option_that_is_neither_bool_nor_callable(self):
        for bad in ("yes", 1):
            with self.assertRaisesRegex(EpsError, "Invalid debug"):
                EpsClient(DEV, ACCESS, "sandbox", debug=bad)

    def test_debug_setup_failure_never_breaks_the_client(self):
        t = Transport(ok())
        with patched(t), mock.patch("eps_sdk.client.Debug", side_effect=RuntimeError("boom")):
            client, _ = make()
            self.assertEqual(client.call(*MOBILE), {"status": 0, "response_status_id": 0})


class DebugEvents(DebugCase):
    def test_masks_get_url_and_headers_with_documented_key_order(self):
        client, events = make()
        with patched(Transport(ok())):
            client.call(*MOBILE)
        self.assertEqual([e["event"] for e in events], ["init", "request", "response"])
        _, request, response = events
        self.assertEqual(
            list(request)[:9],
            ["logger", "ts", "event", "sdk", "sdk_version", "surface", "env", "call_id", "slug"],
        )
        self.assertRegex(request["call_id"], r"^[0-9a-f]{8}$")
        self.assertEqual(response["call_id"], request["call_id"])
        # Real wall clock, not the injected signing clock.
        self.assertRegex(request["ts"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")
        self.assertFalse(
            request["ts"].startswith(
                datetime.fromtimestamp(NOW / 1000, timezone.utc).strftime("%Y-%m-%d")
            )
        )
        self.assertEqual(
            request["url"],
            "https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210"
            "/operator?initiator_id=****1729",
        )
        self.assertEqual(
            request["headers"],
            {
                "developer_key": "****wxyz",
                "secret-key": "****",
                "secret-key-timestamp": str(NOW),
                "content-type": "application/json",
            },
        )
        self.assertIsNone(request["body"])
        self.assertEqual(response["status"], 200)
        self.assertEqual(response["body"], {"status": 0, "response_status_id": 0})
        self.assertIsInstance(response["ms"], int)
        self.assertNoSecrets(events)

    def test_masks_json_body_and_response_by_key_class(self):
        reply = {
            "message": "sent to k@x.in, ref 9876543210",
            "data": {
                "tid": "2611230001",
                "name": "Kumar",
                "email": "k@x.in",
                "dob": "1990-01-01",
                "photo": "A" * 5000,
                "reference_id": "123456789012",
                "john@example.com": "x",
                "123456789012": "y",
            },
            "otp_code": {"reference_id": "r1"},
            "foo": [{"tid": "t1"}],
        }
        client, events = make()
        with patched(Transport(ok(**reply))):
            client.call(
                "pan-lite",
                {
                    **PAN_LITE,
                    "AADHAR": "123456789012",
                    "otp_code": "654321",
                    "otp": "4321",  # 4 chars: asserted by field, not by the byte scan
                    "foo_bar": "x",
                    "entries": [
                        {
                            "reference_id": "r1",
                            "bank_account": "000111222333",
                            "ifsc": "SBIN0000001",
                        }
                    ],
                },
            )
        body = of_type(events, "request")[0]["body"]
        expected = {
            "pan_number": "****234F",
            "name": "****",
            "dob": "****",
            "AADHAR": "****9012",
            "otp_code": "****",
            "otp": "****",
            "foo_bar": "****",
            "initiator_id": "****1729",
            "entries": [
                {"reference_id": "r1", "bank_account": "****2333", "ifsc": "SBIN0000001"}
            ],
        }
        for key, value in expected.items():
            self.assertEqual(body[key], value, key)
        self.assertRegex(body["client_ref_id"], r"^[0-9a-z]{15}$")  # generated, safe
        response = of_type(events, "response")[0]["body"]
        self.assertEqual(response["message"], "sent to ****@****, ref ****3210")
        self.assertEqual(
            response["data"],
            {
                "tid": "2611230001",
                "name": "****",
                "email": "****",
                "dob": "****",
                "photo": "****",
                "reference_id": "****",  # a request secret echoed under a safe key
                "#1": "****",
                "#2": "****",
            },
        )
        self.assertEqual(response["otp_code"], "****")
        self.assertEqual(response["foo"], "****")
        self.assertNoSecrets(events)

    def test_masks_client_ref_failing_format_in_url_echo_and_error(self):
        client, events = make()
        with patched(Transport(ok(data={"client_ref_id": "KUMAR 123456789012"}))):
            client.call(
                "bbps-fetch-bill",
                {
                    "phone_operator_code": "1",
                    "utility_acc_no": "000111222333",
                    "confirmation_mobile_no": "9876543210",
                    "sender_name": "Kumar",
                    "category": 1,
                    "client_ref_id": "KUMAR 123456789012",
                    "source_ip": "10.0.0.1",
                },
            )
        url = of_type(events, "request")[0]["url"]
        self.assertIn("client_ref_id=****&", url)
        self.assertIn("utility_acc_no=****2333", url)
        self.assertIn("phone_operator_code=1", url)
        self.assertEqual(of_type(events, "response")[0]["body"]["data"]["client_ref_id"], "****")
        # An error carrying the ref masks it the same way.
        client._debug.trace("bbps-fetch-bill").error(
            EpsIndeterminateError(
                "bbps-fetch-bill", "KUMAR 123456789012", RuntimeError("x"), None, None
            )
        )
        self.assertEqual(of_type(events, "error")[0]["client_ref_id"], "****")
        self.assertNoSecrets(events)
        self.assertNotIn("123456789012", json.dumps(events))

    def test_scrubs_and_caps_non_json_error_page_and_error_message(self):
        page = (
            f"<html><title>502 Bad Gateway</title>{'x' * 600} 123456789012 "
            f"Kumar%20Abhi {DEV}</html>"
        )
        echo_first = f"<html>123456789012 Kumar%20Abhi {DEV}</html>"
        client, events = make()
        with patched(Transport(http(502, (echo_first + page).encode()))):
            with self.assertRaisesRegex(Exception, "HTTP 502"):
                client.call(
                    "pan-lite", {**PAN_LITE, "name": "Kumar Abhi", "AADHAR": "123456789012"}
                )
        response = of_type(events, "response")[0]
        self.assertEqual(response["status"], 502)
        self.assertRegex(response["body"], r"^<html>\*\*\*\*9012 \*\*\*\* \*\*\*\*</html>")
        self.assertRegex(response["body"], r"…\(\+\d+ chars\)$")
        self.assertEqual(len(re.sub(r"…\(\+\d+ chars\)$", "", response["body"])), 512)
        self.assertEqual(of_type(events, "error")[0]["error"], "EpsHttpError")
        self.assertNoSecrets(events)

    def test_logs_multipart_as_masked_fields_plus_file_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            pan_path = Path(tmp) / "KUMAR_123456789012.JPG"
            pan_path.write_bytes(b"12345")
            client, events = make()
            with patched(Transport(ok())):
                client.call(
                    "activate-aeps-fingpay",
                    {
                        "user_code": "20810200",
                        "modelname": "MANTRA",
                        "devicenumber": "D1",
                        "account": "000111222333",
                        "ifsc": "SBIN0000001",
                        "shop_type": "1",
                        "office_address": {"line": "Kumar House"},
                        "address_as_per_proof": {"line": "Kumar House"},
                        "aadhar": "123456789012",
                        "pan_card": str(pan_path),
                        "aadhar_front": ("front.PNG", b"abc"),
                        "aadhar_back": ("blob", b"abcd"),
                        "latlong": "28.6,77.2",
                    },
                )
        request = of_type(events, "request")[0]
        self.assertIn("/admin/network/agent/20810200/aeps-fingpay/activate", request["url"])
        self.assertTrue(request["headers"]["content-type"].startswith("multipart/form-data;"))
        fields = request["body"]["fields"]
        for key, value in {
            "account": "****2333",
            "aadhar": "****9012",
            "modelname": "MANTRA",
            "office_address": "****",
            "latlong": "****",
        }.items():
            self.assertEqual(fields[key], value, key)
        self.assertEqual(
            request["body"]["files"],
            [
                {"param": "pan_card", "ext": "jpg", "bytes": 5},
                {"param": "aadhar_front", "ext": "png", "bytes": 3},
                {"param": "aadhar_back", "ext": None, "bytes": 4},
            ],
        )
        self.assertNoSecrets(events)

    def test_pre_send_failure_is_a_single_error_event(self):
        client, events = make()
        t = Transport(ok())
        with patched(t):
            with self.assertRaisesRegex(EpsError, "Unknown endpoint"):
                client.call("no-such-slug")
            with self.assertRaisesRegex(EpsError, "Missing"):
                client.call("pan-lite", {"name": "Kumar"})
        self.assertEqual([e["event"] for e in events], ["init", "error", "error"])
        self.assertEqual(events[1]["error"], "EpsError")
        self.assertEqual(events[1]["slug"], "no-such-slug")
        self.assertRegex(events[1]["call_id"], r"^[0-9a-f]{8}$")
        self.assertEqual(t.requests, [])

    def test_logs_transport_failure_then_error(self):
        client, events = make(retries=0)
        failure = urllib.error.URLError(f"fetch failed for {DEV} 9876543210")
        with patched(Transport(failure)):
            with self.assertRaises(urllib.error.URLError):
                client.call(*MOBILE)
        self.assertEqual(
            [e["event"] for e in events], ["init", "request", "transport_error", "error"]
        )
        transport = of_type(events, "transport_error")[0]
        self.assertEqual(transport["attempt"], 1)
        self.assertEqual(transport["error"], "URLError")
        self.assertEqual(transport["message"], "<urlopen error fetch failed for **** ****3210>")
        self.assertIsInstance(transport["ms"], int)
        self.assertNotIn("status", transport)
        self.assertEqual(of_type(events, "error")[0]["error"], "URLError")
        self.assertNoSecrets(events)

    def test_body_read_failure_after_a_status_is_a_transport_error_with_status(self):
        broken = _response(b"")
        broken.read.side_effect = ConnectionResetError("reset")
        client, events = make(retries=0)
        with patched(Transport(broken)):
            with self.assertRaises(ConnectionResetError):
                client.call(*MOBILE)
        self.assertEqual(
            [e["event"] for e in events], ["init", "request", "transport_error", "error"]
        )
        self.assertEqual(of_type(events, "transport_error")[0]["status"], 200)

    def test_logs_each_retry_with_its_delay(self):
        client, events = make(retries=1)
        with patched(Transport(http(503, b"busy"), ok())):
            client.call(*MOBILE)
        self.assertEqual(
            [(e["event"], e.get("attempt")) for e in events],
            [
                ("init", None),
                ("request", 1),
                ("response", 1),
                ("retry", 1),
                ("request", 2),
                ("response", 2),
            ],
        )
        self.assertEqual(of_type(events, "retry")[0]["delay_ms"], 0)
        self.assertEqual(of_type(events, "response")[0]["body"], "busy")

    def test_logs_status_check_inquiry_under_its_own_call_id(self):
        client, events = make()
        with patched(Transport(http(503, b"busy"), ok(data={"tx_status": 0}))):
            with self.assertRaises(EpsIndeterminateError):
                client.call("dmt-initiate-transfer", TRANSFER)
        self.assertEqual(
            [e["slug"] for e in of_type(events, "request")],
            ["dmt-initiate-transfer", "transaction-inquiry"],
        )
        last = of_type(events, "error")[-1]
        self.assertEqual(last["error"], "EpsIndeterminateError")
        self.assertEqual(last["client_ref_id"], "ref123")
        self.assertEqual(len({e["call_id"] for e in events if "call_id" in e}), 2)
        otp = of_type(events, "request")[0]["body"]["otp"]
        self.assertEqual(otp, "****")

    def test_bounds_deep_and_huge_bodies(self):
        deep = "leaf"
        for _ in range(12):
            deep = {"data": deep}
        client, events = make()
        with patched(Transport(ok(**deep))):
            client.call(*MOBILE)
        body = json.dumps(of_type(events, "response")[0]["body"])
        self.assertIn('"****"', body)
        self.assertNotIn("leaf", body)

        big = {"data": [{"tid": f"t{i}".ljust(50, "0")} for i in range(3000)]}
        client, events = make()
        with patched(Transport(ok(**big))):
            client.call(*MOBILE)
        self.assertRegex(of_type(events, "response")[0]["body"], r"^\[\d+ bytes omitted\]$")


class DebugIsolation(DebugCase):
    """A sink that throws on every event leaves the outcome and request count
    exactly as with debug off."""

    @staticmethod
    def outcome(debug, script, slug, params):
        t = Transport(*script())
        client = EpsClient(
            DEV,
            ACCESS,
            "sandbox",
            initiator_id="9962981729",
            now=lambda: NOW,
            retry_base_delay=0,
            debug=debug,
        )
        with patched(t):
            try:
                return ("value", client.call(slug, params), len(t.requests))
            except Exception as exc:
                return (
                    type(exc).__name__,
                    str(exc),
                    getattr(exc, "status_check", None),
                    len(t.requests),
                )

    def test_throwing_sink_changes_nothing(self):
        def throwing(event):
            raise RuntimeError("sink exploded")

        class BrokenStderr:
            def write(self, s):
                raise OSError("stderr closed")

        cases = {
            "validation failure": (lambda: [ok()], "pan-lite", {"name": "x"}),
            "successful financial call": (
                lambda: [ok(data={"tid": "1"})],
                "dmt-initiate-transfer",
                TRANSFER,
            ),
            "indeterminate financial call": (
                lambda: [http(503, b"busy"), ok(data={"tx_status": 0})],
                "dmt-initiate-transfer",
                TRANSFER,
            ),
        }
        for name, (script, slug, params) in cases.items():
            with self.subTest(name):
                off = self.outcome(False, script, slug, params)
                self.assertEqual(self.outcome(throwing, script, slug, params), off)
                with mock.patch("sys.stderr", BrokenStderr()):
                    self.assertEqual(self.outcome(True, script, slug, params), off)


class MaskerUrlAlignment(unittest.TestCase):
    masker = Masker(
        {"safe": ["tid", "user_code"], "last4": ["customer_id"], "text": [], "nest": []},
        None,
    )
    base = "https://h/v3"

    def url(self, u):
        return self.masker.url(u, self.base, "/x/{customer_id}/y", [], [])

    def test_masks_path_params_and_query_values_by_class(self):
        self.assertEqual(
            self.url(f"{self.base}/x/9876543210/y?tid=1&k%40x=2"),
            f"{self.base}/x/****3210/y?tid=1&#1=****",
        )

    def test_keeps_an_encoded_slash_inside_its_segment(self):
        self.assertEqual(self.url(f"{self.base}/x/98765%2F43210/y"), f"{self.base}/x/****3210/y")

    def test_masks_a_safe_query_value_that_is_not_safe_shaped(self):
        self.assertEqual(
            self.url(f"{self.base}/x/1/y?tid=KUMAR%20123456789012"),
            f"{self.base}/x/****/y?tid=****",
        )

    def test_fails_closed(self):
        for name, u in (
            ("another base", "https://evil/v3/x/1/y"),
            ("a different literal segment", f"{self.base}/z/1/y"),
            ("an extra segment", f"{self.base}/x/1/y/z"),
            ("a malformed escape", f"{self.base}/x/%E0%A4%A/y"),
            ("invalid UTF-8", f"{self.base}/x/%FF/y"),
        ):
            with self.subTest(name):
                self.assertEqual(self.url(u), "[unavailable]")


if __name__ == "__main__":
    unittest.main()
