// Settings, keyboard only: the section nav then the panel; the theme and language groups move with
// the arrow keys; switches and row buttons are named (the row title describes "Clear",
// "Change…"…); About's update check is busy while it runs; in Sources the channel dialogs take the
// focus and give it back — after a cancelled trust confirmation, to the Subscribe that asked.
import { screen, waitFor, within } from "@testing-library/react";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const SECTIONS = [
  "General",
  "Updates",
  "Downloads",
  "Apps",
  "Sources",
  "Notifications",
  "Privacy",
  "Account",
  "Advanced",
  "About",
];
const sections = () => screen.getByRole("navigation", { name: "Settings sections" });
const section = (name: string) => within(sections()).getByRole("button", { name });

describe("Settings a11y", () => {
  it("tabs through the section nav into the General panel", async () => {
    const { user } = await openScreen("/settings");
    await screen.findByRole("radiogroup", { name: "Theme" });
    focusBeforeScreen();
    await expectTabOrder(user, [
      ...SECTIONS.map((name) => section(name)),
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", {
        checked: true,
      }),
      within(screen.getByRole("radiogroup", { name: "Language" })).getByRole("radio", {
        checked: true,
      }),
    ]);
    expect(section("General")).toHaveAttribute("aria-current", "page");
    expectNamedControls();
  });

  it("picks a section with Enter and keeps the focus on the nav", async () => {
    const { user } = await openScreen("/settings");
    section("Privacy").focus();
    await user.keyboard("{Enter}");
    expect(section("Privacy")).toHaveAttribute("aria-current", "page");
    expect(section("Privacy")).toHaveFocus();
    // Row buttons repeat short labels; the row title describes each one.
    expect(within(content()).getByRole("button", { name: "Clear" })).toHaveAccessibleDescription(
      "Search history",
    );
    expectNamedControls();
  });

  it("moves the theme with the arrow keys", async () => {
    const { user } = await openScreen("/settings");
    const theme = await screen.findByRole("radiogroup", { name: "Theme" });
    within(theme).getByRole("radio", { name: "Dark" }).focus();
    await user.keyboard("{ArrowRight}");
    const system = within(theme).getByRole("radio", { name: "System" });
    expect(system).toHaveFocus();
    await waitFor(() => expect(system).toBeChecked());
  });

  it("keeps Check for updates busy while it runs", async () => {
    const { user } = await openScreen("/settings/about");
    const check = await screen.findByRole("button", { name: "Check for updates" });
    check.focus();
    await user.keyboard("{Enter}");
    const checking = screen.getByRole("button", { name: "Checking…" });
    expect(checking).toHaveAttribute("aria-busy", "true");
    expect(checking).toHaveFocus();
    expect(
      await screen.findByRole("button", { name: "Check for updates" }, { timeout: 3000 }),
    ).not.toHaveAttribute("aria-busy");
  });

  it("returns the focus from the channel dialogs (Sources)", async () => {
    const { user } = await openScreen("/settings/sources");
    const add = await screen.findByRole("button", { name: "Add channel" });
    add.focus();
    await user.keyboard("{Enter}");
    let dialog = screen.getByRole("dialog", { name: "Add channel" });
    expect(within(dialog).getByRole("textbox", { name: "Channel address" })).toHaveFocus();
    expectNamedControls(dialog);

    // A community channel asks first; Cancel comes back to the Subscribe that asked.
    const subscribe = within(dialog).getAllByRole("button", { name: "Subscribe" })[0];
    if (!subscribe) throw new Error("no catalog row");
    const channel = subscribe.getAttribute("aria-describedby") ?? "";
    const channelName = document.getElementById(channel)?.textContent ?? "";
    expect(subscribe).toHaveAccessibleDescription(channelName);
    subscribe.focus();
    await user.keyboard("{Enter}");
    const confirm = await screen.findByRole("dialog", { name: `Add ${channelName}?` });
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");
    dialog = await screen.findByRole("dialog", { name: "Add channel" });
    const back = within(dialog).getAllByRole("button", { name: "Subscribe" })[0];
    expect(back).toHaveFocus();
    expect(back).toHaveAccessibleDescription(channelName);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(add).toHaveFocus();
  });
});
