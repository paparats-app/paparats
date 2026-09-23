// Ideas board (prototype lines 1184–1283): banner, released-idea note, tabs with counts, status
// chips, sort, the app filter chip, cards with vote / take, the right column, and the flows —
// vote/unvote, take (developer view), activate the thank-you, open an idea.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogHost } from "@/app/DialogHost";
import { ToastHost } from "@/app/ToastHost";
import type { MockServices } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useIdeasStore } from "@/stores/useIdeasStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { IdeasScreen } from "./IdeasScreen";

async function openIdeas(
  options: { services?: MockServices; developer?: boolean; appFilter?: string } = {},
) {
  const services = options.services ?? createTestServices();
  if (options.appFilter) useIdeasStore.getState().focusApp(options.appFilter);
  const rendered = await renderWithProviders(
    <>
      <IdeasScreen />
      <DialogHost />
      <ToastHost />
    </>,
    { route: "/ideas", services },
  );
  if (options.developer) {
    await act(() => useSettingsStore.getState().update({ dev: true, viewAsDeveloper: true }));
  }
  await screen.findByRole("heading", { level: 1, name: "Ideas" });
  return { ...rendered, path: () => rendered.router.state.location.pathname };
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const chip = (name: string) =>
  within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name });
const sortSelect = () => screen.getByRole("combobox", { name: "Sort by" });
/** Card titles in list order. */
const titles = () =>
  within(screen.getByRole("tabpanel"))
    .queryAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);
const card = (title: string) => {
  const el = screen.getByRole("heading", { level: 3, name: title }).closest("article");
  if (!el) throw new Error(`no card for ${title}`);
  return el;
};
const note = () => screen.queryByRole("region", { name: "Your idea became an app" });
const yourIdeas = () => screen.getByRole("region", { name: "Your ideas" });
const toast = () => useUiStore.getState().toast?.message;

const BY_VOTES = [
  "A context menu editor without registry hacks",
  "Battery health monitor for laptops",
  "Offline Belarusian dictionary",
  "Clipboard history with pinned snippets",
  "Scrolling capture for long pages",
  "Send a file to several devices at once",
  "Icon packs for the context menu",
  "Graph view that follows the dark theme",
  "Pomodoro timer in the system tray",
];

