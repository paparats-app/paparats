import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SELF_UPDATE_CHECK_MS } from "@/services/mock/system";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderWithProviders } from "@/test/render";
import { AboutPanel } from "./AboutPanel";

const toast = () => useUiStore.getState().toast?.message;

async function openAbout(services = createTestServices()) {
  const rendered = await renderWithProviders(<AboutPanel />, {
    route: "/settings/about",
    services,
  });
  await screen.findByText("Version 1.2.3 (Build 20260915)");
  return rendered;
}

function useFakeTimers() {
  vi.useFakeTimers();
  return () => {
    vi.clearAllTimers();
    vi.useRealTimers();
  };
}

describe("AboutPanel", () => {
  it("renders the top block, the statement, the principles, the links and the footer", async () => {
    await openAbout();
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByRole("heading", { level: 2, name: "Paparats" })).toBeInTheDocument();
    expect(screen.getByText("Hidden gems for Windows.")).toBeInTheDocument();
    expect(screen.getByText("You’re up to date!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "What’s new" })).toBeInTheDocument();
    expect(
      screen.getByText(/Paparats is a curated app store for modern tools and utilities\./),
    ).toHaveTextContent(
      "Paparats is a curated app store for modern tools and utilities.We believe in useful software, privacy, and a more open ecosystem.",
    );
    expect(
      within(screen.getByRole("list"))
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Curated quality apps",
      "No ads. No telemetry",
      "Support independent developers",
      "Discover hidden gems",
    ]);
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Website", "https://paparats.app/"],
      ["Documentation", "https://paparats.app/docs"],
      ["Get support", "https://paparats.app/support"],
      ["Report an issue", "https://paparats.app/issues"],
      ["Terms of Service", "https://paparats.app/terms"],
      ["Privacy Policy", "https://paparats.app/privacy"],
      ["Licenses", "https://paparats.app/licenses"],
    ]);
    expect(screen.getByText("© 2026 Paparats. All rights reserved.")).toBeInTheDocument();
  });

  it("Check for updates: “Checking…” for 1.2 s, then the “You’re up to date!” toast", async () => {
    const services = createTestServices();
    const check = vi.spyOn(services.system, "checkForAppUpdate");
    await openAbout(services);
    const restore = useFakeTimers();
    try {
      const button = screen.getByRole("button", { name: "Check for updates" });
      fireEvent.click(button);
      expect(button).toHaveTextContent("Checking…");
      // A second click while checking starts nothing new.
      fireEvent.click(button);
      expect(check).toHaveBeenCalledTimes(1);

      await flush(SELF_UPDATE_CHECK_MS - 1);
      expect(button).toHaveTextContent("Checking…");
      expect(toast()).toBeUndefined();

      await flush(1);
      expect(button).toHaveTextContent("Check for updates");
      expect(toast()).toBe("You’re up to date!");
    } finally {
      restore();
    }
  });

  it("toasts the version when a newer client is available", async () => {
    const services = createTestServices();
    vi.spyOn(services.system, "checkForAppUpdate").mockResolvedValue({
      kind: "available",
      version: "1.3.0",
    });
    const user = userEvent.setup();
    await openAbout(services);
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByText("Version 1.3.0 is available")).toBeInTheDocument();
    expect(toast()).toBe("Version 1.3.0 is available");
    expect(screen.queryByText("You’re up to date!")).toBeNull();
  });

  it("returns quietly when the check fails", async () => {
    const services = createTestServices();
    vi.spyOn(services.system, "checkForAppUpdate").mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    await openAbout(services);
    const button = screen.getByRole("button", { name: "Check for updates" });
    await user.click(button);
    await screen.findByRole("button", { name: "Check for updates" });
    expect(toast()).toBeUndefined();
    expect(screen.getByText("You’re up to date!")).toBeInTheDocument();
  });

  it("What’s new opens Updates", async () => {
    const user = userEvent.setup();
    const { router } = await openAbout();
    await user.click(screen.getByRole("button", { name: "What’s new" }));
    expect(router.state.location.pathname).toBe("/updates");
  });

  it("the links open in the default browser, not in the app", async () => {
    const services = createTestServices();
    const open = vi.spyOn(services.system, "openExternal");
    const user = userEvent.setup();
    const { router } = await openAbout(services);
    await user.click(screen.getByRole("link", { name: "Documentation" }));
    await user.click(screen.getByRole("link", { name: "Report an issue" }));
    await user.click(screen.getByRole("link", { name: "Licenses" }));
    expect(open.mock.calls).toEqual([
      ["https://paparats.app/docs"],
      ["https://paparats.app/issues"],
      ["https://paparats.app/licenses"],
    ]);
    expect(router.state.location.pathname).toBe("/settings/about");
  });

  it("follows the UI language", async () => {
    await openAbout();
    await act(async () => {
      await useSettingsStore.getState().update({ locale: "ru" });
    });
    expect(await screen.findByText("Версия 1.2.3 (Сборка 20260915)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Проверить обновления" })).toBeInTheDocument();
    expect(screen.getByText("Поддержка независимых разработчиков")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Политика конфиденциальности" })).toBeInTheDocument();
  });
});
