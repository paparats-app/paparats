import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CarouselDots } from "./CarouselDots";

describe("CarouselDots", () => {
  it("marks the current slide and selects another", async () => {
    const onSelect = vi.fn();
    render(
      <CarouselDots
        count={4}
        index={1}
        onSelect={onSelect}
        label="Featured slides"
        dotLabel={(i) => `Slide ${i + 1} of 4`}
        onImage
      />,
    );
    expect(screen.getByRole("group", { name: "Featured slides" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Slide 2 of 4" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Slide 2 of 4" }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Slide 4 of 4" }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
