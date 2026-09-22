import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, type MenuEntry } from "./Menu";

function setup() {
  const onFavorite = vi.fn();
  const onFolder = vi.fn();
  const onUninstall = vi.fn();
  const items: MenuEntry[] = [
    { id: "fav", label: "Add to favorites", icon: "star", onSelect: onFavorite },
    { id: "folder", label: "Open install folder", icon: "folder", onSelect: onFolder },
    { id: "d1", type: "divider" },
    { id: "rm", label: "Uninstall", icon: "trash-2", destructive: true, onSelect: onUninstall },
  ];
  render(
    <div>
      <Menu
        label="Obsidian actions"
        items={items}
        renderTrigger={(props) => (
          <button type="button" aria-label="More" {...props}>
            ⋯
          </button>
        )}
      />
      <button type="button">Elsewhere</button>
    </div>,
  );
  return {
    onFavorite,
    onFolder,
    onUninstall,
    trigger: screen.getByRole("button", { name: "More" }),
  };
}

describe("Menu", () => {
  it("draws 15px item icons in the muted icon style (prototype line 609)", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    const icon = screen.getByRole("menuitem", { name: "Add to favorites" }).querySelector("svg");
    expect(icon).toHaveAttribute("width", "15");
    expect(icon).toHaveClass("icon");
  });

  it("opens on click with focus on the first item and selects", async () => {
    const { trigger, onUninstall } = setup();
    await userEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "Obsidian actions" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Add to favorites" })).toHaveFocus();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Uninstall" }));
    expect(onUninstall).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("is keyboard navigable", async () => {
    const { trigger, onFolder } = setup();
    trigger.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Uninstall" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Add to favorites" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onFolder).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape and on an outside press", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
