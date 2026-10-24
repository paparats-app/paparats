// Trust confirmation (prototype lines 1500–1517): opened on its own (a store card's or the channel
// page's Subscribe on a community channel), it follows the channel only once confirmed.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { changeLocale } from "@/i18n";
import { queryKeys } from "@/queries";
import { ServiceError } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

const toast = () => useUiStore.getState().toast?.message;

async function openConfirm(channelId: string, services = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
    </>,
    { services },
  );
  act(() => useDialogStore.getState().open({ kind: "trustConfirm", channelId }));
  return rendered;
}

const subscriptionIds = async (services: ReturnType<typeof createTestServices>) =>
  (await services.channels.getSubscriptions()).map((s) => s.channelId);

describe("TrustConfirmDialog", () => {
  it("names the community channel and warns before adding it", async () => {
    const user = userEvent.setup();
    const { services } = await openConfirm("vitrazh");
    const dialog = await screen.findByRole("dialog", { name: "Add Vitrazh?" });
    expect(within(dialog).getByText("Vitrazh")).toBeInTheDocument();
    expect(within(dialog).getByText("Community")).toBeInTheDocument();
    expect(within(dialog).getByText("Developer · by Andrei V. · 1 app")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This is a community channel. Paparats has not reviewed its apps — they come straight from the author’s server and are not covered by Paparats Pro. Add only channels whose author you trust.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Add channel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Subscribed to Vitrazh");
    expect(await subscriptionIds(services)).toContain("vitrazh");
  });

  it("Cancel and Escape close it without following the channel", async () => {
    const user = userEvent.setup();
    const { services } = await openConfirm("mpvbuilds");
    const dialog = await screen.findByRole("dialog", { name: "Add mpv builds?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => useDialogStore.getState().open({ kind: "trustConfirm", channelId: "mpvbuilds" }));
    await screen.findByRole("dialog", { name: "Add mpv builds?" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await subscriptionIds(services)).not.toContain("mpvbuilds");
    expect(toast()).toBeUndefined();
  });

  it("stays open without a toast when following fails, and follows once on double clicks", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const subscribe = vi
      .spyOn(services.channels, "subscribe")
      .mockRejectedValueOnce(new ServiceError("internal", "down"));
    await openConfirm("bysoft", services);
    const dialog = await screen.findByRole("dialog", { name: "Add Софт па-беларуску?" });
    await user.click(within(dialog).getByRole("button", { name: "Add channel" }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast()).toBeUndefined();

    await user.dblClick(within(dialog).getByRole("button", { name: "Add channel" }));
    await waitFor(() => expect(toast()).toBe("Subscribed to Софт па-беларуску"));
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders nothing for an unknown channel", async () => {
    const { queryClient } = await openConfirm("nope");
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.channels)).toBeDefined());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is translated", async () => {
    await openConfirm("vitrazh");
    await screen.findByRole("dialog", { name: "Add Vitrazh?" });
    await act(() => changeLocale("ru"));
    const dialog = screen.getByRole("dialog", { name: "Добавить Vitrazh?" });
    expect(
      within(dialog).getByText("Разработчик · от Andrei V. · 1 приложение"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Добавить канал" })).toBeInTheDocument();
  });
});

describe("TrustConfirmDialog busy state", () => {
  it("keeps Add channel busy and subscribes once while it runs", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const subscribe = vi
      .spyOn(services.channels, "subscribe")
      .mockImplementation(() => new Promise(() => {}));
    await openConfirm("vitrazh", services);
    const dialog = await screen.findByRole("dialog", { name: "Add Vitrazh?" });
    const add = within(dialog).getByRole("button", { name: "Add channel" });
    await user.click(add);
    expect(add).toHaveAttribute("aria-busy", "true");
    await user.click(add);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
