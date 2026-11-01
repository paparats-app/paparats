// Settings through the whole shell (renderApp): the sidebar entry, deep links into a section, the
// appearance applied to the document, toasts in the shell, the developer tools reaching the offline
// banner, and About › What's new. Fails on any console error or warning.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { renderApp } from "@/test/render";

const sidebar = () => screen.getByRole("navigation", { name: "Main" });
const sectionNav = () => screen.getByRole("navigation", { name: "Settings sections" });
const h1 = () => screen.getByRole("heading", { level: 1 }).textContent;

const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => {
  errors.mockClear();
  warnings.mockClear();
});

afterEach(() => {
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

async function openShell(route = "/home") {
  const rendered = await renderApp({ route });
  // No navigation skeleton: every screen is on screen right after a click.
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  return rendered;
}

describe("Settings in the shell", () => {
  it("opens from the sidebar, keeps it highlighted and is reached from Updates › Update settings", async () => {
    const user = userEvent.setup();
    await openShell();
    await user.click(within(sidebar()).getByRole("button", { name: "Settings" }));
    expect(h1()).toBe("Settings");
    expect(within(sidebar()).getByRole("button", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(sectionNav()).getByRole("button", { name: "Privacy" }));
    expect(within(sidebar()).getByRole("button", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(within(sidebar()).getByRole("button", { name: /^Updates/ }));
    await user.click(await screen.findByRole("button", { name: /^Update settings/ }));
    expect(h1()).toBe("Settings");
    expect(within(sectionNav()).getByRole("button", { name: "Updates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Check for updates")).toBeInTheDocument();
  });

  it("reopens the section last shown from the sidebar, as the prototype's `section` state", async () => {
    const user = userEvent.setup();
    await openShell();
    const settingsItem = () => within(sidebar()).getByRole("button", { name: "Settings" });
    const current = () =>
      within(sectionNav())
        .getAllByRole("button")
        .find((b) => b.getAttribute("aria-current") === "page")?.textContent;

    await user.click(settingsItem());
    expect(current()).toBe("General");
    await user.click(within(sectionNav()).getByRole("button", { name: "Privacy" }));
    await user.click(within(sidebar()).getByRole("button", { name: /^Home/ }));
    await user.click(settingsItem());
    expect(h1()).toBe("Settings");
    expect(current()).toBe("Privacy");

    // An explicit target (Update settings) sets it; the sidebar then keeps that one.
    await user.click(within(sidebar()).getByRole("button", { name: /^Updates/ }));
    await user.click(await screen.findByRole("button", { name: /^Update settings/ }));
    expect(current()).toBe("Updates");
    await user.click(within(sidebar()).getByRole("button", { name: /^Library/ }));
    await user.click(settingsItem());
    expect(current()).toBe("Updates");
    await user.click(within(sectionNav()).getByRole("button", { name: "General" }));
    await user.click(within(sidebar()).getByRole("button", { name: /^Home/ }));
    await user.click(settingsItem());
    expect(current()).toBe("General");
  });

  it("applies theme and language to the whole window and toasts in the shell", async () => {
    const user = userEvent.setup();
    await openShell("/settings");
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("radio", { name: "Русский" }));
    const mainNav = await screen.findByRole("navigation", { name: "Главное меню" });
    expect(within(mainNav).getByRole("button", { name: "Настройки" })).toBeInTheDocument();
    expect(h1()).toBe("Настройки");

    const sections = screen.getByRole("navigation", { name: "Разделы настроек" });
    await user.click(within(sections).getByRole("button", { name: "Конфиденциальность" }));
    await user.click(screen.getByRole("button", { name: "Очистить" }));
    expect(await screen.findByText("История поиска очищена")).toBeInTheDocument();
  });

  it("developer mode › Simulate offline shows the offline banner; switching it off is back online", async () => {
    const user = userEvent.setup();
    await openShell("/settings/advanced");
    expect(screen.queryByRole("switch", { name: "Simulate offline" })).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Developer mode" }));
    await user.click(screen.getByRole("switch", { name: "Simulate offline" }));
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Simulate offline" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry" })).toBeNull());
    expect(await screen.findByText("Back online")).toBeInTheDocument();
  });

  it("About › What’s new opens Updates", async () => {
    const user = userEvent.setup();
    await openShell("/settings/about");
    expect(await screen.findByText("Version 1.2.3 (Build 20260915)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "What’s new" }));
    expect(h1()).toBe("Updates");
  });
  it("signs back in after Sign out through the first launch's Account step, staying in Settings", async () => {
    const user = userEvent.setup();
    const { services } = await openShell("/settings/account");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Not signed in")).toBeInTheDocument();

    const signIn = screen.getByRole("button", { name: "Sign in" });
    signIn.focus();
    await user.keyboard("{Enter}");
    // The Account step alone: no scene, no step indicator, no Back.
    const scene = await screen.findByTestId("first-launch");
    expect(scene).toHaveAttribute("data-phase", "signin");
    expect(within(scene).getByRole("heading", { name: "Sign in to Paparats" })).toBeInTheDocument();
    expect(within(scene).queryByRole("button", { name: "Back" })).toBeNull();
    expect(within(scene).queryByRole("list", { name: "Setup steps" })).toBeNull();

    // Nothing typed: signs in as the profile (the prototype's `signInIntro`).
    await user.click(within(scene).getByRole("button", { name: "Sign in" }));
    // "Signed in as …" is toasted 1.6 s later, as after the first launch.
    await waitFor(
      () =>
        expect(screen.getByRole("status")).toHaveTextContent("Signed in as serj.kaje@example.com"),
      { timeout: 3000 },
    );
    expect((await services.account.getAccount()).signedIn).toBe(true);
    expect(h1()).toBe("Settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // The first-run record is not rewritten and the scene goes after its exit.
    expect(window.localStorage.getItem("paparats.firstRun")).toBeNull();
    await waitFor(() => expect(screen.queryByTestId("first-launch")).toBeNull(), {
      timeout: 3000,
    });
    // The focus is back on the row it came from.
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
  });
});
