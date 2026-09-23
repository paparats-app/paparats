import { act, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useDialogStore } from "@/stores/useDialogStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { ToastHost } from "./ToastHost";

const sidebar = (label = "Main") => screen.getByRole("navigation", { name: label });
const navItem = (name: string, label?: string) =>
  within(sidebar(label)).getByRole("button", { name: new RegExp(`^${name}`) });
const searchBox = () => screen.getByRole("searchbox", { name: "Search for apps, tools, ideas…" });
const update = (patch: Parameters<ReturnType<typeof useSettingsStore.getState>["update"]>[0]) =>
  act(async () => {
    await useSettingsStore.getState().update(patch);
  });

describe("App shell", () => {
  it("renders the sidebar, top bar and window controls with Home active", async () => {
    await renderApp();
    for (const name of [
      "Home",
      "Browse",
      "Categories",
      "Updates",
      "Library",
      "Ideas",
      "Subscription",
      "Settings",
    ]) {
      expect(navItem(name)).toBeInTheDocument();
    }
    expect(navItem("Home")).toHaveAttribute("aria-current", "page");
    expect(within(sidebar()).getByText("Hidden gems for Windows.")).toBeInTheDocument();
    expect(searchBox()).toBeInTheDocument();
    for (const name of ["Minimize", "Maximize", "Close"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // Six pending updates in the fixtures; initials from the profile.
    expect(
      await within(sidebar()).findByRole("img", { name: "6 updates available" }),
    ).toHaveTextContent("6");
    expect(await screen.findByText("SK")).toBeInTheDocument();
  });

  it("navigates from the sidebar behind the skeleton and clears the search", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.type(searchBox(), "obs");
    expect(searchBox()).toHaveValue("obs");
    expect(screen.getByTestId("screen").firstElementChild).not.toBeVisible();

    await user.click(navItem("Library"));
    expect(navItem("Library")).toHaveAttribute("aria-current", "page");
    expect(navItem("Home")).not.toHaveAttribute("aria-current");
    expect(searchBox()).toHaveValue("");
    await waitForElementToBeRemoved(() => screen.queryByTestId("navigation-skeleton"));
    expect(screen.getByTestId("screen")).toBeVisible();
  });

  it("skips the skeleton when animations are off", async () => {
    const user = userEvent.setup();
    await renderApp();
    await update({ animations: false });
    await user.click(navItem("Browse"));
    expect(screen.queryByTestId("navigation-skeleton")).toBeNull();
    expect(document.documentElement.dataset.motion).toBe("off");
  });

  it("applies theme and language changes instantly", async () => {
    await renderApp();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await update({ theme: "light" });
    expect(document.documentElement.dataset.theme).toBe("light");

    await update({ locale: "ru" });
    expect(document.documentElement.lang).toBe("ru");
    expect(navItem("Главная", "Главное меню")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
  });

  it("follows the OS colour scheme when the theme is System", async () => {
    let dark = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      media: query,
      get matches() {
        return dark;
      },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }));
    try {
      await renderApp();
      await update({ theme: "system" });
      expect(document.documentElement.dataset.theme).toBe("light");
      act(() => {
        dark = true;
        listeners.forEach((cb) => cb());
      });
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows the offline banner; Retry ends a simulated outage with a toast", async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(screen.queryByText("You’re offline")).toBeNull();

    await update({ dev: true, simulateOffline: true });
    expect(screen.getByText("You’re offline")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByText("You’re offline")).toBeNull());
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(false);
    expect(await screen.findByText("Back online")).toBeInTheDocument();
  });

  it("shows the Pro pill next to Subscription once subscribed", async () => {
    const services = createTestServices();
    await services.account.purchase("monthly");
    await renderApp({ services });
    expect(await within(navItem("Subscription")).findByText("Pro")).toBeInTheDocument();
  });

  it("clears the “Updated just now” markers when leaving Updates", async () => {
    const user = userEvent.setup();
    await renderApp({ route: "/updates" });
    act(() => useDownloadsStore.setState({ justUpdated: { vscode: true } }));
    await user.click(navItem("Updates"));
    expect(useDownloadsStore.getState().justUpdated).toEqual({ vscode: true });
    await user.click(navItem("Library"));
    expect(useDownloadsStore.getState().justUpdated).toEqual({});
  });

  it("keeps dialogs and toasts in the content column, beside the sidebar", async () => {
    await renderApp({ route: "/app/obsidian" });
    act(() =>
      useDialogStore
        .getState()
        .open({ kind: "report", target: { appId: "obsidian", channelId: "paparats" } }),
    );
    act(() => useUiStore.getState().notify("Sent to Paparats"));
    const dialog = await screen.findByRole("dialog");
    // The prototype's dialogs live in its `main`: the scrim dims the column, not the sidebar.
    const column = screen.getByTestId("screen").closest("main")?.parentElement;
    expect(column).toContainElement(dialog);
    expect(column).toContainElement(screen.getByText("Sent to Paparats"));
    expect(sidebar()).not.toContainElement(dialog);
  });

  // The gallery is heavy in jsdom (see DevScreen.test.tsx).
  it("renders the component gallery at /dev in both themes", { timeout: 20_000 }, async () => {
    await renderApp({ route: "/dev" });
    // Lazy route: the gallery chunk loads on first visit.
    const headings = await screen.findAllByRole(
      "heading",
      { level: 2, name: "Icon" },
      { timeout: 15_000 },
    );
    expect(headings).toHaveLength(2);
    expect(document.querySelector('main [data-theme="light"]')).not.toBeNull();
    expect(within(sidebar()).queryByRole("button", { current: "page" })).toBeNull();
  });
});

describe("ToastHost", () => {
  it("shows a toast for 2.8 s", async () => {
    await renderWithProviders(<ToastHost />);
    vi.useFakeTimers();
    try {
      act(() => useUiStore.getState().notify("Profile saved"));
      expect(screen.getByRole("status")).toHaveTextContent("Profile saved");
      act(() => vi.advanceTimersByTime(2799));
      expect(screen.getByText("Profile saved")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("Profile saved")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
