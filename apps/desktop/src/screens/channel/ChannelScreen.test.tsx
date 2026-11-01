// Channel page (prototype lines 1119–1183) against the mock services: the official, verified,
// outage and community states; subscribe (with the community confirmation), unsubscribe, pause,
// Keep; Copy address, Sync now, report routing; the apps grid, the empty state and Back.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { vi } from "vitest";
import { useNav } from "@/app/navigation";
import { changeLocale } from "@/i18n";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { ChannelScreen } from "./ChannelScreen";

async function openChannel(channelId: string, services = createTestServices()) {
  const rendered = await renderWithProviders(
    <Routes>
      <Route path="/channel/:channelId" element={<ChannelScreen />} />
    </Routes>,
    { route: `/channel/${channelId}`, services },
  );
  await screen.findByRole("heading", { level: 1 });
  return rendered;
}

function header(): HTMLElement {
  const el = screen.getByRole("heading", { level: 1 }).closest("header");
  if (!el) throw new Error("no header");
  return el;
}

/** The Details card (named by its "Details" overline in every language). */
function details(): HTMLElement {
  return within(header()).getByRole("complementary");
}

/** The value of a Details row, by its label. */
function detail(label: string): string | null {
  const term = within(details()).queryByText(label, { selector: "dt" });
  return term?.nextElementSibling?.textContent ?? null;
}

function appsGrid(): HTMLElement {
  return screen.getByRole("list", { name: "Apps in this channel" });
}

const toast = () => useUiStore.getState().toast?.message;

