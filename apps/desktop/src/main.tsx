import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./app/App";
import { bootstrap } from "./app/bootstrap";
import { initialPathFromHash } from "./app/navigation";
import { shouldUseMockServices } from "./platform/runtime";
import { createServices } from "./services";

// An async function, not top-level await: rolldown turns its chunk optimizations off for a
// module graph with TLA, and the startup would then load several small shared chunks.
async function start(root: HTMLElement): Promise<void> {
  // In mock mode (plain browser, PAPARATS_MOCK=1) this awaits the mock world's own chunk; a
  // Tauri build never loads it.
  const services = await createServices(shouldUseMockServices() ? "mock" : "tauri");
  await bootstrap(services);

  createRoot(root).render(
    <StrictMode>
      <App services={services} initialEntries={[initialPathFromHash(window.location.hash)]} />
    </StrictMode>,
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");
void start(root);
