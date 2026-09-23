import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { CompactUpdatedRow } from "./CompactUpdatedRow";
import { LibraryGridCard } from "./LibraryGridCard";
import { LibraryRow } from "./LibraryRow";
import { NotableCard } from "./NotableCard";
import { NotableRow } from "./NotableRow";
import { UpdateRow } from "./UpdateRow";

const icon = { mono: "VS", tint: "#2f7fd6" };

describe("LibraryRow", () => {
  function renderRow(overrides: Partial<Parameters<typeof LibraryRow>[0]> = {}) {
    const handlers = {
      onOpen: vi.fn(),
      onToggleFavorite: vi.fn(),
      onOpenFolder: vi.fn(),
      onUninstall: vi.fn(),
    };
    render(
      <LibraryRow
        name="Visual Studio Code"
        icon={icon}
        tagline="Code editing. Redefined."
        tags={["Development", "MIT"]}
        status="1.92.2"
        statusSub="Update → 1.93.0"
        statusTone="mint"
        action={{ label: "Open" }}
        moreLabel="More actions"
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  }

  it("shows tags, status and the favourite star", () => {
    renderRow({ favorite: true });
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("Update → 1.93.0")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Favorites" })).toBeInTheDocument();
  });

  it("offers favourite, folder and uninstall in the overflow menu", async () => {
    const handlers = renderRow();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Add to favorites", "Open install folder", "Uninstall"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Uninstall" }));
    expect(handlers.onUninstall).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to favorites" }));
    expect(handlers.onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("labels the menu item for a favourite as removal and shows progress", async () => {
    renderRow({ favorite: true, progress: 40, action: { label: "40% · Pause", tone: "progress" } });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Remove from favorites" })).toBeInTheDocument();
  });
  it("opens the app from the icon tile, which is no control of its own", async () => {
    const { onOpen } = renderRow();
    const tile = document.querySelector(".tile");
    if (!(tile instanceof HTMLElement)) throw new Error("no tile");
    // Not a button, not in the tab order, hidden from assistive tech: the name button is the control.
    expect(tile.tagName).toBe("DIV");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile.tabIndex).toBe(-1);
    expect(tile).not.toHaveAttribute("tabindex");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).not.toContain("VS");
    await userEvent.click(tile);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(tile).not.toHaveFocus();
  });
});

describe("LibraryGridCard", () => {
  it("toggles the favourite and opens the app", async () => {
    const onToggleFavorite = vi.fn();
    const onOpen = vi.fn();
    render(
      <LibraryGridCard
        name="Obsidian"
        icon={icon}
        subtitle="1.8.9 · Updated yesterday"
        action={{ label: "Open" }}
        favorite
        onToggleFavorite={onToggleFavorite}
        onOpen={onOpen}
      />,
    );
    const star = screen.getByRole("button", { name: "Remove from favorites" });
    expect(star).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(star);
    await userEvent.click(screen.getByRole("button", { name: /Obsidian/ }));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateRow", () => {
  it("expands the release notes and links to the app", async () => {
    const onToggleExpanded = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = render(
      <UpdateRow
        name="Visual Studio Code"
        icon={icon}
        versionLine="1.92.2 → 1.93.0"
        sizeLabel="87 MB"
        action={{ label: "Update", tone: "primary" }}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        notes={["Improved performance", "Better Python support"]}
        onOpen={onOpen}
      />,
    );
    const toggle = screen.getByRole("button", { name: "View details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Improved performance")).toBeNull();
    await userEvent.click(toggle);
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    rerender(
      <UpdateRow
        name="Visual Studio Code"
        icon={icon}
        versionLine="1.92.2 → 1.93.0"
        sizeLabel="87 MB"
        action={{ label: "Update", tone: "primary" }}
        expanded
        onToggleExpanded={onToggleExpanded}
        notes={["Improved performance", "Better Python support"]}
        onOpen={onOpen}
      />,
    );
    const hide = screen.getByRole("button", { name: "Hide details" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(hide.getAttribute("aria-controls") ?? "")).toHaveTextContent(
      "Improved performance",
    );
    expect(screen.getByText("What’s new")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens the app from the icon tile, which is no control of its own", async () => {
    const onOpen = vi.fn();
    render(
      <UpdateRow
        name="Visual Studio Code"
        icon={icon}
        versionLine="1.92.2 → 1.93.0"
        sizeLabel="87 MB"
        action={{ label: "Update", tone: "primary" }}
        expanded={false}
        onToggleExpanded={() => {}}
        notes={[]}
        onOpen={onOpen}
      />,
    );
    const tile = document.querySelector(".tile");
    if (!(tile instanceof HTMLElement)) throw new Error("no tile");
    expect(tile.tagName).toBe("DIV");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).not.toHaveAttribute("tabindex");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).not.toContain("VS");
    await userEvent.click(tile);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(tile).not.toHaveFocus();
  });

  it("settles to a disabled 'Updated just now' when done", () => {
    render(
      <UpdateRow
        name="Obsidian"
        icon={icon}
        versionLine="1.8.10"
        sizeLabel="105 MB"
        action={{ label: "Update", tone: "primary" }}
        done
        expanded={false}
        onToggleExpanded={() => {}}
        notes={[]}
      />,
    );
    const button = screen.getByRole("button", { name: "Updated just now" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-tone", "quiet");
    expect(screen.queryByRole("button", { name: "Update" })).toBeNull();
  });

  it("shows the 3px bar while downloading", () => {
    render(
      <UpdateRow
        name="Obsidian"
        icon={icon}
        versionLine="Downloading… 43 %"
        sizeLabel="105 MB"
        action={{ label: "43% · Pause", tone: "progress" }}
        progress={43}
        expanded={false}
        onToggleExpanded={() => {}}
        notes={[]}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Obsidian" })).toHaveAttribute(
      "aria-valuenow",
      "43",
    );
  });
});

describe("compact rows", () => {
  it("CompactUpdatedRow joins version and date", async () => {
    const onClick = vi.fn();
    render(
      <CompactUpdatedRow
        name="ShareX"
        icon={icon}
        version="17.1.0"
        updated="Updated 5 days ago"
        action={{ label: "Get", onClick }}
      />,
    );
    expect(screen.getByText("17.1.0 · Updated 5 days ago")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Get" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("NotableRow and NotableCard open the app", async () => {
    const onOpen = vi.fn();
    render(
      <>
        <NotableRow
          name="LocalSend"
          icon={icon}
          tagline="Share files nearby"
          category="Utilities"
          action={{ label: "Get" }}
          onOpen={onOpen}
        />
        <NotableCard name="Czkawka" icon={icon} tagline="Find duplicates" onOpen={onOpen} />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: /LocalSend/ }));
    await userEvent.click(screen.getByRole("button", { name: /Czkawka/ }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Utilities")).toBeInTheDocument();
  });
});
