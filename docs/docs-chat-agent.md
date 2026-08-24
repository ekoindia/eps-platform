# AI docs-chat agent (`POST /chat/ask`)

A signed-in developer asks an EPS integration question in the ⌘K palette and
gets a grounded answer, with citations, without leaving the docs.

**Status:** built, shipped dark. Both switches are off by default — the backend
has no `EPS_CHAT_*` configured, and `VITE_SHOW_AI_CHAT=false`.

---

## Why it exists

Every AI surface EPS had before this one outsources the inference:

| Surface | What it does |
| --- | --- |
| "Ask AI" header column | Deep-links to ChatGPT / Claude / Gemini / Perplexity with a prompt pointing at the site, relying on the `.md` twins and `llms.txt` |
| `eps-context-mcp` (stdio + `/context/mcp`) | Serves bundle slices to *the user's* agent. Read-only, LLM-free |
| Zoho SalesIQ | Human live chat |

They all work, and they all depend on the developer already having an assistant
open. This is the first surface where EPS pays for the inference and therefore
controls the answer — which matters because of one fact in particular:

```
secret-key = base64(HMAC-SHA256(timestamp, base64(access_key)))
```

That is not what a general-purpose model guesses. The single most common EPS
integration failure is a developer confidently signing requests the wrong way,
and this feature exists to make the correct answer the easy one.

## How it answers

**Agentic tool use over the live bundle, not stuffed-context retrieval.**

The model is given the same lookups `eps-context-mcp` exposes and decides which
to call: `search_apis` → `get_api`, `get_topic("auth")`, `get_signing_snippet`,
`list_recipes` → `get_recipe`. Calls are dispatched **in-process** against the
bundle already held by `src/context/bundleManager.ts`.

```
browser ── POST /chat/ask ──▶ eps-backend
                                │  ├─ round 1: model asks for get_topic("auth")
                                │  ├─ dispatch in-process ▶ bundleManager.bundle
                                │  ├─ round 2: model answers from the result
                                └──◀ { answer, sources, usage }
```

Two designs were rejected getting here:

- **Retrieve-then-answer** (the original 2026-07-02 spec): run `searchApis` on
  the user's text, stuff the top slices into one call. Simpler, but we own
  retrieval quality, and it fails exactly where a chat assistant must not — a
  follow-up like *"and what goes in the timestamp?"* lexically matches nothing.
- **Anthropic's MCP connector** pointed at `https://mcp.eko.in/context/mcp`.
  Same model-driven retrieval, but each tool call would leave the process, cross
  the public internet, hit our own nginx and re-enter the same process, several
  times per question — while pinning v1 to one provider.

The in-process dispatch keeps the model-driven behaviour and drops the loop.

## Grounding, and what a citation means

`sources` is built from the tool calls that actually **returned content**, never
from model output — a model cannot fabricate a citation here because it does not
author the list. A `search_apis` hit list is deliberately *not* a source: it
proves the model looked, not that anything it found informed the answer.

Ids are canonical: `topic:auth`, `api:pan-verify`, `recipe:onboard-user`,
`signing:php`. The UI renders them via `sourceLabel()`.

## Configuration

Backend env, bounds, error codes and the privacy/privilege guarantees are
documented in [`packages/eps-backend/README.md`](../packages/eps-backend/README.md)
under **AI docs-chat**. Frontend: `VITE_SHOW_AI_CHAT` (see `.env.example`).

Two independent switches, and the backend is authoritative:

1. **Backend** — no `EPS_CHAT_PROVIDER`/`EPS_CHAT_API_KEY` (or no
   `CONTEXT_BUNDLE_URL`, so no bundle to ground on) ⇒ `503 CHAT_DISABLED`.
2. **Frontend** — `VITE_SHOW_AI_CHAT` gates whether the palette row renders.
   SSG cannot know the backend's runtime state, so this is a build-time hint,
   not a guarantee. A `503 CHAT_DISABLED` at runtime hides the row for the rest
   of the session.

## Files

| Path | Role |
| --- | --- |
| `packages/eps-backend/src/context/bundleManager.ts` | Shared, TTL-refreshed bundle. Used by `/context/*` **and** chat |
| `packages/eps-backend/src/chat/tools.ts` | Tool schemas + in-process dispatch, arg validation, result caps |
| `packages/eps-backend/src/chat/providers.ts` | `anthropic` + `openai-compatible` adapters over a neutral message shape |
| `packages/eps-backend/src/chat/spend.ts` | Best-effort monthly cost guard (weighted micro-USD) |
| `packages/eps-backend/src/http/chat.ts` | Route: guard, body limits, the tool loop, `sources` |
| `src/lib/chat.ts` | Shared types, `trimHistory`, `sourceLabel` |
| `src/components/AskAiDialog.tsx` | Popup conversation; lazy chunk (~4.5 kB) |
| `src/components/CommandPalette.tsx` | The gated "Ask AI: …" row |

## Rollout

1. Deploy with `EPS_CHAT_*` unset. Confirm `/chat/ask` answers `503
   CHAT_DISABLED` for a valid developer session and no palette row appears.
2. Set the env on UAT with a real key and a small
   `EPS_CHAT_MONTHLY_BUDGET_USD`. Ask **"how do I compute the secret-key
   header?"** — the answer must state
   `base64(HMAC-SHA256(timestamp, base64(access_key)))` and cite `topic:auth`.
   If that is wrong, the tool loop is broken; nothing else matters.
3. Follow up with **"and what goes in the timestamp?"** — must stay correct
   without the question restating context. This is the case retrieve-then-answer
   would have failed.
4. Watch `chatspend:<YYYY-MM>` advance and confirm the access log carries `rid`
   with no message text.
5. Flip `VITE_SHOW_AI_CHAT=true` on the same deploy that sets the backend env.

## Known limits

- **Logged-in developers and admins only.** Anonymous evaluators — most of the
  docs site's traffic — see nothing. Public access needs a per-IP limiter tier,
  bot defense and a harder spend ceiling; none of it is foreclosed by this
  design, but none of it is built.
- **Buffered, not streamed.** A multi-round answer can take several seconds with
  a spinner. SSE is the obvious v2 if that reads as slow.
- **The spend guard is best-effort**, not a hard ceiling — see the backend
  README for what that permits and why the per-login limit is the real gate.
- **Two copies of the request limits** (backend `http/chat.ts`, frontend
  `lib/chat.ts`). The browser bundle must not import backend code, so they are
  kept in step by hand.
