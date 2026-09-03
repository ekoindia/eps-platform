"""Cross-language conformance suite for the Python SDK.

Ported case for case from `packages/sdk-php/tests/EpsClientTest.php`, which is
itself the executable form of `docs/sdk-golden-vector.md`. Any divergence here
is a divergence on the wire.
"""

import io
import json
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

from eps_sdk import (
    MULTIPART_JSON_FIELD,
    EpsClient,
    EpsError,
    EpsHttpError,
    sign_secret_key,
)
from eps_sdk.client import _encode_multipart

# from docs/sdk-golden-vector.md
GOLDEN = "u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk="
ACCESS_KEY = "TEST_ACCESS_KEY_DO_NOT_USE"
FIXED_MS = 1700000000000

THIS_FILE = str(Path(__file__).resolve())

ADDRESS = {"line": "Shop 5", "city": "Patna", "state": "Bihar", "pincode": "800001"}


def client(**kwargs) -> EpsClient:
    return EpsClient(
        developer_key="dev123",
        access_key=ACCESS_KEY,
        environment="sandbox",
        now=lambda: FIXED_MS,
        **kwargs,
    )


def aeps_params(**overrides):
    """Every required param of `activate-aeps-fingpay`, so a test that targets
    one guard is not short-circuited by the missing-param guard."""
    params = {
        "initiator_id": "9962981729",
        "user_code": "20810200",
        "modelname": "Morpho 1300E3",
        "devicenumber": "SN1234567890",
        "account": "38759149196",
        "ifsc": "SBIN0007515",
        "shop_type": 4215,
        "office_address": ADDRESS,
        "address_as_per_proof": ADDRESS,
        "pan_card": THIS_FILE,
        "aadhar": "123456789012",
        "aadhar_front": THIS_FILE,
        "aadhar_back": THIS_FILE,
        "latlong": "28.6139,77.2090",
    }
    params.update(overrides)
    return params


def multipart_payload(body: bytes) -> dict:
    """Pull the `form-data` JSON envelope back out of an encoded multipart body."""
    marker = f'name="{MULTIPART_JSON_FIELD}"'.encode()
    start = body.index(marker)
    start = body.index(b"\r\n\r\n", start) + 4
    end = body.index(b"\r\n--", start)
    return json.loads(body[start:end])


class TestSigning(unittest.TestCase):
    def test_golden_vector(self):
        self.assertEqual(GOLDEN, sign_secret_key(ACCESS_KEY, str(FIXED_MS)))

    def test_builds_signed_headers(self):
        headers = client().build_headers()
        self.assertEqual("dev123", headers["developer_key"])
        self.assertEqual(GOLDEN, headers["secret-key"])
        self.assertEqual(str(FIXED_MS), headers["secret-key-timestamp"])

    def test_multipart_headers_omit_content_type(self):
        headers = client().build_headers(multipart=True)
        self.assertNotIn("content-type", headers)
        self.assertEqual(GOLDEN, headers["secret-key"])  # still signed
        self.assertEqual("application/json", client().build_headers()["content-type"])

    def test_unknown_environment_rejected(self):
        with self.assertRaisesRegex(EpsError, "Unknown environment"):
            EpsClient("dev123", ACCESS_KEY, "moon")

    def test_unknown_slug_rejected(self):
        with self.assertRaisesRegex(EpsError, "Unknown endpoint slug"):
            client().resolve_target("no-such-endpoint", {})


class TestRouting(unittest.TestCase):
    def test_get_puts_non_path_params_in_query_string_no_body(self):
        target = client().resolve_target(
            "dmt-get-sender",
            {
                "customer_id": "9123456789",
                "initiator_id": "9962981729",
                "user_code": "20810200",
            },
        )
        self.assertIn("/customer/payment/dmt-fino/sender/9123456789", target.url)
        self.assertIn("initiator_id=9962981729", target.url)
        self.assertIn("user_code=20810200", target.url)
        self.assertNotIn("{customer_id}", target.url)
        self.assertIsNone(target.body)

    def test_json_endpoint_still_sends_json_body(self):
        target = client().resolve_target(
            "pan-lite",
            {
                "initiator_id": "9962981729",
                "pan_number": "ABCDE1234F",
                "name": "Test Name",
                "dob": "1990-01-01",
            },
        )
        self.assertFalse(target.multipart)
        self.assertIn(b'"pan_number":"ABCDE1234F"', target.body)


