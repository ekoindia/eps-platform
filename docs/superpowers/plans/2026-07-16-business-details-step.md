# Business Details Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Business Details step (role `13300`) to the self-serve signup wizard, collecting company, contact, and registered-address details and submitting them to upstream interaction 522.

**Architecture:** The signup wizard is a role-keyed registry — the API's `onboarding_steps` decides order and labels at runtime, and `src/features/signup/steps.ts` only answers "can we render role N, with what, and how does it submit?". Adding a step means one component plus one registry entry on the frontend, and one eko method plus one service method plus one route on the backend. This step additionally forces a contract change: `StepProps.onSubmit` currently takes a positional `string[]`, which does not survive ten fields.

**Tech Stack:** React 19, TypeScript, shadcn/ui + Tailwind, Hono (BFF), vitest + @testing-library/react.

**Spec:** [2026-07-16-business-details-step-design.md](../specs/2026-07-16-business-details-step-design.md)

## Global Constraints

- **Indentation: tabs.** Every file in this repo uses tabs. Match it.
- **JSDoc on every new exported function, component, and interface.** Existing signup files all carry it; a bare export will look wrong in review.
- **Conventional commits.** `feat:`, `fix:`, `test:`, `docs:`. Do NOT add a `Co-Authored-By:` trailer.
- **Never commit to `main`.** Work on the current branch. Do not create or switch branches without asking.
- **Run single tests, not the whole suite.** Frontend: `npx vitest run <path>`. Backend: `npm run backend:test -- <path>`.
- **Upstream state strings are load-bearing and pasted verbatim.** `"PondiCherry"` (that casing), `"National Capital Territory of Delhi (UT)"`, `"Andhra Pradesh (New)"` (last, not alphabetical), and there is no `"Ladakh"`. Interaction 522 matches on these exact strings. Do not "correct" the spelling, do not re-sort the source array, do not add missing states.
- **Interaction 522 constants:** `interaction_type_id: "522"`, success `response_type_id: 1567`.
- **Validation lives twice** — client (feedback) and BFF (trust boundary). This is the codebase's deliberate stance; see `PAN_PATTERN` in both `PanStep.tsx:9` and `signup.ts:15`. Do not build a shared module.
- **`current_address_state` is the one field the BFF does NOT enum-check** (shape only, ≤60 chars). Rationale in the spec: the backend package cannot import `businessFields.ts`, and a second copy of 36 strings would silently reject users the day the copies diverge. 522 is the authority.

---

### Task 1: Widen the step contract from positional array to named record

`onSubmit` takes `values: string[]` today. PAN sends `[pan]`, PIN sends `[pin1, pin2]`. At ten fields, positional is a bug waiting for the first reorder. This task is pure refactor — no behavior changes, and it lands green before any business logic arrives.

`SignupWizard.tsx:159` passes `values` through opaquely, so the wizard needs no change. Only the types, the two steps, the registry, and three test assertions move.

**Files:**
- Modify: `src/features/signup/resolveSteps.ts:10`, `:18-21`
- Modify: `src/features/signup/steps.ts:21`, `:28`
- Modify: `src/features/signup/PanStep.tsx:19`
- Modify: `src/features/signup/PinStep.tsx:70`
- Test: `src/features/signup/PanStep.test.tsx:40`, `src/features/signup/PinStep.test.tsx:45`, `:57`

**Interfaces:**
- Consumes: nothing.
- Produces: `StepProps.onSubmit: (values: Record<string, string>) => Promise<void>` and `StepSubmit = (client: typeof signupClient, values: Record<string, string>) => Promise<SignupState>`. Every later frontend task depends on these.

- [ ] **Step 1: Update the three test assertions to the named shape**

In `src/features/signup/PanStep.test.tsx`, line 40:

```tsx
		expect(onSubmit).toHaveBeenCalledWith({ pan: "ABCDE1234F" });
```

In `src/features/signup/PinStep.test.tsx`, line 45:

```tsx
		expect(onSubmit).toHaveBeenCalledWith({ pin1: "1234", pin2: "1234" });
```

and line 57:

```tsx
		expect(onSubmit).toHaveBeenCalledWith({ pin1: "0000", pin2: "0000" });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/signup/PanStep.test.tsx src/features/signup/PinStep.test.tsx`
Expected: FAIL — 3 assertions, each reporting the received value as an array (e.g. `["ABCDE1234F"]`) against the expected object.

- [ ] **Step 3: Widen the types in `resolveSteps.ts`**

Replace line 10:

```ts
	onSubmit: (values: Record<string, string>) => Promise<void>;
```

Replace lines 18-21:

```ts
export type StepSubmit = (
	client: typeof signupClient,
	values: Record<string, string>,
) => Promise<SignupState>;
```

Also update the doc comment above `onSubmit` (lines 6-9) so it describes named values:

```ts
	/**
	 * Submits this step's collected values, keyed by field name. Each step
	 * decides what its keys mean; the wizard just forwards them to the step's
	 * own `submit`.
	 */
```

- [ ] **Step 4: Update the two step components**

`src/features/signup/PanStep.tsx`, line 19 — inside the form's `onSubmit`:

```tsx
			if (isValid && !busy) void onSubmit({ pan });
```

`src/features/signup/PinStep.tsx`, line 70:

```tsx
					if (canSubmit) void onSubmit({ pin1, pin2 });
```

- [ ] **Step 5: Update the registry to destructure by name**

`src/features/signup/steps.ts`, replace line 21:

```ts
		submit: (client, v) => client.submitPan(v.pan),
```

and line 28:

```ts
		submit: (client, v) => client.submitPin(v.pin1, v.pin2),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/signup/PanStep.test.tsx src/features/signup/PinStep.test.tsx src/features/signup/resolveSteps.test.ts src/features/signup/SignupWizard.test.tsx`
