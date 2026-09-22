import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

type Tab = "installed" | "favorites" | "collections";

function LibraryTabs({ onChange }: { onChange: (v: Tab) => void }) {
  const [value, setValue] = useState<Tab>("installed");
  return (
    <Tabs<Tab>
      label="Library"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      panelId={(v) => `panel-${v}`}
      items={[
        { value: "installed", label: "Installed", count: 12 },
        { value: "favorites", label: "Favorites", count: 3 },
        { value: "collections", label: "Collections", count: 4 },
      ]}
    />
  );
}

describe("Tabs", () => {
  it("selects on click and links the panel", async () => {
    const onChange = vi.fn();
    render(<LibraryTabs onChange={onChange} />);
    expect(screen.getByRole("tablist", { name: "Library" })).toBeInTheDocument();
    const installed = screen.getByRole("tab", { name: /Installed/ });
    expect(installed).toHaveAttribute("aria-selected", "true");
    expect(installed).toHaveAttribute("aria-controls", "panel-installed");
    expect(installed).toHaveTextContent("12");
    await userEvent.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(onChange).toHaveBeenCalledWith("favorites");
    expect(screen.getByRole("tab", { name: /Favorites/ })).toHaveAttribute("aria-selected", "true");
  });

  it("moves with arrows, Home and End", async () => {
    const onChange = vi.fn();
    render(<LibraryTabs onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: /Installed/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Collections/ })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("collections");
    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("installed");
    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("collections");
  });

  it("renders underline tabs with icons", () => {
    render(
      <Tabs
        variant="underline"
        label="Profile"
        value="account"
        onChange={() => {}}
        items={[
          { value: "account", label: "Account", icon: "user" },
          { value: "security", label: "Security", icon: "shield" },
        ]}
      />,
    );
    expect(
      screen.getByRole("tab", { name: "Security" }).querySelector('[data-icon="shield"]'),
    ).not.toBeNull();
  });
});
