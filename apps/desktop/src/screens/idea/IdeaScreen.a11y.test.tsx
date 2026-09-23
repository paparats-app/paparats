// Idea page, keyboard only: the tab order (Back, vote, the composer; Post out of the way while it
// is empty), posting with the keyboard and its busy state, and in the developer view the release
// dialog taking the focus and giving it back.
import { act, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createTestServices } from "@/test/render";
import {
  content,
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const composer = () => screen.getByRole("textbox", { name: "Add to the discussion…" });
const post = () => screen.getByRole("button", { name: "Post" });

async function openIdea(services = createTestServices()) {
  const opened = await openScreen("/ideas/clip", services);
  await screen.findByRole("heading", { level: 1 });
  return opened;
}

describe("Idea a11y", () => {
  it("tabs Back → vote → composer; Post joins once there is text", async () => {
    const { user } = await openIdea();
    focusBeforeScreen();
    await expectTabOrder(user, [
      within(content()).getByRole("button", { name: "Ideas" }),
      within(content()).getByRole("button", { name: /votes?$/ }),
      composer(),
    ]);
    expect(post()).toBeDisabled();
    await user.keyboard("Pinned snippets would be great");
    expect(post()).toBeEnabled();
    await user.tab();
    expect(post()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Pinned snippets would be great")).toBeInTheDocument();
    expect(composer()).toHaveValue("");
    expect(post()).toBeDisabled();
    expectNamedControls();
  });

  it("shows Post busy and sends the comment once while it runs", async () => {
    const services = createTestServices();
    const comment = vi
      .spyOn(services.ideas, "comment")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openIdea(services);
    await user.click(composer());
    await user.keyboard("Twice?");
    await user.click(post());
    expect(post()).toHaveAttribute("aria-busy", "true");
    await user.click(post());
    expect(comment).toHaveBeenCalledTimes(1);
  });

  it("takes the idea and opens the release dialog with the keyboard (developer view)", async () => {
    const { user } = await openIdea();
    await act(async () => {
      await useSettingsStore.getState().update({ dev: true, viewAsDeveloper: true });
    });
    (await screen.findByRole("button", { name: "Take this idea" })).focus();
    await user.keyboard("{Enter}");
    // The focus follows to the button that replaces Take this idea.
    const mark = await screen.findByRole("button", { name: "Mark as released" });
    expect(mark).toHaveFocus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Release the idea" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expectNamedControls(dialog);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mark).toHaveFocus();
  });
});
