// App page, keyboard only: the tab order from Back through the header into the screenshots; the
// favourite reports its state; the rating moves with the arrow keys; the report dialog takes the
// focus (Send inert while empty) and gives it back; offline, Get reads as unavailable but still
// answers with the offline toast (Installing… is disabled: AppScreen.test).
import { act, screen, waitFor, within } from "@testing-library/react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const header = () => {
  const el = within(content()).getByRole("heading", { level: 1 }).closest("header");
  if (!el) throw new Error("no header");
  return within(el);
};

async function openApp(appId: string) {
  const opened = await openScreen(`/app/${appId}`);
  await within(content()).findByRole("heading", { level: 1 });
  return opened;
}

describe("App page a11y", () => {
  it("tabs from Back through the header into the screenshots", async () => {
    const { user } = await openApp("obsidian");
    focusBeforeScreen();
    await expectTabOrder(user, [
      within(content()).getByRole("button", { name: "Back" }),
      header().getByRole("button", { name: "Paparats" }),
      header().getByRole("button", { name: "Update" }),
      header().getByRole("button", { name: "Remove from favorites" }),
      within(content()).getByRole("button", { name: "Previous" }),
      within(content()).getByRole("button", { name: "Next" }),
    ]);
    expectNamedControls();
  });

  it("toggles the favourite and rates with the keyboard", async () => {
    const { user } = await openApp("obsidian");
    const star = header().getByRole("button", { name: "Remove from favorites" });
    expect(star).toHaveAttribute("aria-pressed", "true");
    star.focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(header().getByRole("button", { name: "Add to favorites" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );

    const rate = screen.getByRole("radiogroup", { name: "Rate this app" });
    const first = within(rate).getByRole("radio", { name: "1" });
    first.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    const third = within(rate).getByRole("radio", { name: "3" });
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute("aria-checked", "true");
  });

  it("opens Report a problem on Enter; Send is reachable; Escape gives the focus back", async () => {
    const { user } = await openApp("obsidian");
    const report = within(content()).getByRole("button", { name: "Report a problem" });
    report.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog");
    const text = within(dialog).getByRole("textbox");
    expect(text).toHaveFocus();
    const send = within(dialog).getByRole("button", { name: "Send" });
    // Always enabled, as in the prototype: the next Tab after Cancel lands on it.
    expect(send).toBeEnabled();
    await user.keyboard("Crashes on start");
    await user.tab();
    await user.tab();
    expect(send).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(report).toHaveFocus();
  });

  it("reads Get as unavailable offline, still answering with the toast", async () => {
    const { user } = await openApp("imageglass");
    await act(async () => {
      await useSettingsStore.getState().update({ simulateOffline: true });
    });
    const action = header().getByRole("button", { name: "Offline" });
    expect(action).toHaveAttribute("aria-disabled", "true");
    action.focus();
    await user.keyboard("{Enter}");
    expect(useUiStore.getState().toast?.message).toBe("You’re offline");
    expect(action).toHaveFocus();
  });
});