Expected: PASS — all four files.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors. This is the real gate for this task — the compiler is what proves no caller was missed.

- [ ] **Step 8: Commit**

```bash
git add src/features/signup/resolveSteps.ts src/features/signup/steps.ts \
	src/features/signup/PanStep.tsx src/features/signup/PinStep.tsx \
	src/features/signup/PanStep.test.tsx src/features/signup/PinStep.test.tsx
git commit -m "refactor(signup): pass step values as a named record

Positional string[] does not survive the ten-field Business Details step.
No behavior change."
```

---

### Task 2: eko client — `submitBusiness` (interaction 522)

**Files:**
- Modify: `packages/eps-backend/src/clients/eko.ts` (interface ~line 54, constants ~line 74, implementation ~line 373 after `verifyPan`)
- Test: `packages/eps-backend/src/clients/eko.test.ts`

**Interfaces:**
- Consumes: `EkoIdentity` (`eko.ts:83`), `EkoStepResult` (`eko.ts:102`), `stepResult()` (`eko.ts:227`), `actor()` (`eko.ts:218`), `ONBOARDING_LATLONG` (`eko.ts:68`), `randomUUID` (already imported at `eko.ts:1`).
- Produces: `submitBusiness(input: { details: BusinessDetails; identity: EkoIdentity; xRealIp?: string }): Promise<EkoStepResult>` and `export interface BusinessDetails`. Task 3 consumes both.

- [ ] **Step 1: Write the failing test**

Add to `packages/eps-backend/src/clients/eko.test.ts`. Match the file's existing setup style for building a client with a stub fetch — read the top of the file first and follow it rather than inventing a new harness.

```ts
describe("submitBusiness", () => {
	const details = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		contact_person_cell: "9876543210",
		alternate_mobile: "",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};
	const identity = { initiatorId: "9999999999", userCode: "20810200", orgId: 8 };

	it("posts interaction 522 with the actor, latlong and a client_ref_id", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ response_type_id: 1567 }), { status: 200 }),
		);
		const client = createEkoClient(cfg, fetchImpl);

		const result = await client.submitBusiness({ details, identity });

		expect(result).toEqual({ ok: true });
		const sent = Object.fromEntries(
			new URLSearchParams(fetchImpl.mock.calls[0][1].body as string),
		);
		expect(sent.interaction_type_id).toBe("522");
		expect(sent.initiator_id).toBe("9999999999");
		expect(sent.user_code).toBe("20810200");
		expect(sent.org_id).toBe("8");
		expect(sent.source).toBe("EPS");
		expect(sent.latlong).toBe("27.176670,78.008075,7787");
		expect(sent.client_ref_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(sent.name).toBe("Acme Retail");
		expect(sent.current_address_state).toBe("Karnataka");
	});

	it("reports the upstream message on a non-1567 response", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ response_type_id: 1502, message: "Invalid pincode" }),
				{ status: 200 },
			),
		);
		const client = createEkoClient(cfg, fetchImpl);

		expect(await client.submitBusiness({ details, identity })).toEqual({
			ok: false,
			message: "Invalid pincode",
			responseTypeId: 1502,
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- src/clients/eko.test.ts`
Expected: FAIL — `client.submitBusiness is not a function`.

- [ ] **Step 3: Add the type, constant, and interface entry**

In `packages/eps-backend/src/clients/eko.ts`, add after the `EkoIdentity` interface (~line 87):

```ts
/**
 * Business details collected by the onboarding step, keyed exactly as
 * interaction 522 expects them. Values are forwarded verbatim — this client
 * does not rename, trim, or re-validate them.
 */
export interface BusinessDetails {
	name: string;
	company_type: string;
	authorized_signatory_name: string;
	contact_person_cell: string;
	alternate_mobile: string;
	current_address_line1: string;
	current_address_line2: string;
	current_address_district: string;
	current_address_state: string;
	current_address_pincode: string;
}
```

Add to the success-code block (after line 72, `PAN_VERIFICATION_OK`):

```ts
const BUSINESS_DETAILS_OK = 1567;
```

Add to the `EkoClient` interface, after `verifyPan` (line 38):

```ts
	submitBusiness(input: {
		details: BusinessDetails;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
```

- [ ] **Step 4: Implement the method**

In the returned object, after `verifyPan` (~line 373):

```ts
		async submitBusiness(input) {
			// Eloka always sends a client_ref_id on this interaction — its
			// apiHelper injects one when absent (helpers/apiHelper.js:103) and its
			// pipeline sets one explicitly (executePipeline.ts:289). Match that.
			const raw = await post(
				{
					...actor(input.identity),
					client_ref_id: randomUUID(),
					interaction_type_id: "522",
					...input.details,
					latlong: ONBOARDING_LATLONG,
					source: "EPS",
				},
				input.xRealIp,
			);
			return stepResult(raw, BUSINESS_DETAILS_OK);
		},
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run backend:test -- src/clients/eko.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/eps-backend/src/clients/eko.ts packages/eps-backend/src/clients/eko.test.ts
git commit -m "feat(signup): add eko submitBusiness for interaction 522"
```

---

### Task 3: signup service — `submitBusiness`

Structurally identical to `submitPan` (`service.ts:132-143`): fetch the profile, derive the actor identity, call upstream, then re-read state from upstream so progress is never inferred client-side.

**Files:**
- Modify: `packages/eps-backend/src/signup/service.ts` (interface ~line 29, implementation ~line 143 after `submitPan`)
- Test: `packages/eps-backend/src/signup/service.test.ts`

