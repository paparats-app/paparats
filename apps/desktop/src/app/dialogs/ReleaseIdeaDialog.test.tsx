// Release the idea (prototype lines 1470–1499): app picker or fixed app, the next-version prefill
// (recomputed when the app changes), the note, Release → service + toast, Cancel/Escape, failure.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { queryKeys } from "@/queries";
import { ServiceError } from "@/services";
import type { App, Catalog, Idea } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

const toast = () => useUiStore.getState().toast?.message;

async function openRelease(ideaId: string, services = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
    </>,
    { services },
  );
  await act(async () => {
    await useSettingsStore.getState().update({ dev: true, viewAsDeveloper: true });
  });
  act(() => useDialogStore.getState().open({ kind: "releaseIdea", ideaId }));
  const dialog = await screen.findByRole("dialog", { name: "Release the idea" });
  return { ...rendered, dialog: within(dialog) };
}

describe("ReleaseIdeaDialog", () => {
  it("prefills a new-app idea with the channel's app and its next patch version", async () => {
    const { dialog } = await openRelease("clip");
    expect(dialog.getByText("Clipboard history with pinned snippets")).toBeInTheDocument();
    const app = dialog.getByRole("combobox", { name: "Which app implements it?" });
    expect(app).toHaveValue("shell");
    expect(app).toHaveFocus();
    expect(
      within(app)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Nilesoft Shell"]);
    expect(dialog.getByRole("textbox", { name: "Version" })).toHaveValue("1.9.16");
    expect(
      dialog.getByText(
        "Alena K. and 214 voters will be notified. The author gets 3 months of Paparats Pro.",
      ),
    ).toBeInTheDocument();
  });

  it("recomputes the version when another app is picked", async () => {
    const user = userEvent.setup();
    const { dialog, queryClient } = await openRelease("clip");
    // A second Nilesoft app, so there is something to switch to.
    act(() =>
      queryClient.setQueryData<Catalog>(queryKeys.catalog, (catalog) => {
        if (!catalog) return catalog;
        const shell = catalog.apps.find((a) => a.id === "shell") as App;
        const tweaker: App = {
          ...shell,
          id: "tweaker",
          name: "Nilesoft Tweaker",
          version: "3.2.9",
        };
        return { ...catalog, apps: [...catalog.apps, tweaker] };
      }),
    );
    const app = dialog.getByRole("combobox", { name: "Which app implements it?" });
    const version = dialog.getByRole("textbox", { name: "Version" });
    await waitFor(() => expect(within(app).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(app, "tweaker");
    expect(version).toHaveValue("3.2.10");
    await user.clear(version);
    await user.type(version, "4.0");
    expect(version).toHaveValue("4.0");
    // As in the prototype, a new app replaces the typed version with its own next one.
    await user.selectOptions(app, "shell");
    expect(version).toHaveValue("1.9.16");
  });

  it("shows the improved app for an improvement and names the user as the author", async () => {
    const services = createTestServices();
    const mine = await services.ideas.propose({
      kind: "app",
      appId: "shell",
      category: null,
      title: "Portable settings file",
      body: "",
    });
    const { dialog } = await openRelease(mine.id, services);
    expect(dialog.queryByRole("combobox")).toBeNull();
    expect(dialog.getByText("Nilesoft Shell")).toBeInTheDocument();
    expect(dialog.getByText("Version 1.9.15")).toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Version" })).toHaveValue("1.9.16");
    // One vote (the author's own); the developer view names the signed-in user.
    expect(
      dialog.getByText(
        "Serj Kaje and 1 voter will be notified. The author gets 3 months of Paparats Pro.",
      ),
    ).toBeInTheDocument();
  });

  it("releases with the trimmed version, closes and toasts who was notified", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const release = vi.spyOn(services.ideas, "release");
    const { dialog, queryClient } = await openRelease("clip", services);
    const version = dialog.getByRole("textbox", { name: "Version" });
    await user.clear(version);
    // Blank: inert, not disabled (the prototype's button stays enabled); a press does nothing.
    const button = dialog.getByRole("button", { name: "Release" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(release).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(version, " 2.0.0 ");
    await user.click(dialog.getByRole("button", { name: "Release" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(release).toHaveBeenCalledWith("clip", "shell", "2.0.0");
    expect(toast()).toBe("Released · 214 people notified");
    const idea = queryClient.getQueryData<Idea[]>(queryKeys.ideas)?.find((i) => i.id === "clip");
    expect(idea).toMatchObject({
      status: "released",
      releasedAppId: "shell",
      releasedVersion: "2.0.0",
      releasedAt: "2026-09-15",
    });
  });

  it("keeps the dialog open when the release fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.ideas, "release").mockRejectedValue(new ServiceError("internal", "down"));
    const { dialog } = await openRelease("clip", services);
    await user.click(dialog.getByRole("button", { name: "Release" }));
    expect(await screen.findByRole("dialog", { name: "Release the idea" })).toBeInTheDocument();
    expect(toast()).toBeUndefined();
    expect(dialog.getByRole("button", { name: "Release" })).toBeEnabled();
  });

  it("closes with Cancel and with Escape", async () => {
    const user = userEvent.setup();
    const { dialog } = await openRelease("clip");
    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => useDialogStore.getState().open({ kind: "releaseIdea", ideaId: "clip" }));
    await screen.findByRole("dialog", { name: "Release the idea" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("closes itself for an unknown idea", async () => {
    await renderWithProviders(<DialogHost />);
    act(() => useDialogStore.getState().open({ kind: "releaseIdea", ideaId: "nope" }));
    await waitFor(() => expect(useDialogStore.getState().dialog).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ReleaseIdeaDialog busy state", () => {
  it("keeps Release busy and releases once while it runs", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const release = vi
      .spyOn(services.ideas, "release")
      .mockImplementation(() => new Promise(() => {}));
    const { dialog } = await openRelease("clip", services);
    const button = dialog.getByRole("button", { name: "Release" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
