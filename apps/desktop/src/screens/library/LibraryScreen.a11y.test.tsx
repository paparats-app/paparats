// Library, keyboard only: the tab order through the toolbar into the first row; the tabs and the
// list/grid switch move with the arrow keys; the ⋯ menu opens on Enter / ArrowDown, moves with the
// arrows and closes on Escape back on its trigger; the quick filters report their state.
import { screen, within } from "@testing-library/react";
import {
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const more = (app: string) => screen.getByRole("button", { name: `More actions for ${app}` });

async function openLibrary() {
  const opened = await openScreen("/library");
  await screen.findByRole("button", { name: "More actions for Visual Studio Code" });
  return opened;
}

describe("Library a11y", () => {
  it("tabs through the toolbar into the first row", async () => {
    const { user } = await openLibrary();
    focusBeforeScreen();
    const first = more("Visual Studio Code").closest("li");
    if (!first) throw new Error("no first row");
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Install app" }),
      tab(/^Installed/),
      screen.getByRole("combobox", { name: "Sort by" }),
      screen.getByRole("radio", { name: "List" }),
      within(first).getByRole("button", { name: /^Visual Studio Code/ }),
      within(first).getByRole("button", { name: "Update" }),
      more("Visual Studio Code"),
    ]);
    expect(tab(/^Installed/)).toHaveAttribute("aria-selected", "true");
    expectNamedControls();
  });

  it("moves between tabs and views with the arrow keys", async () => {
    const { user } = await openLibrary();
    tab(/^Installed/).focus();
    await user.keyboard("{ArrowRight}");
    expect(tab(/^Favorites/)).toHaveFocus();
    expect(tab(/^Favorites/)).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tab(/^Collections/)).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(tab(/^Installed/)).toHaveAttribute("aria-selected", "true");

    screen.getByRole("radio", { name: "List" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Grid" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Grid" })).toBeChecked();
  });

  it("drives the ⋯ menu with the keyboard and returns the focus on Escape", async () => {
    const { user } = await openLibrary();
    const trigger = more("Visual Studio Code");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(items.at(-1)).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    // ArrowUp on the trigger opens it at the last item.
    await user.keyboard("{ArrowUp}");
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").at(-1)).toHaveFocus();
    await user.keyboard("{Escape}");
  });

  it("reports the quick filter in effect", async () => {
    const { user } = await openLibrary();
    const filters = screen.getByRole("region", { name: "Quick filters" });
    const all = within(filters).getByRole("button", { name: /^All/ });
    const favorites = within(filters).getByRole("button", { name: /^Favorites/ });
    expect(all).toHaveAttribute("aria-pressed", "true");
    favorites.focus();
    await user.keyboard(" ");
    expect(favorites).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
  });
});
