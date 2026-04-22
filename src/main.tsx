import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

const container = document.getElementById("root")!;
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

const hasPrerenderedMarkup =
  container.innerHTML.replace(/<!--([\s\S]*?)-->/g, "").trim().length > 0;

if (hasPrerenderedMarkup) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
