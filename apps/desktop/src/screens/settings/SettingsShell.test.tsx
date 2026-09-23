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
    expect(screen.getByRole("switch", { name: "Automatic updates" })).toBeInTheDocument();
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
});
