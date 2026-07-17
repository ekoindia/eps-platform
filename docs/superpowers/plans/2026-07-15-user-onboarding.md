# User Onboarding (Self-Serve Signup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let new users sign up on `/signup` — OTP → create partial account → verify PAN → set a 4-digit secret PIN → become an EPS Admin — with resume after drop-off.

**Architecture:** `eps-backend` (a Hono BFF) gains a `signup`-role session and four `/signup/*` endpoints. All upstream calls reuse the existing form-encoded SimpliBank client (`clients/eko.ts`) with `developer_key` — there is **no per-user Bearer token**. The upstream profile (interaction 151) is the single source of truth for progress: every step re-fetches it and returns fresh state. The frontend is a centered card wizard driven by a two-entry step registry.

**Tech Stack:** React 19.2.7, react-router-dom 7.18, Vite 8.1, TypeScript 6.0.3, Tailwind 4.3, shadcn/ui + Radix, Hono (backend), Vitest + @testing-library/react + jsdom.

**Design spec:** `docs/superpowers/specs/2026-07-15-user-onboarding-design.md` — read it before starting.

**Worktree:** `/Users/abhi/DEV/eko_github/eko-eps-website-onboarding`, branch `feature/user-onboarding`. All paths below are relative to it.

## Global Constraints

- **Indentation: tabs.** Every file in this repo uses tabs. Match it.
- **Type hints required** — TypeScript interfaces on every exported function and object.
- **JSDoc on every new exported function**, matching the existing density (see `clients/eko.ts`, `audit/ekoLog.ts`).
- **No new dependencies.** `input-otp@^1.4.2` is already in `package.json` and currently unused — use it. Do not add anything else.
- **Conventional commits.** No `Co-Authored-By` trailer.
- **Never switch branches.** Work only in the worktree above, on `feature/user-onboarding`.
- **Upstream identity:** `user_id` is NEVER sent upstream. Use `initiator_id` + `user_code` + `org_id`.
- **Constants, exact values:** `applicant_type: 1`, `business_vertical: "EPS"`, `source: "EPS"`, `latlong: "27.176670,78.008075,7787"`, `doc_type: 2`, `intent_id: 3`.
- **Interaction ids:** 521 create partial account, 523 upload document, 170 get booklet number, 10005 fetch pintwin, 5 set secret PIN, 151 get profile.
- **Success `response_type_id`s:** 521 → `1566`, 523 → `1569`, 170 → `1646` (with `response_status_id === 0`), 5 → `9`, 151 → `369`.
- **Roles:** PAN step `13000`, Set Secret PIN step `12600`.
- **Test commands:** frontend `npm test`, backend `npm run backend:test`. Run single tests, not the whole suite.

---

## File Structure

**Backend** — `packages/eps-backend/src/`

| File | Responsibility |
|---|---|
| `audit/ekoLog.ts` | *modify* — redact PIN-derivable fields |
| `types.ts` | *modify* — `onboarding` variant on `ProfileResult` |
| `clients/eko.ts` | *modify* — `onboarding` gate branch; 5 onboarding methods |
| `signup/pintwin.ts` | *new* — pure PIN encoding, no I/O |
| `signup/service.ts` | *new* — step orchestration + state projection |
| `http/signup.ts` | *new* — 4 routes + signup-role gate |
| `http/app.ts` | *modify* — verify-OTP branch, `/me` signup view, `mountSignup` |
| `auth/session.ts` | *modify* — `role` union |
| `identity/me.ts` | *modify* — `SignupView` type |

**Frontend** — `src/`

| File | Responsibility |
|---|---|
| `components/ui/input-otp.tsx` | *new* — shadcn primitive |
| `features/signup/steps.ts` | *new* — the step registry (the configurable surface) |
| `features/signup/resolveSteps.ts` | *new* — pure resolver, no React |
| `features/signup/PanStep.tsx` | *new* |
| `features/signup/PinStep.tsx` | *new* |
| `features/signup/SignupWizard.tsx` | *new* — orchestrates steps + progress |
| `pages/SignupPage.tsx` | *rewrite* — auth-state switch; Zoho iframe deleted |
| `lib/auth/client.ts` | *modify* — `signupClient`, `SignupView`, `SignupState` |
| `lib/auth/AuthProvider.tsx` | *modify* — classify the signup role |

Backend tests sit beside their module (`eko.test.ts` next to `eko.ts`). Frontend tests sit beside their component. Both match existing convention.

**Dependency order:** Tasks 1-2 are independent. Task 3 (pintwin) is pure and independent. Tasks 4-8 build the backend upward. Tasks 9-16 build the frontend. Task 17 documents.

---

### Task 1: Redact PIN-derivable fields from upstream logs

**Why:** At `EKO_LOG_LEVEL=full`, `ekoLog` logs full request fields and full response bodies. That captures `first_okekey` (request to 5) and `pintwin_key` (response from 10005). Since the encoding is a plain digit substitution, key + okekey together recover the PIN. Redaction lives in `ekoLog` so no call site can forget it.

**Files:**
- Modify: `packages/eps-backend/src/audit/ekoLog.ts`
- Test: `packages/eps-backend/src/audit/ekoLog.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: no signature change. `createEkoLogger` keeps its exact current signature; only its output is redacted.

- [ ] **Step 1: Write the failing test**

Append to `packages/eps-backend/src/audit/ekoLog.test.ts`:

```ts
describe("redaction", () => {
	it("redacts okekeys from request fields at full level", () => {
		const lines: string[] = [];
		const logger = createEkoLogger({ level: "full", sink: (l) => lines.push(l) });
		logger.log({
			fields: {
				interaction_type_id: "5",
				first_okekey: "9748|39",
				second_okekey: "9748|41",
				booklet_serial_number: "SN123",
			},
			status: 200,
			response: { response_type_id: 9 },
			durMs: 12,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.request.first_okekey).toBe("[REDACTED]");
		expect(rec.request.second_okekey).toBe("[REDACTED]");
		// Non-sensitive fields must survive.
		expect(rec.request.booklet_serial_number).toBe("SN123");
		expect(lines[0]).not.toContain("9748");
	});

	it("redacts pintwin_key from the response body at full level", () => {
		const lines: string[] = [];
		const logger = createEkoLogger({ level: "full", sink: (l) => lines.push(l) });
		logger.log({
			fields: { interaction_type_id: "10005" },
			status: 200,
			response: {
				response_type_id: 0,
				data: { pintwin_key: "1974856302", key_id: 39 },
			},
			durMs: 8,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.response.data.pintwin_key).toBe("[REDACTED]");
		// key_id is not secret on its own and aids debugging.
		expect(rec.response.data.key_id).toBe(39);
		expect(lines[0]).not.toContain("1974856302");
	});

	it("does not mutate the caller's objects", () => {
		const fields = { interaction_type_id: "5", first_okekey: "9748|39" };
		const response = { data: { pintwin_key: "1974856302" } };
		const logger = createEkoLogger({ level: "full", sink: () => {} });
		logger.log({ fields, status: 200, response, durMs: 1 });
		expect(fields.first_okekey).toBe("9748|39");
		expect(response.data.pintwin_key).toBe("1974856302");
	});
});
```

If `ekoLog.test.ts` does not exist, create it with this header first:

```ts
import { describe, expect, it } from "vitest";
import { createEkoLogger } from "./ekoLog";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- ekoLog -t "redaction"`
Expected: FAIL — `expected '9748|39' to be '[REDACTED]'`.

- [ ] **Step 3: Implement the redaction**

In `packages/eps-backend/src/audit/ekoLog.ts`, add above `createEkoLogger`:

```ts
/**
 * Fields that must never be logged, at any level.
 *
 * The secret PIN is never sent upstream raw — the BFF encodes it — but the
 * pintwin encoding is a plain digit substitution, so an `okekey` logged
 * alongside the `pintwin_key` that produced it recovers the PIN exactly.
 * Redacting either one breaks that; we redact both.
 */
const REDACTED_REQUEST_FIELDS = new Set(["first_okekey", "second_okekey"]);
const REDACTED_RESPONSE_FIELDS = new Set(["pintwin_key"]);

const REDACTION_PLACEHOLDER = "[REDACTED]";

/** Returns a copy of `fields` with sensitive entries replaced. Never mutates the input. */
function redactFields(fields: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(fields)) {
		out[k] = REDACTED_REQUEST_FIELDS.has(k) ? REDACTION_PLACEHOLDER : v;
	}
	return out;
}

/**
 * Deep-copies `value`, replacing any property named in REDACTED_RESPONSE_FIELDS.
 * Upstream nests the pintwin key under `data`, so this must recurse. Never
 * mutates the input.
 */
function redactResponse(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactResponse);
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = REDACTED_RESPONSE_FIELDS.has(k)
			? REDACTION_PLACEHOLDER
			: redactResponse(v);
	}
	return out;
}
```

Then in the returned `log()`, change the `full` branch only. Replace:

```ts
				const record =
					level === "full"
						? { ...base, request: f, response: entry.response ?? null }
```

with:

```ts
				const record =
					level === "full"
						? {
								...base,
								request: redactFields(f),
								response:
									entry.response == null ? null : redactResponse(entry.response),
							}
```

Leave the `basic` branch untouched — it logs no request fields and only a `responseSummary` allowlist, so it cannot leak these.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run backend:test -- ekoLog`
Expected: PASS, including the pre-existing tests in the file.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/audit/ekoLog.ts packages/eps-backend/src/audit/ekoLog.test.ts
git commit -m "fix(backend): redact pintwin key and okekeys from upstream logs

