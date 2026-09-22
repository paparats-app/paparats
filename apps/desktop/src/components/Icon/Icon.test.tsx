import { render, screen } from "@testing-library/react";
import catalog from "@fixtures/catalog.json";
import library from "@fixtures/library.json";
import { Icon } from "./Icon";
import { ICON_NAMES, isIconName } from "./registry";

describe("Icon", () => {
  it("is decorative by default, with the design stroke", () => {
    const { container } = render(<Icon name="layout-grid" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
  });

  it("gets an accessible name when labelled", () => {
    render(<Icon name="search" size={18} strokeWidth={2} label="Search" />);
    const svg = screen.getByRole("img", { name: "Search" });
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke-width", "2");
  });

  it("draws a visible fallback for an unknown name", () => {
    const { container } = render(<Icon name="no-such-icon" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-missing-icon", "true");
  });

  it("resolves the legacy lucide spellings", () => {
    for (const name of ["home", "trash-2", "history"]) expect(isIconName(name)).toBe(true);
  });

  it("covers every icon named by the fixtures", () => {
    const named = [
      ...catalog.categories.map((c) => c.icon),
      ...catalog.collections.map((c) => c.icon),
      ...library.collections.map((c) => c.icon),
    ];
    expect(named.filter((n) => !isIconName(n))).toEqual([]);
  });

  it("covers every icon of the prototype's inline set (lucide names)", () => {
    const prototype = [
      "rss",
      "badge-check",
      "triangle-alert",
      "home",
      "layout-grid",
      "layers",
      "download",
      "book",
      "crown",
      "settings",
      "search",
      "user",
      "chevron-down",
      "chevron-up",
      "chevron-right",
      "chevron-left",
      "arrow-right",
      "check",
      "x",
      "ellipsis",
      "list",
      "laptop",
      "code",
      "palette",
      "play",
      "wrench",
      "leaf",
      "gamepad-2",
      "graduation-cap",
      "infinity",
      "zap",
      "heart",
      "users",
      "shield",
      "bell",
      "folder",
      "sliders-horizontal",
      "info",
      "lock",
      "monitor",
      "mail",
      "globe",
      "clock",
      "camera",
      "star",
      "refresh-cw",
      "external-link",
      "plus",
      "pencil",
      "briefcase",
      "minus",
      "square",
      "package",
      "hard-drive",
      "trash-2",
      "history",
      "wifi-off",
      "lightbulb",
      "chevrons-right",
      "message-square",
      "message-circle",
      "flag",
      "copy",
      "git-branch",
      "rotate-ccw",
      "circle-check",
      "pen-line",
    ];
    expect(prototype.filter((n) => !isIconName(n))).toEqual([]);
    expect(ICON_NAMES.length).toBeGreaterThan(prototype.length);
  });
});
