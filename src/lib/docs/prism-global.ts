/**
 * Exposes prism-react-renderer's vendored Prism instance on `globalThis` so the
 * stock `prismjs/components/*` grammar files (which call `Prism.languages.x = …`
 * at import time) register onto the SAME instance the `<Highlight>` component
 * tokenizes with.
 *
 * This lives in its OWN module on purpose: ES module imports are hoisted and
 * evaluated before sibling statements, so the assignment MUST happen in a
 * dependency that {@link ./prism-setup} imports *before* the grammar files —
 * doing it inline alongside the grammar imports would run them out of order.
 * Side-effect only; SSR/SSG-safe (touches `globalThis`, never `window`).
 */
import { Prism } from "prism-react-renderer";

(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
