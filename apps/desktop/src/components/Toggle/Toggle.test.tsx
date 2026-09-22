import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle, ToggleTrack } from "./Toggle";

describe("Toggle", () => {
  it("is a switch that reports the next state", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Automatic updates" />);
    const toggle = screen.getByRole("switch", { name: "Automatic updates" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("works from the keyboard", async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Sound" />);
    await userEvent.tab();
    expect(screen.getByRole("switch")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("ignores input when disabled", async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Always on" disabled />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers the bare track for composite buttons", () => {
    const { container } = render(<ToggleTrack checked size="sm" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
