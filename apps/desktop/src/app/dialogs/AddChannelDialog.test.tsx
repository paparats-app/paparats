// Add channel (prototype lines 1367–1403, logic `lookupChannel` / `subscribeChannel`): lookup by
// address, host, @handle and handle, both inline errors, the catalog, the trust confirmation for
// community channels, and the apps that become visible.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useVisibleApps } from "@/hooks";
import { changeLocale } from "@/i18n";
import { ServiceError, type MockServices } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

const toast = () => useUiStore.getState().toast?.message;

function VisibleApps() {
  const ids = useVisibleApps().map((app) => app.id);
  return <div data-testid="visible">{ids.join(" ")}</div>;
}
const visible = () => screen.getByTestId("visible").textContent?.split(" ") ?? [];

async function subscriptionIds(services: MockServices) {
  return (await services.channels.getSubscriptions()).map((s) => s.channelId);
}

/** Opens the dialog; `unfollow` channels are unsubscribed first so they can be added again. */
async function openDialog(unfollow: string[] = [], services = createTestServices()) {
  for (const id of unfollow) await services.channels.unsubscribe(id);
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
      <VisibleApps />
    </>,
    { route: "/settings/sources", services },
  );
  act(() => useDialogStore.getState().open({ kind: "addChannel" }));
  const dialog = await screen.findByRole("dialog", { name: "Add channel" });
  return {
    ...rendered,
    dialog,
    input: within(dialog).getByRole("textbox", { name: "Channel address" }),
  };
}

/** Each catalog row's identity text: monogram, name, trust, meta. */
const catalogRows = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("group", { name: "Channel catalog" }))
    .queryAllByRole("button", { name: "Learn more" })
    .map((b) => b.parentElement?.firstElementChild?.textContent);
const WINAERO = "WaWinaeroCommunityDeveloper · by Sergey Tkachenko · 1 app";
const MPV = "mpmpv buildsCommunityDeveloper · by shinchiro · 1 app";
const BYSOFT = "БыСофт па-беларускуCommunityCurated · by Алесь М. · 1 app";