describe("IdeasScreen", () => {
  it("renders the banner, the note, the toolbar with counts, the cards and the right column", async () => {
    await openIdeas();

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByText("Tell developers what’s missing. Vote for what matters."),
    ).toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: "Suggest an idea" })).toBeInTheDocument();
    expect(within(banner).queryByText(/Developer view/)).not.toBeInTheDocument();

    const released = note();
    expect(released).not.toBeNull();
    expect(
      within(released as HTMLElement).getByText(
        "“Offline Belarusian dictionary” is now available as Слоўнік, by Софт па-беларуску. Thank you — 3 months of Paparats Pro are waiting for you.",
      ),
    ).toBeInTheDocument();
    expect(
      within(released as HTMLElement).getByRole("button", { name: "Open Слоўнік" }),
    ).toBeInTheDocument();

    expect(tab(/^All/)).toHaveTextContent("All9");
    expect(tab(/^All/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^New apps/)).toHaveTextContent("New apps5");
    expect(tab(/^Existing apps/)).toHaveTextContent("Existing apps4");
    expect(tab(/^My ideas/)).toHaveTextContent("My ideas2");
    for (const name of ["Open", "In work", "Released"]) {
      expect(chip(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(sortSelect()).toHaveValue("top");
    expect(titles()).toEqual(BY_VOTES);

    const battery = card("Battery health monitor for laptops");
    expect(within(battery).getByText("New app · System")).toBeInTheDocument();
    expect(within(battery).getByText("In work")).toBeInTheDocument();
    expect(within(battery).getByText("Winaero is on it")).toBeInTheDocument();
    expect(within(battery).getByText("by You")).toBeInTheDocument();
    expect(within(battery).getByText("last month")).toBeInTheDocument();
    expect(within(battery).getByRole("button", { name: "341 votes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const graph = card("Graph view that follows the dark theme");
    expect(within(graph).getByText("For Obsidian")).toBeInTheDocument();
    expect(within(graph).getByText("Released as Obsidian 1.8.10")).toBeInTheDocument();
    // No Take outside the developer view.
    expect(screen.queryByRole("button", { name: "Take" })).not.toBeInTheDocument();

    const how = screen.getByRole("region", { name: "How it works" });
    expect(within(how).getAllByRole("listitem")).toHaveLength(4);
    expect(within(how).getByText("A thank-you")).toBeInTheDocument();

    const mine = yourIdeas();
    expect(within(mine).getByRole("button", { name: /^Battery health monitor/ })).toHaveTextContent(
      "Battery health monitor for laptops341 votes · last monthIn work",
    );
    expect(within(mine).getByRole("button", { name: /^Offline Belarusian/ })).toHaveTextContent(
      "Offline Belarusian dictionary268 votes · 6 months agoReleased",
    );
    // The note is showing, so the rail is not.
    expect(
      within(mine).queryByRole("button", { name: "Activate 3 months of Pro" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nilesoft" })).not.toBeInTheDocument();
  });

  it("filters by tab and keeps the counts over every status", async () => {
    const user = userEvent.setup();
    await openIdeas();

    await user.click(tab(/^New apps/));
    expect(tab(/^New apps/)).toHaveAttribute("aria-selected", "true");
    expect(titles()).toEqual([
      "A context menu editor without registry hacks",
      "Battery health monitor for laptops",
      "Offline Belarusian dictionary",
      "Clipboard history with pinned snippets",
      "Pomodoro timer in the system tray",
    ]);

    await user.click(tab(/^Existing apps/));
    expect(titles()).toEqual([
      "Scrolling capture for long pages",
      "Send a file to several devices at once",
      "Icon packs for the context menu",
      "Graph view that follows the dark theme",
    ]);

    await user.click(tab(/^My ideas/));
    expect(titles()).toEqual([
      "Battery health monitor for laptops",
      "Offline Belarusian dictionary",
    ]);

    // Status chips narrow the list, not the counts; nothing left → the empty state.
    await user.click(chip("Open"));
    expect(titles()).toEqual([]);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Be the first to suggest something.")).toBeInTheDocument();
    expect(tab(/^My ideas/)).toHaveTextContent("My ideas2");
  });

  it("toggles the status chips and sorts by votes or date", async () => {
    const user = userEvent.setup();
    await openIdeas();

    await user.click(chip("Open"));
    expect(chip("Open")).toHaveAttribute("aria-pressed", "true");
    expect(titles()).toEqual([
      "Clipboard history with pinned snippets",
      "Scrolling capture for long pages",
      "Icon packs for the context menu",
      "Pomodoro timer in the system tray",
    ]);

    await user.click(chip("Released"));
    expect(titles()).toEqual([
      "A context menu editor without registry hacks",
      "Offline Belarusian dictionary",
      "Clipboard history with pinned snippets",
      "Scrolling capture for long pages",
      "Icon packs for the context menu",
      "Graph view that follows the dark theme",
      "Pomodoro timer in the system tray",
    ]);

    await user.click(chip("Open"));
    await user.click(chip("Released"));
    expect(titles()).toEqual(BY_VOTES);

    await user.selectOptions(sortSelect(), "Newest");
    expect(sortSelect()).toHaveValue("new");
    expect(titles()).toEqual([
      "Pomodoro timer in the system tray",
      "Icon packs for the context menu",
      "Clipboard history with pinned snippets",
      "Scrolling capture for long pages",
      "Battery health monitor for laptops",
      "Send a file to several devices at once",
      "Graph view that follows the dark theme",
      "A context menu editor without registry hacks",
      "Offline Belarusian dictionary",
    ]);
  });

  it("shows the app filter chip from an app page and clears it", async () => {
    const user = userEvent.setup();
    await openIdeas({ appFilter: "sharex" });

    expect(screen.getByText("Filters:")).toBeInTheDocument();
    const filter = screen.getByRole("button", { name: /^For ShareX/ });
    expect(filter).toHaveAttribute("aria-description", "Remove filter");
    expect(tab(/^All/)).toHaveTextContent("All1");
    expect(tab(/^New apps/)).toHaveTextContent("New apps0");
    expect(tab(/^Existing apps/)).toHaveTextContent("Existing apps1");
    expect(titles()).toEqual(["Scrolling capture for long pages"]);

    await user.click(filter);
    expect(screen.queryByText("Filters:")).not.toBeInTheDocument();
    expect(useIdeasStore.getState().appFilter).toBeNull();
    expect(tab(/^All/)).toHaveTextContent("All9");
    expect(titles()).toEqual(BY_VOTES);
  });

  it("votes and unvotes", async () => {
    const user = userEvent.setup();
    const { services } = await openIdeas();
    const clip = () => card("Clipboard history with pinned snippets");

    await user.click(within(clip()).getByRole("button", { name: "214 votes" }));
    const voted = await within(clip()).findByRole("button", { name: "215 votes" });
    expect(voted).toHaveAttribute("aria-pressed", "true");
    expect(voted).toHaveAttribute("title", "Voted");
    expect(services.world.ideas.find((i) => i.id === "clip")).toMatchObject({
      votes: 215,
      voted: true,
    });

    await user.click(voted);
    const unvoted = await within(clip()).findByRole("button", { name: "214 votes" });
    expect(unvoted).toHaveAttribute("aria-pressed", "false");
    expect(unvoted).toHaveAttribute("title", "Vote");
    // Voting never opens the idea.
    expect(screen.getByRole("heading", { level: 1, name: "Ideas" })).toBeInTheDocument();
  });

  it("opens an idea from its card and from Your ideas", async () => {
    const user = userEvent.setup();
    const { path } = await openIdeas();

    await user.click(screen.getByRole("button", { name: "Scrolling capture for long pages" }));
    expect(path()).toBe("/ideas/scrollcap");

    await user.click(within(yourIdeas()).getByRole("button", { name: /^Battery health monitor/ }));
    expect(path()).toBe("/ideas/battery");
  });

  it("opens the suggest dialog from the banner", async () => {
    const user = userEvent.setup();
    await openIdeas({ appFilter: "sharex" });
    await user.click(screen.getByRole("button", { name: "Suggest an idea" }));
    // Like the prototype, the banner's dialog starts on a new app even with an app filter on.
    expect(useDialogStore.getState().dialog).toEqual({ kind: "suggestIdea" });
    expect(await screen.findByRole("dialog", { name: "Suggest an idea" })).toBeInTheDocument();
  });

  describe("developer view", () => {
    it("shows the channel pill, its tabs and panel, and Take on the ideas it may take", async () => {
      await openIdeas({ developer: true });

      const banner = screen.getByRole("banner");
      expect(within(banner).getByText("Developer view · Nilesoft")).toBeInTheDocument();
      expect(within(banner).getByText("Ni")).toBeInTheDocument();

      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
        "All9",
        "New apps5",
        "For my apps1",
        "My work1",
      ]);
      // Authors see no release note; the own ideas show the profile name.
      expect(note()).toBeNull();
      expect(
        within(card("Battery health monitor for laptops")).getByText("by Serj Kaje"),
      ).toBeInTheDocument();

      const panel = screen.getByRole("region", { name: "Nilesoft" });
      expect(within(panel).getByText("Developer")).toBeInTheDocument();
      expect(
        within(panel).getByText(
          "You see what a channel author sees: take open ideas and mark them released.",
        ),
      ).toBeInTheDocument();
      expect(panel).toHaveTextContent("0In work1Released1For your apps");
      expect(screen.queryByRole("region", { name: "Your ideas" })).not.toBeInTheDocument();

      // Any open new-app idea, or an open idea about the channel's own apps.
      const takeable = screen
        .getAllByRole("button", { name: "Take" })
        .map((b) => b.closest("article")?.querySelector("h3")?.textContent);
      expect(takeable).toEqual([
        "Clipboard history with pinned snippets",
        "Icon packs for the context menu",
        "Pomodoro timer in the system tray",
      ]);
    });

    it("takes an idea: pinned to the channel, toasted, counted in My work", async () => {
      const user = userEvent.setup();
      const { services } = await openIdeas({ developer: true });
      const take = vi.spyOn(services.ideas, "take");
      const clip = () => card("Clipboard history with pinned snippets");

      await user.click(within(clip()).getByRole("button", { name: "Take" }));
      expect(take).toHaveBeenCalledWith("clip", "nilesoft");
      expect(await within(clip()).findByText("Nilesoft is on it")).toBeInTheDocument();
      expect(within(clip()).getByText("In work")).toBeInTheDocument();
      expect(within(clip()).queryByRole("button", { name: "Take" })).not.toBeInTheDocument();
      expect(toast()).toBe("Pinned to Nilesoft · author notified");
      expect(tab(/^My work/)).toHaveTextContent("My work2");
      expect(screen.getByRole("region", { name: "Nilesoft" })).toHaveTextContent(
        "1In work1Released1For your apps",
      );

      await user.click(tab(/^My work/));
      expect(titles()).toEqual([
        "A context menu editor without registry hacks",
        "Clipboard history with pinned snippets",
      ]);
    });

    it("falls back to All when the stored tab belongs to the user view", async () => {
      useIdeasStore.getState().setTab("mine");
      await openIdeas({ developer: true });
      expect(tab(/^All/)).toHaveAttribute("aria-selected", "true");
      expect(titles()).toHaveLength(9);
    });
  });

  describe("the thank-you", () => {
    it("activates 3 months of Pro from the note and dismisses it", async () => {
      const user = userEvent.setup();
      const { services } = await openIdeas();
      const claim = vi.spyOn(services.account, "claimIdeaBonus");

      await user.click(
        within(note() as HTMLElement).getByRole("button", { name: "Activate 3 months of Pro" }),
      );
      expect(claim).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(note()).toBeNull());
      expect(toast()).toBe("Paparats Pro is active until 15 December 2026");
      expect(services.world.account.subscription.giftUntil).toBe("2026-12-15");
      expect(services.world.ideas.find((i) => i.id === "slounik")?.releaseNoteDismissed).toBe(true);
      // Claimed: no rail either.
      expect(
        within(yourIdeas()).queryByRole("button", { name: "Activate 3 months of Pro" }),
      ).not.toBeInTheDocument();
    });

    it("dismisses the note with ×, then offers the rail", async () => {
      const user = userEvent.setup();
      const { services } = await openIdeas();

      await user.click(within(note() as HTMLElement).getByRole("button", { name: "Dismiss" }));
      await waitFor(() => expect(note()).toBeNull());
      expect(services.world.account.subscription.giftUntil).toBeNull();

      const rail = within(yourIdeas()).getByRole("button", { name: "Activate 3 months of Pro" });
      await user.click(rail);
      await waitFor(() =>
        expect(
          within(yourIdeas()).queryByRole("button", { name: "Activate 3 months of Pro" }),
        ).not.toBeInTheDocument(),
      );
      expect(toast()).toBe("Paparats Pro is active until 15 December 2026");
    });

    it("opens the released app from the note", async () => {
      const user = userEvent.setup();
      const { path } = await openIdeas();
      await user.click(screen.getByRole("button", { name: "Open Слоўнік" }));
      expect(path()).toBe("/app/slounik");
    });

    it("shows Pro everywhere and clears the sidebar badge once activated", async () => {
      const user = userEvent.setup();
      await renderApp({ route: "/ideas" });
      await screen.findByRole("heading", { level: 1, name: "Ideas" });
      const sidebar = screen.getByRole("navigation");
      const ideasItem = within(sidebar).getByRole("button", { name: /^Ideas/ });
      const subscriptionItem = within(sidebar).getByRole("button", { name: /^Subscription/ });
      expect(ideasItem).toHaveTextContent(/^Ideas1$/);
      expect(subscriptionItem).toHaveTextContent(/^Subscription$/);

      await user.click(screen.getByRole("button", { name: "Activate 3 months of Pro" }));
      await waitFor(() => expect(ideasItem).toHaveTextContent(/^Ideas$/));
      expect(subscriptionItem).toHaveTextContent(/^SubscriptionPro$/);
      expect(
        await screen.findByText("Paparats Pro is active until 15 December 2026"),
      ).toBeVisible();

      // The gift is the plan everywhere, e.g. on Subscription.
      await user.click(subscriptionItem);
      await screen.findByRole("heading", { level: 1, name: "Subscription" });
      expect((await screen.findAllByText(/Paparats Pro · gift/)).length).toBeGreaterThan(0);
      expect(screen.getByText("Idea bonus · active until 15 December 2026")).toBeInTheDocument();
    });
  });

  it("speaks Russian and Belarusian, with plural votes", async () => {
    await openIdeas();
    await act(() => useSettingsStore.getState().update({ locale: "ru" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Идеи" })).toBeInTheDocument();
    expect(tab(/^Существующие/)).toHaveTextContent("Существующие4");
    expect(screen.getByRole("group", { name: "Фильтр по статусу" })).toHaveTextContent(
      "ОткрытаВ работеВыпущена",
    );
    const mine = screen.getByRole("region", { name: "Ваши идеи" });
    expect(mine).toHaveTextContent("341 голос · в прошлом месяце");
    expect(mine).toHaveTextContent("268 голосов · 6 месяцев назад");

    await act(() => useSettingsStore.getState().update({ locale: "be" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Ідэі" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Вашы ідэі" })).toHaveTextContent("341 голас");
  });

  it("has no Your ideas rows before the user proposes anything", async () => {
    const services = createTestServices();
    services.world.ideas = services.world.ideas.filter((i) => !i.mine);
    await openIdeas({ services });
    expect(within(yourIdeas()).getByText("You haven’t proposed anything yet.")).toBeInTheDocument();
    expect(tab(/^My ideas/)).toHaveTextContent("My ideas0");
    expect(note()).toBeNull();
  });
});
