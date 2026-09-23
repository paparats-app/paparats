// Channel page, keyboard only: the tab order through the action row into the apps; Unsubscribe
// and Subscribe hand the focus to what replaces them; the Enabled/Paused switch reports its state;
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
    const { user } = await openChannel("nilesoft");
    focusBeforeScreen();
    const apps = screen.getByRole("region", { name: "Apps in this channel" });
    await expectTabOrder(user, [
      button("Back"),
      within(content()).getByRole("switch", { name: "Enabled" }),
      button("Unsubscribe"),
      button("Copy address"),
      button("Report a problem"),
      button("Sync now"),
      within(apps).getByRole("button", { name: /^Nilesoft Shell/ }),
    ]);
    expect(within(content()).getByRole("switch", { name: "Enabled" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expectNamedControls();
  });

  it("keeps the focus on the buttons that replace Unsubscribe and Subscribe", async () => {
    const { user } = await openChannel("nilesoft");
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

  it("keeps Sync now busy and syncs once while it runs", async () => {
    const services = createTestServices();
    const sync = vi
      .spyOn(services.channels, "sync")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openChannel("nilesoft", services);
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
