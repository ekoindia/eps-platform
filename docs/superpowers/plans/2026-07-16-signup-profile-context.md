# Signup Profile Context + Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the user's profile name/email to onboarding steps via a Context Provider + Hook, and prefill the Business Details step with them.

**Architecture:** The backend already maps name/email onto `EkoProfile` from interaction 151; the signup `project()` merely drops them. This plan stops dropping them (no new upstream call), carries them on `SignupState`, and exposes them to steps through a new `SignupProfileProvider` / `useSignupProfile()` wrapping the wizard's rendered step. `BusinessStep` seeds its name/email from the hook; a prefilled name renders read-only.

**Tech Stack:** Hono BFF, React 19 + TypeScript, shadcn/ui, vitest + @testing-library/react.

**Spec:** [2026-07-16-signup-profile-context-design.md](../specs/2026-07-16-signup-profile-context-design.md)

## Global Constraints

- **Indentation: tabs.** Every file in this repo uses tabs.
- **JSDoc on every exported function/component/interface.**
- **Conventional commits.** No `Co-Authored-By:` trailer.
- **Never commit to `main`; work on the current branch `dev`.** Do not create/switch branches.
- **Run single test files.** Backend: `npm run backend:test -- <path>`. Frontend: `npx vitest run <path>`.
- **Prefill is when-present.** Name/email are usually absent for a fresh signup; the wiring must render cleanly empty in that case, never show `""` as a real value.
- **Empty upstream strings collapse to `undefined`.** `profile.name === ""` must surface as absent, not as an empty prefill.
- **`readOnly`, not `disabled`, for a locked field** — keeps the value in the DOM and announced to assistive tech.
- A **parallel Claude session** may be committing to `dev`. Stage only the files each task names; never `git add -A`; never stage `packages/eps-backend/src/http/app.test.ts`.

---

### Task 1: Surface name/email on SignupState (backend)

`project()` already receives the profile; it just doesn't copy name/email onto the returned state. Add two optional fields and populate them in both profile-bearing branches (`in_progress` and `done`). Empty strings become `undefined`.

**Files:**
- Modify: `packages/eps-backend/src/signup/service.ts` (`SignupState` ~line 16-23; `project()` ~line 86-109)
- Test: `packages/eps-backend/src/signup/service.test.ts`

**Interfaces:**
- Consumes: `EkoProfile` (already has `name`, `email`), `ProfileResult`.
- Produces: `SignupState` gains `name?: string` and `email?: string`, present only when the upstream profile carries a non-empty value. Task 2 (frontend type) and Task 3 (consumer) depend on this shape.

- [ ] **Step 1: Write the failing test**

Add to `packages/eps-backend/src/signup/service.test.ts`. The existing `onboardingProfile` fixture has `name: ""`/`email: ""`; add a second fixture with values, and assert both directions.

```ts
describe("project surfaces profile name/email", () => {
	it("carries a non-empty name/email onto in-progress state", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				...onboardingProfile,
				profile: { ...onboardingProfile.profile, name: "Asha Rao", email: "asha@acme.in" },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.name).toBe("Asha Rao");
		expect(state.email).toBe("asha@acme.in");
	});

	it("omits name/email when the upstream strings are empty", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.name).toBeUndefined();
		expect(state.email).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run backend:test -- src/signup/service.test.ts`
Expected: FAIL — `state.name` is `undefined` in the first test (field not populated yet).

- [ ] **Step 3: Add the fields to `SignupState`**

In `packages/eps-backend/src/signup/service.ts`, extend the interface (after `currentRole`, line 22):

```ts
	/** The step awaiting input, or null when there is none. */
	currentRole: number | null;
	/** Profile display name, when the upstream 151 record carries one. */
	name?: string;
	/** Profile email, when the upstream 151 record carries one. */
	email?: string;
```

- [ ] **Step 4: Populate them in `project()`**

Replace the profile-bearing tail of `project()` (from `const { profile } = r;` at line 96 through the `in_progress` return at line 108) with:

```ts
		const { profile } = r;
		const steps = profile.onboardingSteps;
		// Empty upstream strings collapse to undefined so the client sees a clean
		// "absent" rather than an empty-string prefill.
		const name = profile.name || undefined;
		const email = profile.email || undefined;
		if (profile.onboarding === 0) {
			return { mobile, status: "done", steps, currentRole: null, name, email };
		}
		const pending = new Set(profile.roleList.map((x) => Number(x)));
		const current = steps.find((s) => pending.has(s.role));
		return {
			mobile,
			status: "in_progress",
			steps,
			currentRole: current?.role ?? null,
			name,
			email,
		};
```

