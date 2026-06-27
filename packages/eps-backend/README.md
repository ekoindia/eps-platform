# @ekoindia/eps-backend

Standalone BFF for the EPS platform. Developer login via mobile+OTP and admin
login via GitHub OAuth, delegating OTP + profile to the Eko backend
("SimpliBank"). Stateless except for ephemeral KV (rate-limit + refresh tokens).

## Run

	cp .env.example .env   # fill in secrets
	npm run build -w @ekoindia/eps-backend
	npm start -w @ekoindia/eps-backend

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /auth/otp/start | none | Send mobile OTP (Eko 515) |
| POST | /auth/otp/verify | none | Verify OTP (518), fetch profile (151), set session |
| GET  | /me | cookie | Profile + lifecycle state |
| POST | /auth/refresh | refresh cookie | Rotate session |
| POST | /auth/logout | cookie | Revoke session |
| GET  | /auth/admin/github | none | Begin admin OAuth |
| GET  | /auth/admin/github/callback | none | Complete admin OAuth |
| GET  | /healthz | none | Liveness |

## Deferred

`/credentials` (UAT/live key view/generate) — pending the Eko credential
issuance API contract. See the design spec.
