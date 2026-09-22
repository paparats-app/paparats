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

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

const services = createServices(shouldUseMockServices() ? "mock" : "tauri");
await bootstrap(services);

createRoot(root).render(
  <StrictMode>
    <App services={services} initialEntries={[initialPathFromHash(window.location.hash)]} />
  </StrictMode>,
);