The `not_found` → `new` branch (line 87-88) is left untouched: no profile, no name/email.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run backend:test -- src/signup/service.test.ts`
Expected: PASS. All pre-existing tests in the file still pass — they assert states via `toEqual`, and vitest's `toEqual` ignores `undefined`-valued properties, so the empty-string fixtures still match their existing expected objects.

- [ ] **Step 6: Typecheck the backend**

Run: `npm run backend:typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/eps-backend/src/signup/service.ts packages/eps-backend/src/signup/service.test.ts
git commit -m "feat(signup): surface profile name/email on SignupState

project() already holds the profile; stop dropping name/email. Empty
upstream strings collapse to undefined. No new upstream call."
```

---

### Task 2: SignupProfileContext + hook, wired through the wizard (frontend)

Mirror the two optional fields on the frontend `SignupState` type, create the context/hook, and wrap the wizard's rendered step so every step can read profile data.

**Files:**
- Modify: `src/lib/auth/client.ts` (`SignupState` ~line 55-61)
- Create: `src/features/signup/SignupProfileContext.tsx`
- Modify: `src/features/signup/SignupWizard.tsx` (import; the `<Component>` render ~line 158-162)
- Test: `src/features/signup/SignupProfileContext.test.tsx`

**Interfaces:**
- Consumes: the backend `SignupState` shape from Task 1 (name/email).
- Produces: `SignupProfile { mobile: string; name?: string; email?: string }`, `SignupProfileProvider({ profile, children })`, and `useSignupProfile(): SignupProfile` (throws outside a provider). Task 3 consumes `useSignupProfile`.

- [ ] **Step 1: Add the optional fields to the frontend `SignupState`**

In `src/lib/auth/client.ts`, extend the interface (after `currentRole`, line 60):

```ts
	steps: SignupStep[];
	currentRole: number | null;
	/** Profile display name, when an upstream record carries one. */
	name?: string;
	/** Profile email, when an upstream record carries one. */
	email?: string;
```

- [ ] **Step 2: Write the failing context test**

Create `src/features/signup/SignupProfileContext.test.tsx`:

```tsx
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	SignupProfileProvider,
	useSignupProfile,
} from "./SignupProfileContext";

