import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n";
import { FilterCheckOption, FilterGroup, FilterPanel, FilterRadioOptions } from "./FilterPanel";

describe("FilterPanel", () => {
  it("renders header, search and labelled groups", async () => {
    const onClearAll = vi.fn();
    const onSearch = vi.fn();
    const onCheck = vi.fn();
    const onSort = vi.fn();
    render(
      <FilterPanel onClearAll={onClearAll} search={{ value: "", onChange: onSearch }}>
        <FilterGroup label="Category">
          <FilterCheckOption label="Productivity" checked={false} onChange={onCheck} />
          <FilterCheckOption label="Development" checked onChange={onCheck} />
        </FilterGroup>
        <FilterGroup label="Price">
          <FilterCheckOption label="Free" checked disabled onChange={onCheck} />
        </FilterGroup>
        <FilterGroup label="Source">
          <FilterCheckOption
            label="Nilesoft"
            checked={false}
            onChange={onCheck}
            dot="#3b6fd1"
            count="2"
          />
        </FilterGroup>
        <FilterGroup label="Sort by">
          <FilterRadioOptions
            name="sort"
            value="featured"
            onChange={onSort}
            options={[
              { value: "featured", label: "Featured" },
              { value: "name", label: "A–Z" },
            ]}
          />
        </FilterGroup>
      </FilterPanel>,
    );
    const panel = screen.getByRole("complementary", { name: "Filters" });
    await userEvent.click(within(panel).getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search filters…" }), "p");
    expect(onSearch).toHaveBeenCalledWith("p");

    const category = screen.getByRole("group", { name: "Category" });
    await userEvent.click(within(category).getByRole("checkbox", { name: "Productivity" }));
    expect(onCheck).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Free" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Source" })).toHaveTextContent("Nilesoft2");

    const sort = screen.getByRole("radiogroup", { name: "Sort by" });
    await userEvent.click(within(sort).getByRole("radio", { name: "A–Z" }));
    expect(onSort).toHaveBeenCalledWith("name");
  });
});
