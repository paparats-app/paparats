import { applyDocumentSettings, resolveTheme } from "./documentSettings";

describe("document settings", () => {
  it("resolves System from the OS scheme and keeps explicit themes", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("writes data-theme and data-motion on the root", () => {
    const root = document.createElement("html");
    applyDocumentSettings({ theme: "light", animations: false }, true, root);
    expect(root.dataset).toMatchObject({ theme: "light", motion: "off" });
    applyDocumentSettings({ theme: "system", animations: true }, true, root);
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.motion).toBeUndefined();
  });
});
