import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

type Theme = "light" | "dark" | "system";

function ThemeSwitch({ onChange }: { onChange: (v: Theme) => void }) {
  const [value, setValue] = useState<Theme>("dark");
  return (
    <SegmentedControl<Theme>
      label="Theme"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System", disabled: true },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("marks the active option and selects on click", async () => {
    const onChange = vi.fn();
    render(<ThemeSwitch onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });

  it("has a single tab stop and moves with arrows, skipping disabled options", async () => {
    const onChange = vi.fn();
    render(<ThemeSwitch onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    // "System" is disabled, so the focus wraps to "Light".
    expect(screen.getByRole("radio", { name: "Light" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("light");
  });

  it("supports icon-only options", () => {
    render(
      <SegmentedControl
        label="View"
        value="list"
        onChange={() => {}}
        ground="card"
        iconStrokeWidth={2}
        options={[
          { value: "list", icon: "list", ariaLabel: "List" },
          { value: "grid", icon: "layout-grid", ariaLabel: "Grid" },
        ]}
      />,
    );
    const grid = screen.getByRole("radio", { name: "Grid" });
    expect(grid).toHaveAttribute("tabindex", "-1");
    expect(grid.querySelector("svg")).toHaveAttribute("stroke-width", "2");
  });
});