At EKO_LOG_LEVEL=full the logger captured both the okekeys sent to
interaction 5 and the pintwin_key returned by 10005. The encoding is a
digit substitution, so the pair recovers the raw PIN. Redact in the
logger itself so no call site can forget."
```

---

### Task 2: Add the `onboarding` profile result

**Why:** `user_type` becomes `23` immediately after partial-account creation, so it cannot distinguish in-progress from complete. `onboarding === 1` is the only reliable signal, and it must be checked **before** the `user_type` gate or every mid-onboarding user is locked out on re-login.

**Files:**
- Modify: `packages/eps-backend/src/types.ts`
- Modify: `packages/eps-backend/src/clients/eko.ts:171-182`
- Test: `packages/eps-backend/src/clients/eko.test.ts`

**Interfaces:**
- Consumes: `EkoProfile`, `ProfileResult` from `types.ts`.
- Produces: `ProfileResult` gains `{ kind: "onboarding"; responseTypeId: number; profile: EkoProfile }`. Tasks 6, 7, and 8 consume this variant.

- [ ] **Step 1: Write the failing test**

Append to `packages/eps-backend/src/clients/eko.test.ts`. Match the existing fetch-stub style already used in that file:

```ts
describe("getProfile onboarding classification", () => {
	/** Builds a fetch stub returning one canned 151 response. */
	function stubProfile(userDetail: Record<string, unknown>) {
		return async () =>
			new Response(
				JSON.stringify({ response_type_id: 369, data: { user_detail: userDetail } }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
	}

	const baseDetail = {
		name: "Test User",
		mobile: "9990000001",
		code: "20810001",
		eko_user_id: "55501",
		org_id: 1,
		role_list: [13000, 12600],
	};

	it("returns kind onboarding when onboarding is 1, even with user_type 23", async () => {
		// user_type becomes 23 right after partial-account creation, so the
		// onboarding flag must win over the user_type gate.
		const eko = createEkoClient(
			testCfg,
			stubProfile({ ...baseDetail, user_type: "23", onboarding: 1 }),
		);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("onboarding");
		if (r.kind === "onboarding") {
			expect(r.profile.onboarding).toBe(1);
			expect(r.profile.ekoUserId).toBe("55501");
			expect(r.profile.code).toBe("20810001");
		}
	});

	it("returns kind onboarding when onboarding is 1 and user_type is not yet 23", async () => {
		const eko = createEkoClient(
			testCfg,
			stubProfile({ ...baseDetail, user_type: "0", onboarding: 1 }),
		);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("onboarding");
	});

	it("still returns found for a completed EPS business profile", async () => {
		const eko = createEkoClient(
			testCfg,
			stubProfile({ ...baseDetail, user_type: "23", onboarding: 0 }),
		);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("found");
	});

	it("still returns not_allowed for a completed non-EPS profile", async () => {
		const eko = createEkoClient(
			testCfg,
			stubProfile({ ...baseDetail, user_type: "2", onboarding: 0 }),
		);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("not_allowed");
	});
});
```

Reuse the existing config fixture in that file. If none is exported, define it locally:

```ts
const testCfg = {
	scheme: "https",
	host: "example.test",
	port: 443,
	path: "/api",
	developerKey: "dev-key",
	initiatorId: "9990000000",
	userCode: "20810200",
	defaultOrgId: 1,
	logLevel: "off" as const,
};
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- eko -t "onboarding classification"`
Expected: FAIL — the first two cases return `"not_allowed"` or `"found"`, not `"onboarding"`.

- [ ] **Step 3: Add the type variant**

In `packages/eps-backend/src/types.ts`, add to `ProfileResult`, directly after the `found` variant:

```ts
	/**
	 * A real profile whose onboarding is incomplete (`onboarding === 1`).
	 * Checked BEFORE the EPS-business-partner gate: `user_type` becomes "23"
	 * immediately after partial-account creation, so it cannot distinguish
	 * in-progress from complete. Callers mint a signup session for this kind.
	 */
	| { kind: "onboarding"; responseTypeId: number; profile: EkoProfile }
```

- [ ] **Step 4: Add the gate branch**

In `packages/eps-backend/src/clients/eko.ts`, inside `getProfile`, replace:

```ts
			const d = raw?.data?.user_detail;
			if (code === SUCCESS_CODE && d) {
				// Check if the user matches EPS Business partner type (orgId == 1 && userType == "23"). If not, treat as an invalid user (not_allowed) so the caller does not mint a session for a non-business user.
				if (Number(d.org_id ?? 0) !== 1 || String(d.user_type ?? "") !== "23") {
					return { kind: "not_allowed", responseTypeId: code };
				}
```

with:

```ts
			const d = raw?.data?.user_detail;
			if (code === SUCCESS_CODE && d) {
				// Onboarding-in-progress is checked FIRST and deliberately: user_type
				// flips to "23" as soon as the partial account exists, so it cannot
				// tell an in-progress user from a finished one. `onboarding === 1` is
				// the only reliable signal. Gating on user_type first would classify
				// every mid-onboarding user as not_allowed and lock them out on every
				// subsequent login.
				if (Number(d.onboarding ?? 0) === 1) {
					return {
						kind: "onboarding",
						responseTypeId: code,
						profile: mapProfile(d),
					};
				}
				// Check if the user matches EPS Business partner type (orgId == 1 && userType == "23"). If not, treat as an invalid user (not_allowed) so the caller does not mint a session for a non-business user.
				if (Number(d.org_id ?? 0) !== 1 || String(d.user_type ?? "") !== "23") {
					return { kind: "not_allowed", responseTypeId: code };
				}
```

- [ ] **Step 5: Handle the new variant in `me.ts`**

`deriveStateFromProfile` and `buildMeView` in `packages/eps-backend/src/identity/me.ts` switch on `r.kind` and will not compile against the new variant. In `deriveStateFromProfile`, add before the final return:

```ts
	if (r.kind === "onboarding") return "onboarded";
```

In `buildMeView`, add after the `found` branch:

```ts
	if (r.kind === "onboarding") {
		return {
			state: "onboarded",
			mobile,
			profile: r.profile,
			zohoId: r.profile.zohoId || null,
		};
	}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run backend:test -- eko` then `npm run backend:test -- me`
Expected: PASS for both, including pre-existing tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/types.ts packages/eps-backend/src/clients/eko.ts packages/eps-backend/src/clients/eko.test.ts packages/eps-backend/src/identity/me.ts
git commit -m "feat(backend): classify onboarding-in-progress profiles

Adds ProfileResult kind 'onboarding', checked before the user_type 23
gate. user_type becomes 23 right after partial-account creation, so
onboarding === 1 is the only reliable in-progress signal; gating on
user_type first locked mid-onboarding users out on re-login."
```

---

### Task 3: Pintwin PIN encoding

**Why:** Pintwin is a digit-substitution cipher over a server-issued key. Pure, synchronous, no I/O — so it is isolated in its own module and tested against Eloka's own golden vectors.

**Files:**
- Create: `packages/eps-backend/src/signup/pintwin.ts`
- Test: `packages/eps-backend/src/signup/pintwin.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `encodePin(pin: string, key: string, keyId: number | string): string`. Task 6 consumes it.

- [ ] **Step 1: Write the failing test**

Create `packages/eps-backend/src/signup/pintwin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { encodePin } from "./pintwin";

describe("encodePin", () => {
	// Golden vectors lifted from Eloka's own usePinTwin test suite. Do not
	// change these expectations — they pin the wire contract with upstream.
	it("substitutes each digit through the key and appends the key id", () => {
		expect(encodePin("1234", "1974856302", 39)).toBe("9748|39");
	});

	it("round-trips an identity key unchanged", () => {
		expect(encodePin("0123", "0123456789", 55)).toBe("0123|55");
	});

	it("accepts a string key id", () => {
		expect(encodePin("1234", "1974856302", "39")).toBe("9748|39");
	});

	it("returns empty string for an empty pin", () => {
		expect(encodePin("", "1974856302", 39)).toBe("");
	});

	it("throws when the key is not exactly 10 characters", () => {
		expect(() => encodePin("1234", "123", 39)).toThrow(/10 characters/);
	});

	it("throws on a non-digit pin", () => {
		expect(() => encodePin("12a4", "1974856302", 39)).toThrow(/digits/);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- pintwin`
Expected: FAIL — cannot resolve `./pintwin`.

- [ ] **Step 3: Implement**

Create `packages/eps-backend/src/signup/pintwin.ts`:

```ts
/** Length of a pintwin key: one substitution target per decimal digit. */
const PINTWIN_KEY_LENGTH = 10;

/**
 * Encodes a PIN by substituting each digit through a server-issued pintwin key.
 *
 * The key is a permutation of `0-9`; digit `d` maps to `key[d]`. The key id is
 * appended so the upstream can pick the right table to invert. Keys are
 * single-use and invalidated upstream after each attempt, so every submit must
 * fetch a fresh one.
 *
 * This is obfuscation, not encryption — the key travels in plaintext and the
 * substitution is trivially reversible by anyone holding it. Its only security
 * value is that a captured okekey cannot be replayed.
 *
 * @param pin - The raw PIN; digits only.
 * @param key - The 10-character pintwin key from interaction 10005.
 * @param keyId - The key's id, appended after a `|` separator.
 * @returns The encoded okekey (e.g. `"9748|39"`), or `""` for an empty pin.
 * @throws If the key is not exactly 10 characters, or the pin holds a non-digit.
 */
export function encodePin(
	pin: string,
	key: string,
	keyId: number | string,
): string {
	if (key.length !== PINTWIN_KEY_LENGTH) {
		throw new Error(
			`pintwin key must be exactly ${PINTWIN_KEY_LENGTH} characters, got ${key.length}`,
		);
	}
	if (pin.length === 0) return "";
	if (!/^[0-9]+$/.test(pin)) {
		throw new Error("pin must contain digits only");
	}
	const encoded = pin
		.split("")
		.map((digit) => key[Number(digit)])
		.join("");
	return `${encoded}|${keyId}`;
}
```

Note: Eloka returns `""` on a bad key and silently swallows non-digits via `?? ""`. We throw instead — a malformed key means the upstream contract broke, and submitting a silently-truncated okekey would fail confusingly at interaction 5.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run backend:test -- pintwin`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/signup/pintwin.ts packages/eps-backend/src/signup/pintwin.test.ts
git commit -m "feat(backend): add pintwin PIN encoding

Pure digit-substitution over a server-issued key, pinned to Eloka's
golden vectors."
```

---

### Task 4: Upstream onboarding calls

**Why:** All five onboarding interactions go to the same SimpliBank path the client already uses, so they belong on the existing `EkoClient` and reuse its `post()` helper, logging, and timeout.

**Files:**
- Modify: `packages/eps-backend/src/clients/eko.ts`
- Test: `packages/eps-backend/src/clients/eko.test.ts`

**Interfaces:**
- Consumes: `post()`, `base()`, `EkoProfile` — all existing in `eko.ts`.
- Produces — added to the `EkoClient` interface, consumed by Task 6:

```ts
/** Identity of the acting user for an onboarding interaction. */
export interface EkoIdentity {
	initiatorId: string;
	userCode: string;
	orgId: number;
}

export interface EkoBooklet {
	bookletSerialNumber: string;
	isPintwinUser: number;
}

export interface EkoPintwinKey {
	pintwinKey: string;
	keyId: number | string;
}

/** Outcome of an onboarding interaction: success, or the upstream's own message. */
export type EkoStepResult =
	| { ok: true }
	| { ok: false; message: string; responseTypeId: number };

createPartialAccount(input: { mobile: string; xRealIp?: string }): Promise<EkoStepResult>;
verifyPan(input: { pan: string; identity: EkoIdentity; xRealIp?: string }): Promise<EkoStepResult>;
getBooklet(input: { identity: EkoIdentity; xRealIp?: string }): Promise<EkoBooklet | null>;
fetchPintwinKey(input: { mobile: string; identity: EkoIdentity; xRealIp?: string }): Promise<EkoPintwinKey | null>;
setSecretPin(input: {
	firstOkekey: string;
	secondOkekey: string;
	booklet: EkoBooklet;
	identity: EkoIdentity;
	xRealIp?: string;
}): Promise<EkoStepResult>;
```

- [ ] **Step 1: Write the failing test**

Append to `packages/eps-backend/src/clients/eko.test.ts`:

```ts
describe("onboarding interactions", () => {
	const identity = { initiatorId: "55501", userCode: "20810001", orgId: 1 };

	/** Captures the form-encoded body of the last upstream call. */
	function captureFetch(responseBody: unknown) {
		const calls: URLSearchParams[] = [];
		const fetchImpl = async (_url: string, init?: RequestInit) => {
			calls.push(new URLSearchParams(String(init?.body ?? "")));
			return new Response(JSON.stringify(responseBody), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
	}

	it("createPartialAccount sends 521 with the default initiator and EPS vertical", async () => {
		const { calls, fetchImpl } = captureFetch({ response_type_id: 1566 });
		const eko = createEkoClient(testCfg, fetchImpl);
		const r = await eko.createPartialAccount({ mobile: "9990000001" });
		expect(r.ok).toBe(true);
		const body = calls[0];
		expect(body.get("interaction_type_id")).toBe("521");
		expect(body.get("applicant_type")).toBe("1");
		expect(body.get("business_vertical")).toBe("EPS");
		expect(body.get("user_identity")).toBe("9990000001");
		expect(body.get("user_identity_type")).toBe("mobile_number");
		// New users have no account yet: the DEFAULT initiator/user_code pair acts.
		expect(body.get("initiator_id")).toBe(testCfg.initiatorId);
		expect(body.get("user_code")).toBe(testCfg.userCode);
		// user_id must never be sent upstream.
		expect(body.get("user_id")).toBeNull();
	});

	it("createPartialAccount reports the upstream message on failure", async () => {
		const { fetchImpl } = captureFetch({
			response_type_id: 1500,
			message: "Account already exists",
		});
		const eko = createEkoClient(testCfg, fetchImpl);
		const r = await eko.createPartialAccount({ mobile: "9990000001" });
		expect(r).toEqual({
			ok: false,
			message: "Account already exists",
			responseTypeId: 1500,
		});
	});

	it("verifyPan sends 523 with the user's own identity and no file", async () => {
		const { calls, fetchImpl } = captureFetch({ response_type_id: 1569 });
		const eko = createEkoClient(testCfg, fetchImpl);
		const r = await eko.verifyPan({ pan: "ABCDE1234F", identity });
		expect(r.ok).toBe(true);
		const body = calls[0];
		expect(body.get("interaction_type_id")).toBe("523");
		expect(body.get("doc_id")).toBe("ABCDE1234F");
		expect(body.get("doc_type")).toBe("2");
		expect(body.get("intent_id")).toBe("3");
		expect(body.get("source")).toBe("EPS");
		// Once the partial account exists, the user acts as their own initiator.
		expect(body.get("initiator_id")).toBe("55501");
		expect(body.get("user_code")).toBe("20810001");
	});

	it("getBooklet accepts only response_status_id 0 with type 1646", async () => {
		const { fetchImpl } = captureFetch({
			response_status_id: 0,
			response_type_id: 1646,
			data: { booklet_serial_number: "SN123", is_pintwin_user: 1 },
		});
		const eko = createEkoClient(testCfg, fetchImpl);
		expect(await eko.getBooklet({ identity })).toEqual({
			bookletSerialNumber: "SN123",
			isPintwinUser: 1,
		});
	});

	it("getBooklet returns null on an unexpected response type", async () => {
		const { fetchImpl } = captureFetch({
			response_status_id: 0,
			response_type_id: 999,
			data: { booklet_serial_number: "SN123", is_pintwin_user: 1 },
		});
		const eko = createEkoClient(testCfg, fetchImpl);
		expect(await eko.getBooklet({ identity })).toBeNull();
	});

	it("fetchPintwinKey returns the key and id", async () => {
		const { calls, fetchImpl } = captureFetch({
			data: { pintwin_key: "1974856302", key_id: 39 },
		});
		const eko = createEkoClient(testCfg, fetchImpl);
		expect(
			await eko.fetchPintwinKey({ mobile: "9990000001", identity }),
		).toEqual({ pintwinKey: "1974856302", keyId: 39 });
		expect(calls[0].get("interaction_type_id")).toBe("10005");
		expect(calls[0].get("alternate_user_id")).toBe("9990000001");
	});

	it("fetchPintwinKey returns null when the key is missing", async () => {
		const { fetchImpl } = captureFetch({ data: {} });
		const eko = createEkoClient(testCfg, fetchImpl);
		expect(
			await eko.fetchPintwinKey({ mobile: "9990000001", identity }),
		).toBeNull();
	});

	it("setSecretPin sends 5 with both okekeys and the booklet fields verbatim", async () => {
		const { calls, fetchImpl } = captureFetch({ response_type_id: 9 });
		const eko = createEkoClient(testCfg, fetchImpl);
		const r = await eko.setSecretPin({
			firstOkekey: "9748|39",
			secondOkekey: "9748|41",
			booklet: { bookletSerialNumber: "SN123", isPintwinUser: 1 },
			identity,
		});
		expect(r.ok).toBe(true);
		const body = calls[0];
		expect(body.get("interaction_type_id")).toBe("5");
		expect(body.get("first_okekey")).toBe("9748|39");
		expect(body.get("second_okekey")).toBe("9748|41");
		expect(body.get("is_pintwin_user")).toBe("1");
		expect(body.get("booklet_serial_number")).toBe("SN123");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- eko -t "onboarding interactions"`
Expected: FAIL — `eko.createPartialAccount is not a function`.

- [ ] **Step 3: Implement**

In `packages/eps-backend/src/clients/eko.ts`, add near the top (after the existing `NOT_FOUND_CODES` / `INACTIVE_CODE` / `SUCCESS_CODE` constants):

```ts
/**
 * Fixed geo-coordinates sent with onboarding interactions.
 *
 * This flow does not capture the user's location — the Eloka geolocation step
 * is deliberately not ported — but upstream expects the field. Eloka itself
 * falls back to this exact value when its capture step is skipped.
 */
const ONBOARDING_LATLONG = "27.176670,78.008075,7787";

/** Upstream `response_type_id` values that mean a step succeeded. */
const CREATE_PARTIAL_ACCOUNT_OK = 1566;
const PAN_VERIFICATION_OK = 1569;
const BOOKLET_OK = 1646;
const SECRET_PIN_OK = 9;
```

Add the exported types above `createEkoClient`:

```ts
/**
 * The identity acting on an onboarding interaction.
 *
 * Before the partial account exists, this is the configured DEFAULT pair.
 * Afterwards it is the user's own `ekoUserId` / `code` from the 151 profile.
 * `user_id` is never sent upstream.
 */
export interface EkoIdentity {
	initiatorId: string;
	userCode: string;
	orgId: number;
}

/** Booklet details from interaction 170, forwarded verbatim to interaction 5. */
export interface EkoBooklet {
	bookletSerialNumber: string;
	isPintwinUser: number;
}

/** A single-use substitution key from interaction 10005. */
export interface EkoPintwinKey {
	pintwinKey: string;
	keyId: number | string;
}

/** Outcome of an onboarding interaction, carrying the upstream message on failure. */
export type EkoStepResult =
	| { ok: true }
	| { ok: false; message: string; responseTypeId: number };
```

Add to the `EkoClient` interface:

```ts
	createPartialAccount(input: {
		mobile: string;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
	verifyPan(input: {
		pan: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
	getBooklet(input: {
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoBooklet | null>;
	fetchPintwinKey(input: {
		mobile: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoPintwinKey | null>;
	setSecretPin(input: {
		firstOkekey: string;
		secondOkekey: string;
		booklet: EkoBooklet;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
```

Inside `createEkoClient`, add these helpers after the existing `base()`:

```ts
	/** Form fields identifying the acting user on an onboarding interaction. */
	function actor(identity: EkoIdentity): Record<string, string> {
		return {
			initiator_id: identity.initiatorId,
			user_code: identity.userCode,
			org_id: String(identity.orgId),
		};
	}

	/** Classifies a step response against its expected success `response_type_id`. */
	function stepResult(raw: unknown, successTypeId: number): EkoStepResult {
		const r = raw as { response_type_id?: number; message?: string };
		const code = Number(r?.response_type_id ?? -1);
		if (code === successTypeId) return { ok: true };
		return {
			ok: false,
			message: r?.message ?? "The request could not be completed.",
			responseTypeId: code,
		};
	}
```

Add the five methods to the returned object:

```ts
		async createPartialAccount(input) {
			// The account does not exist yet, so the configured DEFAULT initiator /
			// user_code pair acts on the new user's behalf, identified by mobile.
			const raw = await post(
				{
					...base(),
					interaction_type_id: "521",
					user_identity: input.mobile,
					user_identity_type: "mobile_number",
					csp_id: input.mobile,
					applicant_type: "1",
					business_vertical: "EPS",
					latlong: ONBOARDING_LATLONG,
					source: "EPS",
				},
				input.xRealIp,
			);
			return stepResult(raw, CREATE_PARTIAL_ACCOUNT_OK);
		},
		async verifyPan(input) {
			// PAN rides as `doc_id` on the document interaction; no photo is sent.
			const raw = await post(
				{
					...actor(input.identity),
					interaction_type_id: "523",
					intent_id: "3",
					doc_type: "2",
					doc_id: input.pan,
					latlong: ONBOARDING_LATLONG,
					source: "EPS",
				},
				input.xRealIp,
			);
			return stepResult(raw, PAN_VERIFICATION_OK);
		},
		async getBooklet(input) {
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "170",
					document_id: "",
					latlong: ONBOARDING_LATLONG,
				},
				input.xRealIp,
			)) as {
				response_status_id?: number;
				response_type_id?: number;
				data?: { booklet_serial_number?: string; is_pintwin_user?: number };
			};
			// This interaction reports success on BOTH ids; accept neither alone.
			if (
				Number(raw?.response_status_id ?? -1) !== 0 ||
				Number(raw?.response_type_id ?? -1) !== BOOKLET_OK
			) {
				return null;
			}
			return {
				bookletSerialNumber: String(raw.data?.booklet_serial_number ?? ""),
				isPintwinUser: Number(raw.data?.is_pintwin_user ?? 0),
			};
		},
		async fetchPintwinKey(input) {
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "10005",
					alternate_user_id: input.mobile,
				},
				input.xRealIp,
			)) as { data?: { pintwin_key?: string; key_id?: number | string } };
			const key = raw?.data?.pintwin_key;
			const keyId = raw?.data?.key_id;
			if (!key || keyId === undefined || keyId === null) return null;
			return { pintwinKey: String(key), keyId };
		},
		async setSecretPin(input) {
			// is_pintwin_user and booklet_serial_number are forwarded verbatim from
			// interaction 170 — they are interpreted upstream, not here.
			const raw = await post(
				{
					...actor(input.identity),
					interaction_type_id: "5",
					first_okekey: input.firstOkekey,
					second_okekey: input.secondOkekey,
					is_pintwin_user: String(input.booklet.isPintwinUser),
					booklet_serial_number: input.booklet.bookletSerialNumber,
					latlong: ONBOARDING_LATLONG,
				},
				input.xRealIp,
			);
			return stepResult(raw, SECRET_PIN_OK);
		},
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run backend:test -- eko`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/clients/eko.ts packages/eps-backend/src/clients/eko.test.ts
git commit -m "feat(backend): add onboarding interactions to the Eko client

Adds 521, 523, 170, 10005 and 5 on the existing form-encoded SimpliBank
path. Identity is the DEFAULT initiator pair before the partial account
exists, and the user's own ekoUserId/code afterwards."
```

---

### Task 5: Signup session role

**Files:**
- Modify: `packages/eps-backend/src/auth/session.ts:9`
- Modify: `packages/eps-backend/src/identity/me.ts`
- Test: `packages/eps-backend/src/auth/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SessionClaim.role` becomes `"developer" | "admin" | "signup"`; `SignupView` exported from `identity/me.ts`. Tasks 7 and 8 consume both.

- [ ] **Step 1: Write the failing test**

Append to `packages/eps-backend/src/auth/session.test.ts`, matching that file's existing setup:

```ts
it("mints and verifies a signup-role access token", async () => {
	const sessions = createSessions(testCfg, testKv);
	const token = await sessions.mintAccess({
		sub: "9990000001",
		role: "signup",
		orgId: 1,
	});
	const claim = await sessions.verifyAccess(token);
	expect(claim?.role).toBe("signup");
	expect(claim?.sub).toBe("9990000001");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- session -t "signup-role"`
Expected: FAIL — TypeScript rejects `role: "signup"` as not assignable.

- [ ] **Step 3: Widen the role union**

In `packages/eps-backend/src/auth/session.ts`, change:

```ts
	role: "developer" | "admin";
```

to:

```ts
	/**
	 * `signup` is a limited session for a user partway through onboarding. It
	 * authorizes `/signup/*` and a lightweight `/me` only — never `/admin/*`
	 * and never a developer's `/me` profile view.
	 */
	role: "developer" | "admin" | "signup";
```

- [ ] **Step 4: Add the `SignupView` type**

In `packages/eps-backend/src/identity/me.ts`, add after the `MeView` interface:

```ts
/**
 * The `/me` view for a signup session. Deliberately lightweight — no Eko call —
 * because the wizard fetches its own state from `/signup/state`. It exists so a
 * page reload mid-onboarding restores the session instead of dropping the user
 * to anonymous and forcing a fresh OTP.
 */
export interface SignupView {
	role: "signup";
	mobile: string;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run backend:test -- session`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/auth/session.ts packages/eps-backend/src/auth/session.test.ts packages/eps-backend/src/identity/me.ts
git commit -m "feat(backend): add the signup session role"
```

---

### Task 6: Signup service

**Why:** The orchestration — which identity acts, when to re-fetch, how to project state — is the real logic and deserves its own tested module, separate from HTTP concerns.

**Files:**
- Create: `packages/eps-backend/src/signup/service.ts`
- Test: `packages/eps-backend/src/signup/service.test.ts`

**Interfaces:**
- Consumes: `EkoClient`, `EkoIdentity`, `EkoStepResult` (Task 4); `encodePin` (Task 3); `ProfileResult` with the `onboarding` kind (Task 2); `Config`.
- Produces — consumed by Task 7:

```ts
export interface SignupStep { role: number; label: string; }
export interface SignupState {
	mobile: string;
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	currentRole: number | null;
}
export interface SignupService {
	getState(mobile: string, xRealIp?: string): Promise<SignupState>;
	createProfile(mobile: string, xRealIp?: string): Promise<SignupState>;
	submitPan(mobile: string, pan: string, xRealIp?: string): Promise<SignupState>;
	submitPin(mobile: string, pin1: string, pin2: string, xRealIp?: string): Promise<SignupState>;
}
export class SignupStepError extends Error {
	constructor(message: string, public readonly responseTypeId: number);
}
export function createSignupService(deps: { eko: EkoClient; cfg: Config }): SignupService;
```

- [ ] **Step 1: Write the failing test**

Create `packages/eps-backend/src/signup/service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { EkoClient } from "../clients/eko";
import type { Config } from "../config";
import { createSignupService, SignupStepError } from "./service";

const cfg = {
	eko: { initiatorId: "9990000000", userCode: "20810200", defaultOrgId: 1 },
} as unknown as Config;

/** A profile mid-onboarding, pending both steps. */
const onboardingProfile = {
	kind: "onboarding" as const,
	responseTypeId: 369,
	profile: {
		name: "",
		email: "",
		mobile: "9990000001",
		code: "20810001",
		userType: "23",
		ekoUserId: "55501",
		roleList: ["13000", "12600"],
		orgId: 1,
		onboarding: 1,
		zohoId: "",
		onboardingSteps: [
			{ role: 13000, label: "PAN Details" },
			{ role: 12600, label: "Set Secret PIN" },
		],
	},
};

/** Builds an EkoClient double; only the methods a test needs are provided. */
function ekoStub(over: Partial<EkoClient>): EkoClient {
	return {
		sendOtp: vi.fn(),
		verifyOtp: vi.fn(),
		getProfile: vi.fn(),
		createPartialAccount: vi.fn(),
		verifyPan: vi.fn(),
		getBooklet: vi.fn(),
		fetchPintwinKey: vi.fn(),
		setSecretPin: vi.fn(),
		...over,
	} as unknown as EkoClient;
}

describe("getState", () => {
	it("reports status new when the profile does not exist", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({ kind: "not_found", responseTypeId: 319 }),
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.getState("9990000001")).toEqual({
			mobile: "9990000001",
			status: "new",
			steps: [],
			currentRole: null,
		});
	});

	it("projects steps and the current role while onboarding", async () => {
		const eko = ekoStub({ getProfile: vi.fn().mockResolvedValue(onboardingProfile) });
		const svc = createSignupService({ eko, cfg });
		expect(await svc.getState("9990000001")).toEqual({
			mobile: "9990000001",
			status: "in_progress",
			steps: [
				{ role: 13000, label: "PAN Details" },
				{ role: 12600, label: "Set Secret PIN" },
			],
			currentRole: 13000,
		});
	});

	it("picks the first pending role from role_list, not the first step", async () => {
		// PAN is done; role_list carries only the PIN role.
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				...onboardingProfile,
				profile: { ...onboardingProfile.profile, roleList: ["12600"] },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.currentRole).toBe(12600);
		expect(state.status).toBe("in_progress");
	});

	it("reports status done when onboarding completes", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				kind: "found",
				responseTypeId: 369,
				profile: { ...onboardingProfile.profile, onboarding: 0, roleList: [] },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.status).toBe("done");
		expect(state.currentRole).toBeNull();
	});
});

describe("createProfile", () => {
	it("creates the partial account then returns refreshed state", async () => {
		const createPartialAccount = vi.fn().mockResolvedValue({ ok: true });
		const getProfile = vi
			.fn()
			.mockResolvedValueOnce({ kind: "not_found", responseTypeId: 319 })
			.mockResolvedValueOnce(onboardingProfile);
		const svc = createSignupService({
			eko: ekoStub({ createPartialAccount, getProfile }),
			cfg,
		});
		const state = await svc.createProfile("9990000001");
		expect(createPartialAccount).toHaveBeenCalledWith({
			mobile: "9990000001",
			xRealIp: undefined,
		});
		expect(state.status).toBe("in_progress");
		expect(state.currentRole).toBe(13000);
	});

	it("throws SignupStepError carrying the upstream message on failure", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				createPartialAccount: vi
					.fn()
					.mockResolvedValue({ ok: false, message: "Already exists", responseTypeId: 1500 }),
				getProfile: vi.fn().mockResolvedValue({ kind: "not_found", responseTypeId: 319 }),
			}),
			cfg,
		});
		await expect(svc.createProfile("9990000001")).rejects.toThrow("Already exists");
	});
});

describe("submitPan", () => {
	it("acts as the user's own initiator using the fetched profile", async () => {
		const verifyPan = vi.fn().mockResolvedValue({ ok: true });
		const svc = createSignupService({
			eko: ekoStub({ verifyPan, getProfile: vi.fn().mockResolvedValue(onboardingProfile) }),
			cfg,
		});
		await svc.submitPan("9990000001", "ABCDE1234F");
		expect(verifyPan).toHaveBeenCalledWith({
			pan: "ABCDE1234F",
			identity: { initiatorId: "55501", userCode: "20810001", orgId: 1 },
			xRealIp: undefined,
		});
	});
});

describe("submitPin", () => {
	it("fetches a fresh key per PIN and submits both encoded okekeys", async () => {
		const setSecretPin = vi.fn().mockResolvedValue({ ok: true });
		const fetchPintwinKey = vi
			.fn()
			.mockResolvedValueOnce({ pintwinKey: "1974856302", keyId: 39 })
			.mockResolvedValueOnce({ pintwinKey: "0123456789", keyId: 41 });
		const svc = createSignupService({
			eko: ekoStub({
				setSecretPin,
				fetchPintwinKey,
				getBooklet: vi
					.fn()
					.mockResolvedValue({ bookletSerialNumber: "SN123", isPintwinUser: 1 }),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await svc.submitPin("9990000001", "1234", "1234");
		// Two independent keys, mirroring Eloka's two Pintwin mounts.
		expect(fetchPintwinKey).toHaveBeenCalledTimes(2);
		expect(setSecretPin).toHaveBeenCalledWith(
			expect.objectContaining({
				firstOkekey: "9748|39",
				secondOkekey: "1234|41",
				booklet: { bookletSerialNumber: "SN123", isPintwinUser: 1 },
			}),
		);
	});

	it("rejects mismatched pins before any upstream call", async () => {
		const getBooklet = vi.fn();
		const svc = createSignupService({
			eko: ekoStub({ getBooklet, getProfile: vi.fn().mockResolvedValue(onboardingProfile) }),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "1234", "5678")).rejects.toThrow(
			/do not match/i,
		);
		expect(getBooklet).not.toHaveBeenCalled();
	});

	it("rejects a non-4-digit pin before any upstream call", async () => {
		const getBooklet = vi.fn();
		const svc = createSignupService({
			eko: ekoStub({ getBooklet, getProfile: vi.fn().mockResolvedValue(onboardingProfile) }),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "12", "12")).rejects.toThrow(/4 digits/);
		expect(getBooklet).not.toHaveBeenCalled();
	});

	it("throws when the booklet lookup fails", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				getBooklet: vi.fn().mockResolvedValue(null),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "1234", "1234")).rejects.toThrow(
			SignupStepError,
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- signup/service`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Carry `onboarding_steps` through the profile mapping**

The tests above rely on `profile.onboardingSteps`, which `mapProfile` does not yet produce.

In `packages/eps-backend/src/types.ts`, add to `EkoProfile`:

```ts
	/** Ordered onboarding steps from upstream; empty for a fully-onboarded user. */
	onboardingSteps: Array<{ role: number; label: string }>;
```

In `packages/eps-backend/src/clients/eko.ts`, inside `mapProfile`, add before the closing brace of the returned object:

```ts
		onboardingSteps: Array.isArray(d.onboarding_steps)
			? (d.onboarding_steps as Array<Record<string, unknown>>).map((s) => ({
					role: Number(s.role ?? -1),
					label: String(s.label ?? ""),
				}))
			: [],
```

Mirror the field in the frontend `Profile` interface later (Task 9).

- [ ] **Step 4: Implement the service**

Create `packages/eps-backend/src/signup/service.ts`:

```ts
import type { EkoClient, EkoIdentity } from "../clients/eko";
import type { Config } from "../config";
import type { EkoProfile, ProfileResult } from "../types";
import { encodePin } from "./pintwin";

/** One step of the onboarding journey, as named by upstream. */
export interface SignupStep {
	role: number;
	label: string;
}

/**
 * The client-facing onboarding state. Always derived from a fresh upstream
 * profile fetch — never from client-supplied progress.
 */
export interface SignupState {
	mobile: string;
	/** `new` = no partial account yet; `done` = onboarding complete. */
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	/** The step awaiting input, or null when there is none. */
	currentRole: number | null;
}

export interface SignupService {
	getState(mobile: string, xRealIp?: string): Promise<SignupState>;
	createProfile(mobile: string, xRealIp?: string): Promise<SignupState>;
	submitPan(mobile: string, pan: string, xRealIp?: string): Promise<SignupState>;
	submitPin(
		mobile: string,
		pin1: string,
		pin2: string,
		xRealIp?: string,
	): Promise<SignupState>;
}

/** A step that failed upstream, carrying the upstream's own message for the user. */
export class SignupStepError extends Error {
	constructor(
		message: string,
		public readonly responseTypeId: number,
	) {
		super(message);
		this.name = "SignupStepError";
	}
}

const PIN_LENGTH = 4;

/** Creates the signup orchestration service. */
export function createSignupService(deps: {
	eko: EkoClient;
	cfg: Config;
}): SignupService {
	const { eko, cfg } = deps;

	/** The user's own identity, valid once the partial account exists. */
	function identityOf(profile: EkoProfile): EkoIdentity {
		return {
			initiatorId: profile.ekoUserId,
			userCode: String(profile.code),
			orgId: profile.orgId,
		};
	}

	/**
	 * Projects an upstream profile result into client state.
	 *
	 * `role_list` carries the PENDING roles, so the current step is the first
	 * entry of `onboarding_steps` that still appears there. Everything before it
	 * is complete.
	 */
	function project(mobile: string, r: ProfileResult): SignupState {
		if (r.kind === "not_found") {
			return { mobile, status: "new", steps: [], currentRole: null };
		}
		if (r.kind !== "onboarding" && r.kind !== "found") {
			throw new SignupStepError(
				"Couldn't load your profile right now. Please try again.",
				r.responseTypeId,
			);
		}
		const { profile } = r;
		const steps = profile.onboardingSteps;
		if (profile.onboarding === 0) {
			return { mobile, status: "done", steps, currentRole: null };
		}
		const pending = new Set(profile.roleList.map((x) => Number(x)));
		const current = steps.find((s) => pending.has(s.role));
		return {
			mobile,
			status: "in_progress",
			steps,
			currentRole: current?.role ?? null,
		};
	}

	/** Fetches the profile, or throws if it is not usable for onboarding. */
	async function requireProfile(
		mobile: string,
		xRealIp?: string,
	): Promise<EkoProfile> {
		const r = await eko.getProfile({ mobile, xRealIp });
		if (r.kind !== "onboarding" && r.kind !== "found") {
			throw new SignupStepError(
				"Couldn't load your profile right now. Please try again.",
				r.responseTypeId,
			);
		}
		return r.profile;
	}

	/** Re-reads state from upstream after a step, so progress is never inferred. */
	async function refresh(mobile: string, xRealIp?: string): Promise<SignupState> {
		return project(mobile, await eko.getProfile({ mobile, xRealIp }));
	}

	return {
		async getState(mobile, xRealIp) {
			return refresh(mobile, xRealIp);
		},

		async createProfile(mobile, xRealIp) {
			const result = await eko.createPartialAccount({ mobile, xRealIp });
			if (!result.ok) {
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},

		async submitPan(mobile, pan, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const result = await eko.verifyPan({
				pan,
				identity: identityOf(profile),
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},

		async submitPin(mobile, pin1, pin2, xRealIp) {
			// Validate before touching upstream: a mismatch must not burn a
			// single-use pintwin key.
			if (pin1 !== pin2) {
				throw new SignupStepError("The PINs do not match.", -1);
			}
			if (!new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin1)) {
				throw new SignupStepError(`The PIN must be ${PIN_LENGTH} digits.`, -1);
			}
			const profile = await requireProfile(mobile, xRealIp);
			const identity = identityOf(profile);

			const booklet = await eko.getBooklet({ identity, xRealIp });
			if (!booklet) {
				throw new SignupStepError(
					"Couldn't start PIN setup right now. Please try again.",
					-1,
				);
			}
			// One key per PIN: upstream invalidates a key after each use, and Eloka
			// mounts two independent Pintwins for the same reason. Each okekey
			// carries its own `|key_id` so the server can invert the right table.
			const first = await eko.fetchPintwinKey({ mobile, identity, xRealIp });
			const second = await eko.fetchPintwinKey({ mobile, identity, xRealIp });
			if (!first || !second) {
				throw new SignupStepError(
					"Couldn't secure your PIN right now. Please try again.",
					-1,
				);
			}
			const result = await eko.setSecretPin({
				firstOkekey: encodePin(pin1, first.pintwinKey, first.keyId),
				secondOkekey: encodePin(pin2, second.pintwinKey, second.keyId),
				booklet,
				identity,
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},
	};
}
```

Note `cfg` is destructured but only needed if a future step acts before the account exists; if the linter objects to it being unused, drop it from the destructure and keep it in `deps`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run backend:test -- signup/service`
Expected: PASS, 11 tests.

- [ ] **Step 6: Run the full backend suite for regressions**

Run: `npm run backend:test`
Expected: PASS. `mapProfile` changed, so `eko.test.ts` and `me.test.ts` fixtures may need `onboardingSteps: []` added. Fix any fixture that fails.

- [ ] **Step 7: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/signup/service.ts packages/eps-backend/src/signup/service.test.ts packages/eps-backend/src/types.ts packages/eps-backend/src/clients/eko.ts
git commit -m "feat(backend): add the signup orchestration service

Projects onboarding state from a fresh 151 fetch after every step, so
progress is never inferred client-side. PIN validation runs before any
upstream call so a mismatch cannot burn a single-use pintwin key."
```

---

### Task 7: Signup routes

**Files:**
- Create: `packages/eps-backend/src/http/signup.ts`
- Test: `packages/eps-backend/src/http/signup.test.ts`

**Interfaces:**
- Consumes: `SignupService`, `SignupState`, `SignupStepError` (Task 6); `Sessions`, `ACCESS_COOKIE` (Task 5); `AppError` from `./errors`; `AppEnv` from `./requestId`.
- Produces: `mountSignup(app: Hono<AppEnv>, deps: { sessions: Sessions; signup: SignupService }): void`. Task 8 calls it.

- [ ] **Step 1: Write the failing test**

Create `packages/eps-backend/src/http/signup.test.ts`. Mirror the harness style in the existing `app.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { SignupService, SignupState } from "../signup/service";
import { SignupStepError } from "../signup/service";
import { errorBody } from "./errors";
import type { AppEnv } from "./requestId";
import { mountSignup } from "./signup";

const inProgress: SignupState = {
	mobile: "9990000001",
	status: "in_progress",
	steps: [
		{ role: 13000, label: "PAN Details" },
		{ role: 12600, label: "Set Secret PIN" },
	],
	currentRole: 13000,
};

/** Builds an app with a session double that returns `role` for any cookie. */
function harness(role: string | null, signup: Partial<SignupService>) {
	const app = new Hono<AppEnv>();
	app.onError((err, c) => {
		const { status, body } = errorBody(err);
		return c.json(body, status as never);
	});
	const sessions = {
		verifyAccess: vi
			.fn()
			.mockResolvedValue(role ? { sub: "9990000001", role, orgId: 1 } : null),
	} as unknown as Sessions;
	mountSignup(app, { sessions, signup: signup as SignupService });
	return app;
}

const withCookie = { headers: { Cookie: "eps_at=token" } };

describe("signup route gate", () => {
	it("rejects a request with no session", async () => {
		const app = harness(null, {});
		const res = await app.request("/signup/state");
		expect(res.status).toBe(401);
	});

	it("rejects a developer session", async () => {
		const app = harness("developer", {});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(403);
		expect((await res.json()).error.code).toBe("NOT_SIGNUP_SESSION");
	});

	it("rejects an admin session", async () => {
		const app = harness("admin", {});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(403);
	});

	it("admits a signup session", async () => {
		const app = harness("signup", {
			getState: vi.fn().mockResolvedValue(inProgress),
		});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(inProgress);
	});
});

describe("signup endpoints", () => {
	it("POST /signup/profile creates the account for the session's own mobile", async () => {
		const createProfile = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { createProfile });
		const res = await app.request("/signup/profile", {
			method: "POST",
			...withCookie,
		});
		expect(res.status).toBe(200);
		// The mobile comes from the session, never from the request body.
		expect(createProfile).toHaveBeenCalledWith("9990000001", undefined);
	});

	it("POST /signup/pan submits the PAN", async () => {
		const submitPan = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitPan });
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "ABCDE1234F" }),
		});
		expect(res.status).toBe(200);
		expect(submitPan).toHaveBeenCalledWith("9990000001", "ABCDE1234F", undefined);
	});

	it("POST /signup/pan rejects a malformed PAN before calling the service", async () => {
		const submitPan = vi.fn();
		const app = harness("signup", { submitPan });
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "notapan" }),
		});
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("INVALID_INPUT");
		expect(submitPan).not.toHaveBeenCalled();
	});

	it("POST /signup/pan uppercases the PAN before submitting", async () => {
		const submitPan = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitPan });
		await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "abcde1234f" }),
		});
		expect(submitPan).toHaveBeenCalledWith("9990000001", "ABCDE1234F", undefined);
	});

	it("POST /signup/pin submits both pins", async () => {
		const submitPin = vi.fn().mockResolvedValue({ ...inProgress, status: "done" });
		const app = harness("signup", { submitPin });
		const res = await app.request("/signup/pin", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(submitPin).toHaveBeenCalledWith("9990000001", "1234", "1234", undefined);
	});

	it("surfaces a SignupStepError as a 400 with the upstream message", async () => {
		const app = harness("signup", {
			submitPan: vi.fn().mockRejectedValue(new SignupStepError("PAN already in use", 1500)),
		});
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "ABCDE1234F" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("STEP_FAILED");
		expect(body.error.message).toBe("PAN already in use");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- http/signup`
Expected: FAIL — cannot resolve `./signup`.

- [ ] **Step 3: Implement the routes**

Create `packages/eps-backend/src/http/signup.ts`:

```ts
import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { SignupService } from "../signup/service";
import { SignupStepError } from "../signup/service";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";

/** Indian PAN: five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Mounts the self-serve signup routes.
 *
 * Every route requires a signup session and reads the mobile from the session
 * claim — never from the request body, so one signed-up user cannot drive
 * another's onboarding.
 */
export function mountSignup(
	app: Hono<AppEnv>,
	deps: { sessions: Sessions; signup: SignupService },
): void {
	const { sessions, signup } = deps;

	/** Resolves the caller's mobile, or throws unless this is a signup session. */
	async function requireSignupSession(c: Context<AppEnv>): Promise<string> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "signup") {
			throw new AppError(
				403,
				"NOT_SIGNUP_SESSION",
				"This account has already completed signup.",
			);
		}
		return claim.sub;
	}

	/** Maps a step failure to a 400 carrying the upstream's own message. */
	function toAppError(e: unknown): never {
		if (e instanceof SignupStepError) {
			throw new AppError(400, "STEP_FAILED", e.message);
		}
		throw e;
	}

	app.get("/signup/state", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return c.json(await signup.getState(mobile, c.req.header("x-real-ip")));
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/profile", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return c.json(await signup.createProfile(mobile, c.req.header("x-real-ip")));
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/pan", async (c) => {
		const mobile = await requireSignupSession(c);
		const { pan } = await c.req.json().catch(() => ({}));
		// Validate at the trust boundary; the client's check is only for feedback.
		const normalized = String(pan ?? "").toUpperCase();
		if (!PAN_PATTERN.test(normalized)) {
			throw new AppError(400, "INVALID_INPUT", "Enter a valid 10-character PAN.");
		}
		try {
			return c.json(
				await signup.submitPan(mobile, normalized, c.req.header("x-real-ip")),
			);
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/pin", async (c) => {
		const mobile = await requireSignupSession(c);
		const { pin1, pin2 } = await c.req.json().catch(() => ({}));
		if (!pin1 || !pin2) {
			throw new AppError(400, "INVALID_INPUT", "Both PIN fields are required.");
		}
		try {
			return c.json(
				await signup.submitPin(
					mobile,
					String(pin1),
					String(pin2),
					c.req.header("x-real-ip"),
				),
			);
		} catch (e) {
			toAppError(e);
		}
	});
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run backend:test -- http/signup`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/http/signup.ts packages/eps-backend/src/http/signup.test.ts
git commit -m "feat(backend): add the /signup/* routes

Signup-session-gated. The mobile always comes from the session claim,
never the request body. PAN is re-validated at the trust boundary."
```

---

### Task 8: Wire signup into the app

**Why:** This is where the `TODO(signup)` at `app.ts:232-244` finally goes away.

**Files:**
- Modify: `packages/eps-backend/src/http/app.ts`
- Test: `packages/eps-backend/src/http/app.test.ts`

**Interfaces:**
- Consumes: `mountSignup` (Task 7), `createSignupService` (Task 6), `SignupView` (Task 5).
- Produces: `Deps` gains optional `signup?: SignupService`; verify-OTP returns `SignupView` for signup sessions; `/me` returns `SignupView`.

- [ ] **Step 1: Write the failing test**

Append to `packages/eps-backend/src/http/app.test.ts`, reusing that file's existing app harness:

```ts
describe("signup sessions", () => {
	it("mints a signup session for an unregistered mobile", async () => {
		const app = buildTestApp({
			eko: {
				verifyOtp: async () => ({ ok: true, raw: {} }),
				getProfile: async () => ({ kind: "not_found", responseTypeId: 319 }),
			},
		});
		const res = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ role: "signup", mobile: "9990000001" });
		expect(res.headers.get("set-cookie")).toContain("eps_at=");
	});

	it("mints a signup session for a mid-onboarding profile", async () => {
		const app = buildTestApp({
			eko: {
				verifyOtp: async () => ({ ok: true, raw: {} }),
				getProfile: async () => ({
					kind: "onboarding",
					responseTypeId: 369,
					profile: onboardingProfileFixture,
				}),
			},
		});
		const res = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "1234" }),
		});
		expect(res.status).toBe(200);
		expect((await res.json()).role).toBe("signup");
	});

	it("no longer returns NOT_REGISTERED", async () => {
		const app = buildTestApp({
			eko: {
				verifyOtp: async () => ({ ok: true, raw: {} }),
				getProfile: async () => ({ kind: "not_found", responseTypeId: 319 }),
			},
		});
		const res = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "1234" }),
		});
		expect(res.status).not.toBe(403);
	});

	it("GET /me returns a signup view without hitting Eko", async () => {
		const getProfile = vi.fn();
		const app = buildTestApp({ eko: { getProfile } });
		const token = await testSessions.mintAccess({
			sub: "9990000001",
			role: "signup",
			orgId: 1,
		});
		const res = await app.request("/me", {
			headers: { Cookie: `eps_at=${token}` },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ role: "signup", mobile: "9990000001" });
		// A reload mid-onboarding must restore the session cheaply.
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("still refuses an inactive account", async () => {
		const app = buildTestApp({
			eko: {
				verifyOtp: async () => ({ ok: true, raw: {} }),
				getProfile: async () => ({ kind: "inactive", responseTypeId: 2123 }),
			},
		});
		const res = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "1234" }),
		});
		expect(res.status).toBe(403);
	});
});
```

Define the fixture near the top of the describe block:

```ts
const onboardingProfileFixture = {
	name: "",
	email: "",
	mobile: "9990000001",
	code: "20810001",
	userType: "23",
	ekoUserId: "55501",
	roleList: ["13000", "12600"],
	orgId: 1,
	onboarding: 1,
	zohoId: "",
	onboardingSteps: [
		{ role: 13000, label: "PAN Details" },
		{ role: 12600, label: "Set Secret PIN" },
	],
};
```

Adapt `buildTestApp` and `testSessions` to whatever the existing harness in that file names them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- http/app -t "signup sessions"`
Expected: FAIL — verify returns 403 `NOT_REGISTERED`.

- [ ] **Step 3: Wire the service into `Deps`**

In `packages/eps-backend/src/http/app.ts`, add the imports:

```ts
import { createSignupService, type SignupService } from "../signup/service";
import { mountSignup } from "./signup";
import type { SignupView } from "../identity/me";
```

Add to the `Deps` interface:

```ts
	/** Signup orchestration; defaults to one built over the injected Eko client. */
	signup?: SignupService;
```

Where the app is constructed (near the other `mount*` calls), add:

```ts
	const signup = deps.signup ?? createSignupService({ eko, cfg });
	mountSignup(app, { sessions, signup });
```

- [ ] **Step 4: Replace the `TODO(signup)` block**

In `packages/eps-backend/src/http/app.ts`, replace this block:

```ts
		// TODO(signup): New users — Eko response 319/1200/1867 → `not_found` — are
		// not onboarded via /console yet. The reference (simplibankLoginAPI) admits
		// them with a limited-role signup session (role_list [-5] for mobile,
		// onboarding=1) and starts the signup flow. When self-serve signup is
		// enabled, replace this block with that flow. For now, refuse so an
		// unregistered number cannot obtain a session.
		if (profile.kind === "not_found") {
			throw new AppError(
				403,
				"NOT_REGISTERED",
				"This mobile number isn't registered for EPS yet.",
			);
		}
```

with:

```ts
		// New users (`not_found`) and users partway through onboarding
		// (`onboarding`) both get a limited signup session, which authorizes the
		// /signup/* endpoints and a lightweight /me — nothing else. The wizard
		// reads its own progress from /signup/state.
		if (profile.kind === "not_found" || profile.kind === "onboarding") {
			const claim = {
				sub: m,
				role: "signup" as const,
				orgId:
					profile.kind === "onboarding"
						? profile.profile.orgId
						: cfg.eko.defaultOrgId,
			};
			const access = await sessions.mintAccess(claim);
			const refresh = await sessions.issueRefresh(claim);
			c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
			c.header("Set-Cookie", sessions.refreshCookie(refresh), { append: true });
			const view: SignupView = { role: "signup", mobile: m };
			return c.json(view);
		}
```

Place it exactly where the old block was — after the `inactive` and `error` checks, before `not_allowed`. Order matters: `not_allowed` must still refuse a completed non-EPS profile.

- [ ] **Step 5: Add the `/me` signup branch**

In the `/me` handler, directly after the existing admin branch:

```ts
		// A signup session has no developer profile yet. Return a lightweight view
		// without an Eko call, so a reload mid-onboarding restores the session
		// instead of dropping the user to anonymous and forcing a fresh OTP.
		if (claim.role === "signup") {
			const view: SignupView = { role: "signup", mobile: claim.sub };
			return c.json(view);
		}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run backend:test -- http/app`
Expected: PASS. Any pre-existing test asserting `NOT_REGISTERED` must be updated to the new signup-session behaviour — that error no longer exists.

- [ ] **Step 7: Run the whole backend suite**

Run: `npm run backend:test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add packages/eps-backend/src/http/app.ts packages/eps-backend/src/http/app.test.ts
git commit -m "feat(backend): admit new users with a signup session

Resolves the TODO(signup) at the verify-OTP branch. New and
mid-onboarding users now receive a limited signup session instead of
403 NOT_REGISTERED. /me returns a lightweight signup view so a reload
mid-onboarding does not force a fresh OTP."
```

---

### Task 9: Frontend signup client

**Files:**
- Modify: `src/lib/auth/client.ts`
- Test: `src/lib/auth/client.signup.test.ts`

**Interfaces:**
- Consumes: `request()` (private, existing in `client.ts`).
- Produces — consumed by Tasks 10, 12, 13, 14, 15:

```ts
export interface SignupView { role: "signup"; mobile: string; }
export interface SignupStep { role: number; label: string; }
export interface SignupState {
	mobile: string;
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	currentRole: number | null;
}
export const signupClient: {
	state(): Promise<SignupState>;
	createProfile(): Promise<SignupState>;
	submitPan(pan: string): Promise<SignupState>;
	submitPin(pin1: string, pin2: string): Promise<SignupState>;
};
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/client.signup.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, signupClient } from "./client";

const state = {
	mobile: "9990000001",
	status: "in_progress" as const,
	steps: [{ role: 13000, label: "PAN Details" }],
	currentRole: 13000,
};

/** Stubs global fetch with one JSON response and returns the call spy. */
function stubFetch(body: unknown, status = 200) {
	const spy = vi.fn().mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", spy);
	return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("signupClient", () => {
	it("state() GETs /signup/state with credentials", async () => {
		const spy = stubFetch(state);
		expect(await signupClient.state()).toEqual(state);
		const [url, init] = spy.mock.calls[0];
		expect(String(url)).toContain("/signup/state");
		expect(init.method).toBe("GET");
		expect(init.credentials).toBe("include");
	});

	it("createProfile() POSTs /signup/profile", async () => {
		const spy = stubFetch(state);
		await signupClient.createProfile();
		const [url, init] = spy.mock.calls[0];
		expect(String(url)).toContain("/signup/profile");
		expect(init.method).toBe("POST");
	});

	it("submitPan() POSTs the pan", async () => {
		const spy = stubFetch(state);
		await signupClient.submitPan("ABCDE1234F");
		const [, init] = spy.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({ pan: "ABCDE1234F" });
	});

	it("submitPin() POSTs both pins", async () => {
		const spy = stubFetch(state);
		await signupClient.submitPin("1234", "1234");
		const [, init] = spy.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({ pin1: "1234", pin2: "1234" });
	});

	it("throws ApiError carrying the backend message", async () => {
		stubFetch({ error: { code: "STEP_FAILED", message: "PAN already in use" } }, 400);
		await expect(signupClient.submitPan("ABCDE1234F")).rejects.toThrow(
			"PAN already in use",
		);
		try {
			await signupClient.submitPan("ABCDE1234F");
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
			expect((e as ApiError).code).toBe("STEP_FAILED");
		}
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- client.signup`
Expected: FAIL — `signupClient` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/auth/client.ts`, add `onboardingSteps` to the existing `Profile` interface so it mirrors the backend:

```ts
	/** Ordered onboarding steps from upstream; empty for a fully-onboarded user. */
	onboardingSteps: Array<{ role: number; label: string }>;
```

Add the types after `AdminView`:

```ts
/** The `/me` view for a user partway through signup. */
export interface SignupView {
	role: "signup";
	mobile: string;
}

/** One onboarding step, as named by the backend. */
export interface SignupStep {
	role: number;
	label: string;
}

/**
 * Server-authoritative onboarding progress. The wizard renders this and never
 * infers progress locally — every step call returns a fresh copy.
 */
export interface SignupState {
	mobile: string;
	/** `new` = no partial account yet; `done` = onboarding complete. */
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	currentRole: number | null;
}
```

Add the client after `authClient`:

```ts
/** Self-serve signup API — requires a signup session cookie. */
export const signupClient = {
	state: (): Promise<SignupState> =>
		request("/signup/state", { method: "GET" }) as Promise<SignupState>,
	createProfile: (): Promise<SignupState> =>
		request("/signup/profile", { method: "POST" }) as Promise<SignupState>,
	submitPan: (pan: string): Promise<SignupState> =>
		request("/signup/pan", {
			method: "POST",
			body: JSON.stringify({ pan }),
		}) as Promise<SignupState>,
	submitPin: (pin1: string, pin2: string): Promise<SignupState> =>
		request("/signup/pin", {
			method: "POST",
			body: JSON.stringify({ pin1, pin2 }),
		}) as Promise<SignupState>,
};
```

Also widen `authClient.me` and `authClient.verifyOtp` return types:

```ts
	verifyOtp: (mobile: string, otp: string): Promise<MeView | SignupView> =>
		request("/auth/otp/verify", {
			method: "POST",
			body: JSON.stringify({ mobile, otp }),
		}) as Promise<MeView | SignupView>,
	me: (): Promise<MeView | AdminView | SignupView> =>
		request("/me", { method: "GET" }) as Promise<MeView | AdminView | SignupView>,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- client.signup`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/lib/auth/client.ts src/lib/auth/client.signup.test.ts
git commit -m "feat(web): add the signup API client"
```

---

### Task 10: Classify the signup session

**Files:**
- Modify: `src/lib/auth/AuthProvider.tsx`
- Test: `src/lib/auth/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `SignupView` (Task 9).
- Produces: `AuthState` gains `{ status: "authed"; role: "signup"; me: SignupView }`. Task 16 consumes it.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/auth/AuthProvider.test.tsx`, matching that file's existing harness:

```ts
it("classifies a signup session", async () => {
	vi.mocked(authClient.me).mockResolvedValue({
		role: "signup",
		mobile: "9990000001",
	});
	const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
	await waitFor(() => expect(result.current.state.status).toBe("authed"));
	expect(result.current.state).toEqual({
		status: "authed",
		role: "signup",
		me: { role: "signup", mobile: "9990000001" },
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- AuthProvider -t "signup session"`
Expected: FAIL — role is `"developer"`, since `classify` falls through.

- [ ] **Step 3: Implement**

In `src/lib/auth/AuthProvider.tsx`, update the import:

```ts
import {
	authClient,
	type AdminView,
	type MeView,
	type SignupView,
} from "@/lib/auth/client";
```

Add the state variant:

```ts
export type AuthState =
	| { status: "loading" }
	| { status: "anon" }
	| { status: "authed"; role: "developer"; me: MeView }
	| { status: "authed"; role: "admin"; me: AdminView }
	| { status: "authed"; role: "signup"; me: SignupView };
```

Update `classify`:

```ts
/** Maps a /me response to the typed AuthState union. */
function classify(me: MeView | AdminView | SignupView): AuthState {
	if ("role" in me && me.role === "admin") {
		return { status: "authed", role: "admin", me };
	}
	// A signup session is authenticated but has no profile yet — it authorizes
	// the onboarding wizard only.
	if ("role" in me && me.role === "signup") {
		return { status: "authed", role: "signup", me };
	}
	return { status: "authed", role: "developer", me: me as MeView };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- AuthProvider`
Expected: PASS.

- [ ] **Step 5: Check consumers of `AuthState` still compile**

Run: `npx tsc --noEmit`
Expected: PASS. `src/lib/auth/identity.ts` (`accountIdentity`, `chatIdentity`) and `src/components/auth/UserMenu.tsx` switch on `state`; a new variant may need handling. If `accountIdentity` needs a signup case, return the mobile-derived identity it already builds for profile-less users.

- [ ] **Step 6: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/lib/auth/AuthProvider.tsx src/lib/auth/AuthProvider.test.tsx src/lib/auth/identity.ts
git commit -m "feat(web): classify the signup session in AuthProvider"
```

---

### Task 11: InputOTP primitive

**Why:** `input-otp@^1.4.2` is already a dependency and unused. The PIN step needs a masked 4-box input; `LoginForm`'s hand-rolled boxes are left alone.

**Files:**
- Create: `src/components/ui/input-otp.tsx`

**Interfaces:**
- Consumes: `input-otp` package.
- Produces: `InputOTP`, `InputOTPGroup`, `InputOTPSlot` — consumed by Task 14.

- [ ] **Step 1: Create the primitive**

Create `src/components/ui/input-otp.tsx` — the standard shadcn wrapper, minus the separator (unused here):

```tsx
import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Root one-time-code input. Pass `maxLength` and `value`/`onChange`. */
const InputOTP = React.forwardRef<
	React.ElementRef<typeof OTPInput>,
	React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
	<OTPInput
		ref={ref}
		containerClassName={cn(
			"flex items-center gap-2 has-[:disabled]:opacity-50",
			containerClassName,
		)}
		className={cn("disabled:cursor-not-allowed", className)}
		{...props}
	/>
));
InputOTP.displayName = "InputOTP";

/** Groups slots into one visual field. */
const InputOTPGroup = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

/** One character cell. Renders a dot instead of the character when `mask` is set. */
const InputOTPSlot = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div"> & { index: number; mask?: boolean }
>(({ index, mask, className, ...props }, ref) => {
	const inputOTPContext = React.useContext(OTPInputContext);
	const slot = inputOTPContext.slots[index];
	const char = slot?.char;
	const hasFakeCaret = slot?.hasFakeCaret;
	const isActive = slot?.isActive;

	return (
		<div
			ref={ref}
			className={cn(
				"relative flex h-12 w-12 items-center justify-center rounded-md border border-input text-lg transition-all",
				isActive && "z-10 ring-2 ring-ring ring-offset-background",
				className,
			)}
			{...props}
		>
			{char !== null && char !== undefined && (mask ? "•" : char)}
			{hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
				</div>
			)}
		</div>
	);
});
InputOTPSlot.displayName = "InputOTPSlot";

export { InputOTP, InputOTPGroup, InputOTPSlot };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS. If `cn` is not at `@/lib/utils`, correct the import to wherever the other `src/components/ui/*` files import it from.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/components/ui/input-otp.tsx
git commit -m "feat(web): add the InputOTP primitive"
```

---

### Task 12: Step registry and resolver

**Why:** This is the entire "configurable steps" surface. Keep it pure and free of React so it is trivially testable.

**Files:**
- Create: `src/features/signup/steps.ts`
- Create: `src/features/signup/resolveSteps.ts`
- Test: `src/features/signup/resolveSteps.test.ts`

**Interfaces:**
- Consumes: `SignupState`, `SignupStep` (Task 9).
- Produces — consumed by Task 15:

```ts
export interface StepProps {
	onSubmit: (values: string[]) => Promise<void>;
	busy: boolean;
	error: string | null;
}
export type StepSubmit = (
	client: typeof signupClient,
	values: string[],
) => Promise<SignupState>;
export interface StepDefinition {
	role: number;
	name: string;
	label: string;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}
export type StepStatus = "complete" | "current" | "pending";
export interface ResolvedStep {
	role: number;
	name: string;
	label: string;
	status: StepStatus;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}
export function resolveSteps(state: SignupState, registry: readonly StepDefinition[]): ResolvedStep[];
```

**Design note:** every step submits `string[]` and each registry entry owns its own
`submit` function. This is what makes the registry real: the wizard never learns a step's
name or its argument shape, so a third step is genuinely one entry plus one component. A
wizard that switched on `name` to pick a call signature would force an edit here for every
new step — the exact coupling this registry exists to remove.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/resolveSteps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SignupState } from "@/lib/auth/client";
import { resolveSteps, type StepDefinition } from "./resolveSteps";

const Dummy = () => null;
const noSubmit = async () => ({}) as never;

const registry: StepDefinition[] = [
	{
		role: 13000,
		name: "pan",
		label: "PAN Details",
		Component: Dummy,
		submit: noSubmit,
	},
	{
		role: 12600,
		name: "pin",
		label: "Set Secret PIN",
		Component: Dummy,
		submit: noSubmit,
	},
];

function state(over: Partial<SignupState> = {}): SignupState {
	return {
		mobile: "9990000001",
		status: "in_progress",
		steps: [
			{ role: 13000, label: "PAN Details" },
			{ role: 12600, label: "Set Secret PIN" },
		],
		currentRole: 13000,
		...over,
	};
}

describe("resolveSteps", () => {
	it("marks the current step and leaves later steps pending", () => {
		expect(resolveSteps(state(), registry).map((s) => [s.name, s.status])).toEqual([
			["pan", "current"],
			["pin", "pending"],
		]);
	});

	it("marks steps before the current one complete", () => {
		const resolved = resolveSteps(state({ currentRole: 12600 }), registry);
		expect(resolved.map((s) => [s.name, s.status])).toEqual([
			["pan", "complete"],
			["pin", "current"],
		]);
	});

	it("orders by the API, not the registry", () => {
		// API returns PIN first; the registry lists PAN first. API wins.
		const resolved = resolveSteps(
			state({
				steps: [
					{ role: 12600, label: "Set Secret PIN" },
					{ role: 13000, label: "PAN Details" },
				],
				currentRole: 12600,
			}),
			registry,
		);
		expect(resolved.map((s) => s.name)).toEqual(["pin", "pan"]);
	});

	it("prefers the API label over the registry label", () => {
		const resolved = resolveSteps(
			state({ steps: [{ role: 13000, label: "PAN Card" }], currentRole: 13000 }),
			registry,
		);
		expect(resolved[0].label).toBe("PAN Card");
	});

	it("falls back to the registry label when the API sends none", () => {
		const resolved = resolveSteps(
			state({ steps: [{ role: 13000, label: "" }], currentRole: 13000 }),
			registry,
		);
		expect(resolved[0].label).toBe("PAN Details");
	});

	it("skips a role the registry does not know, without throwing", () => {
		const resolved = resolveSteps(
			state({
				steps: [
					{ role: 99999, label: "Future Step" },
					{ role: 13000, label: "PAN Details" },
				],
				currentRole: 13000,
			}),
			registry,
		);
		expect(resolved.map((s) => s.name)).toEqual(["pan"]);
	});

	it("marks every step complete when onboarding is done", () => {
		const resolved = resolveSteps(state({ status: "done", currentRole: null }), registry);
		expect(resolved.every((s) => s.status === "complete")).toBe(true);
	});

	it("returns an empty list when the API sends no steps", () => {
		expect(resolveSteps(state({ steps: [], currentRole: null }), registry)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- resolveSteps`
Expected: FAIL — cannot resolve `./resolveSteps`.

- [ ] **Step 3: Implement the resolver**

Create `src/features/signup/resolveSteps.ts`:

```ts
import type { ComponentType } from "react";
import type { signupClient, SignupState } from "@/lib/auth/client";

/** Props every step component receives from the wizard. */
export interface StepProps {
	/**
	 * Submits this step's collected values. Each step decides what its values
	 * mean; the wizard just forwards them to the step's own `submit`.
	 */
	onSubmit: (values: string[]) => Promise<void>;
	/** True while a submit is in flight; disable inputs and the button. */
	busy: boolean;
	/** Server-side error for this step, or null. */
	error: string | null;
}

/** Sends one step's values to the backend and returns the refreshed state. */
export type StepSubmit = (
	client: typeof signupClient,
	values: string[],
) => Promise<SignupState>;

/**
 * A step this app knows how to render.
 *
 * To add a step: append an entry with its role code, component, and submit. To
 * remove one: delete the entry. Order and labels come from the API at runtime,
 * so neither is authoritative in this file.
 *
 * Each entry owns its `submit` so the wizard never needs to know step names or
 * call signatures — that is what keeps adding a step to one entry plus one
 * component.
 */
export interface StepDefinition {
	/** The backend role code identifying this step. */
	role: number;
	name: string;
	/** Fallback label; the API's label wins when present. */
	label: string;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}

export type StepStatus = "complete" | "current" | "pending";

export interface ResolvedStep {
	role: number;
	name: string;
	label: string;
	status: StepStatus;
	Component: ComponentType<StepProps>;
	submit: StepSubmit;
}

/**
 * Resolves the server's onboarding steps against the local registry.
 *
 * The API is authoritative for which steps exist, their order, and their
 * labels. A role the registry does not know is skipped rather than thrown on,
 * so the backend can introduce a step before this app ships its UI.
 *
 * @param state - Server-authoritative signup state.
 * @param registry - Steps this app can render.
 * @returns Steps in API order, each tagged with its status.
 */
export function resolveSteps(
	state: SignupState,
	registry: readonly StepDefinition[],
): ResolvedStep[] {
	const byRole = new Map(registry.map((s) => [s.role, s]));
	const known = state.steps.filter((s) => byRole.has(s.role));
	const currentIndex = known.findIndex((s) => s.role === state.currentRole);

	return known.map((apiStep, index) => {
		const def = byRole.get(apiStep.role) as StepDefinition;
		return {
			role: def.role,
			name: def.name,
			label: apiStep.label || def.label,
			// currentIndex === -1 means nothing is pending (onboarding finished),
			// so every step is complete.
			status:
				currentIndex === -1
					? "complete"
					: index < currentIndex
						? "complete"
						: index === currentIndex
							? "current"
							: "pending",
			Component: def.Component,
			submit: def.submit,
		};
	});
}
```

- [ ] **Step 4: Create the registry**

Create `src/features/signup/steps.ts`:

```ts
import type { StepDefinition } from "./resolveSteps";
import { PanStep } from "./PanStep";
import { PinStep } from "./PinStep";

/**
 * Steps this app can render, keyed by their backend role code.
 *
 * Order here is not authoritative — the API's `onboarding_steps` decides the
 * sequence and the labels at runtime. This registry only answers "can we render
 * role N, with what, and how does it submit?".
 *
 * To add a step: write the component, then add an entry with its role code and
 * its submit. Nothing else in the app needs to change.
 */
export const SIGNUP_STEPS: readonly StepDefinition[] = [
	{
		role: 13000,
		name: "pan",
		label: "PAN Details",
		Component: PanStep,
		submit: (client, [pan]) => client.submitPan(pan),
	},
	{
		role: 12600,
		name: "pin",
		label: "Set Secret PIN",
		Component: PinStep,
		submit: (client, [pin1, pin2]) => client.submitPin(pin1, pin2),
	},
];
```

This will not compile until Tasks 13 and 14 exist. That is expected — commit the resolver now and the registry with Task 14.

- [ ] **Step 5: Run the resolver tests to verify they pass**

Run: `npm test -- resolveSteps`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit the resolver only**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/features/signup/resolveSteps.ts src/features/signup/resolveSteps.test.ts
git commit -m "feat(web): add the signup step resolver

The API is authoritative for step order and labels; the local registry
only decides what can be rendered. Unknown roles are skipped so the
backend can add a step before this app ships its UI."
```

---

### Task 13: PAN step

**Files:**
- Create: `src/features/signup/PanStep.tsx`
- Test: `src/features/signup/PanStep.test.tsx`

**Interfaces:**
- Consumes: `StepProps` (Task 12); `Button`, `Input`, `Label` from `@/components/ui/*`.
- Produces: `PanStep: (props: StepProps) => JSX.Element`, calling `onSubmit([pan])`.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/PanStep.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanStep } from "./PanStep";

const noop = async () => {};

describe("PanStep", () => {
	it("disables submit until the PAN is valid", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const button = screen.getByRole("button", { name: /continue/i });
		expect(button).toBeDisabled();
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE1234F" },
		});
		expect(button).toBeEnabled();
	});

	it("keeps submit disabled for a malformed PAN", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE12345" },
		});
		expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
	});

	it("uppercases typed input", () => {
		render(<PanStep onSubmit={noop} busy={false} error={null} />);
		const input = screen.getByLabelText(/pan/i) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "abcde1234f" } });
		expect(input.value).toBe("ABCDE1234F");
	});

	it("submits the PAN", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<PanStep onSubmit={onSubmit} busy={false} error={null} />);
		fireEvent.change(screen.getByLabelText(/pan/i), {
			target: { value: "ABCDE1234F" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith(["ABCDE1234F"]);
	});

	it("disables the field and button while busy", () => {
		render(<PanStep onSubmit={noop} busy={true} error={null} />);
		expect(screen.getByLabelText(/pan/i)).toBeDisabled();
		expect(screen.getByRole("button")).toBeDisabled();
	});

	it("shows a server error", () => {
		render(<PanStep onSubmit={noop} busy={false} error="PAN already in use" />);
		expect(screen.getByRole("alert")).toHaveTextContent("PAN already in use");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PanStep`
Expected: FAIL — cannot resolve `./PanStep`.

- [ ] **Step 3: Implement**

Create `src/features/signup/PanStep.tsx`:

```tsx
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepProps } from "./resolveSteps";

/** Indian PAN: five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PAN_LENGTH = 10;

/**
 * Collects and submits the user's PAN. No photo upload — the number alone is
 * verified upstream.
 *
 * Client-side validation is for feedback only; the backend re-validates.
 */
export function PanStep({ onSubmit, busy, error }: StepProps) {
	const [pan, setPan] = useState("");
	const isValid = PAN_PATTERN.test(pan);

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (isValid && !busy) void onSubmit([pan]);
			}}
		>
			<p className="text-muted-foreground">
				Enter your PAN number to continue.
			</p>

			<div className="flex flex-col gap-2">
				<Label htmlFor="pan">PAN</Label>
				<Input
					id="pan"
					value={pan}
					disabled={busy}
					autoComplete="off"
					autoCapitalize="characters"
					maxLength={PAN_LENGTH}
					placeholder="ABCDE1234F"
					className="font-mono tracking-widest uppercase"
					onChange={(e) => setPan(e.target.value.toUpperCase())}
				/>
				<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<Lock className="h-3.5 w-3.5 shrink-0" />
					We use your PAN to verify your identity, as required by regulation.
				</p>
			</div>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!isValid || busy}>
				{busy ? "Verifying…" : "Continue"}
			</Button>
		</form>
	);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- PanStep`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/features/signup/PanStep.tsx src/features/signup/PanStep.test.tsx
git commit -m "feat(web): add the PAN onboarding step"
```

---

### Task 14: PIN step

**Files:**
- Create: `src/features/signup/PinStep.tsx`
- Test: `src/features/signup/PinStep.test.tsx`
- Create: `src/features/signup/steps.ts` (from Task 12, Step 4 — commit it here)

**Interfaces:**
- Consumes: `StepProps` (Task 12); `InputOTP`, `InputOTPGroup`, `InputOTPSlot` (Task 11).
- Produces: `PinStep: (props: StepProps) => JSX.Element`, calling `onSubmit([pin1, pin2])`. `SIGNUP_STEPS` from `steps.ts`, consumed by Task 15.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/PinStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PinStep } from "./PinStep";