**Interfaces:**
- Consumes: `BusinessDetails` and `submitBusiness` from Task 2; `requireProfile()` (`service.ts:100`), `identityOf()` (`service.ts:59`), `refresh()` (`service.ts:115`), `SignupStepError` (`service.ts:39`).
- Produces: `SignupService.submitBusiness(mobile: string, details: BusinessDetails, xRealIp?: string): Promise<SignupState>`. Task 4 consumes it.

- [ ] **Step 1: Write the failing test**

Add to `packages/eps-backend/src/signup/service.test.ts`, following the file's existing eko-stub and fixture style:

```ts
describe("submitBusiness", () => {
	const details = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		contact_person_cell: "9876543210",
		alternate_mobile: "",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};

	it("submits with the user's own identity and returns refreshed state", async () => {
		const eko = makeEko({ submitBusiness: vi.fn().mockResolvedValue({ ok: true }) });
		const service = createSignupService({ eko, cfg });

		const state = await service.submitBusiness("9876543210", details);

		expect(eko.submitBusiness).toHaveBeenCalledWith(
			expect.objectContaining({
				details,
				identity: expect.objectContaining({ orgId: expect.any(Number) }),
			}),
		);
		expect(state.status).toBe("in_progress");
	});

	it("throws SignupStepError carrying the upstream message", async () => {
		const eko = makeEko({
			submitBusiness: vi.fn().mockResolvedValue({
				ok: false,
				message: "Invalid pincode",
				responseTypeId: 1502,
			}),
		});
		const service = createSignupService({ eko, cfg });

		await expect(service.submitBusiness("9876543210", details)).rejects.toThrow(
			"Invalid pincode",
		);
	});
});
```

`makeEko` is illustrative — use whatever stub helper `service.test.ts` already defines. Read the file first.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- src/signup/service.test.ts`
Expected: FAIL — `service.submitBusiness is not a function`.

- [ ] **Step 3: Add to the service interface**

In `packages/eps-backend/src/signup/service.ts`, import the type at the top:

```ts
import type { BusinessDetails, EkoClient, EkoIdentity } from "../clients/eko";
```

Add to the `SignupService` interface after `submitPan` (line 29):

```ts
	submitBusiness(
		mobile: string,
		details: BusinessDetails,
		xRealIp?: string,
	): Promise<SignupState>;
