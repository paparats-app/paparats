import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("toggles through its label", async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Productivity" />);
    const box = screen.getByRole("checkbox", { name: "Productivity" });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText("Productivity"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles with Space", async () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Design" />);
    await userEvent.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders the always-on state inert", async () => {
    const onChange = vi.fn();
    render(<Checkbox checked disabled onChange={onChange} label="Free" />);
    expect(screen.getByRole("checkbox", { name: "Free" })).toBeDisabled();
    await userEvent.click(screen.getByText("Free"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
