import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "./Popover";

function Demo({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <div>
      <Popover
        label="Filters"
        onOpenChange={onOpenChange}
        renderTrigger={(props) => (
          <button type="button" {...props}>
            Open filters
          </button>
        )}
      >
        <button type="button">Inside</button>
      </Popover>
      <button type="button">Outside</button>
    </div>
  );
}

describe("Popover", () => {
  it("toggles from the trigger and wires aria-expanded / aria-controls", async () => {
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Open filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    const panel = screen.getByRole("dialog", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    await userEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a press outside", async () => {
    const onOpenChange = vi.fn();
    render(<Demo onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Open filters" }));
    await userEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Open filters" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Inside" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
