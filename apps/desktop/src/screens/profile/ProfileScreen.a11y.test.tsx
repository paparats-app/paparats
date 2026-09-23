// Profile, keyboard only: the tab order through the header into the tabs and the rows; the tabs
// move with the arrow keys; Edit → the Name field → Save (busy, saved once while it runs); the
// device buttons carry the device name.
import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createTestServices } from "@/test/render";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const tab = (name: string) => screen.getByRole("tab", { name });

async function openProfile(services = createTestServices()) {
  const opened = await openScreen("/profile", services);
  await screen.findByRole("button", { name: "Edit profile" });
  return opened;
}

describe("Profile a11y", () => {
  it("tabs through the header into the tabs and the account rows", async () => {
    const { user } = await openProfile();
    focusBeforeScreen();
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Change photo" }),
      screen.getByRole("button", { name: "Edit profile" }),
      tab("Account"),
      within(content()).getByRole("button", { name: /^Name/ }),
      within(content()).getByRole("button", { name: /^Email/ }),
    ]);
    expect(tab("Account")).toHaveAttribute("aria-selected", "true");
    expectNamedControls();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const { user } = await openProfile();
    tab("Account").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Preferences")).toHaveFocus();
    expect(tab("Preferences")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tab("Data & Privacy")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(tab("Devices")).toHaveAttribute("aria-selected", "true");
    // "Remove" names the device it removes.
    expect(within(content()).getByRole("button", { name: /^Remove / })).toBeInTheDocument();
    expectNamedControls();
  });

  it("edits with the keyboard; Save is busy and saves once while it runs", async () => {
    const services = createTestServices();
    const update = vi
      .spyOn(services.account, "updateProfile")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openProfile(services);
    screen.getByRole("button", { name: "Edit profile" }).focus();
    await user.keyboard("{Enter}");
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveFocus();
    await user.keyboard(" Jr");
    await user.keyboard("{Enter}");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Enter}");
    await user.click(save);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