describe("AddChannelDialog", () => {
  it("shows the address field and the catalog of channels not followed yet", async () => {
    const { dialog, input } = await openDialog();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("placeholder", "https://… or @name");
    expect(
      within(dialog).getByText("Paste a link from the author or a short code like @winaero."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Channel catalog")).toBeInTheDocument();
    expect(within(dialog).getByText("3 channels")).toBeInTheDocument();
    expect(catalogRows(dialog)).toEqual([WINAERO, MPV, BYSOFT]);
    expect(within(dialog).getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
  });

  it("adds a verified channel by its full address (scheme, www., case and / ignored)", async () => {
    const user = userEvent.setup();
    const { input, services } = await openDialog(["nilesoft"]);
    await user.type(input, "https://www.Nilesoft.org/paparats/{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Subscribed to Nilesoft");
    expect(await subscriptionIds(services)).toContain("nilesoft");
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("adds a channel by its host with the Add button", async () => {
    const user = userEvent.setup();
    const { dialog, input, services } = await openDialog(["fossfriends"]);
    expect(visible()).not.toContain("imageglass");
    await user.type(input, "fossfriends.dev");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(toast()).toBe("Subscribed to FOSS Friends"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await subscriptionIds(services)).toContain("fossfriends");
    expect(visible()).toContain("imageglass");
  });

  it("adds a community channel by @handle after the trust confirmation", async () => {
    const user = userEvent.setup();
    const { input, services } = await openDialog();
    expect(visible()).not.toContain("slounik");
    await user.type(input, "@BySoft{Enter}");
    const confirm = await screen.findByRole("dialog", { name: "Add Софт па-беларуску?" });
    expect(screen.queryByRole("dialog", { name: "Add channel" })).toBeNull();
    expect(await subscriptionIds(services)).not.toContain("bysoft");
    await user.click(within(confirm).getByRole("button", { name: "Add channel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Subscribed to Софт па-беларуску");
    expect(await subscriptionIds(services)).toContain("bysoft");
    expect(visible()).toContain("slounik");
  });

  it("finds a channel by its handle without @; Cancel returns to the dialog with the address", async () => {
    const user = userEvent.setup();
    const { input, services } = await openDialog();
    await user.type(input, "mpv{Enter}");
    const confirm = await screen.findByRole("dialog", { name: "Add mpv builds?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: "Add channel" });
    const again = within(dialog).getByRole("textbox", { name: "Channel address" });
    expect(again).toHaveValue("mpv");
    expect(again).toHaveFocus();
    expect(await subscriptionIds(services)).not.toContain("mpvbuilds");
    expect(toast()).toBeUndefined();

    // Escape on the confirmation also goes back.
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Add mpv builds?" });
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("dialog", { name: "Add channel" })).toBeInTheDocument();
  });

  it("says when there is no channel at the address, until the address changes", async () => {
    const user = userEvent.setup();
    const { dialog, input } = await openDialog();
    await user.type(input, "https://example.com/feed{Enter}");
    expect(
      await within(dialog).findByText(
        "No channel at this address. Check the link or ask the author for a short code.",
      ),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(
      within(dialog).queryByText("Paste a link from the author or a short code like @winaero."),
    ).toBeNull();
    await user.type(input, "x");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(
      within(dialog).getByText("Paste a link from the author or a short code like @winaero."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add channel" })).toBeInTheDocument();
  });

  it("says when the channel is already followed", async () => {
    const user = userEvent.setup();
    const { dialog, input, services } = await openDialog();
    const subscribe = vi.spyOn(services.channels, "subscribe");
    await user.type(input, "@nilesoft{Enter}");
    expect(await within(dialog).findByText("You already follow this channel.")).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
    expect(toast()).toBeUndefined();
  });

  it("ignores a blank address", async () => {
    const user = userEvent.setup();
    const { dialog, input, services } = await openDialog();
    const lookup = vi.spyOn(services.channels, "lookup");
    await user.type(input, "   {Enter}");
    await user.clear(input);
    await user.type(input, "https://{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(lookup).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("subscribes from the catalog: verified at once, community after the confirmation", async () => {
    const user = userEvent.setup();
    const { dialog, services } = await openDialog(["nilesoft"]);
    expect(catalogRows(dialog)).toEqual([
      "NiNilesoftVerifiedDeveloper · by Nilesoft · 1 app",
      WINAERO,
      MPV,
      BYSOFT,
    ]);
    const subscribeButtons = () => within(dialog).getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons()[0] as HTMLElement);
    await waitFor(() => expect(toast()).toBe("Subscribed to Nilesoft"));
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => useDialogStore.getState().open({ kind: "addChannel" }));
    const next = await screen.findByRole("dialog", { name: "Add channel" });
    expect(within(next).getByText("3 channels")).toBeInTheDocument();
    await user.click(within(next).getAllByRole("button", { name: "Subscribe" })[0] as HTMLElement);
    const confirm = await screen.findByRole("dialog", { name: "Add Winaero?" });
    expect(
      within(confirm).getByText(/^This is a community channel\. Paparats has not reviewed/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Add channel" }));
    await waitFor(() => expect(toast()).toBe("Subscribed to Winaero"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await subscriptionIds(services)).toEqual([
      "paparats",
      "fossfriends",
      "nilesoft",
      "winaero",
    ]);
  });

  it("says so when every catalog channel is followed", async () => {
    const services = createTestServices();
    for (const id of ["winaero", "mpvbuilds", "bysoft"]) await services.channels.subscribe(id);
    const { dialog } = await openDialog([], services);
    expect(
      within(dialog).getByText("You follow every channel in the catalog."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("0 channels")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Subscribe" })).toBeNull();
  });

  it("Learn more closes the dialog and opens the channel page", async () => {
    const user = userEvent.setup();
    const { dialog, router } = await openDialog();
    await user.click(
      within(dialog).getAllByRole("button", { name: "Learn more" })[1] as HTMLElement,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.state.location.pathname).toBe("/channel/mpvbuilds");
    expect(router.state.location.state).toEqual({ from: "/settings/sources" });
  });

  it("closes with × and Escape without subscribing", async () => {
    const user = userEvent.setup();
    const { dialog, services } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => useDialogStore.getState().open({ kind: "addChannel" }));
    await screen.findByRole("dialog", { name: "Add channel" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await subscriptionIds(services)).toEqual(["paparats", "nilesoft", "fossfriends"]);
  });

  it("keeps the dialog open without a toast when subscribing fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    await services.channels.unsubscribe("nilesoft");
    vi.spyOn(services.channels, "subscribe").mockRejectedValue(
      new ServiceError("internal", "down"),
    );
    const { input } = await openDialog([], services);
    await user.type(input, "@nilesoft{Enter}");
    await waitFor(() => expect(services.channels.subscribe).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "Add channel" })).toBeInTheDocument();
    expect(toast()).toBeUndefined();
  });

  it("is translated, with be/ru plurals", async () => {
    await openDialog();
    await act(() => changeLocale("ru"));
    const dialog = screen.getByRole("dialog", { name: "Добавить канал" });
    expect(within(dialog).getByText("3 канала")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Адрес канала" })).toHaveAttribute(
      "placeholder",
      "https://… или @название",
    );
    await act(() => changeLocale("be"));
    expect(within(dialog).getByText("3 каналы")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "Падпісацца" })).toHaveLength(3);
  });
});
