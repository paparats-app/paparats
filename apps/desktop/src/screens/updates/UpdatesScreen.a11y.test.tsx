// Updates, keyboard only: the tab order through the banner and the rows, the expanders, the
// switch, and Update all → Pause all / Cancel all → Update all keeping the focus where the pressed
// button was, with the batch progress bar reporting its value.
import { screen, waitFor, within } from "@testing-library/react";
import {
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const list = () => screen.getByRole("list", { name: "Updates" });
function row(name: string): HTMLElement {
  const item = [...list().children].find(
    (li) => within(li as HTMLElement).queryByText(name, { selector: "span" }) !== null,
  );
  if (!(item instanceof HTMLElement)) throw new Error(`no row for ${name}`);
  return item;
}

async function openUpdates() {
  const opened = await openScreen("/updates");
  await screen.findByRole("button", { name: "Update all" });
  return opened;
}

describe("Updates a11y", () => {
  it("tabs from Update all through the first rows, release notes included", async () => {
    const { user } = await openUpdates();
    focusBeforeScreen();
    const obsidian = within(row("Obsidian"));
    const sharex = within(row("ShareX"));
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Update all" }),
      obsidian.getByRole("button", { name: /^Obsidian/ }),
      obsidian.getByRole("button", { name: "Update" }),
      obsidian.getByRole("button", { name: "Hide details" }),
      obsidian.getByRole("button", { name: "View details" }),
      sharex.getByRole("button", { name: /^ShareX/ }),
      sharex.getByRole("button", { name: "Update" }),
      sharex.getByRole("button", { name: "View details" }),
    ]);
    expectNamedControls();
  });

  it("expands and collapses with Enter; the switch and the history answer Space", async () => {
    const { user } = await openUpdates();
    const hide = within(row("Obsidian")).getByRole("button", { name: "Hide details" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    hide.focus();
    await user.keyboard("{Enter}");
    const show = within(row("Obsidian")).getByRole("button", { name: "View details" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(show).toHaveFocus();

    const auto = screen.getByRole("switch", { name: "Automatic updates" });
    const before = auto.getAttribute("aria-checked");
    auto.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(auto.getAttribute("aria-checked")).not.toBe(before));

    const history = screen.getByRole("button", { name: /^Update history/ });
    expect(history).toHaveAttribute("aria-expanded", "false");
    history.focus();
    await user.keyboard(" ");
    expect(history).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Update history" })).toBeInTheDocument();
  });

  it("keeps the keyboard focus on the batch buttons that replace the pressed one", async () => {
    const { user } = await openUpdates();
    screen.getByRole("button", { name: "Update all" }).focus();
    await user.keyboard("{Enter}");

    const pauseAll = await screen.findByRole("button", { name: "Pause all" });
    expect(pauseAll).toHaveFocus();
    const bar = screen.getByRole("progressbar", { name: /^Updating \d+ of 6$/ });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow");

    await user.tab();
    const cancelAll = screen.getByRole("button", { name: "Cancel all" });
    expect(cancelAll).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: "Update all" })).toHaveFocus();
  });
});
