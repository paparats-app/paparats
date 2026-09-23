// App detail page (prototype lines 967–1118) against the mock services: header and source notes,
// the install flow, ratings, version history, report dialog routing and the Back navigation.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { useNav } from "@/app/navigation";
import { changeLocale } from "@/i18n";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useIdeasStore } from "@/stores/useIdeasStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderApp, renderWithProviders } from "@/test/render";
import { AppScreen } from "./AppScreen";

const TICK = 110;

async function openApp(appId: string, services = createTestServices()) {
  const rendered = await renderApp({ route: `/app/${appId}`, services });
  await screen.findByRole("heading", { level: 1 });
  // The ideas and channels arrive with the catalog; wait for the source chip.
  await screen.findByTitle("Source");
  return rendered;
}

function header(): HTMLElement {
  const h1 = screen.getByRole("heading", { level: 1 });
  const el = h1.closest("header");
  if (!el) throw new Error("no header");
  return el;
}

const toast = () => useUiStore.getState().toast?.message;

describe("AppScreen", () => {
  it("renders Obsidian: Pro, official catalog, origins, versions and More in", async () => {
    await openApp("obsidian");
    const top = within(header());
    expect(top.getByRole("heading", { name: "Obsidian" })).toBeInTheDocument();
    expect(top.getByText("Dynalist Inc.")).toBeInTheDocument();
    expect(top.getByRole("button", { name: "Paparats" })).toBeInTheDocument();
    expect(top.getByText("Productivity")).toBeInTheDocument();
    expect(top.getByText("Pro")).toBeInTheDocument();
    expect(top.getByText("Your knowledge, your way.")).toBeInTheDocument();
    // Official catalog: no source note, no alternatives.
    expect(screen.queryByText(/a verified channel/)).toBeNull();
    expect(screen.queryByText(/Also offered by/)).toBeNull();
    // Installed 1.8.9, catalog 1.8.10 → Update, and the sub line.
    expect(top.getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(top.getByText("Free · 105 MB · Freeware")).toBeInTheDocument();
    expect(top.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(screen.getByRole("heading", { name: "Screenshots" })).toBeInTheDocument();
    expect(screen.getByText("Pro features: Sync, publish, advanced plugins")).toBeInTheDocument();
    expect(await screen.findByText("Graph view that follows the dark theme")).toBeInTheDocument();
    expect(screen.getByText("by Maryna V. · 77 votes · Released in 1.8.10")).toBeInTheDocument();

    const details = screen.getByRole("heading", { name: "Details" }).parentElement;
    if (!details) throw new Error("no details");
    expect(within(details).getByText("1.8.10")).toBeInTheDocument();
    expect(within(details).getByText("21 August 2026")).toBeInTheDocument();
    expect(within(details).getByText("Windows 10 or later, x64")).toBeInTheDocument();

    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "More in “For Developers”" })).toBeInTheDocument();
    for (const name of ["Visual Studio Code", "Notepad++", "KeePassXC"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("explains a verified source and links the app's open ideas (Nilesoft Shell)", async () => {
    const user = userEvent.setup();
    await openApp("shell");
    expect(within(header()).getByRole("button", { name: "Nilesoft" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "From Nilesoft, a verified channel. Paparats reviewed the author and mirrors the files; the app itself is the author’s.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("A context menu editor without registry hacks")).toBeInTheDocument();
    // No collection lists Shell.
    expect(screen.queryByRole("heading", { name: /More in/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "1 idea for this app" }));
    expect(useIdeasStore.getState().appFilter).toBe("shell");
  });

  it("shows FOSS Friends as the source of Czkawka, installed → Open", async () => {
    await openApp("czkawka");
    expect(
      screen.getByText(/^From FOSS Friends, a verified channel\. Paparats reviewed the author/),
    ).toBeInTheDocument();
    expect(within(header()).getByRole("button", { name: "Open" })).toBeInTheDocument();
    const details = screen.getByRole("heading", { name: "Details" }).parentElement;
    if (!details) throw new Error("no details");
    expect(within(details).getByText("FOSS Friends")).toBeInTheDocument();
    expect(within(details).getByText("MIT")).toBeInTheDocument();
  });

  it("lists the other active channels that offer the app", async () => {
    const services = createTestServices();
    await services.channels.subscribe("winaero");
    await openApp("winaerotweaker", services);
    expect(
      screen.getByText(
        "Also offered by Winaero. Paparats installs and updates from the most trusted channel that offers an app.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/a community channel/)).toBeNull();
  });

  it("explains a community source (mpv builds)", async () => {
    const services = createTestServices();
    await services.channels.subscribe("mpvbuilds");
    await openApp("mpv", services);
    expect(
      screen.getByText(
        "From mpv builds, a community channel. Not reviewed by Paparats; downloaded from the author’s server.",
      ),
    ).toBeInTheDocument();
  });

  it("installs: Get → progress and status → Installing… → Open", async () => {
    await openApp("files");
    const top = within(header());
    expect(top.getByText("Free · 88 MB · MIT")).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      fireEvent.click(top.getByRole("button", { name: "Get" }));
      await flush(4 * TICK);
      expect(top.getByRole("button", { name: "40% · Pause" })).toBeInTheDocument();
      expect(top.getByRole("progressbar", { name: "Files" })).toHaveAttribute(
        "aria-valuenow",
        "40",
      );
      expect(top.getByText("Downloading… 40% · 35 MB of 88 MB")).toBeInTheDocument();
      expect(top.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

      fireEvent.click(top.getByRole("button", { name: "40% · Pause" }));
      await flush();
      expect(top.getByText("Paused · 40% · 35 MB of 88 MB")).toBeInTheDocument();
      fireEvent.click(top.getByRole("button", { name: "Resume" }));
      await flush(6 * TICK);
      expect(top.getByRole("button", { name: "Installing…" })).toBeDisabled();
      expect(top.getByText("Installing…", { selector: "span" })).toBeInTheDocument();

      await flush(8 * TICK);
      expect(top.getByRole("button", { name: "Open" })).toBeInTheDocument();
      expect(top.queryByRole("progressbar")).toBeNull();
      expect(top.getByText("Free · 88 MB · MIT")).toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("cancels a download from the status line", async () => {
    await openApp("files");
    const top = within(header());
    vi.useFakeTimers();
    try {
      fireEvent.click(top.getByRole("button", { name: "Get" }));
      await flush(2 * TICK);
      fireEvent.click(top.getByRole("button", { name: "Cancel" }));
      await flush();
      expect(top.getByRole("button", { name: "Get" })).toBeInTheDocument();
      expect(top.queryByRole("progressbar")).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("toggles the favourite from the action's star", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    await user.click(within(header()).getByRole("button", { name: "Remove from favorites" }));
    expect(
      await within(header()).findByRole("button", { name: "Add to favorites" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("thanks for a tap-to-rate and for Write a review", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    const rate = screen.getByRole("radiogroup", { name: "Rate this app" });
    await user.click(within(rate).getByRole("radio", { name: "4" }));
    expect(within(rate).getByRole("radio", { name: "4" })).toHaveAttribute("aria-checked", "true");
    expect(toast()).toBe("Thanks for your rating");

    act(() => useUiStore.getState().dismissToast());
    await user.click(screen.getByRole("button", { name: "Write a review" }));
    expect(toast()).toBe("Thanks for your rating");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("expands and collapses the version history", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    const toggle = screen.getByRole("button", { name: "Show all versions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1.8.9")).toBeInTheDocument();
    expect(screen.queryByText("1.8.8")).toBeNull();
    // Installed 1.8.9 is the second entry.
    expect(screen.getByText("Installed")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("1.8.8")).toBeInTheDocument();
    expect(screen.getByText("1.8.7")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("1.8.7")).toBeNull();
  });

  it("switches screenshots with the arrows and thumbnails", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    expect(screen.getByText("Screenshot 1", { selector: "figcaption" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Screenshot 2", { selector: "figcaption" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Screenshot 4" }));
    expect(screen.getByText("Screenshot 4", { selector: "figcaption" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Screenshot 3", { selector: "figcaption" })).toBeInTheDocument();
  });

  it("reports a problem to the channel author with a copy to Paparats", async () => {
    const user = userEvent.setup();
    await openApp("shell");
    await user.click(screen.getByRole("button", { name: "Report a problem" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem with Nilesoft Shell" });
    expect(
      within(dialog).getByText(
        "Your report goes to Nilesoft, the author of Nilesoft. Paparats receives a copy to spot channels that cause repeated problems.",
      ),
    ).toBeInTheDocument();
    const send = within(dialog).getByRole("button", { name: "Send" });
    expect(send).toBeEnabled();
    await user.type(within(dialog).getByRole("textbox", { name: "What went wrong?" }), "   ");
    await user.type(within(dialog).getByRole("textbox"), "The menu disappears after an update");
    await user.click(send);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Sent to Nilesoft · copy to Paparats");
  });

  it("reports an official-catalog app to the Paparats team", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const report = vi.spyOn(services.channels, "report");
    await openApp("obsidian", services);
    await user.click(screen.getByRole("button", { name: "Report a problem" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem with Obsidian" });
    expect(within(dialog).getByText("Your report goes to the Paparats team.")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "Sync fails");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toast()).toBe("Sent to Paparats"));
    expect(report).toHaveBeenCalledWith({ appId: "obsidian", channelId: "paparats" }, "Sync fails");
  });

  it("closes the report dialog on Cancel without sending", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const report = vi.spyOn(services.channels, "report");
    await openApp("shell", services);
    await user.click(screen.getByRole("button", { name: "Report a problem" }));
    await user.type(screen.getByRole("textbox", { name: "What went wrong?" }), "Oops");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it("opens the suggest-idea dialog for this app", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    await user.click(screen.getByRole("button", { name: "Suggest an improvement" }));
    expect(useDialogStore.getState().dialog).toEqual({ kind: "suggestIdea", appId: "obsidian" });
  });

  it("opens Browse on the collection from See all", async () => {
    const user = userEvent.setup();
    await openApp("obsidian");
    await user.click(screen.getByRole("button", { name: "See all" }));
    expect(useBrowseStore.getState().collection).toBe("developers");
    expect(screen.getByRole("button", { name: /^Browse/ })).toHaveAttribute("aria-current", "page");
  });

  it("shows a not-found state for an unknown app", async () => {
    await renderApp({ route: "/app/nope" });
    expect(await screen.findByText("App not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("renders in Russian with localised plurals and numbers", async () => {
    await openApp("obsidian");
    await act(() => changeLocale("ru"));
    expect(screen.getByRole("heading", { name: "Скриншоты" })).toBeInTheDocument();
    expect(screen.getByText("637 оценок")).toBeInTheDocument();
    expect(screen.getByText("4,4")).toBeInTheDocument();
    expect(screen.getByText("Бесплатно · 105 МБ · Freeware")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ещё в коллекции «Для разработчиков»" }),
    ).toBeInTheDocument();
  });
});

/** Opens Obsidian from a section with `useNav`, like a card would. */
function Harness() {
  const { go, section } = useNav();
  return (
    <Routes>
      <Route
        path="/app/:appId"
        element={
          <>
            <output aria-label="section">{section}</output>
            <AppScreen />
          </>
        }
      />
      <Route
        path="*"
        element={
          <button type="button" onClick={() => go({ to: "app", appId: "obsidian" })}>
            open
          </button>
        }
      />
    </Routes>
  );
}

describe("AppScreen navigation", () => {
  it("keeps the originating section active and Back returns to it", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<Harness />, { route: "/library" });
    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByRole("heading", { name: "Obsidian" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app/obsidian");
    expect(screen.getByRole("status", { name: "section" })).toHaveTextContent("library");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/library");
  });

  it("opens another app from More in and still returns to the original section", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<Harness />, { route: "/updates" });
    await user.click(screen.getByRole("button", { name: "open" }));
    await screen.findByRole("heading", { name: "Obsidian" });
    const more = await screen.findByRole("heading", { name: "More in “For Developers”" });
    const grid = more.parentElement?.nextElementSibling;
    if (!(grid instanceof HTMLElement)) throw new Error("no grid");
    await user.click(within(grid).getAllByRole("button", { name: "Details" })[0] as HTMLElement);
    expect(router.state.location.pathname).toBe("/app/vscode");
    expect(await screen.findByRole("heading", { name: "Visual Studio Code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/updates");
  });
});
