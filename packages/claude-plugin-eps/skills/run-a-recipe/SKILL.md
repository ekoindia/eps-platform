---
name: run-a-recipe
description: Use when running or executing a multi-step EPS flow end to end — fetches the runbook via the eps MCP and executes each step's endpoint in order, branching on response_status_id.
---

# Run an EPS recipe

1. Use the `eps` MCP `list_recipes` to find the runbook, then `get_recipe(id)` for the steps (e.g. `dmt-fino-send-money`, `aeps-cash-withdrawal`).
2. Read `get_topic('auth')` — every call is signed server-side; never expose `access_key`.
3. Execute each step's endpoint (`specSlug`) in order, signing each request.
4. Honor the documented `response_status_id` branches: jump to the branch's `goto` slug when a status matches (e.g. `463` → onboard the sender via `dmt-onboard-sender`), or stop when `goto` is `done`.
5. Carry forward IDs from each response into the next step's params.
