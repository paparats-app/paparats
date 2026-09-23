// Search, keyboard only: the search field is the first stop after the sidebar; typing shows the
// results (their count in a status region), Tab goes on into the first result, Escape clears the
// field and brings the screen back with the focus still in the field.
import { screen, within } from "@testing-library/react";
import { expectNamedControls, openScreen } from "@/screens/shared/a11yTesting";

const searchBox = () => screen.getByRole("searchbox", { name: "Search for apps, tools, ideas…" });
const results = () => screen.queryByRole("region", { name: /^Results for / });

describe("Search a11y", () => {
  it("is reachable after the sidebar and leads into the results", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    const sidebar = screen.getByRole("navigation", { name: "Main" });
    within(sidebar).getByRole("button", { name: "Settings" }).focus();
    await user.tab();
    expect(searchBox()).toHaveFocus();

    await user.keyboard("obs");
    const region = results();
    if (!region) throw new Error("no results");
    expect(await within(region).findByText("2 apps")).toBeInTheDocument();
    expect(within(region).getByRole("status")).toHaveTextContent("2 apps");

    await user.tab();
    expect(screen.getByRole("button", { name: "Profile" })).toHaveFocus();
    await user.tab();
    expect(document.activeElement?.closest("[data-app-card]")).not.toBeNull();
    expectNamedControls(region);
  });

  it("clears with Escape and brings the screen back, the focus kept in the field", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    await user.click(searchBox());
    await user.keyboard("obs");
    expect(results()).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(searchBox()).toHaveValue("");
    expect(searchBox()).toHaveFocus();
    expect(results()).toBeNull();
    expect(screen.getByRole("region", { name: "Highlights" })).toBeVisible();
  });
});
