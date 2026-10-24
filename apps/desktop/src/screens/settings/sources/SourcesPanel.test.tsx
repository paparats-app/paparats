// Settings › Sources (prototype lines 823–865): the followed channels, pause/resume, the stale
// callout (FOSS Friends has been down since 2026-08-30: 16 days on the fixture day 2026-09-15),
// the trust levels, and what following changes elsewhere (visible apps, the Browse source filter).
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogHost } from "@/app/DialogHost";
import { ToastHost } from "@/app/ToastHost";
import { useVisibleApps } from "@/hooks";
import { changeLocale } from "@/i18n";
import { ServiceError } from "@/services";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { SourcesPanel } from "./SourcesPanel";

const toast = () => useUiStore.getState().toast?.message;

/** The ids of the apps `useVisibleApps()` returns, space-separated. */
function VisibleApps() {
  const ids = useVisibleApps().map((app) => app.id);
  return <div data-testid="visible">{ids.join(" ")}</div>;
}
const visible = () => screen.getByTestId("visible").textContent?.split(" ") ?? [];

async function openSources(services = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <SourcesPanel />
      <VisibleApps />
      <DialogHost />
      <ToastHost />
    </>,
    { route: "/settings/sources", services },
  );
  await screen.findByRole("switch", { name: "Kvetka" });
  return rendered;
}

const panel = () => screen.getByRole("region", { name: "Sources" });
/** A channel's list item (row + stale callout): the chevron's row's parent. */
const row = (name: string) => {
  const chevron = within(panel()).getByRole("button", { name });
  const item = chevron.parentElement?.parentElement;
  if (!item) throw new Error(`No row for ${name}`);
  return item;
};
const rowNames = () =>
  within(panel())
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-label") !== null)
    .map((b) => b.getAttribute("aria-label"));

