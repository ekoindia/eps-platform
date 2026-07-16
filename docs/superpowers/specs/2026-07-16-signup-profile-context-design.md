# Signup profile context + prefill — design

**Date:** 2026-07-16
**Status:** Approved, ready for planning
**Related:** [2026-07-16-business-details-step-design.md](./2026-07-16-business-details-step-design.md)

## Goal

Surface the user's profile data (name, email) to the onboarding steps through a
Context Provider + Hook, and use it to prefill the Business Details step. Every
onboarding step — not just BusinessStep — can read profile data via the hook.

## Scope decision

**Onboarding-scoped**, not app-wide. The data flows through the `SignupState`
the wizard already fetches from `/signup/state`; it does NOT touch the app-level
`/me` path (which deliberately does no upstream call for signup sessions). A
future app-wide need can enrich `useAuth` separately.

## Reality check (accepted)

For a fresh partial signup the prefill is usually **empty**: `createPartialAccount`
sends only the mobile, and name/email are what the user enters on this very step.
Prefill shows a value only when the mobile already maps to an enriched interaction-151
record. This is "prefill-when-present," by design. The context/hook wiring is still
built so it works the moment such data exists.

## Data flow

```
interaction 151 profile (has name/email)
  → mapProfile → EkoProfile { name, email, ... }   [already mapped today]
  → project() → SignupState { ..., name?, email? }  [NEW: stop dropping them]
  → GET /signup/state → frontend SignupState
  → SignupWizard holds it
  → <SignupProfileProvider value={{ mobile, name, email }}>
       <StepComponent />
     </SignupProfileProvider>
  → useSignupProfile() in BusinessStep seeds name/email
```

No new upstream call: `project()` already receives the profile.

## Backend

`packages/eps-backend/src/signup/service.ts`

- `SignupState` gains two optional fields:

  ```ts
  export interface SignupState {
  	mobile: string;
  	status: "new" | "in_progress" | "done";
  	steps: SignupStep[];
  	currentRole: number | null;
  	/** Profile display name, when the upstream 151 record carries one. */
  	name?: string;
  	/** Profile email, when the upstream 151 record carries one. */
  	email?: string;
  }
  ```

- `project()` populates them in the `found`/`onboarding` branch only:

  ```ts
  const { profile } = r;
  const base = { mobile, steps, name: profile.name || undefined, email: profile.email || undefined };
  // "new" (not_found) branch stays { mobile, status:"new", steps:[], currentRole:null } — no name/email
  ```

  Empty upstream strings (`""`) collapse to `undefined` so the frontend sees a clean
  "absent" rather than an empty string it would treat as a real prefill.

## Frontend

### `src/lib/auth/client.ts`

Mirror the two optional fields on the frontend `SignupState` type.

### `src/features/signup/SignupProfileContext.tsx` (new)

```ts
/** The user's profile as known during onboarding. Fields are absent until an
 *  upstream record supplies them. */
export interface SignupProfile {
	mobile: string;
	name?: string;
	email?: string;
}

const SignupProfileContext = createContext<SignupProfile | null>(null);

/** Provides profile data to every onboarding step. */
export function SignupProfileProvider({ profile, children }: {
	profile: SignupProfile;
	children: ReactNode;
}) { ... }

/** Reads the onboarding profile. Throws outside a SignupProfileProvider. */
export function useSignupProfile(): SignupProfile { ... }
```

Same throw-outside-provider pattern as `useAuth` and Eloka's `useOnboardingContext`.

### `src/features/signup/SignupWizard.tsx`

Wrap the rendered step with the provider, fed from the held `SignupState`:

```tsx
<SignupProfileProvider profile={{ mobile: state.mobile, name: state.name, email: state.email }}>
	<Component onSubmit={...} busy={busy} error={error} />
</SignupProfileProvider>
```

The wizard renders a step only after `SignupState` has loaded, so there is no
async race — the profile is present at the moment BusinessStep mounts, and its
`useState` initial seed is correct on first render.

### `src/features/signup/businessFields.ts`

Add one optional flag to `BusinessField`, set on the `name` field:

```ts
/** When true, the field renders read-only once the profile prefills it. */
lockWhenPrefilled?: boolean;
```

Set `lockWhenPrefilled: true` on `name`. Email is NOT locked (Eloka mirror:
prefilled name is authoritative; email stays editable).

### `src/features/signup/BusinessStep.tsx`

- Read `const profile = useSignupProfile();`.
- Seed initial values from the profile:

  ```ts
  const seed = (): Record<string, string> => ({
  	...emptyValues(),
  	name: profile.name ?? "",
  	email: profile.email ?? "",
  });
  const [values, setValues] = useState<Record<string, string>>(seed);
  ```

- A field is locked when its spec says so AND the profile actually prefilled it:

  ```ts
  const prefilled = (name: string): boolean =>
  	Boolean(name === "name" ? profile.name : name === "email" ? profile.email : false);
  const isLocked = (field: BusinessField): boolean =>
  	Boolean(field.lockWhenPrefilled) && prefilled(field.name);
  ```

- Locked text inputs render `readOnly` with a muted style; they are already valid,
  so submit gating is unaffected. `disabled` is NOT used (a disabled field is
  dropped from some form serializations and reads worse to AT — `readOnly` keeps
  the value present and announced).

## Error handling

No new failure modes. Missing profile data → fields render empty, exactly as today.
The provider always receives at least `mobile` (always present on `SignupState`).

## Testing

| Test | Covers |
| --- | --- |
| `service.test.ts` | `project` surfaces name/email from a profile; omits them (undefined) for a `new` state and for empty upstream strings |
| `SignupProfileContext.test.tsx` | provider exposes `{mobile,name,email}`; `useSignupProfile` throws outside a provider |
| `BusinessStep.test.tsx` | seeds name/email from context; locks a prefilled name (read-only) while email stays editable; renders empty and unlocked when the profile is bare |
| `client.signup.test.ts` / `SignupWizard.test.tsx` | `SignupState` type carries the optional fields; wizard passes them to the provider |

`BusinessStep.test.tsx` currently renders `<BusinessStep .../>` directly; it must now
wrap renders in a `SignupProfileProvider` (a small test helper). Bare renders would
throw from `useSignupProfile`.

## Out of scope

- Enriching app-wide `useAuth` / `/me` for signup sessions (the "app-wide" option).
- Prefilling any field other than name/email (no other profile field is collected here).
- Fetching Zoho lead data as a prefill source.