class TestValidation(unittest.TestCase):
    def test_throws_when_required_param_missing(self):
        # dmt-get-sender requires initiator_id and customer_id (user_code is optional).
        with self.assertRaisesRegex(
            EpsError, r"Missing required params.*initiator_id.*customer_id"
        ):
            client().resolve_target("dmt-get-sender", {"user_code": "20810200"})

    def test_throws_when_required_param_null(self):
        with self.assertRaisesRegex(EpsError, r"Missing required params.*customer_id"):
            client().resolve_target(
                "dmt-get-sender",
                {"initiator_id": "9962981729", "customer_id": None},
            )

    def test_accepts_numeric_string_for_number_param(self):
        # bbps-get-operators: category is an optional `number` param.
        target = client().resolve_target(
            "bbps-get-operators",
            {
                "initiator_id": "9962981729",
                "user_code": "20810200",
                "category": "5",
            },
        )
        self.assertIn("category=5", target.url)

    def test_accepts_plain_number_for_number_param(self):
        target = client().resolve_target(
            "bbps-get-operators",
            {"initiator_id": "9962981729", "user_code": "20810200", "category": 5},
        )
        self.assertIn("category=5", target.url)

    def test_throws_on_type_mismatch(self):
        with self.assertRaisesRegex(
            EpsError, r"Invalid param types.*category \(expected number\)"
        ):
            client().resolve_target(
                "bbps-get-operators",
                {
                    "initiator_id": "9962981729",
                    "user_code": "20810200",
                    "category": "abc",
                },
            )

    def test_throws_on_object_for_number_param(self):
        with self.assertRaisesRegex(
            EpsError, r"Invalid param types.*category \(expected number\)"
        ):
            client().resolve_target(
                "bbps-get-operators",
                {
                    "initiator_id": "9962981729",
                    "user_code": "20810200",
                    "category": {},
                },
            )

    def test_rejects_non_file_value_for_file_param(self):
        with self.assertRaisesRegex(
            EpsError, r"Invalid param types.*pan_card \(expected file\)"
        ):
            client().resolve_target(
                "activate-aeps-fingpay",
                aeps_params(pan_card="/no/such/file.jpg"),
            )


class TestClientLevelDefaults(unittest.TestCase):
    def test_injects_client_level_initiator_id_and_user_code(self):
        target = client(
            initiator_id="9962981729", user_code="20810200"
        ).resolve_target("dmt-get-sender", {"customer_id": "9123456789"})
        self.assertIn("initiator_id=9962981729", target.url)
        self.assertIn("user_code=20810200", target.url)

    def test_per_call_param_overrides_client_level_default(self):
        target = client(
            initiator_id="9962981729", user_code="20810200"
        ).resolve_target(
            "dmt-get-sender",
            {"customer_id": "9123456789", "initiator_id": "1111111111"},
        )
        self.assertIn("initiator_id=1111111111", target.url)
        self.assertNotIn("initiator_id=9962981729", target.url)
        self.assertIn("user_code=20810200", target.url)  # default still used

    def test_explicit_null_per_call_clears_the_default(self):
        with self.assertRaisesRegex(EpsError, r"Missing required params.*initiator_id"):
            client(initiator_id="9962981729", user_code="20810200").resolve_target(
                "dmt-get-sender",
                {"customer_id": "9123456789", "initiator_id": None},
            )


