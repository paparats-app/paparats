import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders a static neutral tag", () => {
    render(<Chip>Productivity</Chip>);
    const chip = screen.getByText("Productivity").parentElement;
    expect(chip?.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("data-tone", "neutral");
  });

  it("draws the channel dot in the given tint", () => {
    const { container } = render(
      <Chip tone="outline" dot="#3b6fd1">
        Nilesoft
      </Chip>,
    );
    expect(container.querySelector("[aria-hidden='true']")).toHaveStyle({
      backgroundColor: "#3b6fd1",
    });
  });

  it("becomes a button when clickable", async () => {
    const onClick = vi.fn();
    render(
      <Chip tone="outline" onClick={onClick}>
        Winaero
      </Chip>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Winaero" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
