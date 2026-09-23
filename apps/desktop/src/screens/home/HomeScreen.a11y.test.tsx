// Home, keyboard only: the tab order from the top bar through the hero into the store cards,
// the carousel's buttons and dots, a card's parts, and named controls.
import { screen, within } from "@testing-library/react";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const hero = () => screen.getByRole("region", { name: "Highlights" });
const featured = () => screen.getByRole("region", { name: "Featured apps" });
const dot = (n: number) => within(hero()).getByRole("button", { name: `Slide ${n} of 4` });

describe("Home a11y", () => {
  it("tabs from the top bar through the hero, the dots and into the first card", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    focusBeforeScreen();

    const card = within(featured()).getByRole("button", { name: /^Obsidian/ });
    const root = card.closest<HTMLElement>("[data-app-card]");
    if (!root) throw new Error("no card");
    await expectTabOrder(user, [
      within(hero()).getByRole("button", { name: "Explore apps" }),
      within(hero()).getByRole("button", { name: "Previous slide" }),
      dot(1),
      dot(2),
      dot(3),
      dot(4),
      within(hero()).getByRole("button", { name: "Next slide" }),
      within(featured()).getByRole("button", { name: "See all" }),
      card,
      within(root).getByRole("button", { name: "Update" }),
      within(root).getByRole("button", { name: "Details" }),
    ]);
    expectNamedControls();
  });

  it("moves the carousel with Enter and Space, and marks the current dot", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    expect(dot(1)).toHaveAttribute("aria-current", "true");

    within(hero()).getByRole("button", { name: "Next slide" }).focus();
    await user.keyboard("{Enter}");
    expect(dot(2)).toHaveAttribute("aria-current", "true");
    expect(dot(1)).not.toHaveAttribute("aria-current");

    dot(4).focus();
    await user.keyboard(" ");
    expect(dot(4)).toHaveAttribute("aria-current", "true");
  });

  it("opens an app page from a card with the keyboard", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    within(featured())
      .getByRole("button", { name: /^Obsidian/ })
      .focus();
    await user.keyboard("{Enter}");
    expect(await within(content()).findByRole("heading", { level: 1 })).toHaveTextContent(
      "Obsidian",
    );
    // The next Tab starts on the new page, not back at the top of the window.
    await user.tab();
    expect(within(content()).getByRole("button", { name: "Back" })).toHaveFocus();
  });
});
