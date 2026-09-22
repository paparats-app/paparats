import { render, screen } from "@testing-library/react";
import { CountPill } from "./CountPill";

describe("CountPill", () => {
  it("shows the value in the solid tone by default", () => {
    render(<CountPill value={3} />);
    expect(screen.getByText("3")).toHaveAttribute("data-tone", "solid");
  });

  it("can carry an accessible description of the count", () => {
    render(<CountPill value={12} tone="soft" label="12 installed apps" />);
    expect(screen.getByRole("img", { name: "12 installed apps" })).toHaveTextContent("12");
  });
});
