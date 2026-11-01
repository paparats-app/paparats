// The real catalog (D68): its platform file turns off the surfaces Paparats runs no server for,
// and its apps carry the facts the catalog bot read from GitHub instead of made-up ratings.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createTestServices, renderApp } from "@/test/render";

function realCatalog() {
  const services = createTestServices();
  const { world } = services;
  world.platform = {
    ...world.platform,
    features: { pro: false, account: false, ideas: false, channels: false, reviews: false },
  };
  for (const app of world.catalog.apps) {
    if (app.id !== "obsidian") continue;
    app.source = {
      repo: "obsidianmd/obsidian-releases",
      stars: 12_345,
      since: "2025-11-01",
      homepage: "https://obsidian.md",
      funding: ["https://github.com/sponsors/someone", "https://ko-fi.com/someone"],
      early: true,
      unsigned: true,
      needsAdmin: true,
      byPaparatsAuthor: true,
    };
  }
  return services;
}

const mainNav = () => screen.getByRole("navigation", { name: "Main" });

describe("the real catalog", () => {
  it("hides Pro, Ideas and the account, and sends their links home", async () => {
    const first = await renderApp({ route: "/home", services: realCatalog() });
    await screen.findByRole("heading", { name: "Featured apps" });
    const items = within(mainNav())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(items.some((text) => text?.startsWith("Ideas"))).toBe(false);
    expect(items.some((text) => text?.startsWith("Subscription"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Profile" })).toBeNull();
    first.unmount();

    for (const route of ["/ideas", "/subscription", "/profile", "/channel/paparats"]) {
      const { unmount } = await renderApp({ route, services: realCatalog() });
      expect(await screen.findByRole("heading", { name: "Featured apps" })).toBeInTheDocument();
      unmount();
    }
  });

  it("shows an app's GitHub project instead of screenshots and reviews", async () => {
    const services = realCatalog();
    const open = vi.spyOn(services.system, "openExternal");
    const user = userEvent.setup();
    await renderApp({ route: "/app/obsidian", services });
    await screen.findByRole("heading", { level: 1, name: "Obsidian" });

    expect(screen.queryByRole("heading", { name: "Screenshots" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Ratings and reviews" })).toBeNull();
    expect(screen.getByText("Early version")).toBeInTheDocument();
    expect(screen.getByText("By the author of Paparats")).toBeInTheDocument();
    expect(screen.getByText(/does not sign the installer/)).toBeInTheDocument();
    expect(screen.getByText("The installer asks for administrator rights.")).toBeInTheDocument();
    expect(screen.getByText("12,345")).toBeInTheDocument();
    expect(screen.getByText("10 months")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suggest an improvement/ })).toBeNull();
    // One current release with the author's notes, no made-up history.
    expect(
      screen.getByText("Release notes from GitHub, in the author’s words."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show all versions" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "obsidianmd/obsidian-releases" }));
    await user.click(screen.getByRole("button", { name: /Report a problem/ }));
    await user.click(screen.getByRole("button", { name: /Support the author: Ko-fi/ }));
    expect(open.mock.calls).toEqual([
      ["https://github.com/obsidianmd/obsidian-releases"],
      ["https://github.com/obsidianmd/obsidian-releases/issues"],
      ["https://ko-fi.com/someone"],
    ]);
  });
});
