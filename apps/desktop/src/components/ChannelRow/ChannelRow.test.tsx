import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { ChannelRow } from "./ChannelRow";

const icon = { mono: "FF", tint: "#7a52c9" };

describe("ChannelRow", () => {
  it("settings row: trust badge, sync text, pause toggle and chevron", async () => {
    const onOpen = vi.fn();
    const onEnabledChange = vi.fn();
    const { container } = render(
      <ChannelRow
        name="FOSS Friends"
        icon={icon}
        trust="community"
        meta="Curated · by FOSS Friends · 3 apps"
        syncText="Unreachable for 16 days"
        unreachable
        enabled={false}
        onEnabledChange={onEnabledChange}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Unreachable for 16 days")).toHaveClass("syncWarn");
    expect(container.firstElementChild).toHaveAttribute("data-paused", "true");
    const toggle = screen.getByRole("switch", { name: "FOSS Friends" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
    const chevron = screen.getByRole("button", { name: "FOSS Friends" });
    // The chevron is the prototype's 16px glyph at stroke 2 (line 838).
    expect(chevron.querySelector("svg")).toHaveAttribute("stroke-width", "2");
    await userEvent.click(chevron);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("official row is 'Always on' and never paused", () => {
    render(
      <ChannelRow
        name="Paparats"
        icon={{ mono: "Pa", tint: "#1f6f52" }}
        trust="official"
        meta="Catalog · by Paparats"
        official
        enabled
        onEnabledChange={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("Always on")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows the stale callout with Keep / Unsubscribe", async () => {
    const onKeep = vi.fn();
    const onUnsubscribe = vi.fn();
    render(
      <ChannelRow
        name="FOSS Friends"
        icon={icon}
        trust="community"
        meta="Curated"
        enabled
        onEnabledChange={() => {}}
        onOpen={() => {}}
        stale={{ title: "FOSS Friends hasn’t answered for 16 days", onKeep, onUnsubscribe }}
      />,
    );
    expect(screen.getByText(/Installed apps keep working/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    await userEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("catalog row: Learn more + Subscribe", async () => {
    const onOpen = vi.fn();
    const onSubscribe = vi.fn();
    render(
      <ChannelRow
        variant="catalog"
        name="Winaero"
        icon={{ mono: "Wi", tint: "#c27a2f" }}
        trust="verified"
        meta="Developer · by Sergey Tkachenko"
        onOpen={onOpen}
        onSubscribe={onSubscribe}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Learn more" }));
    await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