class TestMultipart(unittest.TestCase):
    def test_multipart_endpoint_builds_json_envelope_with_files(self):
        target = client().resolve_target("activate-aeps-fingpay", aeps_params())
        self.assertIn("/admin/network/agent/20810200/aeps-fingpay/activate", target.url)
        self.assertTrue(target.multipart)
        self.assertTrue(target.headers["content-type"].startswith("multipart/form-data;"))
        # Every non-file value rides in ONE `form-data` JSON field, never a form
        # field of its own; nested objects stay nested rather than stringified.
        payload = multipart_payload(target.body)
        self.assertEqual("Morpho 1300E3", payload["modelname"])
        self.assertEqual("38759149196", payload["account"])
        self.assertEqual(ADDRESS, payload["office_address"])
        self.assertNotIn("pan_card", payload)
        self.assertNotIn("user_code", payload)  # filled the path
        # Files become their own parts, named by the param.
        self.assertIn(b'name="pan_card"; filename=', target.body)
        self.assertIn(b'name="aadhar_front"; filename=', target.body)

    def test_accepts_in_memory_file_tuple(self):
        target = client().resolve_target(
            "activate-aeps-fingpay",
            aeps_params(pan_card=("pan.jpg", b"\x89PNG-not-really")),
        )
        self.assertIn(b'name="pan_card"; filename="pan.jpg"', target.body)
        self.assertIn(b"\x89PNG-not-really", target.body)

    def test_multipart_omits_null_params_but_keeps_nested_nulls(self):
        body, _ = _encode_multipart(
            {
                # A null param has no form encoding, so it is dropped entirely...
                "extra_note": None,
                # ...but a null INSIDE a value is real data JSON preserves.
                "office_address": {"line": "Shop 5", "state": None},
                "pan_card": THIS_FILE,
            },
            {"pan_card"},
        )
        payload = multipart_payload(body)
        self.assertNotIn("extra_note", payload)
        self.assertEqual({"line": "Shop 5", "state": None}, payload["office_address"])

    def test_multipart_raises_when_the_envelope_cannot_be_encoded(self):
        # Without this guard an unencodable value would blank the whole non-file
        # payload and the request would fail far from its cause.
        with self.assertRaisesRegex(EpsError, "could not be JSON-encoded"):
            _encode_multipart({"office_address": object()}, set())


if __name__ == "__main__":
    unittest.main()


