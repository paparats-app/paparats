// Suggest an idea (prototype lines 1417–1469): kind toggle, category / app select, the title
// check, Publish → the idea on top as mine, its page and the toast; Cancel / Escape.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { queryKeys } from "@/queries";
import type { Idea } from "@/services/types";
import type { MockServices } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

async function openSuggest(appId?: string, services: MockServices = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
    </>,
    { route: "/ideas", services },
  );
  // The board has loaded the ideas before the dialog opens.
  await rendered.queryClient.fetchQuery({
    queryKey: queryKeys.ideas,
    queryFn: () => services.ideas.getIdeas(),
  });
  act(() => useDialogStore.getState().open({ kind: "suggestIdea", appId }));
  const dialog = await screen.findByRole("dialog", { name: "Suggest an idea" });
  // The catalog, channels and library behind the selects have loaded.
  await waitFor(() => {
    const select = within(dialog).getByRole("combobox");
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(8);
    expect(select).not.toHaveValue("");
  });
  return { ...rendered, dialog, path: () => rendered.router.state.location.pathname };
}

const kind = (name: string) => screen.getByRole("radio", { name });
const titleInput = () => screen.getByRole("textbox", { name: "Title" });
const bodyInput = () => screen.getByRole("textbox", { name: "Description" });
const toast = () => useUiStore.getState().toast?.message;

describe("SuggestIdeaDialog", () => {
  it("starts on a new app in Utilities with the title focused", async () => {
    const { dialog } = await openSuggest();
    expect(kind("New app")).toHaveAttribute("aria-checked", "true");
    expect(kind("Improve an app")).toHaveAttribute("aria-checked", "false");
    const category = await within(dialog).findByRole("combobox", { name: "Category" });
    expect(category).toHaveValue("utilities");
    expect(
      within(category)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Productivity",
      "Development",
      "Design",
      "Media",
      "Utilities",
      "System",
      "Lifestyle",
      "Games",
      "Education",
    ]);
    expect(within(dialog).queryByRole("combobox", { name: "Which app?" })).not.toBeInTheDocument();
    expect(titleInput()).toHaveFocus();
    expect(titleInput()).toHaveAttribute("maxlength", "80");
    expect(titleInput()).toHaveAttribute("placeholder", "A short, clear name for the idea");
    expect(
      within(dialog).getByText(
        "Developers see new ideas right away. If yours ships, you get 3 months of Paparats Pro.",
      ),
    ).toBeInTheDocument();
  });

  it("refuses a title under six characters and clears the error on edit", async () => {
    const user = userEvent.setup();
    const { services, dialog } = await openSuggest();
    const propose = vi.spyOn(services.ideas, "propose");

    await user.click(within(dialog).getByRole("button", { name: "Publish" }));
    const message = "Give the idea a title of at least 6 characters.";
    expect(within(dialog).getByText(message)).toBeInTheDocument();
    expect(titleInput()).toHaveAttribute("aria-invalid", "true");
    expect(titleInput()).toHaveAccessibleDescription(message);
    expect(titleInput()).toHaveFocus();

    // Five characters after trimming are still too short.
    await user.type(titleInput(), "  Short  ");
    expect(within(dialog).queryByText(message)).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(within(dialog).getByText(message)).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();

    // Any field clears it, the kind toggle too.
    await user.click(kind("Improve an app"));
    expect(within(dialog).queryByText(message)).not.toBeInTheDocument();
    expect(titleInput()).not.toHaveAttribute("aria-invalid");
  });

  it("publishes a new-app idea: on top as mine, its page, the toast", async () => {
    const user = userEvent.setup();
    const { services, dialog, queryClient, path } = await openSuggest();
    const propose = vi.spyOn(services.ideas, "propose");

    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Category" }),
      "Productivity",
    );
    await user.type(titleInput(), "  Tabs for every window  ");
    await user.type(bodyInput(), "Group any windows into tabs. ");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    expect(propose).toHaveBeenCalledWith({
      kind: "new",
      appId: null,
      category: "productivity",
      title: "Tabs for every window",
      body: "Group any windows into tabs.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const ideas = queryClient.getQueryData<Idea[]>(queryKeys.ideas) ?? [];
    expect(ideas[0]).toMatchObject({
      title: "Tabs for every window",
      mine: true,
      status: "open",
      votes: 1,
      voted: true,
      kind: "new",
      category: "productivity",
    });
    expect(path()).toBe(`/ideas/${ideas[0]?.id ?? ""}`);
    expect(toast()).toBe("Idea published — developers can see it now");
  });

  it("improves an app: visible apps A–Z, the first catalog app picked, the choice published", async () => {
    const user = userEvent.setup();
    const { services, dialog } = await openSuggest();
    const propose = vi.spyOn(services.ideas, "propose");

    await user.click(kind("Improve an app"));
    const app = within(dialog).getByRole("combobox", { name: "Which app?" });
    expect(within(dialog).queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
    expect(app).toHaveValue("obsidian");
    const names = within(app)
      .getAllByRole("option")
      .map((o) => o.textContent ?? "");
    expect(names[0]).toBe("7-Zip");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    // Apps of channels the user does not follow are not offered.
    expect(names).not.toContain("mpv");

    await user.selectOptions(app, "ShareX");
    await user.type(titleInput(), "Dark mode for the capture editor");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));
    expect(propose).toHaveBeenCalledWith({
      kind: "app",
      appId: "sharex",
      category: null,
      title: "Dark mode for the capture editor",
      body: "",
    });
  });

  it("opened from an app page, starts on Improve an app with that app picked", async () => {
    await openSuggest("sharex");
    expect(kind("Improve an app")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("combobox", { name: "Which app?" })).toHaveValue("sharex");
  });

  it("offers an app page's app whose channel is not followed", async () => {
    await openSuggest("mpv");
    const app = screen.getByRole("combobox", { name: "Which app?" });
    expect(app).toHaveValue("mpv");
    expect(within(app).getByRole("option", { name: "mpv" })).toBeInTheDocument();
  });

  it("closes with Cancel, ×, or Escape without publishing", async () => {
    const user = userEvent.setup();
    const { services } = await openSuggest();
    const propose = vi.spyOn(services.ideas, "propose");

    await user.type(titleInput(), "A draft idea");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => useDialogStore.getState().open({ kind: "suggestIdea" }));
    await screen.findByRole("dialog");
    // A new dialog starts empty.
    expect(titleInput()).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => useDialogStore.getState().open({ kind: "suggestIdea" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();
  });

  it("keeps the dialog and the text when publishing fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.ideas, "propose").mockRejectedValue(new Error("offline"));
    const { dialog, path } = await openSuggest(undefined, services);

    await user.type(titleInput(), "Tabs for every window");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Publish" })).not.toHaveAttribute(
        "aria-busy",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Tabs for every window");
    expect(path()).toBe("/ideas");
    expect(toast()).toBeUndefined();
  });
});
