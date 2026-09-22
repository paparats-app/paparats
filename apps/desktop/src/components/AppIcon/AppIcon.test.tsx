import { fireEvent, render, screen } from "@testing-library/react";
import { AppIcon } from "./AppIcon";

describe("AppIcon", () => {
  it("renders the monogram on the tint", () => {
    render(<AppIcon mono="Ob" tint="#6f5bd8" size={56} label="Obsidian" />);
    const tile = screen.getByRole("img", { name: "Obsidian" });
    expect(tile).toHaveTextContent("Ob");
    expect(tile).toHaveStyle({ backgroundColor: "#6f5bd8" });
    expect(tile).toHaveAttribute("data-size", "56");
  });

  it("is decorative without a label", () => {
    const { container } = render(<AppIcon mono="Vs" tint="#2f7fd6" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the publisher icon and falls back to the monogram when it fails", () => {
    const { container, rerender } = render(
      <AppIcon mono="Kr" tint="#c94f8a" iconUrl="https://cdn.example/krita.png" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.example/krita.png");
    expect(container.firstElementChild).not.toHaveTextContent("Kr");

    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveTextContent("Kr");

    // A new URL gets its own chance.
    rerender(<AppIcon mono="Kr" tint="#c94f8a" iconUrl="https://cdn.example/krita-2.png" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/krita-2.png",
    );
  });
});
