import { render, screen } from "@testing-library/react";
import { StatTile } from "./StatTile";

describe("StatTile", () => {
  it("renders value, label and icon", () => {
    const { container } = render(<StatTile icon="package" value="12" label="Installed apps" />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Installed apps")).toBeInTheDocument();
    expect(container.querySelector('[data-icon="package"]')).not.toBeNull();
  });

  it("drops the icon in the compact variant", () => {
    const { container } = render(
      <StatTile variant="compact" icon="package" value="3" label="In work" />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});
