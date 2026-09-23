import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { AppActionButton } from "./AppActionButton";
import { AppCard } from "./AppCard";

const icon = { mono: "Ob", tint: "#6f5bd8" };

describe("AppCard", () => {
  it("opens the app from the identity area and runs the action separately", async () => {
    const onOpen = vi.fn();
    const onClick = vi.fn();
    render(
      <AppCard
        name="Obsidian"
        icon={icon}
        tagline="Your knowledge, your way."
        category="Productivity"
        channel={{ name: "Nilesoft", tint: "#3b6fd1" }}
        action={{ label: "Get", tone: "neutral", onClick }}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Obsidian/ }));
    await userEvent.click(screen.getByRole("button", { name: "Get" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    // The category wraps like the prototype's inline-block chip; the channel chip keeps its
    // ellipsis.
    expect(screen.getByText("Productivity").parentElement).toHaveClass("wrap");
    expect(screen.getByText("Nilesoft").parentElement).not.toHaveClass("wrap");
  });

  it("renders the split variant with a secondary part", async () => {
    const onSecondary = vi.fn();
    render(
      <AppCard
        name="Shell"
        icon={icon}
        action={{ label: "Update", tone: "primary" }}
        secondary={{ label: "Details", onClick: onSecondary }}
      />,
    );
    expect(screen.getByRole("group")).toHaveAttribute("data-tone", "primary");
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("shows the 2px progress bar while busy", () => {
    render(
      <AppCard
        name="VLC"
        icon={icon}
        action={{ label: "43% · Pause", tone: "progress" }}
        progress={43.4}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "VLC" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
  });

  it("is one button with a pinned Pro pill when there is no action", async () => {
    const onOpen = vi.fn();
    render(
      <AppCard
        name="Krita"
        icon={icon}
        tagline="Brush engines, animation"
        proLabel="Pro"
        onOpen={onOpen}
      />,
    );
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-app-card", "link");
    expect(within(card).getByText("Pro")).toBeInTheDocument();
    await userEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("AppActionButton", () => {
  it("maps the tone and keeps busy states inert", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <AppActionButton action={{ label: "Update", tone: "primary", onClick }} />,
    );
    const button = screen.getByRole("button", { name: "Update" });
    expect(button).toHaveAttribute("data-variant", "primary");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <AppActionButton
        action={{ label: "Installing…", tone: "progress", disabled: true, onClick }}
      />,
    );
    const busy = screen.getByRole("button", { name: "Installing…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("data-tone", "progress");
    await userEvent.click(busy);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("AppActionButton offline", () => {
  it("reads the muted (Offline) action as unavailable but keeps it pressable", async () => {
    const onClick = vi.fn();
    render(<AppActionButton action={{ label: "Offline", tone: "muted", onClick }} />);
    const action = screen.getByRole("button", { name: "Offline" });
    expect(action).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("takes Queued out of the tab order", () => {
    render(<AppActionButton action={{ label: "Queued", tone: "quiet", disabled: true }} />);
    expect(screen.getByRole("button", { name: "Queued" })).toBeDisabled();
  });
});
