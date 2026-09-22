import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders an h2 with a See all link", async () => {
    const onAction = vi.fn();
    render(<SectionHeader title="Featured apps" actionLabel="See all" onAction={onAction} />);
    expect(screen.getByRole("heading", { level: 2, name: "Featured apps" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See all" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("can show meta text instead of a link", () => {
    render(<SectionHeader title="Apps in this channel" level={3} meta="12 apps" />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.getByText("12 apps")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
