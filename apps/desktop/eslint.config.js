import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "src/bindings.ts", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports (components, modules). Config files are exempt.",
        },
      ],
    },
  },
  {
    files: ["*.config.{ts,js}"],
    languageOptions: { globals: globals.node },
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Screens and components talk to the core only through services/*.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/services/**", "src/app/**/window*.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@tauri-apps/api/core", message: "Call Tauri through src/services only." },
            { name: "@/bindings", message: "Call Tauri through src/services only." },
          ],
        },
      ],
    },
  },
  prettier,
);
