"""Backend-only Python SDK for Eko Platform Services (EPS) APIs.

    from eps_sdk import EpsClient

    client = EpsClient(
        developer_key="...",
        access_key="...",
        environment="sandbox",
        initiator_id="9962981729",
    )
    sender = client.call("dmt-get-sender", {"customer_id": "9123456789"})

Never instantiate this in anything a browser can reach — `access_key` signs
every request and must stay server-side.
"""

from .client import (
    MULTIPART_JSON_FIELD,
    EpsClient,
    EpsError,
    EpsHttpError,
    Target,
    sign_secret_key,
)

__all__ = [
    "EpsClient",
    "EpsError",
    "EpsHttpError",
    "MULTIPART_JSON_FIELD",
    "Target",
    "sign_secret_key",
]