describe("ChannelScreen", () => {
  it("renders the official catalog: always subscribed, no review row, its apps", async () => {
    await openChannel("paparats");
    const top = within(header());
    expect(top.getByRole("heading", { level: 1, name: "Paparats" })).toBeInTheDocument();
    expect(header().querySelector('[data-level="official"]')).toHaveTextContent("Official");
    expect(top.getByText("Catalog", { selector: "span" })).toBeInTheDocument();
    expect(top.getByText("by Paparats")).toBeInTheDocument();
    expect(top.getByText("@paparats")).toBeInTheDocument();
    expect(top.getByText("10,400 subscribers")).toBeInTheDocument();
    expect(top.getByText(/^The curated Paparats catalog/)).toBeInTheDocument();

    expect(top.getByText("Subscribed")).toBeInTheDocument();
    expect(top.queryByRole("switch")).toBeNull();
    expect(top.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
    expect(top.queryByRole("button", { name: "Subscribe" })).toBeNull();
    for (const name of ["Copy address", "Report a problem", "Sync now"]) {
      expect(top.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(top.getByText("Your default source. It cannot be removed.")).toBeInTheDocument();
    expect(top.queryByText("Apps from this channel are not covered by Paparats Pro.")).toBeNull();

    expect(screen.getByRole("complementary", { name: "Details" })).toBe(details());
    expect(detail("Trust")).toBe("Official");
    expect(detail("Type")).toBe("Catalog");
    expect(detail("Author")).toBe("Paparats");
    expect(detail("Address")).toBe("paparats-app.github.io/catalog");
    expect(detail("Files")).toBe("The author’s own releases");
    expect(detail("Review")).toBeNull();
    expect(detail("Support")).toBe("github.com/paparats-app/catalog/issues");
    expect(detail("Last sync")).toBe("today");
    expect(within(details()).queryByText(/Not reviewed by Paparats/)).toBeNull();

    expect(
      screen.getByRole("heading", { level: 2, name: "Apps in this channel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("26 apps")).toBeInTheDocument();
    expect(within(appsGrid()).getAllByRole("listitem")).toHaveLength(26);
  });

  it("renders a verified developer channel with the review date and its one app", async () => {
    await openChannel("kvetka");
    const top = within(header());
    expect(header().querySelector('[data-level="verified"]')).toHaveTextContent("Verified");
    expect(top.getByText("Developer", { selector: "span" })).toBeInTheDocument();
    expect(top.getByText("1,840 subscribers")).toBeInTheDocument();
    expect(top.getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
    expect(top.getByRole("button", { name: "Unsubscribe" })).toBeInTheDocument();
    expect(
      top.getByText("Apps from this channel are not covered by Paparats Pro."),
    ).toBeInTheDocument();
    expect(top.queryByText("Your default source. It cannot be removed.")).toBeNull();
    // Reachable: no stale callout.
    expect(top.queryByText(/hasn’t answered/)).toBeNull();

    expect(detail("Files")).toBe("The author’s own releases");
    expect(detail("Review")).toBe("Paparats team, 12 March 2026");
    expect(detail("Support")).toBe("kvetka.example/support");
    expect(detail("Last sync")).toBe("yesterday");

    expect(screen.getByText("1 app")).toBeInTheDocument();
    const [card] = within(appsGrid()).getAllByRole("listitem");
    if (!card) throw new Error("no card");
    const item = within(card);
    expect(item.getByText("Kvetka Shell")).toBeInTheDocument();
    expect(item.getByText("System")).toBeInTheDocument();
    // Channel page cards carry the category chip only (no source channel chip).
    expect(item.queryByText("Kvetka")).toBeNull();
    expect(item.getByRole("button", { name: "Details" })).toBeInTheDocument();
  });

  it("shows the outage: stale callout, Keep, Sync still unreachable, Last sync since the outage", async () => {
    const user = userEvent.setup();
    const { services } = await openChannel("fossfriends");
    const top = within(header());
    expect(top.getByText("FOSS Friends hasn’t answered for 16 days.")).toBeInTheDocument();
    expect(top.getByText(/Installed apps keep working/)).toBeInTheDocument();
    expect(detail("Last sync")).toBe("2 weeks ago");

    await user.click(top.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(toast()).toBe("FOSS Friends is still unreachable"));

    await user.click(top.getByRole("button", { name: "Keep" }));
    await waitFor(() => expect(top.queryByRole("button", { name: "Keep" })).toBeNull());
    // The callout stays while the channel is down; only its buttons go.
    expect(top.getByText("FOSS Friends hasn’t answered for 16 days.")).toBeInTheDocument();
    expect(top.getAllByRole("button", { name: "Unsubscribe" })).toHaveLength(1);
    expect(services.world.subscriptions.find((s) => s.channelId === "fossfriends")).toMatchObject({
      staleAcknowledged: true,
    });
  });

  it("unsubscribes from the stale callout", async () => {
    const user = userEvent.setup();
    await openChannel("fossfriends");
    const callout = screen.getByText("FOSS Friends hasn’t answered for 16 days.").parentElement
      ?.parentElement;
    if (!callout) throw new Error("no callout");
    await user.click(within(callout).getByRole("button", { name: "Unsubscribe" }));
    await waitFor(() => expect(toast()).toBe("Unsubscribed from FOSS Friends"));
    // Not followed: no outage shown, Subscribe is back, the last sync is unknown.
    expect(screen.queryByText(/hasn’t answered/)).toBeNull();
    expect(within(header()).getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
    expect(within(header()).queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(detail("Last sync")).toBe("Not synced yet");
  });

  it("renders a community channel and asks for the trust confirmation on Subscribe", async () => {
    const user = userEvent.setup();
    const { services } = await openChannel("vitrazh");
    const top = within(header());
    expect(header().querySelector('[data-level="community"]')).toHaveTextContent("Community");
    expect(top.getByText("960 subscribers")).toBeInTheDocument();
    expect(top.queryByText("Subscribed")).toBeNull();
    expect(top.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(detail("Files")).toBe("The author’s own releases");
    expect(detail("Review")).toBe("Not reviewed");
    expect(detail("Last sync")).toBe("Not synced yet");
    expect(
      within(details()).getByText(
        "Not reviewed by Paparats. Apps download straight from the author’s server.",
      ),
    ).toBeInTheDocument();

    await user.click(top.getByRole("button", { name: "Subscribe" }));
    expect(useDialogStore.getState().dialog).toEqual({
      kind: "trustConfirm",
      channelId: "vitrazh",
    });
    expect(services.world.subscriptions.some((s) => s.channelId === "vitrazh")).toBe(false);
    expect(toast()).toBeUndefined();
  });

  it("unsubscribes and subscribes again (verified: no confirmation)", async () => {
    const user = userEvent.setup();
    useBrowseStore.setState({ sources: ["kvetka", "fossfriends"] });
    await openChannel("kvetka");
    const top = within(header());

    await user.click(top.getByRole("button", { name: "Unsubscribe" }));
    await waitFor(() => expect(toast()).toBe("Unsubscribed from Kvetka"));
    expect(useBrowseStore.getState().sources).toEqual(["fossfriends"]);
    expect(top.queryByText("Subscribed")).toBeNull();
    expect(top.queryByRole("switch")).toBeNull();

    await user.click(top.getByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(toast()).toBe("Subscribed to Kvetka"));
    expect(useDialogStore.getState().dialog).toBeNull();
    expect(top.getByText("Subscribed")).toBeInTheDocument();
    expect(top.getByRole("switch", { name: "Enabled" })).toBeInTheDocument();
  });

  it("pauses and resumes the channel with the mini switch", async () => {
    const user = userEvent.setup();
    useBrowseStore.setState({ sources: ["kvetka"] });
    const { services } = await openChannel("kvetka");
    const top = within(header());

    await user.click(top.getByRole("switch", { name: "Enabled" }));
    await waitFor(() => expect(toast()).toBe("Kvetka paused"));
    expect(top.getByRole("switch", { name: "Paused" })).toHaveAttribute("aria-checked", "false");
    expect(useBrowseStore.getState().sources).toEqual([]);
    expect(services.world.subscriptions.find((s) => s.channelId === "kvetka")).toMatchObject({
      paused: true,
    });
    // Paused is still followed.
    expect(top.getByText("Subscribed")).toBeInTheDocument();

    await user.click(top.getByRole("switch", { name: "Paused" }));
    await waitFor(() => expect(toast()).toBe("Kvetka resumed"));
    expect(top.getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the requested pause at once and switches back when it fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    let fail: (e: Error) => void = () => undefined;
    vi.spyOn(services.channels, "setPaused").mockImplementation(
      () => new Promise((_, reject) => (fail = reject)),
    );
    await openChannel("kvetka", services);
    const top = within(header());

    await user.click(top.getByRole("switch", { name: "Enabled" }));
    // In flight: the switch already says Paused.
    expect(top.getByRole("switch", { name: "Paused" })).toHaveAttribute("aria-checked", "false");
    await act(async () => fail(new Error("down")));
    expect(top.getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
    expect(toast()).toBeUndefined();
  });

  it("copies the address and syncs", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const copy = vi.spyOn(services.system, "copyToClipboard");
    services.world.channels = services.world.channels.map((c) =>
      c.id === "kvetka" ? { ...c, synced: "2026-09-01" } : c,
    );
    await openChannel("kvetka", services);
    const top = within(header());
    expect(detail("Last sync")).toBe("2 weeks ago");

    await user.click(top.getByRole("button", { name: "Copy address" }));
    expect(copy).toHaveBeenCalledWith("kvetka.example/paparats");
    await waitFor(() => expect(toast()).toBe("Address copied"));

    await user.click(top.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(toast()).toBe("Channel synced"));
    expect(detail("Last sync")).toBe("today");
  });

  it("opens the report dialog for the channel", async () => {
    const user = userEvent.setup();
    await openChannel("kvetka");
    await user.click(within(header()).getByRole("button", { name: "Report a problem" }));
    expect(useDialogStore.getState().dialog).toEqual({
      kind: "report",
      target: { appId: null, channelId: "kvetka" },
    });
  });

  it("shows the empty card when the channel offers no apps", async () => {
    const services = createTestServices();
    services.world.catalog = {
      ...services.world.catalog,
      apps: services.world.catalog.apps.filter((a) => a.id !== "slounik"),
    };
    await openChannel("bysoft", services);
    expect(screen.getByText("0 apps")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Apps in this channel" })).toBeNull();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("The author hasn’t published any apps yet.")).toBeInTheDocument();
  });

  it("offers Subscribe on the cards of an unfollowed channel", async () => {
    const user = userEvent.setup();
    await openChannel("mpvbuilds");
    const grid = within(appsGrid());
    expect(grid.getByText("mpv")).toBeInTheDocument();
    await user.click(grid.getByRole("button", { name: "Subscribe" }));
    expect(useDialogStore.getState().dialog).toEqual({
      kind: "trustConfirm",
      channelId: "mpvbuilds",
    });
  });

  it("shows a not-found state for an unknown channel", async () => {
    await renderApp({ route: "/channel/nope" });
    expect(await screen.findByText("Channel not found")).toBeInTheDocument();
    expect(screen.getByText("It may no longer be available.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("renders in Russian and Belarusian with localised plurals and dates", async () => {
    await openChannel("kvetka");
    await act(() => changeLocale("ru"));
    const top = within(header());
    expect(top.getByText(/^1\s840 подписчиков$/)).toBeInTheDocument();
    expect(top.getByRole("button", { name: "Копировать адрес" })).toBeInTheDocument();
    expect(detail("Проверка")).toMatch(/^Команда Paparats, 12 марта 2026/);
    expect(screen.getByText("1 приложение")).toBeInTheDocument();

    await act(() => changeLocale("be"));
    expect(top.getByText("1840 падпісчыкаў")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Праграмы ў гэтым канале" })).toBeInTheDocument();
  });
});

describe("ChannelScreen in the shell", () => {
  it("routes a report to the channel author and toasts the receipt", async () => {
    const user = userEvent.setup();
    await renderApp({ route: "/channel/kvetka" });
    await screen.findByRole("heading", { level: 1, name: "Kvetka" });
    await user.click(within(header()).getByRole("button", { name: "Report a problem" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem with Kvetka" });
    expect(
      within(dialog).getByText(
        "Your report goes to Kvetka, the author of Kvetka. Paparats receives a copy to spot channels that cause repeated problems.",
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "Menu entries vanish");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toast()).toBe("Sent to Kvetka · copy to Paparats"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("routes an official-catalog report to the Paparats team", async () => {
    const user = userEvent.setup();
    await renderApp({ route: "/channel/paparats" });
    await screen.findByRole("heading", { level: 1, name: "Paparats" });
    await user.click(within(header()).getByRole("button", { name: "Report a problem" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem with Paparats" });
    expect(within(dialog).getByText("Your report goes to the Paparats team.")).toBeInTheDocument();
  });
});

/** Opens a channel page from a section with `useNav`, like a chip or row would. */
function Harness() {
  const { go, section } = useNav();
  return (
    <Routes>
      <Route
        path="/channel/:channelId"
        element={
          <>
            <output aria-label="section">{section}</output>
            <ChannelScreen />
          </>
        }
      />
      <Route path="/app/:appId" element={<output aria-label="app">app</output>} />
      <Route
        path="*"
        element={
          <button type="button" onClick={() => go({ to: "channel", channelId: "kvetka" })}>
            open
          </button>
        }
      />
    </Routes>
  );
}

describe("ChannelScreen navigation", () => {
  it("keeps the originating section active and Back returns to it", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<Harness />, { route: "/settings/sources" });
    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Kvetka" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/channel/kvetka");
    expect(screen.getByRole("status", { name: "section" })).toHaveTextContent("settings");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/settings/sources");
  });

  it("opens an app page from a card", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<Harness />, { route: "/browse" });
    await user.click(screen.getByRole("button", { name: "open" }));
    await screen.findByRole("heading", { level: 1, name: "Kvetka" });
    await user.click(within(appsGrid()).getByRole("button", { name: "Details" }));
    expect(router.state.location.pathname).toBe("/app/shell");
  });
});
