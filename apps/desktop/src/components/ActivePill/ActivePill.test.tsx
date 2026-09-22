import { render, screen } from "@testing-library/react";
import { ActivePill } from "./ActivePill";

describe("ActivePill", () => {
  it("renders the given label", () => {
    render(<ActivePill label="Active" size="md" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
