import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup } from "./Radio";

type Sort = "featured" | "newest" | "name";

function SortDemo({ onChange }: { onChange: (v: Sort) => void }) {
  const [value, setValue] = useState<Sort>("featured");
  return (
    <RadioGroup<Sort>
      name="sort"
      label="Sort by"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      options={[
        { value: "featured", label: "Featured" },
        { value: "newest", label: "Newest" },
        { value: "name", label: "A–Z" },
      ]}
    />
  );
}

describe("RadioGroup", () => {
  it("selects by click", async () => {
    const onChange = vi.fn();
    render(<SortDemo onChange={onChange} />);
    expect(screen.getByRole("radiogroup", { name: "Sort by" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Featured" })).toBeChecked();
    await userEvent.click(screen.getByText("Newest"));
    expect(onChange).toHaveBeenLastCalledWith("newest");
    expect(screen.getByRole("radio", { name: "Newest" })).toBeChecked();
  });

  it("moves with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<SortDemo onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Featured" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("newest");
  });
});
