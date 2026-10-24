// The app shell's side of the native shell, with the core mocked at the IPC level
// (@tauri-apps/api/mocks): paparats:// links navigate (useDeepLinks), the tray's "Check for
// updates" opens About and toasts (useTrayActions), and the tray language, the tray setting and the
// first frame reach the core (useNativeShell). Outside Tauri none of it calls anything.
import { act, cleanup, screen } from "@testing-library/react";
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { tauriShell } from "@/services/tauri/system";
import { useDialogStore } from "@/stores/useDialogStore";
import { useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { deepLinkNavTarget, useDeepLinks } from "./useDeepLinks";
import { useTrayActions } from "./useTrayActions";

type Args = Record<string, unknown>;

interface Call {
  cmd: string;
  args: Args;
}

let calls: Call[] = [];

/** A fake core answering the shell's commands; `pending` = links that started the app. */
function core(pending: unknown[] = []): void {
  calls = [];
  mockIPC(
    (cmd, payload) => {
      calls.push({ cmd, args: (payload ?? {}) as Args });
      if (cmd === "shell_take_deep_links") return pending;
      if (cmd === "plugin:window|is_maximized") return false;
      return null;
    },
    { shouldMockEvents: true },
  );
}

const called = (cmd: string) => calls.filter((c) => c.cmd === cmd).map((c) => c.args);

function ShellProbe() {
  useDeepLinks();
  useTrayActions();
  return null;
}

afterEach(async () => {
  cleanup(); // unmount (and unlisten) while the IPC mock is still there
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearMocks();
  // clearMocks leaves an empty `__TAURI_INTERNALS__`, which would still read as "inside Tauri".
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

describe("deepLinkNavTarget", () => {
  it("maps the core's targets onto navigation targets", () => {
    expect(deepLinkNavTarget({ kind: "app", id: "obs" })).toEqual({ to: "app", appId: "obs" });
    expect(deepLinkNavTarget({ kind: "channel", id: "vitrazh" })).toEqual({
      to: "channel",
      channelId: "vitrazh",
    });
  });
});

describe("useDeepLinks", () => {
  it("opens the page of the link that started the app, then of every later link", async () => {
    core([{ kind: "app", id: "obs" }]);
    const { router } = await renderWithProviders(<ShellProbe />, { route: "/library" });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/app/obs"));
    // A detail page: back() returns where the user was.
    expect(router.state.location.state).toEqual({ from: "/library" });
    expect(called("shell_take_deep_links")).toHaveLength(1);

    useDialogStore.getState().open({ kind: "addChannel" });
    await act(() => emit("shell://deep-link", { kind: "channel", id: "kvetka" }));
    expect(router.state.location.pathname).toBe("/channel/kvetka");
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("stops listening when the shell unmounts", async () => {
    core();
    const { router, unmount } = await renderWithProviders(<ShellProbe />, { route: "/home" });
    await vi.waitFor(() => expect(called("shell_take_deep_links")).toHaveLength(1));
    unmount();
    await emit("shell://deep-link", { kind: "app", id: "vlc" });
    expect(router.state.location.pathname).toBe("/home");
  });

  it("shows the linked app in the whole shell", async () => {
    core([{ kind: "app", id: "obs" }]);
    mockWindows("main"); // the window controls ask the native window
    await renderApp({ route: "/home" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "OBS Studio" }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("waits for the first-launch onboarding, then opens the page as the scene exits", async () => {
    core([{ kind: "app", id: "obs" }]);
    act(() => useFirstLaunchStore.getState().start());
    const { router } = await renderWithProviders(<ShellProbe />, { route: "/home" });
    await vi.waitFor(() => expect(called("shell_take_deep_links")).toHaveLength(1));
    await act(() => emit("shell://deep-link", { kind: "app", id: "vlc" }));
    expect(router.state.location.pathname).toBe("/home");

    act(() => {
      useFirstLaunchStore.getState().skip();
      useFirstLaunchStore.getState().finish();
    });
    // The latest link wins; the scene's exit has begun (`done`).
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/app/vlc"));
    expect(router.state.location.state).toEqual({ from: "/home" });
  });

  it("does nothing outside Tauri", async () => {
    const subscribe = vi.spyOn(tauriShell, "subscribeDeepLinks");
    const { router } = await renderWithProviders(<ShellProbe />, { route: "/home" });
    expect(subscribe).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/home");
  });
});

describe("useTrayActions", () => {
  it("Check for updates opens Settings › About and toasts the result", async () => {
    core();
    const services = createTestServices();
    const check = vi
      .spyOn(services.system, "checkForAppUpdate")
      .mockResolvedValue({ kind: "available", version: "0.2.0" });
    const { router } = await renderWithProviders(<ShellProbe />, { route: "/home", services });
    await vi.waitFor(() => expect(called("shell_take_deep_links")).toHaveLength(1));

    await act(() => emit("shell://tray-action", "checkForUpdates"));
    expect(router.state.location.pathname).toBe("/settings/about");
    await vi.waitFor(() =>
      expect(useUiStore.getState().toast?.message).toBe("Version 0.2.0 is available"),
    );
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("says so when Paparats is up to date, one check at a time", async () => {
    core();
    const services = createTestServices();
    let answer: (value: { kind: "upToDate" }) => void = () => undefined;
    const check = vi.spyOn(services.system, "checkForAppUpdate").mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await renderWithProviders(<ShellProbe />, { route: "/home", services });
    await vi.waitFor(() => expect(called("shell_take_deep_links")).toHaveLength(1));

    await act(() => emit("shell://tray-action", "checkForUpdates"));
    await act(() => emit("shell://tray-action", "checkForUpdates"));
    expect(check).toHaveBeenCalledTimes(1);
    await act(async () => answer({ kind: "upToDate" }));
    await vi.waitFor(() => expect(useUiStore.getState().toast?.message).toBe("You’re up to date!"));
  });
});

describe("useNativeShell (mounted by the providers)", () => {
  it("tells the core the tray language and setting, then that the first frame is painted", async () => {
    core();
    await renderWithProviders(<div />);
    expect(called("shell_set_locale")).toEqual([{ locale: "en" }]);
    expect(called("shell_set_minimize_to_tray")).toEqual([{ enabled: true }]);
    await vi.waitFor(() => expect(called("shell_window_ready")).toHaveLength(1));

    await act(() => useSettingsStore.getState().update({ locale: "be", tray: false }));
    expect(called("shell_set_locale")).toEqual([{ locale: "en" }, { locale: "be" }]);
    expect(called("shell_set_minimize_to_tray")).toEqual([{ enabled: true }, { enabled: false }]);
    expect(called("shell_window_ready")).toHaveLength(1);
  });

  it("does nothing outside Tauri", async () => {
    const setLocale = vi.spyOn(tauriShell, "setLocale");
    const ready = vi.spyOn(tauriShell, "windowReady");
    await renderWithProviders(<div />);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(setLocale).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });
});
