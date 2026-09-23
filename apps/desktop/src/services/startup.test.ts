// The startup graph never reaches the mock world. Everything `main.tsx` imports statically ends
// up in the chunks a Tauri build loads and parses before the first frame; `services/mock/**` and
// `fixtures/*.json` must be reached only through `createServices("mock")`'s dynamic import (or
// a lazy route), so they stay a chunk of their own (docs/architecture.md §2).

/** Every non-test source file, as text, keyed by its path from the project root (`/src/…`). */
const SOURCES = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Static `import … from "x"`, `export … from "x"` and `import "x"` statements. `import type`,
 * `export type` and dynamic `import("x")` do not load a module at startup.
 */
const STATIC_IMPORT =
  /^[ \t]*(?:import|export)\s+(?!type\b)(?:([^;]*?)\sfrom\s*)?["']([^"']+)["']/gm;

/** `{ type A, type B }`: TypeScript drops an import whose specifiers are all types. */
function typesOnly(clause: string | undefined): boolean {
  const braces = clause?.trim().match(/^\{([\s\S]*)\}$/);
  if (!braces?.[1]) return false;
  const names = braces[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => name.startsWith("type "));
}

function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** The source file `spec` names from `from`, `fixture:<name>` for the data set, else null. */
function resolve(spec: string, from: string): string | null {
  if (spec.startsWith("@fixtures/")) return `fixture:${spec}`;
  let base: string;
  if (spec.startsWith("@/")) base = `/src/${spec.slice(2)}`;
  else if (spec.startsWith("."))
    base = normalize(`${from.slice(0, from.lastIndexOf("/"))}/${spec}`);
  else return null; // a package
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (candidate in SOURCES) return candidate;
  }
  return null; // CSS, JSON catalogs, images
}

/** Every module `entry` reaches through static imports (fixtures as `fixture:<spec>`). */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const text = SOURCES[file];
    if (text === undefined) continue;
    for (const [, clause, spec] of text.matchAll(STATIC_IMPORT)) {
      if (spec === undefined || typesOnly(clause)) continue;
      const target = resolve(spec, file);
      if (target === null || seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return seen;
}

const isMockWorld = (path: string) =>
  path.startsWith("/src/services/mock/") || path.startsWith("fixture:");

describe("startup graph", () => {
  const reached = staticGraph("/src/main.tsx");

  it("reaches the app, the service registry and the Tauri adapters", () => {
    expect(reached).toContain("/src/app/App.tsx");
    expect(reached).toContain("/src/services/registry.ts");
    expect(reached).toContain("/src/services/tauri/index.ts");
  });

  it("does not reach services/mock or the fixtures", () => {
    expect([...reached].filter(isMockWorld)).toEqual([]);
  });

  it("the registry loads the mock set with a dynamic import", () => {
    expect(SOURCES["/src/services/registry.ts"]).toMatch(/await import\("\.\/mock"\)/);
  });

  it("no module uses top-level await (rolldown then stops merging the startup chunks)", () => {
    // A statement at column 0 that awaits: module scope. Code inside functions is indented.
    const topLevelAwait = /^(?![ \t]|\/\/|\/\*|\*)[^\n]*\bawait\b/m;
    const offenders = Object.entries(SOURCES)
      .filter(([, text]) => topLevelAwait.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("would notice a static import of the mock world (test helpers have one)", () => {
    expect([...staticGraph("/src/hooks/testing.tsx")].filter(isMockWorld)).toContain(
      "/src/services/mock/index.ts",
    );
  });
});
