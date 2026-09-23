// Ideas, keyboard only: the tab order from Suggest an idea through the note into the board; the
// status chips and the vote buttons report their state; Activate is busy (and sends once) while it
// runs; the suggest dialog takes the focus, keeps it and gives it back on Escape.
import { screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { createTestServices } from "@/test/render";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const note = () => screen.getByRole("region", { name: "Your idea became an app" });
const chips = () => screen.getByRole("group", { name: "Filter by status" });

async function openIdeas(services = createTestServices()) {
  const opened = await openScreen("/ideas", services);
  await screen.findByRole("tab", { name: /^All/ });
  return opened;
}

describe("Ideas a11y", () => {
  it("tabs from Suggest an idea through the note into the board", async () => {
    const { user } = await openIdeas();
    focusBeforeScreen();
    const firstCard = screen.getAllByRole("article")[0];
    if (!firstCard) throw new Error("no idea card");
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Suggest an idea" }),
      within(note()).getByRole("button", { name: /^Open / }),
      within(note()).getByRole("button", { name: "Activate 3 months of Pro" }),
      within(note()).getByRole("button", { name: "Dismiss" }),
      screen.getByRole("tab", { name: /^All/ }),
      within(chips()).getByRole("button", { name: "Open" }),
      within(chips()).getByRole("button", { name: "In work" }),
      within(chips()).getByRole("button", { name: "Released" }),
      screen.getByRole("combobox", { name: "Sort by" }),
      within(firstCard).getByRole("button", { name: /votes?$/ }),
      within(firstCard).getByRole("heading", { level: 3 }).querySelector("button") as HTMLElement,
    ]);
    expectNamedControls();
  });

  it("toggles the status chips and votes with the keyboard", async () => {
    const { user } = await openIdeas();
    const open = within(chips()).getByRole("button", { name: "Open" });
    expect(open).toHaveAttribute("aria-pressed", "false");
    open.focus();
    await user.keyboard(" ");
    expect(open).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Enter}");
    expect(open).toHaveAttribute("aria-pressed", "false");

    const card = screen.getAllByRole("article")[0];
    if (!card) throw new Error("no idea card");
    const vote = within(card).getByRole("button", { name: /votes?$/ });
    const before = vote.getAttribute("aria-pressed");
    vote.focus();
    await user.keyboard("{Enter}");
    expect(await within(card).findByRole("button", { name: /votes?$/ })).not.toHaveAttribute(
      "aria-pressed",
      before ?? "",
    );
  });

  it("shows Activate busy and sends it once while it runs", async () => {
    const services = createTestServices();
    const claim = vi
      .spyOn(services.account, "claimIdeaBonus")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openIdeas(services);
    const activate = within(note()).getByRole("button", { name: "Activate 3 months of Pro" });
    activate.focus();
    await user.keyboard("{Enter}");
    expect(activate).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Enter}");
    await user.click(activate);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("opens Suggest an idea on Enter, traps Tab and gives the focus back on Escape", async () => {
    const { user } = await openIdeas();
    const suggest = screen.getByRole("button", { name: "Suggest an idea" });
    suggest.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Suggest an idea" });
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveFocus();
    // Shift+Tab from the title goes back through the dialog, never out of it.
    for (let i = 0; i < 8; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    expectNamedControls(dialog);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(suggest).toHaveFocus();
  });

  it("publishes from the keyboard and continues on the new idea page", async () => {
    const { user } = await openIdeas();
    screen.getByRole("button", { name: "Suggest an idea" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("Portable build of the app");
    const dialog = screen.getByRole("dialog", { name: "Suggest an idea" });
    within(dialog).getByRole("button", { name: "Publish" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(within(content()).getByRole("heading", { level: 1 })).toHaveTextContent(
        "Portable build of the app",
      ),
    );
    // The dialog's opener left with the board: the focus is on the new page's column.
    expect(content()).toHaveFocus();
    await user.tab();
    expect(within(content()).getByRole("button", { name: "Ideas" })).toHaveFocus();
  });
});
