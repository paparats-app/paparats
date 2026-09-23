// Browse, keyboard only: the tab order into the curated view, the filter panel (checkboxes with
// Space, the always-on Free / Windows rows inert, sort radios with the arrow keys, Escape in the
// filter search, Clear all) and named controls.
import { screen, within } from "@testing-library/react";
import {
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const panel = () => screen.getByRole("complementary", { name: "Filters" });
const check = (name: string) => within(panel()).getByRole("checkbox", { name });
const sort = (name: string) => within(panel()).getByRole("radio", { name });
const resultsCount = () => screen.queryByRole("list", { name: /\d+ apps?$/ });

async function openBrowse() {
  const opened = await openScreen("/browse");
  await screen.findByRole("button", { name: "Get Obsidian" });
  await within(panel()).findByRole("checkbox", { name: "Games" });
  return opened;
}

describe("Browse a11y", () => {
  it("tabs from the top bar into the featured hero and its dots", async () => {
    const { user } = await openBrowse();
    focusBeforeScreen();
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Get Obsidian" }),
      screen.getByRole("button", { name: "Slide 1 of 3" }),
      screen.getByRole("button", { name: "Slide 2 of 3" }),
      screen.getByRole("button", { name: "Slide 3 of 3" }),
    ]);
    expect(screen.getByRole("button", { name: "Slide 1 of 3" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expectNamedControls();
  });

  it("filters with Space, keeps Free and Windows inert, sorts with the arrow keys", async () => {
    const { user } = await openBrowse();

    // Free and Windows are always on: checked, disabled, out of the tab order.
    for (const name of ["Free", "Windows"]) {
      expect(check(name)).toBeChecked();
      expect(check(name)).toBeDisabled();
    }
    check("Pro features").focus();
    await user.tab({ shift: true });
    expect(check("Pro features")).not.toHaveFocus();
    expect(check("Free")).not.toHaveFocus();

    check("Games").focus();
    await user.keyboard(" ");
    expect(check("Games")).toBeChecked();
    expect(resultsCount()).not.toBeNull();

    sort("Featured").focus();
    await user.keyboard("{ArrowDown}");
    expect(sort("Newest")).toBeChecked();
    expect(sort("Newest")).toHaveFocus();

    within(panel()).getByRole("button", { name: "Clear all" }).focus();
    await user.keyboard("{Enter}");
    expect(check("Games")).not.toBeChecked();
    expect(resultsCount()).toBeNull();
  });

  it("clears the filter search with Escape", async () => {
    const { user } = await openBrowse();
    const search = within(panel()).getByRole("searchbox", { name: "Search filters…" });
    await user.click(search);
    await user.keyboard("gam");
    expect(within(panel()).queryByRole("checkbox", { name: "Design" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(check("Design")).toBeInTheDocument();
  });
});
