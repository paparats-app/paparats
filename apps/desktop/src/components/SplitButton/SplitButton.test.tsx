import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplitButton } from "./SplitButton";

describe("SplitButton", () => {
  it("routes clicks to the action and the secondary part", async () => {
    const onClick = vi.fn();
    const onSecondaryClick = vi.fn();
    render(
      <SplitButton
        label="Get"
        onClick={onClick}
        secondaryLabel="Details"
        onSecondaryClick={onSecondaryClick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Get" }));
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSecondaryClick).toHaveBeenCalledTimes(1);
  });

  it("exposes the tone, size and the secondary toggle state", () => {
    render(
      <SplitButton
        label="Update"
        tone="primary"
        size="lg"
        secondaryIcon="heart"
        secondaryLabel="Add to favorites"
        secondaryPressed
      />,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("data-tone", "primary");
    expect(group).toHaveAttribute("data-size", "lg");
    expect(screen.getByRole("button", { name: "Add to favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables only the action", async () => {
    const onClick = vi.fn();
    render(<SplitButton label="Offline" disabled onClick={onClick} secondaryLabel="Details" />);
    await userEvent.click(screen.getByRole("button", { name: "Offline" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Details" })).toBeEnabled();
  });
});
