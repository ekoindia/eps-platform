import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { installChunkErrorReload } from "./lib/reload-on-chunk-error";

// Recover from stale-chunk loads (dynamic imports 404 after a redeploy).
installChunkErrorReload();

const container = document.getElementById("root")!;
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

const hasPrerenderedMarkup =
  container.innerHTML.replace(/<!--([\s\S]*?)-->/g, "").trim().length > 0;

if (hasPrerenderedMarkup) {
  // Pre-rendered page: full HTML is already visible before any JS runs.
  // Defer hydration to browser idle time so the main thread stays free
  // for painting. Trigger immediately on the first user interaction so
  // React event handlers are available the moment the user needs them.
  let hydrated = false;
  const TRIGGER_EVENTS = ["click", "touchstart", "keydown", "scroll"] as const;

  function doHydrate() {
    if (hydrated) return;
    hydrated = true;
    TRIGGER_EVENTS.forEach((e) => document.removeEventListener(e, doHydrate));
    hydrateRoot(container, app);
  }

  TRIGGER_EVENTS.forEach((e) =>
    document.addEventListener(e, doHydrate, { once: true, passive: true }),
  );

  // Schedule idle-time hydration. Safari fallback: 2 s timeout.
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(doHydrate, { timeout: 2000 });
  } else {
    setTimeout(doHydrate, 2000);
  }
} else {
  // SPA fallback: no pre-rendered HTML — render immediately.
  createRoot(container).render(app);
}
