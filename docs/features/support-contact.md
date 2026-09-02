# Feature: Support contact strip

A slim line at the **bottom of Console Home** (`/console`) giving a signed-in
partner the ways to reach EPS support: **email**, **phone**, **WhatsApp**. Each
is an icon plus the value itself, linked — `mailto:`, `tel:`, and `wa.me`.

It sits last on the page deliberately. The blocks above it are tasks (profile,
next steps, notifications, dashboard); this is the fallback you reach for once
none of them answered your question.

> **Configured by environment, no separate flag.**
> `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_WHATSAPP` — each
> **independent and optional**. A channel renders only when its var holds a
> usable value; with none of the three set **the strip does not render at all**.
> Being configured _is_ the flag, so there is no `VITE_SHOW_SUPPORT_*`.
> They are module constants in `src/lib/config/features.ts`, read once at
> import — so tests drive the component through its props rather than stubbing
> `import.meta.env`.

## What the values look like

Phone and WhatsApp are **numbers, not links** — give the **bare 10-digit
national number**, no country code and no punctuation:

```
VITE_SUPPORT_EMAIL=eps.support@eko.co.in
VITE_SUPPORT_PHONE=9513181707
VITE_SUPPORT_WHATSAPP=9513181707
```

The strip does the rest:

- **Displayed** as `+91 951 318 1707`, via `formatMobile()` in
  [src/lib/utils.ts](../../src/lib/utils.ts) — the same helper the profile card
  and footer use, so one number reads the same everywhere in the product.
- **`tel:`** → `tel:+919513181707`.
- **`wa.me`** → `https://wa.me/919513181707` (digits only, no `+`).

A 10-digit value gets `91`; anything longer is assumed to already carry its
country code and is passed through. Punctuation in the var still works — it is
stripped for the URLs — but `formatMobile()` only groups a clean 10-digit
number, so a pre-formatted value is displayed as written.

Normalisation runs **before** the presence check, so a whitespace-only var, or a
WhatsApp value with no digits in it, hides that channel instead of rendering a
link to nowhere.

## Spacing

The strip carries `mt-6` on top of Console Home's `gap-6` and `pt-6` under its
rule, so it reads as a footer to the page rather than as one more card in the
stack.

## Accessibility & targets

Each link carries an explicit `aria-label` — "Email support at …", "Call support
at …", "WhatsApp support at …". Without it, phone and WhatsApp would announce
the same string when both are set to the same number.

The WhatsApp link opens in a new tab (`target="_blank"` +
`rel="noopener noreferrer"`): `wa.me` is a third-party origin, and navigating
the console tab away would drop the partner out of whatever they were mid-way
through. Email and phone use the platform handler and stay in place.

## Files

- [src/components/console/SupportContact.tsx](../../src/components/console/SupportContact.tsx) — the strip.
- [src/components/console/SupportContact.test.tsx](../../src/components/console/SupportContact.test.tsx) — hidden/partial/full cases and URL derivation.
- [src/lib/config/features.ts](../../src/lib/config/features.ts) — the three constants.
- [src/vite-env.d.ts](../../src/vite-env.d.ts) — their typed declarations.
- [src/pages/console/ConsoleHome.tsx](../../src/pages/console/ConsoleHome.tsx) — renders it last.
  `ConsoleHome.test.tsx` mocks `SUPPORT_EMAIL` so the wiring itself is covered.