const noop = async () => {};

/** Types into a PIN field by its accessible name. */
async function typePin(name: RegExp, value: string) {
	const field = screen.getByRole("textbox", { name });
	await userEvent.click(field);
	await userEvent.keyboard(value);
}

describe("PinStep", () => {
	it("disables submit until both PINs are complete and equal", async () => {
		render(<PinStep onSubmit={noop} busy={false} error={null} />);
		const button = screen.getByRole("button", { name: /finish|continue/i });
		expect(button).toBeDisabled();
		await typePin(/^secret pin/i, "1234");
		expect(button).toBeDisabled();
		await typePin(/confirm/i, "1234");
		expect(button).toBeEnabled();
	});

	it("keeps submit disabled and warns when the PINs differ", async () => {
		render(<PinStep onSubmit={noop} busy={false} error={null} />);
		await typePin(/^secret pin/i, "1234");
		await typePin(/confirm/i, "5678");
		expect(screen.getByRole("button", { name: /finish|continue/i })).toBeDisabled();
		expect(screen.getByText(/do not match/i)).toBeInTheDocument();
	});

	it("submits both PINs", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<PinStep onSubmit={onSubmit} busy={false} error={null} />);
		await typePin(/^secret pin/i, "1234");
		await typePin(/confirm/i, "1234");
		await userEvent.click(screen.getByRole("button", { name: /finish|continue/i }));
		expect(onSubmit).toHaveBeenCalledWith(["1234", "1234"]);
	});

	it("shows a server error", () => {
		render(<PinStep onSubmit={noop} busy={false} error="Could not set PIN" />);
		expect(screen.getByRole("alert")).toHaveTextContent("Could not set PIN");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PinStep`
Expected: FAIL — cannot resolve `./PinStep`.

- [ ] **Step 3: Implement**

Create `src/features/signup/PinStep.tsx`:

```tsx
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import type { StepProps } from "./resolveSteps";

const PIN_LENGTH = 4;

/** Renders one masked PIN field. */
function PinField({
	id,
	label,
	value,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	disabled: boolean;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<InputOTP
				id={id}
				aria-label={label}
				maxLength={PIN_LENGTH}
				value={value}
				disabled={disabled}
				onChange={onChange}
			>
				<InputOTPGroup>
					{Array.from({ length: PIN_LENGTH }, (_, i) => (
						<InputOTPSlot key={i} index={i} mask />
					))}
				</InputOTPGroup>
			</InputOTP>
		</div>
	);
}

/**
 * Collects a 4-digit secret PIN and its confirmation.
 *
 * The PIN is sent to our backend, which encodes it against a single-use
 * pintwin key before submitting upstream — no encoding happens here.
 */
export function PinStep({ onSubmit, busy, error }: StepProps) {
	const [pin1, setPin1] = useState("");
	const [pin2, setPin2] = useState("");

	const complete = pin1.length === PIN_LENGTH && pin2.length === PIN_LENGTH;
	const matches = pin1 === pin2;
	const canSubmit = complete && matches && !busy;

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				if (canSubmit) void onSubmit([pin1, pin2]);
			}}
		>
			<p className="text-muted-foreground">
				Choose a 4-digit PIN. You'll use it to authorize transactions.
			</p>

			<PinField
				id="pin1"
				label="Secret PIN"
				value={pin1}
				disabled={busy}
				onChange={setPin1}
			/>
			<PinField
				id="pin2"
				label="Confirm PIN"
				value={pin2}
				disabled={busy}
				onChange={setPin2}
			/>

			{complete && !matches && (
				<p className="text-sm text-destructive">The PINs do not match.</p>
			)}

			<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Lock className="h-3.5 w-3.5 shrink-0" />
				Never share your PIN. Eko will never ask for it.
			</p>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!canSubmit}>
				{busy ? "Setting your PIN…" : "Finish"}
			</Button>
		</form>
	);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- PinStep`
Expected: PASS, 4 tests. If `getByRole("textbox")` does not match the `input-otp` element, fall back to `screen.getByLabelText(name)` in the test helper — `input-otp` renders a single visually-hidden input.

- [ ] **Step 5: Verify the registry compiles**

`src/features/signup/steps.ts` was written in Task 12 Step 4 and can now resolve both components.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/features/signup/PinStep.tsx src/features/signup/PinStep.test.tsx src/features/signup/steps.ts
git commit -m "feat(web): add the secret PIN step and the step registry

The PIN is encoded server-side against a single-use pintwin key, so the
client holds no key state and needs no refresh cycle."
```

