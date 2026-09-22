import { render, screen } from "@testing-library/react";
import { ProPill } from "./ProPill";

describe("ProPill", () => {
  it("renders the given label", () => {
    render(<ProPill label="Pro" variant="soft" />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});
