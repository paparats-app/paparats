import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/ — options tailored for `tauri dev` / `tauri build`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@fixtures": fileURLToPath(new URL("../../fixtures", import.meta.url)),
    },
  },
  define: {
    // `PAPARATS_MOCK=1 pnpm tauri dev` forces the in-memory mock services even inside Tauri.
    __PAPARATS_MOCK__: JSON.stringify(process.env.PAPARATS_MOCK === "1"),
  },
  css: {
    modules: { localsConvention: "camelCaseOnly" },
  },
  // Keep Rust errors visible.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    fs: { allow: ["../.."] },
  },
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        // Startup chunks (docs/architecture.md §2): the app's own code, React + router, and the
        // other libraries the first frame needs. `$initial` keeps a library that only a lazy
        // chunk uses out of the startup set. The mock world (services/mock/**) is split off by
        // its dynamic import; its data set gets a readable name here (the dev gallery shares it).
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              tags: ["$initial"],
              priority: 3,
            },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              tags: ["$initial"],
              priority: 2,
            },
            {
              name: "fixtures",
              test: /[\\/]fixtures[\\/][^\\/]+\.json$/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
});
