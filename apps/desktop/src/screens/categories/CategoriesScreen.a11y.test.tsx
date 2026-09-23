// Categories, keyboard only: the nine tiles are the first stops, Enter opens Browse filtered to
// the category (the focus moves to the new screen), and every control is named.
import { screen, within } from "@testing-library/react";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const TILES = [
  "Productivity",
  "Development",
  "Design",
  "Media",
  "Utilities",
  "System",
  "Lifestyle",
  "Games",
  "Education",
];

describe("Categories a11y", () => {
  it("tabs through the nine tiles, then the featured section", async () => {
    const { user } = await openScreen("/categories");
    await screen.findByRole("button", { name: /^Productivity/ });
    focusBeforeScreen();
    await expectTabOrder(user, [
      ...TILES.map((name) => screen.getByRole("button", { name: new RegExp(`^${name}`) })),
      screen.getByRole("button", { name: "See all" }),
    ]);
    expectNamedControls();
  });

  it("opens Browse filtered to a category with Enter", async () => {
    const { user } = await openScreen("/categories");
    const tile = await screen.findByRole("button", { name: /^Design/ });
    tile.focus();
    await user.keyboard("{Enter}");
    const filters = await screen.findByRole("complementary", { name: "Filters" });
    expect(within(filters).getByRole("checkbox", { name: "Design" })).toBeChecked();
    expect(content()).toHaveFocus();
  });
});
