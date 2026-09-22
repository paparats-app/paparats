import { render, screen } from "@testing-library/react";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  it("fills the steps up to the reached one and marks it current", () => {
    const { container } = render(
      <Timeline
        label="Progress"
        reached={1}
        steps={[
          { label: "Proposed", detail: "Alena K. · 4 September 2026" },
          { label: "In work", detail: "Nilesoft · 8 September 2026" },
          { label: "Released", detail: "Not yet" },
        ]}
      />,
    );
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.classList.contains("done"))).toEqual([true, true, false]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
    // Two connectors; only the one before the reached step is mint.
    expect(container.querySelectorAll(".connector")).toHaveLength(2);
    expect(container.querySelectorAll(".connectorDone")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Progress" }).style.gridTemplateColumns).toBe(
      "repeat(3, minmax(0, 1fr))",
    );
  });
});
