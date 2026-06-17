# SDK golden signing vector

Cross-language conformance fixture. Every SDK core must reproduce this.

- access_key: `TEST_ACCESS_KEY_DO_NOT_USE`
- secret-key-timestamp: `1700000000000`
- expected secret-key (base64): `u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=`

Algorithm: `base64(HMAC-SHA256(message = timestamp, key = base64(access_key)))`.