describe("SourcesPanel", () => {
  it("lists the followed channels with trust, meta and sync state, then the trust levels", async () => {
    await openSources();
    expect(screen.getByRole("heading", { level: 2, name: "Sources" })).toBeInTheDocument();
    expect(
      screen.getByText("Channels Paparats installs apps and updates from."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add channel" })).toBeInTheDocument();

    // Catalog order; chevrons are named after their channel.
    expect(rowNames()).toEqual(["Paparats", "Kvetka", "FOSS Friends"]);
    const identity = (name: string) =>
      within(panel()).getByRole("button", { name: new RegExp(`^${name}.`) });
    expect(identity("Paparats")).toHaveTextContent(
      "PpPaparatsOfficialCatalog · by Paparats · 26 apps",
    );
    expect(identity("Kvetka")).toHaveTextContent(
      "KvKvetkaVerifiedDeveloper · by Kvetka · 1 app",
    );
    expect(identity("FOSS Friends")).toHaveTextContent(
      "FFFOSS FriendsVerifiedCurated · by Kasia L. · 3 apps",
    );

    // Sync: today / yesterday / the outage; the official catalog is always on.
    expect(screen.getByText("Synced today")).toBeInTheDocument();
    expect(screen.getByText("Synced yesterday")).toBeInTheDocument();
    expect(screen.getByText("Unreachable for 16 days")).toBeInTheDocument();
    expect(screen.getByText("Always on")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Paparats" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Kvetka" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "FOSS Friends" })).toBeChecked();

    const levels = screen.getByRole("list", { name: "Trust levels" });
    expect(
      within(levels)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "OfficialThe Paparats catalog. Curated, tested and signed by us.",
      "VerifiedAuthor and channel reviewed by the Paparats team. Files are mirrored by Paparats; the apps stay the author’s.",
      "CommunityNot reviewed by Paparats. Apps download straight from the author’s server.",
    ]);
  });

  it("pauses and resumes a channel: toast, dimmed row, hidden apps, Browse source filter", async () => {
    const user = userEvent.setup();
    const { services } = await openSources();
    useBrowseStore.setState({ sources: ["fossfriends", "kvetka"] });
    expect(visible()).toContain("imageglass");

    const toggle = screen.getByRole("switch", { name: "FOSS Friends" });
    expect(toggle).toHaveAttribute("title", "Enabled");
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(toast()).toBe("FOSS Friends paused"));
    expect(toggle).toHaveAttribute("title", "Paused");
    expect(row("FOSS Friends")).toHaveAttribute("data-paused", "true");
    expect(useBrowseStore.getState().sources).toEqual(["kvetka"]);
    expect(visible()).not.toContain("imageglass");
    expect(visible()).toContain("czkawka"); // installed apps stay
    expect(await services.channels.getSubscriptions()).toContainEqual(
      expect.objectContaining({ channelId: "fossfriends", paused: true }),
    );

    await user.click(toggle);
    await waitFor(() => expect(toast()).toBe("FOSS Friends resumed"));
    expect(toggle).toBeChecked();
    expect(row("FOSS Friends")).not.toHaveAttribute("data-paused");
    expect(visible()).toContain("imageglass");
  });

  it("switches back when pausing fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.channels, "setPaused").mockRejectedValue(
      new ServiceError("internal", "down"),
    );
    await openSources(services);
    const toggle = screen.getByRole("switch", { name: "Kvetka" });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toast()).toBeUndefined();
  });

  it("shows the stale callout for FOSS Friends; Keep acknowledges it", async () => {
    const user = userEvent.setup();
    const { services } = await openSources();
    const callout = screen.getByText("FOSS Friends hasn’t answered for 16 days.").parentElement;
    if (!callout) throw new Error("no callout");
    expect(callout).toHaveTextContent(
      "FOSS Friends hasn’t answered for 16 days. Installed apps keep working. Updates from this channel are paused until it responds again.",
    );
    await user.click(
      within(callout.parentElement ?? callout).getByRole("button", { name: "Keep" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("FOSS Friends hasn’t answered for 16 days.")).toBeNull(),
    );
    expect(toast()).toBeUndefined();
    expect(screen.getByText("Unreachable for 16 days")).toBeInTheDocument();
    expect(await services.channels.getSubscriptions()).toContainEqual(
      expect.objectContaining({ channelId: "fossfriends", staleAcknowledged: true }),
    );
  });

  it("Unsubscribe on the stale callout removes the channel everywhere", async () => {
    const user = userEvent.setup();
    const { services } = await openSources();
    useBrowseStore.setState({ sources: ["fossfriends"] });
    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));
    await waitFor(() => expect(toast()).toBe("Unsubscribed from FOSS Friends"));
    expect(rowNames()).toEqual(["Paparats", "Kvetka"]);
    expect(useBrowseStore.getState().sources).toEqual([]);
    expect(visible()).not.toContain("imageglass");
    expect(visible()).toContain("czkawka");
    expect((await services.channels.getSubscriptions()).map((s) => s.channelId)).toEqual([
      "paparats",
      "kvetka",
    ]);
  });

  it("never offers to pause or remove the official catalog", async () => {
    await openSources();
    const paparats = row("Paparats");
    expect(within(paparats).getByText("Always on")).toBeInTheDocument();
    expect(within(paparats).queryByRole("switch")).toBeNull();
    expect(within(paparats).queryByRole("button", { name: "Unsubscribe" })).toBeNull();
    expect(within(paparats).getAllByRole("button")).toHaveLength(2); // identity + chevron
  });

  it("opens the channel page from the row and the chevron, returning to Sources", async () => {
    const user = userEvent.setup();
    const { router } = await openSources();
    await user.click(within(panel()).getByRole("button", { name: "Kvetka" }));
    expect(router.state.location.pathname).toBe("/channel/kvetka");
    expect(router.state.location.state).toEqual({ from: "/settings/sources" });
    act(() => void router.navigate("/settings/sources"));
    await user.click(within(panel()).getByRole("button", { name: /^FOSS Friends./ }));
    expect(router.state.location.pathname).toBe("/channel/fossfriends");
  });

  it("Add channel opens the dialog; a new channel lists without a sync line", async () => {
    const user = userEvent.setup();
    await openSources();
    await user.click(screen.getByRole("button", { name: "Add channel" }));
    expect(useDialogStore.getState().dialog).toEqual({ kind: "addChannel" });
    const dialog = screen.getByRole("dialog", { name: "Add channel" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Channel address" }),
      "@mpvbuilds{Enter}",
    );
    await user.click(
      within(await screen.findByRole("dialog", { name: "Add mpv builds?" })).getByRole("button", {
        name: "Add channel",
      }),
    );
    await waitFor(() => expect(toast()).toBe("Subscribed to mpv builds"));
    expect(rowNames()).toEqual(["Paparats", "Kvetka", "FOSS Friends", "mpv builds"]);
    // Never synced: no sync text, as in the prototype (the channel page says "Not synced yet").
    expect(row("mpv builds")).not.toHaveTextContent(/Synced|Not synced yet|Unreachable/);
    expect(visible()).toContain("mpv");
  });

  it("speaks Russian and Belarusian plurals", async () => {
    await openSources();
    await act(() => changeLocale("ru"));
    expect(screen.getByText("Недоступен 16 дней")).toBeInTheDocument();
    expect(screen.getByText("FOSS Friends не отвечает 16 дней.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Kvetka./ })).toHaveTextContent(
      "Разработчик · от Kvetka · 1 приложение",
    );
    await act(() => changeLocale("be"));
    expect(screen.getByText("Недаступны 16 дзён")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дадаць канал" })).toBeInTheDocument();
  });
});

describe("Sources in the shell", () => {
  it("Browse gains the Source group when a second channel becomes active", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    await services.channels.unsubscribe("kvetka");
    await services.channels.unsubscribe("fossfriends");
    await renderApp({ route: "/settings/sources", services });

    await user.click(await screen.findByRole("button", { name: "Add channel" }));
    const dialog = screen.getByRole("dialog", { name: "Add channel" });
    await user.type(within(dialog).getByRole("textbox"), "kvetka.example{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Subscribed to Kvetka");
    expect(await screen.findByRole("switch", { name: "Kvetka" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /^Browse/ }));
    expect(await screen.findByText("Source")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Settings/ }));
    await user.click(await screen.findByRole("button", { name: "Sources" }));
    await user.click(await screen.findByRole("switch", { name: "Kvetka" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Kvetka paused"));
    await user.click(screen.getByRole("button", { name: /^Browse/ }));
    await screen.findByRole("heading", { name: /Browse/ });
    expect(screen.queryByText("Source")).toBeNull();
  });
});
