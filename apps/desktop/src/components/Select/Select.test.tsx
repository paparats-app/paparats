import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

type Sort = "recent" | "name" | "size";

describe("Select", () => {
  it("renders the options and reports the typed value", async () => {
    const onChange = vi.fn<(value: Sort) => void>();
    render(
      <Select<Sort>
        aria-label="Sort by"
        value="recent"
        onChange={onChange}
        options={[
          { value: "recent", label: "Recently used" },
          { value: "name", label: "A–Z" },
          { value: "size", label: "Size" },
        ]}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("recent");
    await userEvent.selectOptions(select, "Size");
    expect(onChange).toHaveBeenCalledWith("size");
  });

  it("can be disabled", () => {
    render(
      <Select
        aria-label="Parallel downloads"
        value="2"
        disabled
        onChange={() => {}}
        options={[
          { value: "1", label: "1" },
          { value: "2", label: "2" },
        ]}
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