```

Re-export the type so the route layer has one import site:

```ts
export type { BusinessDetails } from "../clients/eko";
```

- [ ] **Step 4: Implement the method**

After `submitPan` (~line 143):

```ts
		async submitBusiness(mobile, details, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const result = await eko.submitBusiness({
				details,
				identity: identityOf(profile),
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run backend:test -- src/signup/service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/eps-backend/src/signup/service.ts packages/eps-backend/src/signup/service.test.ts
git commit -m "feat(signup): add submitBusiness to the signup service"
```

---

### Task 4: BFF route — `POST /signup/business`

Validates all ten fields **before** any upstream call, then returns through `respond()` so the onboarding-complete session upgrade keeps working.

**Files:**
- Modify: `packages/eps-backend/src/http/signup.ts` (constants ~line 15, route after the `/signup/pan` handler ~line 172)
- Test: `packages/eps-backend/src/http/signup.test.ts`

**Interfaces:**
- Consumes: `submitBusiness` from Task 3; `requireSignupSession()` (`signup.ts:41`), `respond()` (`signup.ts:85`), `toAppError()` (`signup.ts:56`), `AppError` (`./errors`).
- Produces: `POST /signup/business` accepting a JSON body of the ten field names, returning `SignupState`. Task 6 calls it.

- [ ] **Step 1: Write the failing test**

Add to `packages/eps-backend/src/http/signup.test.ts`, following the file's existing app-construction and signup-cookie helpers:

```ts
describe("POST /signup/business", () => {
	const valid = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		contact_person_cell: "9876543210",
		alternate_mobile: "",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};

	it("rejects a bad pincode without calling upstream", async () => {
		const signup = makeSignup();
		const res = await post(signup, "/signup/business", {
			...valid,
			current_address_pincode: "56",
		});
		expect(res.status).toBe(400);
		expect(signup.submitBusiness).not.toHaveBeenCalled();
	});

	it("rejects a missing required field without calling upstream", async () => {
		const signup = makeSignup();
		const res = await post(signup, "/signup/business", { ...valid, name: "" });
		expect(res.status).toBe(400);
		expect(signup.submitBusiness).not.toHaveBeenCalled();
	});

	it("accepts a blank alternate_mobile", async () => {
		const signup = makeSignup();
		const res = await post(signup, "/signup/business", {
			...valid,
			alternate_mobile: "",
		});
		expect(res.status).toBe(200);
	});

	it("rejects a malformed alternate_mobile when supplied", async () => {
		const signup = makeSignup();
		const res = await post(signup, "/signup/business", {
			...valid,
			alternate_mobile: "12345",
		});
		expect(res.status).toBe(400);
	});

	it("forwards the ten fields and takes mobile from the session, not the body", async () => {
		const signup = makeSignup();
		await post(signup, "/signup/business", { ...valid, mobile: "9999999999" });
		expect(signup.submitBusiness).toHaveBeenCalledWith(
			SESSION_MOBILE,
			expect.objectContaining({ name: "Acme Retail" }),
			undefined,
		);
		const forwarded = signup.submitBusiness.mock.calls[0][1];
		expect(forwarded).not.toHaveProperty("mobile");
	});

	it("requires a signup session", async () => {
		const res = await postWithoutSession("/signup/business", valid);
		expect(res.status).toBe(401);
	});
});
```

`makeSignup` / `post` / `postWithoutSession` / `SESSION_MOBILE` are illustrative — use the helpers `signup.test.ts` already defines. Read the file first.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- src/http/signup.test.ts`
Expected: FAIL — 404 on the route.

- [ ] **Step 3: Add the validation table**

In `packages/eps-backend/src/http/signup.ts`, after `PAN_PATTERN` (line 15):

```ts
/**
 * Trust-boundary rules for the Business Details step, mirroring the client's
 * `businessFields.ts`. The duplication is deliberate — the client's copy is for
 * feedback, this one is enforcement, exactly as `PAN_PATTERN` is duplicated
 * between `PanStep.tsx` and this file.
 *
 * `current_address_state` is checked for shape only, NOT against the 36-value
 * enum: this package cannot import the client's list, and a second verbatim copy
 * would start silently rejecting users the day the two drift apart. Interaction
 * 522 is the authority on which state names it accepts.
 */
const BUSINESS_RULES: Record<
	string,
	{ pattern: RegExp; min: number; max: number; required: boolean }
> = {
	name: { pattern: /^[-a-zA-Z0-9 ,./:]+$/, min: 2, max: 100, required: true },
	company_type: { pattern: /^[1-4]$/, min: 1, max: 1, required: true },
	authorized_signatory_name: {
		pattern: /^[a-zA-Z][a-zA-Z .]{1,49}$/,
		min: 2,
		max: 50,
		required: true,
	},
	contact_person_cell: { pattern: /^[6-9]\d{9}$/, min: 10, max: 10, required: true },
	alternate_mobile: { pattern: /^[6-9]\d{9}$/, min: 10, max: 10, required: false },
	current_address_line1: { pattern: /^.+$/, min: 10, max: 200, required: true },
	current_address_line2: { pattern: /^.*$/, min: 0, max: 200, required: false },
	current_address_district: {
		pattern: /^[a-zA-Z ]+$/,
		min: 2,
		max: 50,
		required: true,
	},
	current_address_state: { pattern: /^.+$/, min: 2, max: 60, required: true },
	current_address_pincode: { pattern: /^\d{6}$/, min: 6, max: 6, required: true },
};

/**
 * Validates and narrows a request body to exactly the ten business fields.
 *
 * Only known keys are copied out, so an attacker cannot smuggle extra form
 * fields (`mobile`, `org_id`, …) through to the upstream interaction.
 *
 * @param body - Untrusted JSON body.
 * @returns The ten fields as strings.
 * @throws {AppError} 400 INVALID_INPUT on the first field that fails.
 */
function parseBusiness(body: unknown): BusinessDetails {
	const src = (body ?? {}) as Record<string, unknown>;
	const out: Record<string, string> = {};
	for (const [field, rule] of Object.entries(BUSINESS_RULES)) {
		const value = String(src[field] ?? "").trim();
		if (!value) {
			if (rule.required) {
				throw new AppError(400, "INVALID_INPUT", `${field} is required.`);
			}
			out[field] = "";
			continue;
		}
		if (
			value.length < rule.min ||
			value.length > rule.max ||
			!rule.pattern.test(value)
		) {
			throw new AppError(400, "INVALID_INPUT", `${field} is not valid.`);
		}
		out[field] = value;
	}
	return out as unknown as BusinessDetails;
}
```

Import the type at the top of the file:

```ts
import type { BusinessDetails, SignupService, SignupState } from "../signup/service";
```

- [ ] **Step 4: Add the route**

After the `/signup/pan` handler (~line 172):

```ts
	app.post("/signup/business", async (c) => {
		const mobile = await requireSignupSession(c);
		const details = parseBusiness(await c.req.json().catch(() => ({})));
		try {
			return await respond(
				c,
				mobile,
				await signup.submitBusiness(mobile, details, c.req.header("x-real-ip")),
			);
		} catch (e) {
			toAppError(e);
		}
	});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run backend:test -- src/http/signup.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck the backend**

Run: `npm run backend:typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/eps-backend/src/http/signup.ts packages/eps-backend/src/http/signup.test.ts
git commit -m "feat(signup): add POST /signup/business route

Validates all ten fields before any upstream call and copies only known
keys, so extra form fields cannot be smuggled through to interaction 522."
```

---

### Task 5: `businessFields` — field spec, state list, and client validation

One spec array drives **both** the render loop and client validation, so a field is declared once. This task is a pure module with no React — it tests fast and locks the field contract before the component exists.

**Files:**
- Create: `src/features/signup/businessFields.ts`
- Test: `src/features/signup/businessFields.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BUSINESS_FIELDS`, `BUSINESS_GROUPS`, `INDIAN_STATES`, `COMPANY_TYPES`, `type BusinessField`, and `validateField(field: BusinessField, value: string): string | null` (returns an error message, or `null` when valid). Task 6 consumes all of them.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/businessFields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	BUSINESS_FIELDS,
	INDIAN_STATES,
	validateField,
} from "./businessFields";

/** Looks a field up by name, failing loudly if the spec ever drops it. */
const field = (name: string) => {
	const found = BUSINESS_FIELDS.find((f) => f.name === name);
	if (!found) throw new Error(`no such field: ${name}`);
	return found;
};

describe("INDIAN_STATES", () => {
	it("carries upstream's 36 values verbatim", () => {
		expect(INDIAN_STATES).toHaveLength(36);
		// These exact strings are what interaction 522 matches on. If someone
		// "fixes" the spelling, the submit breaks — so pin them.
		expect(INDIAN_STATES).toContain("PondiCherry");
		expect(INDIAN_STATES).toContain("Andhra Pradesh (New)");
		expect(INDIAN_STATES).toContain("National Capital Territory of Delhi (UT)");
		expect(INDIAN_STATES).not.toContain("Ladakh");
	});
});

describe("validateField", () => {
	it("requires a company name of at least 2 characters", () => {
		expect(validateField(field("name"), "")).toMatch(/required/i);
		expect(validateField(field("name"), "A")).toBeTruthy();
		expect(validateField(field("name"), "Acme Retail")).toBeNull();
	});

	it("rejects a company name with disallowed punctuation", () => {
		expect(validateField(field("name"), "Acme@Retail")).toBeTruthy();
	});

	it("accepts a mobile starting 6-9 and rejects anything else", () => {
		expect(validateField(field("contact_person_cell"), "9876543210")).toBeNull();
		expect(validateField(field("contact_person_cell"), "5876543210")).toBeTruthy();
		expect(validateField(field("contact_person_cell"), "98765")).toBeTruthy();
	});

	it("treats a blank alternate mobile as valid but a malformed one as invalid", () => {
		expect(validateField(field("alternate_mobile"), "")).toBeNull();
		expect(validateField(field("alternate_mobile"), "12345")).toBeTruthy();
		expect(validateField(field("alternate_mobile"), "9876543210")).toBeNull();
	});

	it("requires a 6-digit pincode", () => {
		expect(validateField(field("current_address_pincode"), "560038")).toBeNull();
		expect(validateField(field("current_address_pincode"), "56003")).toBeTruthy();
		expect(validateField(field("current_address_pincode"), "5600ab")).toBeTruthy();
	});

	it("requires an address line of at least 10 characters", () => {
		expect(validateField(field("current_address_line1"), "12 MG Rd")).toBeTruthy();
		expect(
			validateField(field("current_address_line1"), "12 MG Road, Indiranagar"),
		).toBeNull();
	});

	it("accepts a signatory name with spaces and initials", () => {
		expect(validateField(field("authorized_signatory_name"), "Asha Rao")).toBeNull();
		expect(validateField(field("authorized_signatory_name"), "A. K. Rao")).toBeNull();
		expect(validateField(field("authorized_signatory_name"), "Asha9")).toBeTruthy();
	});

	it("accepts a city of letters and spaces only", () => {
		expect(validateField(field("current_address_district"), "Bengaluru")).toBeNull();
		expect(validateField(field("current_address_district"), "Bengaluru1")).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signup/businessFields.test.ts`
Expected: FAIL — cannot resolve `./businessFields`.

- [ ] **Step 3: Create the module**

Create `src/features/signup/businessFields.ts`. The `INDIAN_STATES` array is the verbatim output of a UAT probe of interaction 387 — see the spec. Paste it exactly as below; do not re-sort or re-spell.

```ts
/**
 * The 36 state values upstream accepts, captured verbatim from interaction 387
 * (state list) against UAT on 2026-07-16. Upstream returns `value` identical to
 * `label`, so one array serves both.
 *
 * These exact strings are what interaction 522 matches on. The quirks are
 * upstream's and are load-bearing: "PondiCherry" has that casing, Delhi is
 * spelled out with a "(UT)" suffix, "Andhra Pradesh (New)" comes last rather
 * than alphabetically, and there is no "Ladakh" entry. Do not correct them.
 *
 * ponytail: inlined rather than fetched — 36 static names, and the value is the
 * name itself, so there is nothing to look up. If this list ever drifts, swap in
 * a BFF route over interaction 387 (which needs no user identity).
 */
export const INDIAN_STATES: readonly string[] = [
	"Andaman & Nicobar Islands",
	"Arunachal Pradesh",
	"Assam",
	"Bihar",
	"Chandigarh",
	"Chhattisgarh",
	"Dadra and Nagar Haveli",
	"Daman and Diu",
	"Goa",
	"Gujarat",
	"Haryana",
	"Himachal Pradesh",
	"Jammu and Kashmir",
	"Jharkhand",
	"Karnataka",
	"Kerala",
	"Lakshadweep",
	"Madhya Pradesh",
	"Maharashtra",
	"Manipur",
	"Meghalaya",
	"Mizoram",
	"Nagaland",
	"National Capital Territory of Delhi (UT)",
	"Odisha",
	"PondiCherry",
	"Punjab",
	"Rajasthan",
	"Sikkim",
	"Tamil Nadu",
	"Telangana",
	"Tripura",
	"Uttar Pradesh",
	"Uttarakhand",
	"West Bengal",
	"Andhra Pradesh (New)",
];

/** Company types upstream accepts, mirroring Eloka's `COMPANY_TYPE_OPTIONS`. */
export const COMPANY_TYPES: readonly { label: string; value: string }[] = [
	{ label: "Private Ltd", value: "1" },
	{ label: "LLP", value: "2" },
	{ label: "Partnership", value: "3" },
	{ label: "Sole Proprietorship", value: "4" },
];

/** One field of the Business Details form. */
export interface BusinessField {
	/** Submitted key — must match what interaction 522 expects. */
	name: string;
	label: string;
	/** `select` renders a dropdown over `options`; `text` renders an input. */
	kind: "text" | "select";
	options?: readonly { label: string; value: string }[];
	placeholder?: string;
	required: boolean;
	pattern: RegExp;
	min: number;
	max: number;
	/** Shown when `pattern` fails. Length failures get their own message. */
	message: string;
	/** `inputMode` hint for numeric fields; omitted for plain text. */
	numeric?: boolean;
}

/**
 * Every field of the step, declared once. This array drives both the rendered
 * form and client-side validation, so adding a field is a one-line change.
 *
 * The BFF re-validates all of this independently (`http/signup.ts`) — these
 * rules are for feedback, not enforcement.
 */
export const BUSINESS_FIELDS: readonly BusinessField[] = [
	{
		name: "name",
		label: "Company/Firm's Name",
		kind: "text",
		placeholder: "Acme Retail",
		required: true,
		pattern: /^[-a-zA-Z0-9 ,./:]+$/,
		min: 2,
		max: 100,
		message: "Use only letters, numbers and , . / : -",
	},
	{
		name: "company_type",
		label: "Company Type",
		kind: "select",
		options: COMPANY_TYPES,
		required: true,
		pattern: /^[1-4]$/,
		min: 1,
		max: 1,
		message: "Select a company type",
	},
	{
		name: "authorized_signatory_name",
		label: "Director/Authorised Signatory Full Name",
		kind: "text",
		placeholder: "Asha Rao",
		required: true,
		pattern: /^[a-zA-Z][a-zA-Z .]{1,49}$/,
		min: 2,
		max: 50,
		message: "Use letters, spaces and initials only",
	},
	{
		name: "contact_person_cell",
		label: "Contact Person's Mobile Number",
		kind: "text",
		placeholder: "9876543210",
		required: true,
		pattern: /^[6-9]\d{9}$/,
		min: 10,
		max: 10,
		message: "Enter a valid 10-digit mobile number",
		numeric: true,
	},
	{
		name: "alternate_mobile",
		label: "Alternate Mobile Number (optional)",
		kind: "text",
		placeholder: "9876543210",
		required: false,
		pattern: /^[6-9]\d{9}$/,
		min: 10,
		max: 10,
		message: "Enter a valid 10-digit mobile number",
		numeric: true,
	},
	{
		name: "current_address_line1",
		label: "Registered Business Address (Line 1)",
		kind: "text",
		placeholder: "12 MG Road, Indiranagar",
		required: true,
		pattern: /^.+$/,
		min: 10,
		max: 200,
		message: "Enter a valid address",
	},
	{
		name: "current_address_line2",
		label: "Registered Business Address (Line 2, optional)",
		kind: "text",
		required: false,
		pattern: /^.*$/,
		min: 0,
		max: 200,
		message: "Enter a valid address",
	},
	{
		name: "current_address_district",
		label: "City",
		kind: "text",
		placeholder: "Bengaluru",
		required: true,
		pattern: /^[a-zA-Z ]+$/,
		min: 2,
		max: 50,
		message: "Use letters and spaces only",
	},
	{
		name: "current_address_state",
		label: "State",
		kind: "select",
		options: INDIAN_STATES.map((s) => ({ label: s, value: s })).sort((a, b) =>
			a.label.localeCompare(b.label),
		),
		required: true,
		pattern: /^.+$/,
		min: 2,
		max: 60,
		message: "Select a state",
	},
	{
		name: "current_address_pincode",
		label: "Pincode",
		kind: "text",
		placeholder: "560038",
		required: true,
		pattern: /^\d{6}$/,
		min: 6,
		max: 6,
		message: "Enter a valid 6-digit pincode",
		numeric: true,
	},
];

/** Fields grouped for display, so ten inputs don't render as one wall. */
export const BUSINESS_GROUPS: readonly { heading: string; fields: string[] }[] = [
	{ heading: "Business", fields: ["name", "company_type"] },
	{
		heading: "Contact",
		fields: ["authorized_signatory_name", "contact_person_cell", "alternate_mobile"],
	},
	{
		heading: "Address",
		fields: [
			"current_address_line1",
			"current_address_line2",
			"current_address_district",
			"current_address_state",
			"current_address_pincode",
		],
	},
];

/**
 * Validates one field's value against its spec.
 *
 * @param field - The field's spec entry.
 * @param value - The current (untrimmed) input value.
 * @returns An error message, or `null` when the value is acceptable.
 */
export function validateField(field: BusinessField, value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return field.required ? `${field.label} is required` : null;
	}
	if (trimmed.length < field.min) {
		return `Must be at least ${field.min} characters`;
	}
	if (trimmed.length > field.max) {
		return `Must be at most ${field.max} characters`;
	}
	return field.pattern.test(trimmed) ? null : field.message;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/signup/businessFields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/signup/businessFields.ts src/features/signup/businessFields.test.ts
git commit -m "feat(signup): add business field spec, state list and validation

INDIAN_STATES is the verbatim output of a UAT probe of interaction 387;
its spelling quirks are what 522 matches on and are pinned by test."
```

---

### Task 6: `BusinessStep` component

Renders the spec from Task 5. Errors surface on blur rather than on every keystroke, so a half-typed field doesn't scream at the user.

**Deviation from the spec:** the spec called for generating `src/components/ui/select.tsx` (shadcn over the already-installed `@radix-ui/react-select`). This plan uses a **native `<select>`** instead. Radix's Select renders into a portal, ignores `fireEvent.change`, and needs a keyboard-simulation dance to test under jsdom — all to reproduce what the platform already gives us. A native `<select>` is keyboard- and screen-reader-accessible by default, needs no new primitive, and is the better mobile control for a 36-item list. No `select.tsx`, no `npm install`, one fewer file.

If review prefers the Radix look, generating `select.tsx` later is a self-contained swap of one element.

**Files:**
- Create: `src/features/signup/BusinessStep.tsx`
- Test: `src/features/signup/BusinessStep.test.tsx`

**Interfaces:**
- Consumes: `BUSINESS_FIELDS`, `BUSINESS_GROUPS`, `validateField`, `type BusinessField` (Task 5); `StepProps` with the record-shaped `onSubmit` (Task 1); `Button`, `Input`, `Label` from `@/components/ui/*`.
- Produces: `export function BusinessStep(props: StepProps)`. Task 7 registers it.

- [ ] **Step 1: Write the failing test**

Create `src/features/signup/BusinessStep.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessStep } from "./BusinessStep";

const noop = async () => {};

/** Fills every text field with valid input. Selects are set separately. */
const fillText = () => {
	fireEvent.change(screen.getByLabelText(/company\/firm's name/i), {
		target: { value: "Acme Retail" },
	});
	fireEvent.change(screen.getByLabelText(/authorised signatory/i), {
		target: { value: "Asha Rao" },
	});
	fireEvent.change(screen.getByLabelText(/contact person's mobile/i), {
		target: { value: "9876543210" },
	});
	fireEvent.change(screen.getByLabelText(/address \(line 1\)/i), {
		target: { value: "12 MG Road, Indiranagar" },
	});
	fireEvent.change(screen.getByLabelText(/city/i), {
		target: { value: "Bengaluru" },
	});
	fireEvent.change(screen.getByLabelText(/pincode/i), {
		target: { value: "560038" },
	});
};

describe("BusinessStep", () => {
	it("disables submit until every required field is valid", () => {
		render(<BusinessStep onSubmit={noop} busy={false} error={null} />);
		const button = screen.getByRole("button", { name: /continue/i });
		expect(button).toBeDisabled();
		fillText();
		// Both selects are still empty, so it stays disabled.
		expect(button).toBeDisabled();
	});

	it("shows a field error on blur, not while typing", () => {
		render(<BusinessStep onSubmit={noop} busy={false} error={null} />);
		const pincode = screen.getByLabelText(/pincode/i);
		fireEvent.change(pincode, { target: { value: "56" } });
		expect(screen.queryByText(/valid 6-digit pincode/i)).toBeNull();
		fireEvent.blur(pincode);
		expect(screen.getByText(/valid 6-digit pincode/i)).toBeInTheDocument();
	});

	it("accepts a blank alternate mobile", () => {
		render(<BusinessStep onSubmit={noop} busy={false} error={null} />);
		const alt = screen.getByLabelText(/alternate mobile/i);
		fireEvent.blur(alt);
		expect(screen.queryByText(/valid 10-digit mobile/i)).toBeNull();
	});

	it("renders the three group headings", () => {
		render(<BusinessStep onSubmit={noop} busy={false} error={null} />);
		expect(screen.getByText("Business")).toBeInTheDocument();
		expect(screen.getByText("Contact")).toBeInTheDocument();
		expect(screen.getByText("Address")).toBeInTheDocument();
	});

	it("disables every field while busy", () => {
		render(<BusinessStep onSubmit={noop} busy={true} error={null} />);
		expect(screen.getByLabelText(/company\/firm's name/i)).toBeDisabled();
		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
	});

	it("shows a server error", () => {
		render(
			<BusinessStep onSubmit={noop} busy={false} error="Invalid pincode" />,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("Invalid pincode");
	});

	it("submits every field keyed by name, trimmed", () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<BusinessStep onSubmit={onSubmit} busy={false} error={null} />);
		fillText();
		fireEvent.change(screen.getByLabelText(/company\/firm's name/i), {
			target: { value: "  Acme Retail  " },
		});
		fireEvent.change(screen.getByLabelText(/company type/i), {
			target: { value: "4" },
		});
		fireEvent.change(screen.getByLabelText(/state/i), {
			target: { value: "Karnataka" },
		});
		fireEvent.click(screen.getByRole("button", { name: /continue/i }));
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Acme Retail",
			company_type: "4",
			authorized_signatory_name: "Asha Rao",
			contact_person_cell: "9876543210",
			alternate_mobile: "",
			current_address_line1: "12 MG Road, Indiranagar",
			current_address_line2: "",
			current_address_district: "Bengaluru",
			current_address_state: "Karnataka",
			current_address_pincode: "560038",
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/signup/BusinessStep.test.tsx`
Expected: FAIL — cannot resolve `./BusinessStep`.

- [ ] **Step 3: Write the component**

Create `src/features/signup/BusinessStep.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	BUSINESS_FIELDS,
	BUSINESS_GROUPS,
	type BusinessField,
	validateField,
} from "./businessFields";
import type { StepProps } from "./resolveSteps";

/** Looks up a field's spec by name. */
const specOf = (name: string): BusinessField =>
	BUSINESS_FIELDS.find((f) => f.name === name) as BusinessField;

/** Every field starts empty, including the optional ones. */
const emptyValues = (): Record<string, string> =>
	Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.name, ""]));

/**
 * Collects company, contact, and registered-address details for onboarding.
 *
 * The form is generated from `BUSINESS_FIELDS`, so a field is declared once and
 * both rendered and validated from that one entry. Client validation is for
 * feedback only — the BFF re-checks every field before calling upstream.
 */
export function BusinessStep({ onSubmit, busy, error }: StepProps) {
	const [values, setValues] = useState<Record<string, string>>(emptyValues);
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	const set = (name: string, value: string) =>
		setValues((prev) => ({ ...prev, [name]: value }));

	const errorFor = (field: BusinessField): string | null =>
		touched[field.name] ? validateField(field, values[field.name]) : null;

	const canSubmit =
		!busy && BUSINESS_FIELDS.every((f) => !validateField(f, values[f.name]));

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(e) => {
				e.preventDefault();
				if (!canSubmit) return;
				const trimmed = Object.fromEntries(
					BUSINESS_FIELDS.map((f) => [f.name, values[f.name].trim()]),
				);
				void onSubmit(trimmed);
			}}
		>
			<p className="text-muted-foreground">
				Tell us about your business. This appears on your agreement and
				invoices.
			</p>

			{BUSINESS_GROUPS.map((group) => (
				<fieldset key={group.heading} className="flex flex-col gap-4">
					<legend className="text-sm font-medium text-foreground">
						{group.heading}
					</legend>
					{group.fields.map((name) => {
						const field = specOf(name);
						const fieldError = errorFor(field);
						return (
							<div key={name} className="flex flex-col gap-2">
								<Label htmlFor={name}>{field.label}</Label>
								{field.kind === "select" ? (
									<select
										id={name}
										value={values[name]}
										disabled={busy}
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
										onChange={(e) => set(name, e.target.value)}
										onBlur={() =>
											setTouched((t) => ({ ...t, [name]: true }))
										}
									>
										<option value="">Select…</option>
										{field.options?.map((o) => (
											<option key={o.value} value={o.value}>
												{o.label}
											</option>
										))}
									</select>
								) : (
									<Input
										id={name}
										value={values[name]}
										disabled={busy}
										maxLength={field.max}
										placeholder={field.placeholder}
										inputMode={field.numeric ? "numeric" : undefined}
										autoComplete="off"
										aria-invalid={fieldError ? true : undefined}
										onChange={(e) => set(name, e.target.value)}
										onBlur={() =>
											setTouched((t) => ({ ...t, [name]: true }))
										}
									/>
								)}
								{fieldError && (
									<p className="text-sm text-destructive">{fieldError}</p>
								)}
							</div>
						);
					})}
				</fieldset>
			))}

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<Button type="submit" disabled={!canSubmit}>
				{busy ? "Saving…" : "Continue"}
			</Button>
		</form>
	);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/signup/BusinessStep.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/signup/BusinessStep.tsx src/features/signup/BusinessStep.test.tsx
git commit -m "feat(signup): add BusinessStep component

Generated from BUSINESS_FIELDS; errors surface on blur, not per keystroke.
Uses a native select rather than the Radix primitive the spec named — the
platform control is accessible by default and needs no portal."
```

---

### Task 7: Wire the step up end to end

The component and the route both exist but nothing connects them. This task makes role `13300` actually render, and updates the docs in the same change.

**Files:**
- Modify: `src/lib/auth/client.ts:198-213`
- Modify: `src/features/signup/steps.ts`
- Modify: `docs/features/user-onboarding.md`
- Test: `src/lib/auth/client.signup.test.ts`

**Interfaces:**
- Consumes: `BusinessStep` (Task 6); `POST /signup/business` (Task 4); `StepSubmit` (Task 1).
- Produces: `signupClient.submitBusiness(details: Record<string, string>): Promise<SignupState>` and the role-`13300` registry entry.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/auth/client.signup.test.ts`, following the file's existing fetch-stub style:

```ts
it("posts business details to /signup/business", async () => {
	const fetchMock = stubFetch({ mobile: "9876543210", status: "in_progress", steps: [], currentRole: null });
	const details = { name: "Acme Retail", company_type: "4" };

	await signupClient.submitBusiness(details);

	const [url, init] = fetchMock.mock.calls[0];
	expect(String(url)).toContain("/signup/business");
	expect(init.method).toBe("POST");
	expect(JSON.parse(init.body as string)).toEqual(details);
});
```

`stubFetch` is illustrative — use whatever helper the file already defines.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/auth/client.signup.test.ts`
Expected: FAIL — `signupClient.submitBusiness is not a function`.

- [ ] **Step 3: Add the client method**

In `src/lib/auth/client.ts`, add to `signupClient` after `submitPan` (line 207):

```ts
	submitBusiness: (details: Record<string, string>): Promise<SignupState> =>
		request("/signup/business", {
			method: "POST",
			body: JSON.stringify(details),
		}) as Promise<SignupState>,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/auth/client.signup.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the step**

In `src/features/signup/steps.ts`, add the import:

```ts
import { BusinessStep } from "./BusinessStep";
```

and the entry, between the PAN and PIN entries (order here is cosmetic — the API decides the real sequence):

```ts
	{
		role: 13300,
		name: "business",
		label: "Business Details",
		Component: BusinessStep,
		submit: (client, v) => client.submitBusiness(v),
	},
```

- [ ] **Step 6: Verify the wizard renders it**

Run: `npx vitest run src/features/signup/`
Expected: PASS — the whole signup folder, including `SignupWizard.test.tsx` and `resolveSteps.test.ts`.

- [ ] **Step 7: Typecheck both sides**

Run: `npm run typecheck && npm run backend:typecheck`
Expected: no errors.

- [ ] **Step 8: Update the feature doc**

`docs/features/user-onboarding.md` has a "How to add a step" playbook at lines 288-330 and a step/interaction table. Update both:

- Add `13300` / Business Details / interaction `522` / success `1567` to the interaction table.
- In the playbook, note that step values are a `Record<string, string>` keyed by field name (it currently implies a positional array).
- Add a line pointing at `businessFields.ts` as the pattern for a multi-field step, and note that `INDIAN_STATES` came from a probe of interaction 387 and is pinned verbatim.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth/client.ts src/lib/auth/client.signup.test.ts \
	src/features/signup/steps.ts docs/features/user-onboarding.md
git commit -m "feat(signup): register the Business Details step (role 13300)

Wires BusinessStep to POST /signup/business and documents the multi-field
step pattern."
```

---

## Verification

After Task 7, the step is live but has only been exercised against mocks. Before calling it done:

- [ ] Run the full signup test surface: `npx vitest run src/features/signup/ src/lib/auth/` and `npm run backend:test`
- [ ] `npm run lint`
- [ ] Drive the real wizard against UAT with a partial account sitting at role 13300, and confirm a submitted form advances the step. Use the `superpowers:verification-before-completion` skill. **This is the only check that proves the 522 field names are right** — every test above asserts our own assumptions back to us.
- [ ] If UAT rejects the submit, the upstream message surfaces inline on the step. Read it: a `response_type_id` other than 1567 with a field-specific message means a key name is wrong, and Eloka's `BusinessDetailsStep.tsx:326-337` is the reference for what 522 expects.
