import { render, screen } from "@testing-library/react";
import { ProgressBar, clampPercent } from "./ProgressBar";

describe("clampPercent", () => {
  it("clamps and rounds", () => {
    expect(clampPercent(-4)).toBe(0);
    expect(clampPercent(42.6)).toBe(43);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe("ProgressBar", () => {
  it("exposes the value and sizes the fill", () => {
    render(<ProgressBar value={43.2} height={4} label="Obsidian" />);
    const bar = screen.getByRole("progressbar", { name: "Obsidian" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
    expect(bar.firstElementChild).toHaveStyle({ width: "43%" });
  });
});