---

### Task 15: Signup wizard

**Files:**
- Create: `src/features/signup/SignupWizard.tsx`
- Test: `src/features/signup/SignupWizard.test.tsx`

**Interfaces:**
- Consumes: `signupClient`, `SignupState`, `ApiError` (Task 9); `resolveSteps`, `ResolvedStep` (Task 12); `SIGNUP_STEPS` (Task 14); `useAuth` (Task 10).
- Produces: `SignupWizard: () => JSX.Element`. Task 16 renders it.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/SignupWizard.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type SignupState } from "@/lib/auth/client";
import { SignupWizard } from "./SignupWizard";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	signupClient: {
		state: vi.fn(),
		createProfile: vi.fn(),
		submitPan: vi.fn(),
		submitPin: vi.fn(),
	},
}));

const mockRefresh = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: { status: "loading" }, refresh: mockRefresh, logout: vi.fn() }),
}));

const { signupClient } = await import("@/lib/auth/client");

const panPending: SignupState = {
	mobile: "9990000001",
	status: "in_progress",
	steps: [
		{ role: 13000, label: "PAN Details" },
		{ role: 12600, label: "Set Secret PIN" },
	],
	currentRole: 13000,
};
const pinPending: SignupState = { ...panPending, currentRole: 12600 };
const done: SignupState = { ...panPending, status: "done", currentRole: null };