describe("SignupProfileContext", () => {
	it("exposes the provided profile to consumers", () => {
		function Probe() {
			const p = useSignupProfile();
			return <span>{`${p.mobile}|${p.name ?? ""}|${p.email ?? ""}`}</span>;
		}
		render(
			<SignupProfileProvider
				profile={{ mobile: "9990000001", name: "Asha Rao", email: "asha@acme.in" }}
			>
				<Probe />
			</SignupProfileProvider>,
		);
		expect(screen.getByText("9990000001|Asha Rao|asha@acme.in")).toBeInTheDocument();
	});

	it("throws when used outside a provider", () => {
		expect(() => renderHook(() => useSignupProfile())).toThrow(
			/SignupProfileProvider/,
		);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/signup/SignupProfileContext.test.tsx`
Expected: FAIL — cannot resolve `./SignupProfileContext`.

- [ ] **Step 4: Create the context**

Create `src/features/signup/SignupProfileContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from "react";

/**
 * The user's profile as known during onboarding. `name`/`email` are absent
 * until an upstream record supplies them (usually empty for a fresh signup).
 */
export interface SignupProfile {
	mobile: string;
	name?: string;
	email?: string;
}

const SignupProfileContext = createContext<SignupProfile | null>(null);

/**
 * Provides profile data to every onboarding step.
 * @param props.profile - The profile derived from the current SignupState.
 */
export function SignupProfileProvider({
	profile,
	children,
}: {
	profile: SignupProfile;
	children: ReactNode;
}) {
	return (
		<SignupProfileContext.Provider value={profile}>
			{children}
		</SignupProfileContext.Provider>
	);
}

/**
 * Reads the onboarding profile.
 * @returns The current `SignupProfile`.
 * @throws If used outside a `SignupProfileProvider`.
 */
export function useSignupProfile(): SignupProfile {
	const ctx = useContext(SignupProfileContext);
	if (!ctx) {
		throw new Error("useSignupProfile must be used within a SignupProfileProvider");
	}
	return ctx;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/signup/SignupProfileContext.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the provider into the wizard**

In `src/features/signup/SignupWizard.tsx`, add the import:

```ts
import { SignupProfileProvider } from "./SignupProfileContext";
```

Replace the `<Component>` render (lines 158-162) with the provider-wrapped version:

```tsx
				<SignupProfileProvider
					profile={{ mobile: state.mobile, name: state.name, email: state.email }}
				>
					<Component
						onSubmit={(values) => runStep(() => submit(signupClient, values))}
						busy={busy}
						error={error}
					/>
				</SignupProfileProvider>
```

`state` is guaranteed non-null here — the wizard returns early with a skeleton until `SignupState` loads (earlier in the component), so the profile is present before any step mounts.

- [ ] **Step 7: Run the signup suite + typecheck**

Run: `npx vitest run src/features/signup/ src/lib/auth/`
Expected: PASS. (`SignupWizard.test.tsx` renders the wizard, which now wraps steps in the provider — since the provider always receives a value, existing wizard tests keep passing.)

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/client.ts src/features/signup/SignupProfileContext.tsx \
	src/features/signup/SignupProfileContext.test.tsx src/features/signup/SignupWizard.tsx
git commit -m "feat(signup): add SignupProfileContext + useSignupProfile hook

Wraps the wizard's rendered step so every onboarding step can read the
user's profile (mobile/name/email) from the SignupState it already holds."
```

---

### Task 3: Prefill and lock name/email in BusinessStep

Seed the name/email inputs from `useSignupProfile()`. A prefilled name renders read-only (per the `lockWhenPrefilled` spec flag); email stays editable. Existing BusinessStep tests must wrap renders in a provider.

**Files:**
- Modify: `src/features/signup/businessFields.ts` (`BusinessField` interface; the `name` field entry)
- Modify: `src/features/signup/BusinessStep.tsx`
- Test: `src/features/signup/BusinessStep.test.tsx`

**Interfaces:**
- Consumes: `useSignupProfile` (Task 2); `BUSINESS_FIELDS`/`validateField`/`type BusinessField` (existing).
- Produces: BusinessStep that prefills and conditionally locks. Terminal — nothing depends on it.

- [ ] **Step 1: Add the `lockWhenPrefilled` flag to the spec**

In `src/features/signup/businessFields.ts`, add to the `BusinessField` interface (after `inputMode`):

```ts
	/** When true, the field renders read-only once the profile prefills it. */
	lockWhenPrefilled?: boolean;
```

Add `lockWhenPrefilled: true` to the `name` field entry (only that field):

```ts
	{
		name: "name",
		label: "Company/Firm's Name",
		kind: "text",
		description:
			"For an individual or sole proprietorship, enter your own name.",
		required: true,
		pattern: /^[-a-zA-Z0-9 ,./:]+$/,
		min: 2,
		max: 100,
		message: "Use only letters, numbers and , . / : -",
		lockWhenPrefilled: true,
	},
```

- [ ] **Step 2: Write the failing tests**

`BusinessStep.test.tsx` renders `<BusinessStep .../>` directly today; every render must now be wrapped, or `useSignupProfile` throws. Add a render helper at the top of the file and update ALL existing `render(<BusinessStep .../>)` calls to use it (default: empty profile so existing tests behave as before).

Add the helper and import:

```tsx
import { SignupProfileProvider } from "./SignupProfileContext";

/** Renders BusinessStep inside a profile provider (empty profile by default). */
const renderStep = (
	props: Parameters<typeof BusinessStep>[0],
	profile = { mobile: "9990000001" },
) =>
	render(
		<SignupProfileProvider profile={profile}>
			<BusinessStep {...props} />
		</SignupProfileProvider>,
	);
```

Replace every `render(<BusinessStep onSubmit={...} busy={...} error={...} />)` in the file with `renderStep({ onSubmit: ..., busy: ..., error: ... })`. (Mechanical — keep each test's exact props.)

Then add the new prefill tests:

```tsx
it("prefills name and email from the profile", () => {
	renderStep(
		{ onSubmit: noop, busy: false, error: null },
		{ mobile: "9990000001", name: "Asha Rao", email: "asha@acme.in" },
	);
	expect(screen.getByLabelText(/company\/firm's name/i)).toHaveValue("Asha Rao");
	expect(screen.getByLabelText(/email address/i)).toHaveValue("asha@acme.in");
});

it("locks a prefilled name read-only but leaves email editable", () => {
	renderStep(
		{ onSubmit: noop, busy: false, error: null },
		{ mobile: "9990000001", name: "Asha Rao", email: "asha@acme.in" },
	);
	expect(screen.getByLabelText(/company\/firm's name/i)).toHaveAttribute("readonly");
	expect(screen.getByLabelText(/email address/i)).not.toHaveAttribute("readonly");
});

it("leaves name editable when the profile has no name", () => {
	renderStep({ onSubmit: noop, busy: false, error: null });
	expect(screen.getByLabelText(/company\/firm's name/i)).toHaveValue("");
	expect(screen.getByLabelText(/company\/firm's name/i)).not.toHaveAttribute("readonly");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/signup/BusinessStep.test.tsx`
Expected: FAIL — the two prefill tests fail (values empty, no `readonly`); the rewritten existing tests should PASS once wrapped (if any fail here, the wrapper wasn't applied to that render).

- [ ] **Step 4: Consume the profile in BusinessStep**

In `src/features/signup/BusinessStep.tsx`, import the hook:

```ts
import { useSignupProfile } from "./SignupProfileContext";
```

Replace the `emptyValues` seed and add the lock helpers. The current head of the component is:

```ts
export function BusinessStep({ onSubmit, busy, error }: StepProps) {
	const [values, setValues] = useState<Record<string, string>>(emptyValues);
	const [touched, setTouched] = useState<Record<string, boolean>>({});
```

Replace with:

```ts
export function BusinessStep({ onSubmit, busy, error }: StepProps) {
	const profile = useSignupProfile();
	// Seed name/email from the profile when present; every other field starts
	// empty. Computed once for the initial state — the wizard only mounts this
	// step after SignupState (and thus the profile) has loaded, so there is no
	// late-arriving-prop race.
	const [values, setValues] = useState<Record<string, string>>(() => ({
		...emptyValues(),
		name: profile.name ?? "",
		email: profile.email ?? "",
	}));
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	/** A field is locked when its spec opts in AND the profile actually prefilled it. */
	const isLocked = (field: BusinessField): boolean => {
		if (!field.lockWhenPrefilled) return false;
		if (field.name === "name") return Boolean(profile.name);
		if (field.name === "email") return Boolean(profile.email);
		return false;
	};
```

Then, on the text `<Input>` element in the render, add `readOnly` and a muted style when locked. The current `<Input>` is:

```tsx
									<Input
										id={name}
										value={values[name]}
										disabled={busy}
										maxLength={field.max}
										type={field.inputMode === "email" ? "email" : "text"}
										inputMode={field.inputMode}
										autoComplete="off"
										aria-invalid={fieldError ? true : undefined}
										aria-describedby={fieldError ? `${name}-error` : undefined}
										onChange={(e) => set(name, e.target.value)}
										onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
									/>
```

Add `readOnly={isLocked(field)}` and a conditional class:

```tsx
									<Input
										id={name}
										value={values[name]}
										disabled={busy}
										readOnly={isLocked(field)}
										maxLength={field.max}
										type={field.inputMode === "email" ? "email" : "text"}
										inputMode={field.inputMode}
										autoComplete="off"
										aria-invalid={fieldError ? true : undefined}
										aria-describedby={fieldError ? `${name}-error` : undefined}
										className={isLocked(field) ? "bg-muted text-muted-foreground" : undefined}
										onChange={(e) => set(name, e.target.value)}
										onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
									/>
```

(`isLocked` is only ever true for `kind: "text"` fields — name/email are both text — so the `<select>` branch needs no change.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/signup/BusinessStep.test.tsx`
Expected: PASS — all rewritten existing tests plus the three new prefill tests.

- [ ] **Step 6: Run the full signup suite + typecheck**

Run: `npx vitest run src/features/signup/`
Expected: PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/signup/businessFields.ts src/features/signup/BusinessStep.tsx \
	src/features/signup/BusinessStep.test.tsx
git commit -m "feat(signup): prefill business name/email from the profile

Seeds name/email from useSignupProfile; a prefilled name locks read-only
(Eloka mirror), email stays editable."
```

---

## Verification

After Task 3:

- [ ] `npx vitest run src/features/signup/ src/lib/auth/` and `npm run backend:test` — all green.
- [ ] `npm run typecheck && npm run backend:typecheck` — no errors.
- [ ] `npm run lint` — no new errors.
- [ ] Drive the wizard against UAT with a mobile whose 151 record carries a name/email, and confirm BusinessStep shows them prefilled with the name field locked. With a bare partial account, confirm both fields render empty and editable. Use the `superpowers:verification-before-completion` skill. This is the only check that proves prefill data actually flows end to end from interaction 151 — the tests assert the wiring with stub profiles, not real upstream data.
