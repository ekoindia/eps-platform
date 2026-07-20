Returns every service enabled for the given `user_code`, with each service's
activation status, ops-verification status and timestamps. Use it to audit which
services one of your agents can actually transact on.

## Service status (`service_status_list[].status`)

Not to be confused with the top-level `status` — this one lives on each
entry of `service_status_list`.

| `status` | `status_desc` | Meaning |
|---|---|---|
| 0 | `DEACTIVATED` | Agent must re-upload their documents using the Activate Service API |
| 1 | `ACTIVATED` | Service is live and usable |
| 2 | `PENDING` | Activation pending for this agent |

> [!NOTE]
> Once the agent re-uploads their documents from the DEACTIVATED state, the
> service moves to PENDING — not straight back to ACTIVATED.

## Verification status (`verification_status`)

Tells you the action taken by the Eko operations team on the agent's documents
for that service.

| `verification_status` | Meaning |
|---|---|
| 0 | Not applicable — this service needs no ops verification |
| 1 | Verified — documents verified by the ops team |
| 2 | Rejected — rejection reason is in the entry's `comments` field |
| 3 | Pending — action pending from the ops team |
