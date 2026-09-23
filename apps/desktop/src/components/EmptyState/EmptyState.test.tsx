import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title, hint, icon and CTA", () => {
    render(
      <EmptyState
        icon="check"
        title="Everything is up to date"
        hint="Paparats checks for updates every hour in the background."
        action={<button type="button">Browse apps</button>}
        framed
      />,
    );
    expect(screen.getByText("Everything is up to date")).toBeInTheDocument();
    expect(screen.getByText(/checks for updates/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse apps" })).toBeInTheDocument();
    expect(document.querySelector('[data-icon="check"]')).not.toBeNull();
  });

  it("shows the decorative logo", () => {
    const { container } = render(<EmptyState logo title="Nothing found" size="md" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img?.getAttribute("src")).toMatch(/paparats-mark-light/);
  });

  it("lets the hint run the full width with wideHint", () => {
    render(<EmptyState title="Nothing found" hint="Try a shorter query." wideHint />);
    expect(screen.getByText("Try a shorter query.")).toHaveClass("hint", "wideHint");
  });
});
