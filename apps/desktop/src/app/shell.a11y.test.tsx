// The shell, keyboard only: sidebar → search → avatar → screen → window controls; the sidebar
// marks the current section; the toast's polite live region stays mounted; a navigation started
// from inside the content leaves the focus on the content column (never a ring on it: it is not a
// control), so the next Tab lands on the new screen.
import { act, screen, within } from "@testing-library/react";
import { useUiStore } from "@/stores/useUiStore";
import { content, expectNamedControls, openScreen } from "@/screens/shared/a11yTesting";

const sidebar = () => screen.getByRole("navigation", { name: "Main" });

describe("Shell a11y", () => {
  it("runs sidebar → search → avatar → screen, and ends on the window controls", async () => {
    const { user } = await openScreen("/home");
    await screen.findByRole("heading", { level: 1 });
    await user.tab();
    expect(within(sidebar()).getByRole("button", { name: /^Paparats/ })).toHaveFocus();
    for (const name of ["Home", "Browse", "Categories", /^Updates/, "Library", /^Ideas/]) {
      await user.tab();
      expect(within(sidebar()).getByRole("button", { name })).toHaveFocus();
    }
    expect(within(sidebar()).getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Profile" })).toHaveFocus();
    await user.tab();
    expect(content().contains(document.activeElement)).toBe(true);

    // The window controls come after the whole screen.
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Maximize" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Minimize" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(content().contains(document.activeElement)).toBe(true);
    expectNamedControls(document.body);
  });

  it("keeps the toast's live region mounted and announces each toast in it", async () => {
    await openScreen("/home");
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    act(() => useUiStore.getState().notify("Profile saved"));
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Profile saved");
    // One live region: the toast inside does not announce itself again.
    expect(within(region).queryByRole("status")).toBeNull();
  });

  it("moves the focus to the content after a navigation from inside it", async () => {
    const { user } = await openScreen("/home");
    const seeAll = within(await screen.findByRole("region", { name: "Featured apps" })).getByRole(
      "button",
      { name: "See all" },
    );
    seeAll.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("complementary", { name: "Filters" })).toBeInTheDocument();
    expect(content()).toHaveFocus();
    await user.tab();
    expect(content().contains(document.activeElement)).toBe(true);

    // From the sidebar the focus stays where it was.
    const library = within(sidebar()).getByRole("button", { name: "Library" });
    library.focus();
    await user.keyboard("{Enter}");
    expect(library).toHaveFocus();
  });
});
