// Channel page, keyboard only: the tab order through the action row into the apps; Unsubscribe
// and Subscribe hand the focus to what replaces them (a community channel's Subscribe through the
// trust confirmation, too); the Enabled/Paused switch reports its state;
// Sync now is busy (and syncs once) while it runs.
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

const button = (name: string) => within(content()).getByRole("button", { name });

async function openChannel(channelId: string, services = createTestServices()) {
  const opened = await openScreen(`/channel/${channelId}`, services);
  await within(content()).findByRole("heading", { level: 1 });
  return opened;
}

describe("Channel a11y", () => {
  it("tabs from Back through the action row into the apps", async () => {
    const { user } = await openChannel("kvetka");
    focusBeforeScreen();
    const apps = screen.getByRole("region", { name: "Apps in this channel" });
    await expectTabOrder(user, [
      button("Back"),
      within(content()).getByRole("switch", { name: "Enabled" }),
      button("Unsubscribe"),
      button("Copy address"),
      button("Report a problem"),
      button("Sync now"),
      within(apps).getByRole("button", { name: /^Kvetka Shell/ }),
    ]);
    expect(within(content()).getByRole("switch", { name: "Enabled" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expectNamedControls();
  });

  it("keeps the focus on the buttons that replace Unsubscribe and Subscribe", async () => {
    const { user } = await openChannel("kvetka");
    button("Unsubscribe").focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(button("Subscribe")).toHaveFocus());
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(within(content()).getByRole("switch", { name: "Enabled" })).toHaveFocus(),
    );
    await user.keyboard(" ");
    const paused = await within(content()).findByRole("switch", { name: "Paused" });
    expect(paused).toHaveAttribute("aria-checked", "false");
    expect(paused).toHaveFocus();
  });

  it("hands the focus from Subscribe through the trust confirmation to the switch", async () => {
    const { user } = await openChannel("vitrazh");
    button("Subscribe").focus();
    await user.keyboard("{Enter}");
    // A community channel asks first; the dialog takes the focus (Cancel, as in every confirm).
    const dialog = await screen.findByRole("dialog", { name: "Add Vitrazh?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Add channel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Subscribe is gone; its replacement, the Enabled switch, has the focus.
    await waitFor(() =>
      expect(within(content()).getByRole("switch", { name: "Enabled" })).toHaveFocus(),
    );
    expect(within(content()).queryByRole("button", { name: "Subscribe" })).toBeNull();
  });

  it("gives the focus back to Subscribe when the trust confirmation is cancelled", async () => {
    const { user } = await openChannel("vitrazh");
    button("Subscribe").focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Add Vitrazh?" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button("Subscribe")).toHaveFocus();
  });

  it("keeps Sync now busy and syncs once while it runs", async () => {
    const services = createTestServices();
    const sync = vi
      .spyOn(services.channels, "sync")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openChannel("kvetka", services);
    button("Sync now").focus();
    await user.keyboard("{Enter}");
    expect(button("Sync now")).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Enter}");
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("names the stale callout's actions", async () => {
    await openChannel("fossfriends");
    expect(button("Keep")).toBeInTheDocument();
    expect(within(content()).getAllByRole("button", { name: "Unsubscribe" })).toHaveLength(2);
    expectNamedControls();
  });
});