class ResponseContract(unittest.TestCase):
    """The response/error contract shared by all five SDKs.

    See the "Response and error contract conformance" section of
    docs/sdk-golden-vector.md.
    """

    PAN_PARAMS = {
        "initiator_id": "9962981729",
        "pan_number": "BNZAA2318J",
        "name": "Rahul Sharma",
        "dob": "1990-01-01",
    }

    @staticmethod
    def _ok(raw: bytes, status: int = 200):
        """A context-manager stand-in for the urlopen response object."""
        response = mock.MagicMock()
        response.read.return_value = raw
        response.status = status
        response.__enter__.return_value = response
        return response

    def test_raises_eps_http_error_on_non_2xx(self):
        error = urllib.error.HTTPError(
            "https://x/y", 403, "Forbidden", {}, io.BytesIO(b'{"status":403}')
        )
        with mock.patch("eps_sdk.client.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(EpsHttpError) as ctx:
                client().call("pan-lite", self.PAN_PARAMS)
        self.assertEqual(ctx.exception.status, 403)
        self.assertIn("/tools/kyc/pan-lite", ctx.exception.url)
        self.assertEqual(ctx.exception.body, {"status": 403})
        self.assertEqual(ctx.exception.raw, b'{"status":403}')

    def test_keeps_none_body_for_non_json_error_payload(self):
        error = urllib.error.HTTPError(
            "https://x/y", 502, "Bad Gateway", {}, io.BytesIO(b"<html>502</html>")
        )
        with mock.patch("eps_sdk.client.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(EpsHttpError) as ctx:
                client().call("pan-lite", self.PAN_PARAMS)
        self.assertIsNone(ctx.exception.body)
        self.assertEqual(ctx.exception.raw, b"<html>502</html>")

    def test_raises_when_a_2xx_body_is_not_json(self):
        with mock.patch(
            "eps_sdk.client.urllib.request.urlopen",
            return_value=self._ok(b"not json"),
        ):
            with self.assertRaisesRegex(EpsError, "was not valid JSON"):
                client().call("pan-lite", self.PAN_PARAMS)

    def test_returns_the_envelope_on_2xx(self):
        with mock.patch(
            "eps_sdk.client.urllib.request.urlopen",
            return_value=self._ok(b'{"status":0}'),
        ):
            self.assertEqual(
                client().call("pan-lite", self.PAN_PARAMS), {"status": 0}
            )

    def test_default_timeout_is_30_seconds(self):
        self.assertEqual(client().timeout, 30.0)


# ── Shared fixtures for the suites below (docs/sdk-golden-vector.md) ─────────

import re
import socket

from eps_sdk import EpsIndeterminateError, generate_client_ref_id
from eps_sdk.client import _base36, value_problem

REF = re.compile(r"^[0-9a-z]{15}$")
#: pan-lite: POST, not financial.
PAN = {
    "initiator_id": "9962981729",
    "pan_number": "BNZAA2318J",
    "name": "Rahul Sharma",
    "dob": "1990-01-01",
}
#: dmt-initiate-transfer: POST, financial, client_ref_id required.
TRANSFER = {
    "initiator_id": "9962981729",
    "customer_id": "9123456789",
    "recipient_id": "1",
    "amount": 100,
    "otp": "123456",
    "otp_ref_id": "ref1",
}
GET = ("bbps-get-operators", {"initiator_id": "9962981729"})


def _response(raw: bytes, status: int = 200):
    response = mock.MagicMock()
    response.read.return_value = raw
    response.status = status
    response.__enter__.return_value = response
    return response


def _http(status: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        "https://x/y", status, "err", {}, io.BytesIO(b'{"status":1}')
    )


class Transport:
    """Scripted urlopen: each entry is a response, or an exception to raise.
    Records every request so URLs, bodies and headers can be asserted."""

    def __init__(self, *script):
        self.script = list(script)
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        step = self.script.pop(0) if len(self.script) > 1 else self.script[0]
        if isinstance(step, BaseException):
            raise step
        return step

    def body(self, i=0):
        return json.loads(self.requests[i].data)

    def url(self, i=0):
        return self.requests[i].full_url


def patched(transport):
    return mock.patch("eps_sdk.client.urllib.request.urlopen", side_effect=transport)


def fast(**kwargs):
    """A client whose retries never sleep."""
    kwargs = {"now": lambda: FIXED_MS, "retry_base_delay": 0, **kwargs}
    return EpsClient(
        developer_key="dev123", access_key=ACCESS_KEY, environment="sandbox", **kwargs
    )


OK = b'{"status":0}'


class ClientRefId(unittest.TestCase):
    def test_generate_client_ref_id_shape(self):
        a = generate_client_ref_id(FIXED_MS)
        b = generate_client_ref_id(FIXED_MS)
        self.assertRegex(a, REF)
        self.assertTrue(a.startswith(_base36(FIXED_MS)))
        self.assertNotEqual(a, b)

    def test_generated_for_non_get_without_one(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call("pan-lite", PAN)
        self.assertRegex(t.body()["client_ref_id"], REF)

    def test_supplied_value_kept(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call("pan-lite", {**PAN, "client_ref_id": "MY-REF_1"})
        self.assertEqual(t.body()["client_ref_id"], "MY-REF_1")

    def test_satisfies_a_required_client_ref_id(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call("dmt-initiate-transfer", TRANSFER)
        self.assertRegex(t.body()["client_ref_id"], REF)

    def test_not_added_to_get(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call(*GET)
        self.assertNotIn("client_ref_id", t.url())

    def test_not_added_when_endpoint_omits_it(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call("get-refund-otp", {"initiator_id": "9962981729", "tid": "1"})
        self.assertNotIn("client_ref_id", t.body())

    def test_differs_between_calls(self):
        t = Transport(_response(OK))
        with patched(t):
            c = fast()
            c.call("pan-lite", PAN)
            c.call("pan-lite", PAN)
        self.assertNotEqual(t.body(0)["client_ref_id"], t.body(1)["client_ref_id"])

    def test_empty_string_counts_as_supplied(self):
        t = Transport(_response(OK))
        with patched(t):
            with self.assertRaisesRegex(
                EpsError, r"client_ref_id \(expected format client-ref\)"
            ):
                fast().call("pan-lite", {**PAN, "client_ref_id": ""})
        self.assertEqual(t.requests, [])


class RetryAndStatusCheck(unittest.TestCase):
    def test_get_retries_500_then_succeeds_resigning(self):
        clock = iter(range(FIXED_MS, FIXED_MS + 10))
        t = Transport(_http(500), _response(OK))
        with patched(t):
            self.assertEqual(fast(now=lambda: next(clock)).call(*GET), {"status": 0})
        self.assertEqual(len(t.requests), 2)
        ts = [r.get_header("Secret-key-timestamp") for r in t.requests]
        self.assertNotEqual(ts[0], ts[1])

    def test_get_indeterminate_every_attempt_then_raises(self):
        for failure in (
            urllib.error.URLError("fetch failed"),
            socket.timeout("timed out"),
            _http(429),
            _http(503),
        ):
            t = Transport(failure)
            with patched(t):
                with self.assertRaises(Exception):
                    fast().call(*GET)
            self.assertEqual(len(t.requests), 3, failure)

    def test_get_does_not_retry_4xx(self):
        t = Transport(_http(400))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast().call(*GET)
        self.assertEqual(len(t.requests), 1)

    def test_retries_zero_disables(self):
        t = Transport(_http(500))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast(retries=0).call(*GET)
        self.assertEqual(len(t.requests), 1)

    def test_post_never_retried(self):
        t = Transport(_http(500))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast().call("pan-lite", PAN)
        self.assertEqual(len(t.requests), 1)

    def test_financial_post_5xx_inquires_and_raises_indeterminate(self):
        inquiry = {"status": 0, "data": {"tx_status": "0", "tid": "1"}}
        t = Transport(_http(502), _response(json.dumps(inquiry).encode()))
        with patched(t):
            with self.assertRaises(EpsIndeterminateError) as ctx:
                fast().call("dmt-initiate-transfer", TRANSFER)
        e = ctx.exception
        ref = t.body(0)["client_ref_id"]
        self.assertEqual(e.client_ref_id, ref)
        self.assertEqual(e.slug, "dmt-initiate-transfer")
        self.assertEqual(e.status, 502)
        self.assertEqual(e.status_check, inquiry)
        self.assertIsNone(e.status_check_error)
        self.assertIsInstance(e.__cause__, EpsHttpError)
        self.assertEqual(
            str(e),
            f'EPS request for "dmt-initiate-transfer" with client_ref_id "{ref}" '
            "has no confirmed outcome.",
        )
        self.assertEqual(len(t.requests), 2)
        self.assertIn(
            f"/tools/reference/transaction/client_ref_id%3A{ref}?initiator_id=9962981729",
            t.url(1),
        )
        self.assertEqual(t.requests[1].get_method(), "GET")

    def test_financial_post_transport_failure_reuses_supplied_ref(self):
        t = Transport(urllib.error.URLError("fetch failed"), _response(OK))
        with patched(t):
            with self.assertRaises(EpsIndeterminateError) as ctx:
                fast().call("dmt-initiate-transfer", {**TRANSFER, "client_ref_id": "MY-REF"})
        self.assertEqual(ctx.exception.client_ref_id, "MY-REF")
        self.assertIsNone(ctx.exception.status)
        self.assertIsInstance(ctx.exception.__cause__, urllib.error.URLError)
        self.assertIn("client_ref_id%3AMY-REF", t.url(1))

    def test_failing_inquiry_lands_on_status_check_error(self):
        t = Transport(_http(500), _http(503))
        with patched(t):
            with self.assertRaises(EpsIndeterminateError) as ctx:
                fast().call("dmt-initiate-transfer", TRANSFER)
        e = ctx.exception
        self.assertIsNone(e.status_check)
        self.assertEqual(e.status_check_error.status, 503)
        self.assertEqual(e.__cause__.status, 500)
        self.assertEqual(len(t.requests), 1 + 3)

    def test_financial_post_4xx_is_plain_http_error(self):
        t = Transport(_http(403))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast().call("dmt-initiate-transfer", TRANSFER)
        self.assertEqual(len(t.requests), 1)

    def test_non_financial_post_5xx_no_inquiry(self):
        t = Transport(_http(500))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast().call("pan-lite", PAN)
        self.assertEqual(len(t.requests), 1)

    def test_financial_without_ref_param_no_inquiry(self):
        t = Transport(_http(500))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast().call(
                    "initiate-refund", {"initiator_id": "9962981729", "tid": "1", "otp": "1"}
                )
        self.assertEqual(len(t.requests), 1)

    def test_auto_status_check_off(self):
        t = Transport(_http(500))
        with patched(t):
            with self.assertRaises(EpsHttpError):
                fast(auto_status_check=False).call("dmt-initiate-transfer", TRANSFER)
        self.assertEqual(len(t.requests), 1)

    def test_rejects_bad_knobs_at_construction(self):
        for bad in (-1, 1.5, True):
            with self.assertRaisesRegex(EpsError, "Invalid retries"):
                client(retries=bad)
        for bad in (-1, float("nan")):
            with self.assertRaisesRegex(EpsError, "Invalid retry_base_delay"):
                client(retry_base_delay=bad)
        for bad in (0, -1, float("nan"), float("inf")):
            with self.assertRaisesRegex(EpsError, "Invalid timeout"):
                client(timeout=bad)


class ValueValidation(unittest.TestCase):
    def test_rejects_bad_format_and_sends_nothing(self):
        t = Transport(_response(OK))
        with patched(t):
            with self.assertRaises(EpsError) as ctx:
                fast().call("pan-lite", {**PAN, "dob": "01-01-1990"})
        self.assertEqual(
            str(ctx.exception),
            'Invalid param values for "pan-lite": dob (expected format date).',
        )
        self.assertEqual(t.requests, [])

    def test_lists_every_offender_in_surface_order(self):
        with self.assertRaises(EpsError) as ctx:
            client().call("pan-lite", {**PAN, "pan_number": "bad", "dob": "1990-1-1"})
        self.assertEqual(
            str(ctx.exception),
            'Invalid param values for "pan-lite": pan_number (expected format pan), '
            "dob (expected format date).",
        )

    def test_whole_string_match_rejects_trailing_newline(self):
        with self.assertRaisesRegex(EpsError, r"dob \(expected format date\)"):
            client().call("pan-lite", {**PAN, "dob": "1990-01-01\n"})

    def test_unconstrained_param_passes(self):
        t = Transport(_response(OK))
        with patched(t):
            fast().call("pan-lite", {**PAN, "name": "anything at all \n"})
        self.assertEqual(len(t.requests), 1)

    def test_value_problem_helper(self):
        formats = {"date": re.compile(r"^\d{4}-\d{2}-\d{2}$")}

        def check(value, **param):
            return value_problem({"name": "x", "type": "string", **param}, value, formats)

        self.assertIsNone(check("1", enum=[1, 2]))
        self.assertEqual(check(3, enum=[1, 2]), "not one of: 1, 2")
        self.assertIsNone(check("1", type="number", min=1, max=5))
        self.assertIsNone(check(5, type="number", min=1, max=5))
        self.assertEqual(check(0.5, type="number", min=1), "below min 1")
        self.assertEqual(check("6", type="number", max=5), "above max 5")
        self.assertIsNone(check("abc", maxLength=3))
        self.assertEqual(check("é€", maxLength=3), "longer than 3 bytes")
        self.assertEqual(check("b", enum=["a"], format="date"), "not one of: a")
        self.assertEqual(check("x", format="date", maxLength=1), "expected format date")
        self.assertIsNone(check({"a": 1}, type="object", maxLength=1))
