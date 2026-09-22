/// <reference types="vite/client" />

/** True when the app was started with `PAPARATS_MOCK=1` (in-memory mock services). */
declare const __PAPARATS_MOCK__: boolean;

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export = classes;
}
