import { render, screen } from "@testing-library/react";
import { PageBanner } from "./PageBanner";

describe("PageBanner", () => {
  it("renders title, subtitle, motto, actions and extra content", () => {
    const { container } = render(
      <PageBanner
        title="Updates"
        subtitle="Keep your apps up to date."
        motto="Same tools. New possibilities."
        size="lg"
        actionsLayout="column"
        actions={<button type="button">Update all</button>}
      >
        <div>6 updates available</div>
      </PageBanner>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Updates" })).toBeInTheDocument();
    expect(screen.getByText("Keep your apps up to date.")).toBeInTheDocument();
    expect(screen.getByText("6 updates available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update all" })).toBeInTheDocument();
    const banner = container.firstElementChild as HTMLElement;
    expect(banner).toHaveClass("lg", "bleed");
    expect(banner.style.getPropertyValue("--photo")).toContain("hero-fern");
  });

  it("can render without bleed and with its own photo", () => {
    const { container } = render(
      <PageBanner title="Subscription" photo="sub.webp" bleed={false} />,
    );
    const banner = container.firstElementChild as HTMLElement;
    expect(banner).not.toHaveClass("bleed");
    expect(banner.style.getPropertyValue("--photo")).toContain("sub.webp");
  });

  it("wraps the motto at 220px, or 200px when narrow (Library)", () => {
    const { rerender } = render(<PageBanner title="Library" motto="Same tools." />);
    expect(screen.getByText("Same tools.")).not.toHaveClass("mottoNarrow");
    rerender(<PageBanner title="Library" motto="Same tools." narrowMotto />);
    expect(screen.getByText("Same tools.")).toHaveClass("motto", "mottoNarrow");
  });
});