beforeEach(() => vi.clearAllMocks());

describe("SignupWizard", () => {
	it("creates the partial account when the state is new", async () => {
		vi.mocked(signupClient.state).mockResolvedValue({
			mobile: "9990000001",
			status: "new",
			steps: [],
			currentRole: null,
		});
		vi.mocked(signupClient.createProfile).mockResolvedValue(panPending);
		render(<SignupWizard />);
		expect(await screen.findByText(/setting up your account/i)).toBeInTheDocument();
		await waitFor(() => expect(signupClient.createProfile).toHaveBeenCalled());
		expect(await screen.findByText("PAN Details")).toBeInTheDocument();
	});

	it("renders the current step and its progress", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		render(<SignupWizard />);
		expect(await screen.findByText("PAN Details")).toBeInTheDocument();
		expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
		expect(signupClient.createProfile).not.toHaveBeenCalled();
	});

	it("resumes at the pending step after a drop-off", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		expect(await screen.findByText("Set Secret PIN")).toBeInTheDocument();
		expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
	});

	it("advances to the next step on success", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		vi.mocked(signupClient.submitPan).mockResolvedValue(pinPending);
		render(<SignupWizard />);
		await screen.findByText("PAN Details");
		await userEvent.type(screen.getByLabelText(/pan/i), "ABCDE1234F");
		await userEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByText("Set Secret PIN")).toBeInTheDocument();
	});

	it("shows the server error and stays on the step", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(panPending);
		vi.mocked(signupClient.submitPan).mockRejectedValue(
			new ApiError("STEP_FAILED", "PAN already in use", 400),
		);
		render(<SignupWizard />);
		await screen.findByText("PAN Details");
		await userEvent.type(screen.getByLabelText(/pan/i), "ABCDE1234F");
		await userEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(await screen.findByRole("alert")).toHaveTextContent("PAN already in use");
		expect(screen.getByText("PAN Details")).toBeInTheDocument();
	});

	it("refreshes auth on completion so the session swaps to developer", async () => {
		vi.mocked(signupClient.state).mockResolvedValue(pinPending);
		vi.mocked(signupClient.submitPin).mockResolvedValue(done);
		render(<SignupWizard />);
		await screen.findByText("Set Secret PIN");
		await userEvent.click(screen.getByLabelText(/^secret pin/i));
		await userEvent.keyboard("1234");
		await userEvent.click(screen.getByLabelText(/confirm/i));
		await userEvent.keyboard("1234");
		await userEvent.click(screen.getByRole("button", { name: /finish/i }));
		expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
		await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- SignupWizard`
Expected: FAIL — cannot resolve `./SignupWizard`.

- [ ] **Step 3: Implement**

Create `src/features/signup/SignupWizard.tsx`:

```tsx
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, signupClient, type SignupState } from "@/lib/auth/client";
import { resolveSteps, type ResolvedStep } from "./resolveSteps";
import { SIGNUP_STEPS } from "./steps";

/** Segmented progress bar: one segment per step, filled up to the current one. */
function Progress({ steps }: { steps: ResolvedStep[] }) {
	const currentIndex = steps.findIndex((s) => s.status === "current");
	const position = currentIndex === -1 ? steps.length : currentIndex + 1;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2" aria-hidden="true">
				{steps.map((s, i) => (
					<div
						key={s.role}
						className={`h-1.5 flex-1 rounded-full ${
							i < position ? "bg-primary" : "bg-muted"
						}`}
					/>
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				Step {position} of {steps.length}
			</p>
		</div>
	);
}

/**
 * Drives the onboarding steps for a signup session.
 *
 * Progress is never inferred locally: every step call returns fresh
 * server-authoritative state, which decides what renders next. That makes
 * resume-after-drop-off and retry-after-failure the same code path.
 */
export function SignupWizard() {
	const { refresh } = useAuth();
	const [state, setState] = useState<SignupState | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fatal, setFatal] = useState<string | null>(null);

	// Load initial state, creating the partial account if it does not exist yet.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				let next = await signupClient.state();
				if (next.status === "new") {
					next = await signupClient.createProfile();
				}
				if (!cancelled) setState(next);
			} catch (e) {
				if (!cancelled) {
					setFatal(
						e instanceof ApiError
							? e.message
							: "Couldn't start signup. Please try again.",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// When onboarding completes the backend swaps in a developer session; pulling
	// /me makes the app notice and route on to the console.
	useEffect(() => {
		if (state?.status === "done") void refresh();
	}, [state?.status, refresh]);

	/** Runs a step submit, mapping failures to an inline error on the same step. */
	const runStep = useCallback(
		async (submit: () => Promise<SignupState>) => {
			setBusy(true);
			setError(null);
			try {
				setState(await submit());
			} catch (e) {
				setError(
					e instanceof ApiError
						? e.message
						: "Something went wrong. Please try again.",
				);
			} finally {
				setBusy(false);
			}
		},
		[],
	);

	if (fatal) {
		return (
			<p role="alert" className="text-sm text-destructive">
				{fatal}
			</p>
		);
	}

	if (!state) {
		return (
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground">Setting up your account…</p>
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-2/3" />
			</div>
		);
	}

	if (state.status === "done") {
		return (
			<div className="flex flex-col items-center gap-3 py-6 text-center">
				<CheckCircle2 className="h-12 w-12 text-primary" />
				<h2 className="text-xl font-semibold">You're all set</h2>
				<p className="text-muted-foreground">
					Your account is ready. Taking you to your console…
				</p>
			</div>
		);
	}

	const steps = resolveSteps(state, SIGNUP_STEPS);
	const current = steps.find((s) => s.status === "current");

	if (!current) {
		return (
			<p role="alert" className="text-sm text-destructive">
				This signup step isn't supported here yet. Please contact support.
			</p>
		);
	}

	// Each step owns its submit, so the wizard never learns step names or call
	// signatures — adding a step touches only the registry and its component.
	const { Component, submit } = current;

	return (
		<div className="flex flex-col gap-6">
			<Progress steps={steps} />
			<div className="flex flex-col gap-1">
				<h2 className="text-xl font-semibold">{current.label}</h2>
			</div>
			<Component
				onSubmit={(values) => runStep(() => submit(signupClient, values))}
				busy={busy}
				error={error}
			/>
		</div>
	);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- SignupWizard`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/features/signup/SignupWizard.tsx src/features/signup/SignupWizard.test.tsx
git commit -m "feat(web): add the signup wizard

Server-authoritative state drives every render, so resume-after-drop-off
and retry-after-failure share one code path."
```

---

### Task 16: Rewrite the signup page

**Why:** `/signup` becomes real signup. The Zoho lead-capture iframe is retired.

**Files:**
- Rewrite: `src/pages/SignupPage.tsx`
- Test: `src/pages/SignupPage.test.tsx`
- Delete: `src/components/ZohoSignupForm.tsx` (only if nothing else imports it)

**Interfaces:**
- Consumes: `useAuth` (Task 10); `SignupWizard` (Task 15); `LoginForm` (existing).
- Produces: the `/signup` route's page component. Already routed at `src/App.tsx:126`, `src/AppServer.tsx:146`, and prerendered via `ssg/routes.ts:60,117` — no routing changes.

- [ ] **Step 1: Check for other consumers of the Zoho form**

Run: `grep -rn "ZohoSignupForm" src/ ssg/ --include=*.ts --include=*.tsx`
Expected: only `src/pages/SignupPage.tsx` and the component itself. If anything else imports it, leave the component in place and only remove it from this page.

- [ ] **Step 2: Write the failing test**

Create `src/pages/SignupPage.test.tsx`, modelled on the existing `src/components/console/ConsoleLayout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthState } from "@/lib/auth/AuthProvider";
import SignupPage from "./SignupPage";

let mockState: AuthState = { status: "loading" };
vi.mock("@/lib/auth/AuthProvider", () => ({
	useAuth: () => ({ state: mockState, refresh: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/components/auth/LoginForm", () => ({
	LoginForm: () => <div data-testid="login-form" />,
}));
vi.mock("@/features/signup/SignupWizard", () => ({
	SignupWizard: () => <div data-testid="signup-wizard" />,
}));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
	...(await orig<typeof import("react-router-dom")>()),
	useNavigate: () => mockNavigate,
}));

function renderPage() {
	return render(
		<HelmetProvider>
			<MemoryRouter>
				<SignupPage />
			</MemoryRouter>
		</HelmetProvider>,
	);
}

describe("SignupPage", () => {
	it("shows the login form when anonymous", () => {
		mockState = { status: "anon" };
		renderPage();
		expect(screen.getByTestId("login-form")).toBeInTheDocument();
	});

	it("shows the wizard for a signup session", () => {
		mockState = {
			status: "authed",
			role: "signup",
			me: { role: "signup", mobile: "9990000001" },
		};
		renderPage();
		expect(screen.getByTestId("signup-wizard")).toBeInTheDocument();
	});

	it("redirects a fully onboarded user to the console", () => {
		mockState = {
			status: "authed",
			role: "developer",
			me: { state: "active", mobile: "9990000001", profile: null, zohoId: null },
		};
		renderPage();
		expect(mockNavigate).toHaveBeenCalledWith("/console", { replace: true });
	});

	it("shows a skeleton while loading", () => {
		mockState = { status: "loading" };
		renderPage();
		expect(screen.getByTestId("signup-loading")).toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- SignupPage`
Expected: FAIL — the page renders the Zoho marketing layout, not the login form.

- [ ] **Step 4: Rewrite the page**

Replace the whole of `src/pages/SignupPage.tsx`:

```tsx
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignupWizard } from "@/features/signup/SignupWizard";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Self-serve signup.
 *
 * A switch on auth state: anonymous users log in with mobile + OTP, signup
 * sessions run the onboarding wizard, and already-onboarded users are sent to
 * their console.
 */
const SignupPage = () => {
	const { state } = useAuth();
	const navigate = useNavigate();

	// A fully onboarded user has no business here.
	useEffect(() => {
		if (state.status === "authed" && state.role !== "signup") {
			navigate("/console", { replace: true });
		}
	}, [state, navigate]);

	return (
		<div className="min-h-screen bg-background">
			<Helmet>
				<title>Create your account | Eko</title>
				<meta
					name="description"
					content="Create your Eko Platform Services account and start integrating."
				/>
			</Helmet>

			<main className="pt-24 lg:pt-28">
				<section className="py-14 md:py-20">
					<div className="container mx-auto px-4 sm:px-6 lg:px-8">
						<div className="mx-auto w-full max-w-md">
							<Card>
								<CardHeader>
									<CardTitle>
										{state.status === "authed" && state.role === "signup"
											? "Complete your setup"
											: "Create your account"}
									</CardTitle>
								</CardHeader>
								<CardContent>
									{state.status === "loading" && (
										<div
											data-testid="signup-loading"
											className="flex flex-col gap-3"
										>
											<Skeleton className="h-8 w-full" />
											<Skeleton className="h-8 w-2/3" />
										</div>
									)}
									{state.status === "anon" && <LoginForm />}
									{state.status === "authed" && state.role === "signup" && (
										<SignupWizard />
									)}
								</CardContent>
							</Card>
						</div>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default SignupPage;
```

Note the `authed` + non-signup case renders nothing while the `useEffect` redirects — the same pattern the codebase already uses. The SSG prerender captures `status: "loading"`, so the wizard never renders server-side and cannot mismatch on hydration.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- SignupPage`
Expected: PASS, 4 tests.

- [ ] **Step 6: Delete the Zoho form if unused**

Only if Step 1 found no other consumer:

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git rm src/components/ZohoSignupForm.tsx
```

- [ ] **Step 7: Verify the build and the full suite**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: PASS. The build exercises the SSG prerender of `/signup`.

- [ ] **Step 8: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add src/pages/SignupPage.tsx src/pages/SignupPage.test.tsx
git commit -m "feat(web): make /signup a real signup flow

Replaces the Zoho lead-capture iframe with mobile+OTP login and the
onboarding wizard. Onboarded users are redirected to /console."
```

---

### Task 17: Documentation

**Files:**
- Create: `docs/features/user-onboarding.md`
- Modify: `docs/console-roadmap.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no code.

- [ ] **Step 1: Write the feature doc**

Create `docs/features/user-onboarding.md` covering, with real file paths and line references:

1. **Journey** — a mermaid `flowchart` from `/signup` through OTP, partial-account creation, PAN, PIN, to `/console`.
2. **Why there is no Eko access token** — `/transactions/do` is `connect-api`'s own route; `eps-backend` is its equivalent and sends `initiator_id`/`user_code`/`org_id` + `developer_key` to the same SimpliBank path.
3. **The `onboarding === 1` gate** — and why it is checked before `user_type === "23"`.
4. **Session roles** — what `signup` authorizes, and why `/me` returns a lightweight view for it.
5. **Interaction reference table** — 521/523/170/10005/5 with their success `response_type_id`s.
6. **Pintwin** — what it is (substitution, not encryption), why encoding is server-side, and why a fresh key is fetched per attempt.
7. **How to add a step** — the recipe:
   - Backend: add the interaction method to `clients/eko.ts`; add an orchestration method to `signup/service.ts`; add a route to `http/signup.ts`.
   - Frontend: write the step component taking `StepProps`; add one entry to `src/features/signup/steps.ts` with its role code; add its submit shape to the wizard's `onSubmit` switch.
   - Note that step **order and labels come from the API**, not the registry.
8. **Known constants and their caveats** — the hardcoded `latlong`, `alternate_user_id`, and why they are fixed.
9. **Log redaction** — which fields, and why the okekey/pintwin_key pair is the risk.

- [ ] **Step 2: Update the console roadmap**

`docs/console-roadmap.md` describes the console as "a thin lifecycle gate (login → state-aware card)". Add a line noting self-serve signup now exists at `/signup`, and link to the new doc.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhi/DEV/eko_github/eko-eps-website-onboarding
git add docs/features/user-onboarding.md docs/console-roadmap.md
git commit -m "docs(signup): document the user onboarding flow"
```

---

## UAT smoke test (manual, before merge)

Automated tests all mock the upstream. Three things can only be settled against the real UAT SimpliBank, and all three are isolated so a fix is a one-line change:

1. **`alternate_user_id` on 10005** — this plan sends the mobile. Eloka reads a `temp_user_id` from `sessionStorage` whose provenance is not visible in that codebase. If 10005 returns no key, this is the first suspect.
2. **523 with no file part** — confirmed acceptable in review; verify in practice.
3. **The hardcoded `latlong`** — verify it is accepted, or discover it is not required at all.

Procedure: set `EKO_LOG_LEVEL=full` (PIN fields are redacted by Task 1), run a real unregistered UAT mobile through `/signup` end to end, and confirm the profile reports `onboarding: 0` and `user_type: 23` at the end. Then log in again and confirm you land on `/console`, not back in the wizard.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Profile gate (`onboarding` kind, ordering) | 2 |
| verify-OTP branches | 8 |
| Session role | 5 |
| `/me` signup view | 5 (type), 8 (route) |
| Upstream identity per step | 4 |
| `GET /signup/state` | 6, 7 |
| `POST /signup/profile` | 6, 7 |
| `POST /signup/pan` (523, no file) | 4, 6, 7 |
| `POST /signup/pin` (170→10005→5) | 3, 4, 6, 7 |
| Log redaction | 1 |
| `/signup` page + auth switch | 16 |
| Partial-account creation is not a screen | 15 |
| Step registry + resolver | 12, 14 |
| Layout (centered card, segmented progress) | 15, 16 |
| PanStep / PinStep | 13, 14 |
| InputOTP primitive | 11 |
| `signupClient` | 9 |
| `AuthProvider.classify` | 10 |
| Error handling table | 7 (routes), 15 (wizard), 13/14 (inline) |
| Testing plan | every task |
| Docs | 17 |
| SSG hydration guard | 16 |

No gaps.

**Placeholder scan:** none. Every code step carries complete code; every test step carries real assertions.

**Type consistency checked:**
- `EkoIdentity`, `EkoBooklet`, `EkoPintwinKey`, `EkoStepResult` — defined Task 4, consumed Task 6. Match.
- `SignupState`, `SignupStep`, `SignupStepError`, `SignupService` — defined Task 6, consumed Task 7. Match.
- `SignupState`/`SignupStep` — mirrored in the frontend Task 9, consumed Tasks 12/15. Field names identical to the backend.
- `SignupView` — defined Task 5, used Task 8, mirrored Task 9, consumed Task 10.
- `StepProps`/`StepDefinition`/`ResolvedStep` — defined Task 12, consumed Tasks 13/14/15.
- `encodePin(pin, key, keyId)` — defined Task 3, called Task 6 with the same argument order.
- `onboardingSteps` on `EkoProfile` — added Task 6 Step 3, mirrored on the frontend `Profile` in Task 9.
- `mountSignup(app, { sessions, signup })` — defined Task 7, called Task 8.

**One ordering note:** Task 6 Step 3 modifies `clients/eko.ts` (adding `onboardingSteps` to `mapProfile`), which Task 4 also modifies. Task 4 must land first. The task order enforces this.
